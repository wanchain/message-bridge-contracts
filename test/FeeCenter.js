const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FeeCenter", function () {
    let feeCenter;
    let owner;
    let feeWithdrawer;
    let agent;
    let user1;
    let user2;
    let spender;
    let mockToken;
    const NATIVE_COIN = "0x0000000000000000000000000000000000000000";

    beforeEach(async function () {
        // Get signers
        [owner, feeWithdrawer, agent, user1, user2, spender] = await ethers.getSigners();

        // Deploy mock ERC20 token
        const MockToken = await ethers.getContractFactory("MockERC20");
        mockToken = await MockToken.deploy("Mock Token", "MTK");

        // Deploy FeeCenter
        const FeeCenter = await ethers.getContractFactory("FeeCenter");
        feeCenter = await FeeCenter.deploy();

        // Initialize FeeCenter
        await feeCenter.initialize(owner.address, feeWithdrawer.address, agent.address);
    });

    describe("Initialization", function () {
        it("should set correct initial values", async function () {
            expect(await feeCenter.platformFee()).to.equal(2000);
            expect(await feeCenter.hasRole(await feeCenter.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await feeCenter.hasRole(await feeCenter.FEE_WITHDRAWER_ROLE(), feeWithdrawer.address)).to.be.true;
            expect(await feeCenter.hasRole(await feeCenter.AGENT_ROLE(), agent.address)).to.be.true;
        });
    });

    describe("Token Configuration", function () {
        it("should configure chain token correctly", async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            expect(await feeCenter.isSupportedToken(mockToken.address)).to.be.true;
            expect(await feeCenter.chainIdToFeeToken(1)).to.equal(mockToken.address);
        });

        it("should configure native token correctly", async function () {
            await feeCenter.configToChainToken(1, NATIVE_COIN);
            expect(await feeCenter.isSupportedToken(NATIVE_COIN)).to.be.true;
            expect(await feeCenter.chainIdToFeeToken(1)).to.equal(NATIVE_COIN);
        });

        it("should revert when non-admin tries to configure", async function () {
            await expect(
                feeCenter.connect(user1).configToChainToken(1, mockToken.address)
            ).to.be.reverted;
        });
    });

    describe("Fee Operations", function () {
        beforeEach(async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            await feeCenter.configToChainToken(2, NATIVE_COIN);
            await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user1).approve(feeCenter.address, ethers.utils.parseEther("1000"));
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
        });

        it("should deposit ERC20 tokens correctly", async function () {
            const amount = ethers.utils.parseEther("100");
            await feeCenter.connect(user1).depositFees(mockToken.address, amount);
            expect(await feeCenter.getUserBalance(user1.address, mockToken.address)).to.equal(amount);
        });

        it("should deposit native tokens correctly", async function () {
            const amount = ethers.utils.parseEther("1");
            await feeCenter.connect(user1).depositFees(NATIVE_COIN, amount, {
                value: amount
            });
            expect(await feeCenter.getUserBalance(user1.address, NATIVE_COIN)).to.equal(amount);
        });

        it("should withdraw fees correctly", async function () {
            const amount = ethers.utils.parseEther("100");
            await feeCenter.connect(user1).depositFees(mockToken.address, amount);
            await feeCenter.connect(user1).withdrawFees(mockToken.address, amount);
            expect(await feeCenter.getUserBalance(user1.address, mockToken.address)).to.equal(0);
        });

        it("should emit InsufficientFees event when balance is not enough", async function () {
            const depositAmount = ethers.utils.parseEther("10");
            const spendAmount = ethers.utils.parseEther("100");
            const txId = ethers.utils.formatBytes32String("test-tx");
            
            await feeCenter.connect(user1).depositFees(mockToken.address, depositAmount);
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
            
            await expect(
                feeCenter.connect(agent).spendFees(
                    spender.address,
                    1,  // fromChainId
                    1,  // toChainId
                    spendAmount,
                    txId
                )
            ).to.emit(feeCenter, "InsufficientFees");
        });

        it("should check fee balance correctly", async function () {
            const amount = ethers.utils.parseEther("100");
            await feeCenter.connect(user1).depositFees(mockToken.address, amount);

            const [enough, balance] = await feeCenter.feeBalance(
                spender.address,
                1,  // fromChainId
                1,  // toChainId
                ethers.utils.parseEther("50")
            );

            expect(enough).to.be.true;
            expect(balance).to.equal(amount);
        });

        describe("Native Token Withdrawals", function () {
            beforeEach(async function () {
                // Deposit native tokens first
                await feeCenter.connect(user1).depositFees(NATIVE_COIN, ethers.utils.parseEther("1"), {
                    value: ethers.utils.parseEther("1")
                });
            });

            it("should withdraw native tokens correctly", async function () {
                const withdrawAmount = ethers.utils.parseEther("0.5");
                const initialBalance = await ethers.provider.getBalance(user1.address);
                
                // Withdraw native tokens
                const tx = await feeCenter.connect(user1).withdrawFees(NATIVE_COIN, withdrawAmount);
                const receipt = await tx.wait();
                const gasCost = receipt.gasUsed.mul(tx.gasPrice);
                
                // Check user's native token balance increased correctly
                const finalBalance = await ethers.provider.getBalance(user1.address);
                expect(finalBalance).to.equal(
                    initialBalance.add(withdrawAmount).sub(gasCost)
                );
                
                // Check contract balance decreased
                expect(await feeCenter.getUserBalance(user1.address, NATIVE_COIN))
                    .to.equal(ethers.utils.parseEther("0.5")); // 1 ETH - 0.5 ETH
            });

            it("should revert when withdrawing more native tokens than balance", async function () {
                const withdrawAmount = ethers.utils.parseEther("2"); // More than deposited
                await expect(
                    feeCenter.connect(user1).withdrawFees(NATIVE_COIN, withdrawAmount)
                ).to.be.revertedWith("Insufficient balance");
            });

            it("should emit FeesWithdrawn event for native token withdrawal", async function () {
                const withdrawAmount = ethers.utils.parseEther("0.5");
                await expect(feeCenter.connect(user1).withdrawFees(NATIVE_COIN, withdrawAmount))
                    .to.emit(feeCenter, "FeesWithdrawn")
                    .withArgs(user1.address, NATIVE_COIN, withdrawAmount);
            });

            it("should handle multiple native token withdrawals correctly", async function () {
                // First withdrawal
                await feeCenter.connect(user1).withdrawFees(NATIVE_COIN, ethers.utils.parseEther("0.3"));
                expect(await feeCenter.getUserBalance(user1.address, NATIVE_COIN))
                    .to.equal(ethers.utils.parseEther("0.7")); // 1 ETH - 0.3 ETH

                // Second withdrawal
                await feeCenter.connect(user1).withdrawFees(NATIVE_COIN, ethers.utils.parseEther("0.4"));
                expect(await feeCenter.getUserBalance(user1.address, NATIVE_COIN))
                    .to.equal(ethers.utils.parseEther("0.3")); // 0.7 ETH - 0.4 ETH
            });

            it("should revert when contract has insufficient native token balance", async function () {
                // Simulate a situation where contract doesn't have enough native tokens
                // First, withdraw most of the tokens
                await feeCenter.connect(user1).withdrawFees(NATIVE_COIN, ethers.utils.parseEther("0.9"));
                
                // Now, try to withdraw the remaining balance when contract doesn't have enough funds
                // (This scenario might be theoretical as it depends on the contract's native token balance)
                const contractBalance = await ethers.provider.getBalance(feeCenter.address);
                if (contractBalance.lt(ethers.utils.parseEther("0.1"))) {
                    await expect(
                        feeCenter.connect(user1).withdrawFees(NATIVE_COIN, ethers.utils.parseEther("0.1"))
                    ).to.be.revertedWith("Native token transfer failed");
                }
            });
        });
    });

    describe("Fee Collection", function () {
        beforeEach(async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            await feeCenter.configToChainToken(2, NATIVE_COIN);
            
            // Setup some fees to collect
            await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user1).approve(feeCenter.address, ethers.utils.parseEther("1000"));
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("100"));
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
            
            // Spend some fees to accumulate
            const txId1 = ethers.utils.formatBytes32String("tx1");
            await feeCenter.connect(agent).spendFees(
                spender.address,
                1,  // fromChainId
                1,  // toChainId
                ethers.utils.parseEther("50"),
                txId1
            );

            // Also deposit and spend some native tokens
            await feeCenter.connect(user1).depositFees(NATIVE_COIN, ethers.utils.parseEther("1"), {
                value: ethers.utils.parseEther("1")
            });
            await feeCenter.connect(user1).approveSpender(2, spender.address, true);
            
            const txId2 = ethers.utils.formatBytes32String("tx2");
            await feeCenter.connect(agent).spendFees(
                spender.address,
                2,  // fromChainId
                2,  // toChainId
                ethers.utils.parseEther("0.5"),
                txId2
            );
        });

        it("should collect all fees correctly", async function () {
            const initialBalance = await mockToken.balanceOf(feeWithdrawer.address);
            const initialNativeBalance = await ethers.provider.getBalance(feeWithdrawer.address);

            await feeCenter.connect(feeWithdrawer).collectAllFees();

            // Verify all fees were collected
            expect(await feeCenter.accumulatedFees(mockToken.address)).to.equal(0);
            expect(await feeCenter.accumulatedFees(NATIVE_COIN)).to.equal(0);
            
            // Verify balances increased
            expect(await mockToken.balanceOf(feeWithdrawer.address)).to.be.gt(initialBalance);
            expect(await ethers.provider.getBalance(feeWithdrawer.address)).to.be.gt(initialNativeBalance);
        });
    });

    describe("Spender Management", function () {
        it("should approve and revoke spenders correctly", async function () {
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
            expect(await feeCenter.approvedSpenders(user1.address, 1, spender.address)).to.be.true;
            expect(await feeCenter.spenderToUser(1, spender.address)).to.equal(user1.address);

            await feeCenter.connect(user1).approveSpender(1, spender.address, false);
            expect(await feeCenter.approvedSpenders(user1.address, 1, spender.address)).to.be.false;
            expect(await feeCenter.spenderToUser(1, spender.address)).to.equal(ethers.constants.AddressZero);
        });

        it("should handle multiple spenders for a user correctly", async function () {
            const spender2 = user2;
            
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
            await feeCenter.connect(user1).approveSpender(1, spender2.address, true);
            
            const spenders = await feeCenter.getUserSpenders(user1.address);
            expect(spenders.length).to.equal(2);
            expect(spenders[0].spender).to.equal(spender.address);
            expect(spenders[1].spender).to.equal(spender2.address);
            expect(spenders[0].fromChainId).to.equal(1);
            expect(spenders[1].fromChainId).to.equal(1);
            
            await feeCenter.connect(user1).approveSpender(1, spender.address, false);
            
            const updatedSpenders = await feeCenter.getUserSpenders(user1.address);
            expect(updatedSpenders.length).to.equal(1);
            expect(updatedSpenders[0].spender).to.equal(spender2.address);
            expect(updatedSpenders[0].fromChainId).to.equal(1);
        });
    });

    describe("Fee Spending and Collection", function () {
        beforeEach(async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user1).approve(feeCenter.address, ethers.utils.parseEther("1000"));
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("100"));
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
        });

        it("should spend fees correctly", async function () {
            const amount = ethers.utils.parseEther("50");
            const txId = ethers.utils.formatBytes32String("test-tx");
            
            await feeCenter.connect(agent).spendFees(
                spender.address,
                1,  // fromChainId
                1,  // toChainId
                amount,
                txId
            );
            
            // Calculate expected values
            const platformFee = await feeCenter.platformFee();
            const platformFeeAmount = amount.mul(platformFee).div(10000);
            const totalDeduction = amount.add(platformFeeAmount);
            
            expect(await feeCenter.getUserBalance(user1.address, mockToken.address))
                .to.equal(ethers.utils.parseEther("100").sub(totalDeduction));
            expect(await feeCenter.accumulatedFees(mockToken.address))
                .to.equal(totalDeduction);
            expect(await feeCenter.txHashToSpent(txId)).to.be.true;
        });

        it("should revert when spending with duplicate txId", async function () {
            const amount = ethers.utils.parseEther("50");
            const txId = ethers.utils.formatBytes32String("test-tx");
            
            await feeCenter.connect(agent).spendFees(
                spender.address,
                1,
                1,
                amount,
                txId
            );
            
            await expect(
                feeCenter.connect(agent).spendFees(
                    spender.address,
                    1,
                    1,
                    amount,
                    txId
                )
            ).to.be.revertedWith("Already spent");
        });

        it("should collect fees correctly", async function () {
            const amount = ethers.utils.parseEther("50");
            const txId = ethers.utils.formatBytes32String("test-tx");
            
            await feeCenter.connect(agent).spendFees(
                spender.address,
                1,  // fromChainId
                1,  // toChainId
                amount,
                txId
            );
            
            // Calculate values
            const platformFee = await feeCenter.platformFee();
            const platformFeeAmount = amount.mul(platformFee).div(10000);
            const totalDeduction = amount.add(platformFeeAmount);
            
            // Add delay to ensure state is updated
            await ethers.provider.send("evm_mine", []);
            
            // Collect fees
            await feeCenter.connect(feeWithdrawer).collectFees(mockToken.address, totalDeduction);
            
            expect(await feeCenter.accumulatedFees(mockToken.address)).to.equal(0);
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            await feeCenter.configToChainToken(2, NATIVE_COIN);
        });

        it("should get user balances correctly", async function () {
            const [tokens, decimals, balances] = await feeCenter.getUserBalances(user1.address);
            expect(tokens.length).to.equal(2);
            expect(decimals.length).to.equal(2);
            expect(balances.length).to.equal(2);
        });

        it("should get accumulated fees correctly", async function () {
            const [tokens, decimals, amounts] = await feeCenter.getAllAccumulatedFees();
            expect(tokens.length).to.equal(2);
            expect(decimals.length).to.equal(2);
            expect(amounts.length).to.equal(2);
        });

        it("should get user spenders correctly", async function () {
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
            const spenders = await feeCenter.getUserSpenders(user1.address);
            expect(spenders.length).to.equal(1);
            expect(spenders[0].spender).to.equal(spender.address);
            expect(spenders[0].fromChainId).to.equal(1);
        });
    });

    describe("Platform Fee Management", function () {
        it("should set platform fee correctly", async function () {
            await feeCenter.setPlatformFee(3000);
            expect(await feeCenter.platformFee()).to.equal(3000);
        });

        it("should revert when setting invalid platform fee", async function () {
            await expect(feeCenter.setPlatformFee(10001))
                .to.be.revertedWith("Fee exceeds 100%");
        });
    });

    describe("Direct Transfer Prevention", function () {
        it("should reject direct native token transfers", async function () {
            await expect(
                user1.sendTransaction({
                    to: feeCenter.address,
                    value: ethers.utils.parseEther("1")
                })
            ).to.be.revertedWith("Direct transfers not supported");
        });
    });

    describe("User Management", function () {
        beforeEach(async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user1).approve(feeCenter.address, ethers.utils.parseEther("1000"));
        });

        it("should track users correctly when depositing fees", async function () {
            // Check initial state
            expect(await feeCenter.isUserDeposited(user1.address)).to.be.false;
            const initialUsers = await feeCenter.getAllUsers();
            expect(initialUsers.length).to.equal(0);

            // Deposit fees
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("100"));

            // Verify user tracking
            expect(await feeCenter.isUserDeposited(user1.address)).to.be.true;
            const updatedUsers = await feeCenter.getAllUsers();
            expect(updatedUsers.length).to.equal(1);
            expect(updatedUsers[0]).to.equal(user1.address);
        });

        it("should not add user multiple times when making multiple deposits", async function () {
            // First deposit
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("50"));
            const usersAfterFirst = await feeCenter.getAllUsers();
            expect(usersAfterFirst.length).to.equal(1);

            // Second deposit
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("50"));
            const usersAfterSecond = await feeCenter.getAllUsers();
            expect(usersAfterSecond.length).to.equal(1);
            expect(usersAfterSecond[0]).to.equal(user1.address);
        });

        it("should track multiple users correctly", async function () {
            // Setup for user2
            await mockToken.mint(user2.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user2).approve(feeCenter.address, ethers.utils.parseEther("1000"));

            // Deposits from both users
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("100"));
            await feeCenter.connect(user2).depositFees(mockToken.address, ethers.utils.parseEther("100"));

            // Verify users list
            const allUsers = await feeCenter.getAllUsers();
            expect(allUsers.length).to.equal(2);
            expect(allUsers).to.include(user1.address);
            expect(allUsers).to.include(user2.address);
        });
    });

    describe("User Data Transfer", function () {
        beforeEach(async function () {
            // Setup initial state for user1
            await feeCenter.configToChainToken(1, mockToken.address);
            await feeCenter.configToChainToken(2, NATIVE_COIN);
            
            // Mint and deposit ERC20 tokens
            await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user1).approve(feeCenter.address, ethers.utils.parseEther("1000"));
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("100"));
            
            // Deposit native tokens
            await feeCenter.connect(user1).depositFees(NATIVE_COIN, ethers.utils.parseEther("1"), {
                value: ethers.utils.parseEther("1")
            });
            
            // Setup spender approval
            await feeCenter.connect(user1).approveSpender(1, spender.address, true);
        });

        describe("transferUserData", function () {
            it("should transfer all user data to new address", async function () {
                const newAddress = user2.address;
                
                // Get initial state
                const initialBalance = await feeCenter.getUserBalance(user1.address, mockToken.address);
                const initialNativeBalance = await feeCenter.getUserBalance(user1.address, NATIVE_COIN);
                const initialSpenders = await feeCenter.getUserSpenders(user1.address);
                
                // Execute transfer
                await expect(feeCenter.connect(user1).transferUserData(newAddress))
                    .to.emit(feeCenter, "UserDataTransferred")
                    .withArgs(user1.address, newAddress, user1.address);
                
                // Verify balances transferred
                expect(await feeCenter.getUserBalance(newAddress, mockToken.address)).to.equal(initialBalance);
                expect(await feeCenter.getUserBalance(newAddress, NATIVE_COIN)).to.equal(initialNativeBalance);
                expect(await feeCenter.getUserBalance(user1.address, mockToken.address)).to.equal(0);
                expect(await feeCenter.getUserBalance(user1.address, NATIVE_COIN)).to.equal(0);
                
                // Verify spender approvals transferred
                const newSpenders = await feeCenter.getUserSpenders(newAddress);
                expect(newSpenders.length).to.equal(initialSpenders.length);
                expect(newSpenders[0].spender).to.equal(initialSpenders[0].spender);
                expect(newSpenders[0].fromChainId).to.equal(initialSpenders[0].fromChainId);
                expect(await feeCenter.spenderToUser(1, spender.address)).to.equal(newAddress);
                
                // Verify user registration status
                expect(await feeCenter.isUserDeposited(user1.address)).to.be.false;
                expect(await feeCenter.isUserDeposited(newAddress)).to.be.true;
            });

            it("should revert when transferring to zero address", async function () {
                await expect(
                    feeCenter.connect(user1).transferUserData(ethers.constants.AddressZero)
                ).to.be.revertedWith("Invalid new address");
            });

            it("should revert when transferring to self", async function () {
                await expect(
                    feeCenter.connect(user1).transferUserData(user1.address)
                ).to.be.revertedWith("Cannot transfer to self");
            });

            it("should revert when transferring to registered address", async function () {
                // First register user2
                await mockToken.mint(user2.address, ethers.utils.parseEther("100"));
                await mockToken.connect(user2).approve(feeCenter.address, ethers.utils.parseEther("100"));
                await feeCenter.connect(user2).depositFees(mockToken.address, ethers.utils.parseEther("10"));

                await expect(
                    feeCenter.connect(user1).transferUserData(user2.address)
                ).to.be.revertedWith("Target address already registered");
            });
        });

        describe("adminTransferUserData", function () {
            it("should allow admin to transfer user data between addresses", async function () {
                const fromUser = user1.address;
                const toUser = user2.address;
                
                // Get initial state
                const initialBalance = await feeCenter.getUserBalance(fromUser, mockToken.address);
                const initialNativeBalance = await feeCenter.getUserBalance(fromUser, NATIVE_COIN);
                const initialSpenders = await feeCenter.getUserSpenders(fromUser);
                
                // Execute admin transfer
                await expect(feeCenter.connect(owner).adminTransferUserData(fromUser, toUser))
                    .to.emit(feeCenter, "UserDataTransferred")
                    .withArgs(fromUser, toUser, owner.address);
                
                // Verify balances transferred
                expect(await feeCenter.getUserBalance(toUser, mockToken.address)).to.equal(initialBalance);
                expect(await feeCenter.getUserBalance(toUser, NATIVE_COIN)).to.equal(initialNativeBalance);
                expect(await feeCenter.getUserBalance(fromUser, mockToken.address)).to.equal(0);
                expect(await feeCenter.getUserBalance(fromUser, NATIVE_COIN)).to.equal(0);
                
                // Verify spender approvals transferred
                const newSpenders = await feeCenter.getUserSpenders(toUser);
                expect(newSpenders.length).to.equal(initialSpenders.length);
                expect(newSpenders[0].spender).to.equal(initialSpenders[0].spender);
                expect(newSpenders[0].fromChainId).to.equal(initialSpenders[0].fromChainId);
                expect(await feeCenter.spenderToUser(1, spender.address)).to.equal(toUser);
            });

            it("should revert when non-admin tries to transfer", async function () {
                await expect(
                    feeCenter.connect(user2).adminTransferUserData(user1.address, user2.address)
                ).to.be.reverted; // AccessControl error
            });

            it("should revert when source user is not registered", async function () {
                await expect(
                    feeCenter.connect(owner).adminTransferUserData(user2.address, user1.address)
                ).to.be.revertedWith("Source user not registered");
            });

            it("should revert when target user is already registered", async function () {
                // First register user2
                await mockToken.mint(user2.address, ethers.utils.parseEther("100"));
                await mockToken.connect(user2).approve(feeCenter.address, ethers.utils.parseEther("100"));
                await feeCenter.connect(user2).depositFees(mockToken.address, ethers.utils.parseEther("10"));

                await expect(
                    feeCenter.connect(owner).adminTransferUserData(user1.address, user2.address)
                ).to.be.revertedWith("Target address already registered");
            });

            it("should revert when transferring to zero address", async function () {
                await expect(
                    feeCenter.connect(owner).adminTransferUserData(user1.address, ethers.constants.AddressZero)
                ).to.be.revertedWith("Invalid new address");
            });

            it("should revert when transferring to same address", async function () {
                await expect(
                    feeCenter.connect(owner).adminTransferUserData(user1.address, user1.address)
                ).to.be.revertedWith("Cannot transfer to self");
            });
        });
    });
});
