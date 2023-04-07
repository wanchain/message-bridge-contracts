const { expect } = require("chai");
const { ethers } = require("hardhat");
const { keccak256, arrayify, abi, solidityPack, defaultAbiCoder } = ethers.utils;

function splitSignature(signature) {
  const r = signature.slice(0, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = "0x" + signature.slice(130, 132);
  return { r, s, v };
}

async function signMessage(privateKey, message) {
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
    mockMPC = await MockMPC.deploy();
    await wmbGateway.initialize(
      owner.address,
      '2153201998',
      mockMPC.address,
      mockMPC.address,
    );
    chainId = await wmbGateway.getChainId();
    console.log('chainId', chainId);
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
  

  describe("sendCustomMessage", function () {
    it("should send a custom message", async function () {
      const targetChainId = 123;
      const targetContract = "0x1234567890123456789012345678901234567890";
      const messageData = "0x12345678";
      const gasLimit = 200000;

      await wmbGateway.setSupportedDstChains([targetChainId], [true]);

      const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
      const value = fee + 100;

      const nonce = await wmbGateway.nonces(chainId, targetChainId, accounts[0], targetContract);

      await wmbGateway.sendCustomMessage(targetChainId, targetContract, messageData, gasLimit, {from: accounts[0], value: value});

      const filter = {
          address: wmbGateway.address,
          fromBlock: 0,
          toBlock: "latest",
          topics: [ethers.utils.id("MessageDispatchedExtended(bytes32,address,uint256,address,bytes,uint256)")]
      };

      const events = await ethers.provider.getLogs(filter);
      const event = events[0];
      const interface = new ethers.utils.Interface(WmbGateway.interface.fragments);
      const decodedEvent = interface.parseLog(event);

      expect(decodedEvent.args.toChainId).to.equal(targetChainId);
      expect(decodedEvent.args.to).to.equal(targetContract);
      expect(decodedEvent.args.from).to.equal(accounts[0]);
      expect(decodedEvent.args.data).to.equal(messageData);
      expect(decodedEvent.args.gasLimit).to.equal(gasLimit);

      await wmbGateway.sendCustomMessage(targetChainId, targetContract, messageData, gasLimit, {from: accounts[0], value: fee});
    });
  });


  describe("receiveMessage", function () {
    it.only("should receive a message", async function () {
      // Deploy dummy WmbReceiver contract
      const WmbReceiver = await ethers.getContractFactory("MockApp");
      const wmbReceiver = await WmbReceiver.deploy(
        accounts[0],
        wmbGateway.address,
        true,
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
  
      const smgID = "0x9876543210987654321098765432109876543210";
      const validatorPrivateKey = "0x1234567890123456789012345678901234567890123456789012345678901234";
  
      const sigHash = keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "uint256", "address", "uint256", "address", "bytes"],
          [messageId, sourceChainId, sourceContract, chainId, targetContract, messageData]
        )
      );
  
      const signature = await signMessage(validatorPrivateKey, sigHash);
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
      const receivedMessage = await wmbReceiver.messages(messageId);
      expect(receivedMessage).to.be.true;
    });
  });
  

  

  describe("estimateFee", function () {
    it("should estimate the correct fee", async function () {
      const targetChainId = 123;
      const gasLimit = 200000;

      // Then, set the base fee and check that the fee is updated accordingly
      const newBaseFee = 10000000000;
      await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);

      const newFee = await wmbGateway.estimateFee(targetChainId, gasLimit);
      const expectedNewFee = newBaseFee * gasLimit;

      expect(newFee).to.equal(expectedNewFee);
    });
  });

  describe("hasStoredFailedMessage", function () {
    it("should check if a failed message is stored", async function () {
      // Deploy dummy WmbReceiver contract
      const WmbReceiver = await ethers.getContractFactory("MockApp");
      const wmbReceiver = await WmbReceiver.deploy(
        accounts[0],
        wmbGateway.address,
        true,
      );
      await wmbReceiver.deployed();

      // Get nonce and fee
      const sourceChainId = 123;
      const sourceContract = "0x1234567890123456789012345678901234567890";
      const targetContract = wmbReceiver.address;
      const messageData = "0x12345678";
      const gasLimit = 200000;
      const nonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);

      await wmbReceiver.setTrustedRemotes([sourceChainId], [targetContract], [true]);

      // Create message ID and signature
      const messageId = ethers.utils.solidityKeccak256(
          ["uint256", "address", "uint256", "address", "bytes", "uint256"],
          [sourceChainId, sourceContract, chainId, targetContract, messageData, nonce + 1]
      );

      const sigData = {
          messageId,
          smgID: "0x1234567890123456789012345678901234567890123456789012345678901234",
          r: "0x1234567812345678123456781234567812345678123456781234567812345678",
          s: "0x1234567812345678123456781234567812345678123456781234567812345678",
      };

      // Receive message in WmbGateway contract
      let ret = await wmbGateway.receiveMessage(
          sourceChainId,
          sourceContract,
          targetContract,
          messageData,
          nonce + 1,
          gasLimit,
          sigData.smgID,
          sigData.r,
          sigData.s,
          { gasLimit: 500000 }
      );

      ret = await ret.wait();
      expect(ret.events.some(e => e.event === 'MessageStored')).to.be.true;

      let have = await wmbGateway.hasStoredFailedMessage(sourceChainId, sourceContract, targetContract);
      expect(have).to.be.true;

      // Verify that nonce is incremented
      const newNonce = await wmbGateway.getNonce(sourceChainId, chainId, sourceContract, targetContract);
      expect(newNonce).to.equal(nonce + 1);
    });
  });

  describe("retryFailedMessage", function () {
    it("should retry a failed message", async function () {
      // Deploy dummy WmbReceiver contract
      const WmbReceiver = await ethers.getContractFactory("MockApp");
      const wmbReceiver = await WmbReceiver.deploy(
        accounts[0],
        wmbGateway.address,
        true,
      );
      await wmbReceiver.deployed();

      // Get nonce and fee
      const sourceChainId = 123;
      const sourceContract = "0x1234567890123456789012345678901234567890";
      const targetContract = wmbReceiver.address;
      const messageData = "0x12345678";
      const gasLimit = 1_000_000;
      const nonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);

      await wmbReceiver.setTrustedRemotes([sourceChainId], [sourceContract], [true]);

      // Create message ID and signature
      const messageId = ethers.utils.solidityKeccak256(
          ["uint256", "address", "uint256", "address", "bytes", "uint256"],
          [sourceChainId, sourceContract, chainId, targetContract, messageData, nonce + 1]
      );

      const sigData = {
          messageId,
          smgID: "0x1234567890123456789012345678901234567890123456789012345678901234",
          r: "0x1234567812345678123456781234567812345678123456781234567812345678",
          s: "0x1234567812345678123456781234567812345678123456781234567812345678",
      };

      // Receive message in WmbGateway contract
      let ret = await wmbGateway.receiveMessage(
          sourceChainId,
          sourceContract,
          targetContract,
          messageData,
          nonce + 1,
          gasLimit,
          sigData.smgID,
          sigData.r,
          sigData.s,
          { gasLimit: gasLimit + 150_000 }
      );

      ret = await ret.wait();
      expect(ret.events.some(e => e.event === 'MessageStored')).to.be.true;
      
      let have = await wmbGateway.hasStoredFailedMessage(sourceChainId, sourceContract, targetContract);
      expect(have).to.be.true;

      // Verify that nonce is incremented
      const newNonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);
      expect(newNonce).to.equal(nonce + 1);

      // Retry message
      ret = await wmbGateway.retryFailedMessage(sourceChainId, sourceContract, targetContract, messageData, { gasLimit: 5_000_000 });
      ret = await ret.wait();

      expect(ret.events.some(e => e.event === 'MessageCleared')).to.be.true;

      // Verify that message was delivered to the WmbReceiver contract
      const receivedMessage = await wmbReceiver.receivedMessages(messageId);
      expect(receivedMessage.data).to.equal(messageData);
      expect(receivedMessage.fromChainId).to.equal(sourceChainId);
      expect(receivedMessage.from).to.equal(sourceContract);
    });
  });

  describe("forceResumeReceive", function () {
    it("should force resumption of a failed message's receipt", async function () {
      // Deploy dummy WmbReceiver contract
      const WmbReceiver = await ethers.getContractFactory("MockApp");
      const wmbReceiver = await WmbReceiver.deploy(
        accounts[0],
        wmbGateway.address,
        true,
      );
      await wmbReceiver.deployed();

      // Get nonce and fee
      const sourceChainId = 123;
      const sourceContract = "0x1234567890123456789012345678901234567890";
      const targetContract = wmbReceiver.address;
      const messageData = "0x12345678";
      const gasLimit = 1_000_000;
      const nonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);

      await wmbReceiver.setTrustedRemotes([sourceChainId], [sourceContract], [true]);

      // Create message ID and signature
      const messageId = ethers.utils.solidityKeccak256(
          ["uint256", "address", "uint256", "address", "bytes", "uint256"],
          [sourceChainId, sourceContract, chainId, targetContract, messageData, nonce + 1]
      );
      
      const sigData = {
          messageId,
          smgID: "0x1234567890123456789012345678901234567890123456789012345678901234",
          r: "0x1234567812345678123456781234567812345678123456781234567812345678",
          s: "0x1234567812345678123456781234567812345678123456781234567812345678",
      };

      // Receive message in WmbGateway contract
      let ret = await wmbGateway.receiveMessage(
          sourceChainId,
          sourceContract,
          targetContract,
          messageData,
          nonce + 1,
          gasLimit,
          sigData.smgID,
          sigData.r,
          sigData.s,
          { gasLimit: gasLimit + 150_000 }
      );

      ret = await ret.wait();
      expect(ret.events.some(e => e.event === 'MessageStored')).to.be.true;
      
      let have = await wmbGateway.hasStoredFailedMessage(sourceChainId, sourceContract, targetContract);
      expect(have).to.be.true;

      ret = await wmbReceiver.forceResumeReceive(
        sourceChainId,
        sourceContract,
      );

      ret = await ret.wait();
      const interface = new ethers.utils.Interface(WmbGateway.interface.fragments);
      const decodedEvent = interface.parseLog(ret.events[0]);
      expect(decodedEvent.name === 'MessageResumeReceive').to.be.true;
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
        const defaultGasLimit = 50000;
    
        await wmbGateway.setGasLimit(maxGasLimit, minGasLimit, defaultGasLimit);
    
        const actualMaxGasLimit = await wmbGateway.maxGasLimit();
        expect(actualMaxGasLimit).to.equal(maxGasLimit, "Failed to set max gas limit");
    
        const actualMinGasLimit = await wmbGateway.minGasLimit();
        expect(actualMinGasLimit).to.equal(minGasLimit, "Failed to set min gas limit");
    
        const actualDefaultGasLimit = await wmbGateway.defaultGasLimit();
        expect(actualDefaultGasLimit).to.equal(defaultGasLimit, "Failed to set default gas limit");
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
    
        const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
        const value = fee;
      
        await wmbGateway.sendMessage(targetChainId, targetContract, messageData, gasLimit, {from: accounts[0], value: value});
    
        
        const recipient = accounts[1];
    
        const balanceBefore = await ethers.provider.getBalance(recipient);
    
        await wmbGateway.withdrawFee(recipient);
    
        const balanceAfter = await ethers.provider.getBalance(recipient);
    
        expect(balanceAfter).to.equal(balanceBefore.add(fee), "Failed to withdraw fee");
      });
    });
    
  });

  describe("EIP-5164 Functions", function () {
    describe("dispatchMessage", function () {
      it("should dispatch a message", async function () {
        const targetChainId = 123;
        const targetContract = "0x1234567890123456789012345678901234567890";
        const messageData = "0x12345678";
        const gasLimit = await wmbGateway.defaultGasLimit();
        const newBaseFee = 10000000000;
        await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);
        const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
        const value = fee;
        const balanceBefore = await ethers.provider.getBalance(wmbGateway.address);
        
        const tx = await wmbGateway.dispatchMessage(targetChainId, targetContract, messageData, {value: value});
        await tx.wait();
    
        const balanceAfter = await ethers.provider.getBalance(wmbGateway.address);
        
        expect(balanceAfter).to.equal(balanceBefore.add(value), "Failed to dispatch message");
      });
    });
    
    describe("dispatchMessageBatch", function () {
      it("should dispatch a batch of messages", async function () {
        const targetChainId = 123;
        const targetContract1 = "0x1234567890123456789012345678901234567890";
        const targetContract2 = "0x0987654321098765432109876543210987654321";
        const messageData1 = "0x12345678";
        const messageData2 = "0x87654321";
        const gasLimit = await wmbGateway.defaultGasLimit();
        const newBaseFee = 10000000000;
        await wmbGateway.batchSetBaseFees([targetChainId], [newBaseFee]);
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
    
    
  });
});
