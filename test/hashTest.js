const { ethers } = require("ethers");
const crypto = require("crypto");

const { keccak256, arrayify, abi, solidityPack, defaultAbiCoder } = ethers.utils;


function sha256(params) {
  let kBuf = Buffer.from(params.slice(2), 'hex');
  let hash = crypto.createHash("sha256").update(kBuf);
  return '0x' + hash.digest("hex");
}

async function main() {
  

  const messageId = '0x2495cc18a14c348d2830f474b5abba3ad0fc40761aab54274b227dd87df4fa5d';
  const sourceChainId = "2153201998";
  const sourceContract = '0xee2d41f09e5ef247b330faa1a5262edc63b59084';
  const chainId = '2147483708';
  const targetContract = '0x237e7fc6319bf62b936a1803bde7e8a7d056d62e'
  const messageData = '0x4321'

  const data = defaultAbiCoder.encode(
    ["bytes32", "uint256", "address", "uint256", "address", "bytes"],
    [messageId, sourceChainId, sourceContract, chainId, targetContract, messageData]
  );

  console.log('data', data);
  const sigHash = keccak256(data);
  const sigHash2 = sha256(data);

  console.log('sigHash', sigHash);
  console.log('sigHash2', sigHash2);
}

main();