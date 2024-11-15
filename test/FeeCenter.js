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
    });

    describe("Spender Management", function () {
        it("should approve and revoke spenders correctly", async function () {
            await feeCenter.connect(user1).approveSpender(spender.address, true);
            expect(await feeCenter.approvedSpenders(user1.address, spender.address)).to.be.true;
            expect(await feeCenter.spenderToUser(spender.address)).to.equal(user1.address);

            await feeCenter.connect(user1).approveSpender(spender.address, false);
            expect(await feeCenter.approvedSpenders(user1.address, spender.address)).to.be.false;
            expect(await feeCenter.spenderToUser(spender.address)).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("Fee Spending and Collection", function () {
        beforeEach(async function () {
            await feeCenter.configToChainToken(1, mockToken.address);
            await mockToken.mint(user1.address, ethers.utils.parseEther("1000"));
            await mockToken.connect(user1).approve(feeCenter.address, ethers.utils.parseEther("1000"));
            await feeCenter.connect(user1).depositFees(mockToken.address, ethers.utils.parseEther("100"));
            await feeCenter.connect(user1).approveSpender(spender.address, true);
        });

        it("should spend fees correctly", async function () {
            const amount = ethers.utils.parseEther("50");
            
            await feeCenter.connect(agent).spendFees(
                spender.address,
                1,  // fromChainId
                1,  // toChainId
                amount
            );
            
            // Calculate expected values
            const platformFee = await feeCenter.platformFee();
            const platformFeeAmount = amount.mul(platformFee).div(10000);
            const totalDeduction = amount.add(platformFeeAmount);
            
            expect(await feeCenter.getUserBalance(user1.address, mockToken.address))
                .to.equal(ethers.utils.parseEther("100").sub(totalDeduction));
            expect(await feeCenter.accumulatedFees(mockToken.address))
                .to.equal(totalDeduction);
        });

        it("should collect fees correctly", async function () {
            const amount = ethers.utils.parseEther("50");
            
            await feeCenter.connect(agent).spendFees(
                spender.address,
                1,  // fromChainId
                1,  // toChainId
                amount
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
            await feeCenter.connect(user1).approveSpender(spender.address, true);
            const spenders = await feeCenter.getUserSpenders(user1.address);
            expect(spenders.length).to.equal(1);
            expect(spenders[0]).to.equal(spender.address);
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
});
