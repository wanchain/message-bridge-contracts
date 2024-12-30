const { expect } = require("chai");
const { ethers } = require("hardhat");
const { keccak256, arrayify, abi, solidityPack, defaultAbiCoder } = ethers.utils;

function splitSignature(signature) {
  const r = signature.slice(0, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = "0x" + signature.slice(130, 132);
  return { r, s, v };
}

function signMessage(privateKey, message) {
  const signingKey = new ethers.utils.SigningKey(privateKey);
  const sig = signingKey.signDigest(ethers.utils.arrayify(message));
  return ethers.utils.joinSignature(sig);
}

describe("WmbGateway", function () {
  let WmbGateway, wmbGateway, mockMPC, owner, addr1, addr2, chainId, accounts;

  beforeEach(async function () {
    WmbGateway = await ethers.getContractFactory("WmbGateway");
    [owner, addr1, addr2] = await ethers.getSigners();
    accounts = await ethers.getSigners();
    accounts = accounts.map((account) => account.address);
    wmbGateway = await WmbGateway.deploy();
    await wmbGateway.deployed();
    let MockMPC = await ethers.getContractFactory("MockMPC");
    mockMPC = await MockMPC.deploy('2153201998');
    await wmbGateway.initialize(
      owner.address,
      mockMPC.address,
    );
    chainId = await wmbGateway.chainId();
  });

  describe("Deployment", function () {
    it("should set the correct state variables", async function () {
      // Check if owner is set correctly
      const ret = await wmbGateway.hasRole(await wmbGateway.DEFAULT_ADMIN_ROLE(), owner.address);
      expect(ret).to.equal(true);
  
      // Check if chainId is set correctly
      const chainId = await wmbGateway.chainId();
      expect(chainId).to.equal('2153201998');
  
      // Check if messagePool is set correctly
      const signatureVerifier = await wmbGateway.signatureVerifier();
      expect(signatureVerifier).to.equal(mockMPC.address);
  
      // Check if failedMessages is set correctly
      const wanchainStoremanAdminSC = await wmbGateway.wanchainStoremanAdminSC();
      expect(wanchainStoremanAdminSC).to.equal(mockMPC.address);
    });
  });

  describe("EIP-5164 Functions", function () {
    describe("dispatchMessage", function () {
      it("should dispatch a message", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = 200000;
        const newBaseFee = 10000000000;
        await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);

        const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
        const value = fee;
        const balanceBefore = await ethers.provider.getBalance(wmbGateway.address);
        
        const tx = await wmbGateway.dispatchMessage(targetChainId, targetContract, messageData, {value: value});
        await tx.wait();
    
        const balanceAfter = await ethers.provider.getBalance(wmbGateway.address);
        
        expect(balanceAfter).to.equal(balanceBefore.add(value), "Failed to dispatch message");
      });

      it("should use defaultGasLimit when baseFee is zero", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        
        // Enable the destination chain but don't set a base fee (keeping it at 0)
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);
        
        // Get the default gas limit from the contract
        const defaultGasLimit = await wmbGateway.defaultGasLimit();
        
        // When baseFee is 0:
        // minGasLimit * baseFees[toChainId] = 0
        // maxGasLimit * baseFees[toChainId] = 0
        // So msg.value should be 0 to satisfy both conditions
        const tx = await wmbGateway.dispatchMessage(
          targetChainId, 
          targetContract, 
          messageData,
          { value: 0 } // Send zero value since baseFee is 0
        );
        const receipt = await tx.wait();

        // Find the MessageDispatched event
        const event = receipt.events?.find(e => e.event === "MessageDispatched");
        expect(event).to.not.be.undefined;
        
        // Get the messageId from the event
        const messageId = event.args.messageId;
        
        // Verify that the gas limit stored matches the default gas limit
        const storedGasLimit = await wmbGateway.messageGasLimit(messageId);
        expect(storedGasLimit).to.equal(defaultGasLimit);
      });
    });
    
    describe("dispatchMessageBatch", function () {
      it("should dispatch a batch of messages", async function () {
        const targetChainId = 123;
        const targetContract1 = "0x1234567890123456789012345678901234567890";
        const targetContract2 = "0x0987654321098765432109876543210987654321";
        const messageData1 = "0x12345678";
        const messageData2 = "0x87654321";
        const gasLimit = 1000000;
        const newBaseFee = 10000000000;
        await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);

        const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
        const value = fee.mul(2); // Since we are sending two messages in the batch
        const balanceBefore = await ethers.provider.getBalance(wmbGateway.address);
    
        const messages = [
          {to: targetContract1, data: messageData1},
          {to: targetContract2, data: messageData2}
        ];
    
        let tx = await wmbGateway.dispatchMessageBatch(targetChainId, messages, {value: value});
        tx = await tx.wait();

        const balanceAfter = await ethers.provider.getBalance(wmbGateway.address);
    
        expect(balanceAfter).to.equal(balanceBefore.add(value), "Failed to dispatch message batch");
      });
    });
    
    describe("dispatchMessageV2", function () {
      it("should dispatch a message with specified gas limit", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = 200000;
        
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);

        const tx = await wmbGateway.dispatchMessageV2(
          targetChainId,
          targetContract,
          gasLimit,
          messageData
        );
        const receipt = await tx.wait();

        // Find the MessageDispatchedV2 event
        const event = receipt.events?.find(e => e.event === "MessageDispatchedV2");
        expect(event).to.not.be.undefined;
        
        // Verify event parameters
        expect(event.args.sender).to.equal(owner.address);
        expect(event.args.toChainId).to.equal(targetChainId);
        expect(event.args.to).to.equal(targetContract);
        expect(event.args.gasLimit).to.equal(gasLimit);
        expect(event.args.data).to.equal(messageData);

        // Verify gas limit was stored
        const messageId = event.args.messageId;
        const storedGasLimit = await wmbGateway.messageGasLimit(messageId);
        expect(storedGasLimit).to.equal(gasLimit);
      });

      it("should revert when destination chain is not supported", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = 200000;

        await expect(
          wmbGateway.dispatchMessageV2(targetChainId, targetContract, gasLimit, messageData)
        ).to.be.revertedWith("WmbGateway: Unsupported destination chain");
      });

      it("should revert when gas limit exceeds maximum", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = 9000000; // Higher than maxGasLimit (8_000_000)
        
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);

        await expect(
          wmbGateway.dispatchMessageV2(targetChainId, targetContract, gasLimit, messageData)
        ).to.be.revertedWith("WmbGateway: Gas limit exceeds maximum");
      });

      it("should revert when gas limit is below minimum", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = 100000; // Lower than minGasLimit (150_000)
        
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);

        await expect(
          wmbGateway.dispatchMessageV2(targetChainId, targetContract, gasLimit, messageData)
        ).to.be.revertedWith("WmbGateway: Gas limit too low");
      });
    });
    
  });
  
  describe("receiveMessage", function () {
    it("should receive a message", async function () {
      // Deploy dummy WmbReceiver contract
      const WmbReceiver = await ethers.getContractFactory("MockApp");
      const wmbReceiver = await WmbReceiver.deploy(
        accounts[0],
        wmbGateway.address
      );
      await wmbReceiver.deployed();

  
      // Get nonce and fee
      const sourceChainId = 123;
      const sourceContract = "0x1234567890123456789012345678901234567890";
      const targetContract = wmbReceiver.address;
      const messageData = "0x12345678";
      const gasLimit = 2_000_000;
      const messageId = keccak256(
        solidityPack(
          ["uint256", "address", "uint256", "address", "bytes", "uint256"],
          [sourceChainId, sourceContract, chainId, targetContract, messageData, 1]
        )
      );
  
      const smgID = "0x1234567890123456789012345678901234567890123456789012345678901234";
      const validatorPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
  
      const sigHash = keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "uint256", "address", "uint256", "address", "bytes"],
          [messageId, sourceChainId, sourceContract, chainId, targetContract, messageData]
        )
      );
  
      const signature = signMessage(validatorPrivateKey, sigHash);
      const { r, s, v } = splitSignature(signature);
  
      await wmbReceiver.setTrustedRemotes([sourceChainId], [sourceContract], [true]);
  
      // Call receiveMessage
      await wmbGateway.receiveMessage(
        messageId,
        sourceChainId,
        sourceContract,
        targetContract,
        messageData,
        gasLimit,
        smgID,
        r,
        s
      );
  
      // Verify the message was received
      const receivedMessage = await wmbReceiver.receivedMessages(messageId);
      expect(receivedMessage.messageId).to.equal(messageId);
      expect(receivedMessage.data).to.equal(messageData);
      expect(receivedMessage.fromChainId).to.equal(sourceChainId);
      expect(receivedMessage.from).to.equal(sourceContract);
    });
  });
  
  describe("receiveBatchMessage", function () {
    it("should receive a batch of messages", async function () {
      // Deploy dummy WmbReceiver contract
      const WmbReceiver = await ethers.getContractFactory("MockApp");
      const wmbReceiver = await WmbReceiver.deploy(
        accounts[0],
        wmbGateway.address
      );
      await wmbReceiver.deployed();
  
      // Prepare batch of messages
      const batchSize = 3;
      const sourceChainId = 123;
      const sourceContract = "0x1234567890123456789012345678901234567890";
      const gasLimit = 2_000_000;
      let messages = [];
      for (let i = 0; i < batchSize; i++) {
        const targetContract = wmbReceiver.address;
        const messageData = `0x1234567${i}`;
  
        messages.push({
          to: targetContract,
          data: messageData,
        });
      }
  
      const messageId = keccak256(
        solidityPack(
          ["uint256", "address", "uint256", "address", "bytes"],
          [sourceChainId, sourceContract, chainId, wmbReceiver.address, defaultAbiCoder.encode(['tuple(address to, bytes data)[]'], [messages])]
        )
      );
  
      const smgID = "0x1234567890123456789012345678901234567890123456789012345678901234";
      const validatorPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
  
      const sigHash = keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "uint256", "address", "uint256", "tuple(address to, bytes data)[]"],
          [messageId, sourceChainId, sourceContract, chainId, messages]
        )
      );
  
      const signature = signMessage(validatorPrivateKey, sigHash);
      const { r, s, v } = splitSignature(signature);
  
      await wmbReceiver.setTrustedRemotes([sourceChainId], [sourceContract], [true]);
  
      // Call receiveBatchMessage
      await wmbGateway.receiveBatchMessage(
        messageId,
        sourceChainId,
        sourceContract,
        messages,
        gasLimit,
        smgID,
        r,
        s
      );
  
      // Verify the messages were received
      const receivedMessage = await wmbReceiver.receivedMessages(messageId);
      expect(receivedMessage.messageId).to.equal(messageId);
      expect(receivedMessage.data).to.equal(messages[2].data);
      expect(receivedMessage.fromChainId).to.equal(sourceChainId);
      expect(receivedMessage.from).to.equal(sourceContract);
    });
  });

  describe("estimateFee", function () {
    it("should estimate the correct fee", async function () {
      const targetChainId = 123;
      const gasLimit = 200000;

      // Then, set the base fee and check that the fee is updated accordingly
      const newBaseFee = 10000000000;
      await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);
      await wmbGateway.setSupportedDstChains([targetChainId], [true]);

      let newFee = await wmbGateway.estimateFee(targetChainId, gasLimit);
      let expectedNewFee = newBaseFee * gasLimit;
      expect(newFee).to.equal(expectedNewFee);

      let min = await wmbGateway.minGasLimit();

      newFee = await wmbGateway.estimateFee(targetChainId, 0);
      expectedNewFee = newBaseFee * min;

      expect(newFee).to.equal(expectedNewFee);
    });
  });

  describe("Admin Functions", function () {
    describe("batchSetBaseFees", function () {
      it("should set base fees", async function () {
        const targetChainIds = [1, 2, 3];
        const baseFees = [100, 200, 300];
    
        await wmbGateway.batchSetBaseFees(targetChainIds, baseFees);
    
        for (let i = 0; i < targetChainIds.length; i++) {
          const targetChainId = targetChainIds[i];
          const expectedBaseFee = baseFees[i];
          const actualBaseFee = await wmbGateway.baseFees(targetChainId);
          expect(actualBaseFee).to.equal(expectedBaseFee, `Failed to set base fee for target chain ID ${targetChainId}`);
        }
      });
    });
    
    describe("setSignatureVerifier", function () {
      it("should set the signature verifier", async function () {
        const signatureVerifier = accounts[1];
    
        await wmbGateway.setSignatureVerifier(signatureVerifier);
    
        const actualSignatureVerifier = await wmbGateway.signatureVerifier();
        expect(actualSignatureVerifier).to.equal(signatureVerifier, "Failed to set signature verifier");
      });
    });
    
    describe("setGasLimit", function () {
      it("should set the gas limit", async function () {
        const maxGasLimit = 1000000;
        const minGasLimit = 1000;
        const defaultGasLimit = 2000000;
    
        await wmbGateway.setGasLimit(maxGasLimit, minGasLimit, defaultGasLimit);
    
        const actualMaxGasLimit = await wmbGateway.maxGasLimit();
        expect(actualMaxGasLimit).to.equal(maxGasLimit, "Failed to set max gas limit");
    
        const actualMinGasLimit = await wmbGateway.minGasLimit();
        expect(actualMinGasLimit).to.equal(minGasLimit, "Failed to set min gas limit");
      });
    });
    
    describe("setMaxMessageLength", function () {
      it("should set the max message length", async function () {
        const maxMessageLength = 1024;
    
        await wmbGateway.setMaxMessageLength(maxMessageLength);
    
        const actualMaxMessageLength = await wmbGateway.maxMessageLength();
        expect(actualMaxMessageLength).to.equal(maxMessageLength, "Failed to set max message length");
      });
    });
    
    describe("withdrawFee", function () {
      it("should withdraw fee", async function () {
    
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = 200000;
        const newBaseFee = 10000000000;
        await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);
        await wmbGateway.setSupportedDstChains([targetChainId], [true]);
    
        const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
        const value = fee;
      
        await wmbGateway.dispatchMessage(targetChainId, targetContract, messageData, {from: accounts[0], value: value});
        
        const recipient = accounts[1];
    
        const balanceBefore = await ethers.provider.getBalance(recipient);
    
        await wmbGateway.withdrawFee(recipient);
    
        const balanceAfter = await ethers.provider.getBalance(recipient);
    
        expect(balanceAfter).to.equal(balanceBefore.add(fee), "Failed to withdraw fee");
      });
    });
    
  });


});
