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

describe("WmbRetryableApp", function () {
  let WmbGateway, wmbGateway, mockMPC, owner, addr1, addr2, chainId, accounts, wmbReceiver, WmbReceiver;

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
    await wmbGateway.setSupportedDstChains([chainId, 123], [true, true]);
    await wmbGateway.batchSetBaseFees([chainId, 123], [2000000000, 2000000000]);
  });

  it("receive message failed and retry", async function () {
    // Deploy dummy WmbReceiver contract
    const WmbReceiver = await ethers.getContractFactory("MockRetryableApp");
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
    const gasLimit = 100_000;
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

    const signature = await signMessage(validatorPrivateKey, sigHash);
    const { r, s, v } = splitSignature(signature);

    await wmbReceiver.setTrustedRemotes([sourceChainId], [sourceContract], [true]);

    let ret = await wmbGateway.receiveMessage(
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
    
    ret = await ret.wait();
    expect(ret.events.some(e => e.event === 'MessageIdExecuted')).to.be.true;

    const interface = new ethers.utils.Interface(WmbReceiver.interface.fragments);
    const decodedEvent = interface.parseLog(ret.events[0]);
    expect(decodedEvent.name).to.equal('MessageFailed');

    let hash = await wmbReceiver.failedMessages(messageId);

    const retryHash = keccak256(
      solidityPack(
        ["bytes", "bytes32", "uint256", "address"],
        [messageData, messageId, sourceChainId, sourceContract]
      )
    );
    expect(hash).to.equal(retryHash);

    ret = await wmbReceiver.retryMessage(messageData, messageId, sourceChainId, sourceContract);
    ret = await ret.wait();

    expect(ret.events.some(e => e.event === 'RetryMessageSuccess')).to.be.true;

    hash = await wmbReceiver.failedMessages(messageId);
    expect(hash).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
  });

  it("receive message failed and drop", async function () {
    // Deploy dummy WmbReceiver contract
    const WmbReceiver = await ethers.getContractFactory("MockRetryableApp");
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
    const gasLimit = 100_000;
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

    const signature = await signMessage(validatorPrivateKey, sigHash);
    const { r, s, v } = splitSignature(signature);

    await wmbReceiver.setTrustedRemotes([sourceChainId], [sourceContract], [true]);

    let ret = await wmbGateway.receiveMessage(
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
    
    ret = await ret.wait();
    expect(ret.events.some(e => e.event === 'MessageIdExecuted')).to.be.true;

    const interface = new ethers.utils.Interface(WmbReceiver.interface.fragments);
    const decodedEvent = interface.parseLog(ret.events[0]);
    expect(decodedEvent.name).to.equal('MessageFailed');

    let hash = await wmbReceiver.failedMessages(messageId);
    const retryHash = keccak256(
      solidityPack(
        ["bytes", "bytes32", "uint256", "address"],
        [messageData, messageId, sourceChainId, sourceContract]
      )
    );
    expect(hash).to.equal(retryHash);

    ret = await wmbReceiver.dropMessage(messageId);
    ret = await ret.wait();

    expect(ret.events.some(e => e.event === 'MessageDroped')).to.be.true;

    hash = await wmbReceiver.failedMessages(messageId);
    expect(hash).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
  });
});

