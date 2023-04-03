const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WmbApp", function () {
  let WmbGateway, wmbGateway, mockMPC, owner, addr1, addr2, chainId, accounts, wmbReceiver, WmbReceiver;

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
  });

  // non-block mode test 
  it("non-block mode", async function () {
    // Deploy dummy WmbReceiver contract
    const WmbReceiver = await ethers.getContractFactory("MockApp");
    const wmbReceiver = await WmbReceiver.deploy(
      accounts[0],
      wmbGateway.address,
      false,
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

    expect(ret.events.some(e => e.event === 'MessageIdExecuted')).to.be.true;
    
    let have = await wmbGateway.hasStoredFailedMessage(sourceChainId, sourceContract, targetContract);
    expect(have).to.be.false;

    // Verify that nonce is incremented
    const newNonce = await wmbGateway.nonces(sourceChainId, chainId, sourceContract, targetContract);
    expect(newNonce).to.equal(nonce + 1);

    // Retry message
    ret = await wmbReceiver.retryMessage(
      messageData,
      messageId,
      sourceChainId,
      sourceContract
    );
    ret = await ret.wait();
    expect(ret.events.some(e => e.event === 'RetryMessageSuccess')).to.be.true;

    // Verify that message was delivered to the WmbReceiver contract
    const receivedMessage = await wmbReceiver.receivedMessages(messageId);
    expect(receivedMessage.data).to.equal(messageData);
    expect(receivedMessage.fromChainId).to.equal(sourceChainId);
    expect(receivedMessage.from).to.equal(sourceContract);
  });

});

