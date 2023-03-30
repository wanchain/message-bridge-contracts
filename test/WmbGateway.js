const { expect } = require("chai");
const { ethers } = require("hardhat");

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
  

  describe("sendMessage", function () {
    it("should send a message", async function () {
      const targetChainId = 123;
      const targetContract = "0x1234567890123456789012345678901234567890";
      const messageData = "0x12345678";
      const gasLimit = 200000;

      const fee = await wmbGateway.estimateFee(targetChainId, gasLimit);
      const value = fee + 100;

      const nonce = await wmbGateway.nonces(chainId, targetChainId, accounts[0], targetContract);

      await wmbGateway.sendMessage(targetChainId, targetContract, messageData, gasLimit, {from: accounts[0], value: value});

      const filter = {
          address: wmbGateway.address,
          fromBlock: 0,
          toBlock: "latest",
          topics: [ethers.utils.id("MessageSent(address,uint256,address,uint256,bytes,uint256,uint256,bytes32)")]
      };

      const events = await ethers.provider.getLogs(filter);
      const event = events[0];
      const interface = new ethers.utils.Interface(WmbGateway.interface.fragments);
      const decodedEvent = interface.parseLog(event);

      expect(decodedEvent.args.targetChainId).to.equal(targetChainId);
      expect(decodedEvent.args.targetContract).to.equal(targetContract);
      expect(decodedEvent.args.sourceChainId).to.equal(chainId);
      expect(decodedEvent.args.messageData).to.equal(messageData);
      expect(decodedEvent.args.nonce).to.equal(nonce+1);
      expect(decodedEvent.args.gasLimit).to.equal(gasLimit);

      await wmbGateway.sendMessage(targetChainId, targetContract, messageData, gasLimit, {from: accounts[0], value: fee});
    });
  });


  describe("receiveMessage", function () {
    it("should receive a message", async function () {
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
          { gasLimit: gasLimit + 100_000 }
      );

      ret = await ret.wait();

      // Verify that nonce is incremented
      const newNonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);
      expect(newNonce).to.equal(nonce + 1);

      // Verify that message was delivered to the WmbReceiver contract
      const receivedMessage = await wmbReceiver.receivedMessages(messageId);
      expect(receivedMessage.data).to.equal(messageData);
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
      const newNonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);
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
      // TODO: Test forceResumeReceive functionality
    });
  });

  describe("Admin Functions", function () {
    describe("batchSetBaseFees", function () {
      it("should set base fees", async function () {
        // TODO: Test batchSetBaseFees functionality
      });
    });

    describe("setSignatureVerifier", function () {
      it("should set the signature verifier", async function () {
        // TODO: Test setSignatureVerifier functionality
      });
    });

    describe("setGasLimit", function () {
      it("should set the gas limit", async function () {
        // TODO: Test setGasLimit functionality
      });
    });

    describe("setMaxMessageLength", function () {
      it("should set the max message length", async function () {
        // TODO: Test setMaxMessageLength functionality
      });
    });
  });

  describe("EIP-5164 Functions", function () {
    describe("dispatchMessage", function () {
      it("should dispatch a message", async function () {
        // TODO: Test dispatchMessage functionality
      });
    });

    describe("dispatchMessageBatch", function () {
      it("should revert", async function () {
        // TODO: Test dispatchMessageBatch functionality
      });
    });
  });
});
