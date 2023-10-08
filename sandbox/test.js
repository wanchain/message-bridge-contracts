const { ethers } = require("ethers");
const ABI = require("./mcToken.abi.json");

// Sandbox PRIVATE_KEY do not use in production
const PRIVATE_KEY =
  "0x6e6dc8e8f58f6829392ba1e00e5fc1a9c6a48abd62d491381d3eeb996599ac02";

const provider1 = new ethers.providers.JsonRpcProvider('http://localhost:18545');
const provider2 = new ethers.providers.JsonRpcProvider('http://localhost:28545');

const wallet1 = new ethers.Wallet(PRIVATE_KEY, provider1);
const wallet2 = new ethers.Wallet(PRIVATE_KEY, provider2);

const mcToken1 = new ethers.Contract("0xFac60b04D7Ade6de72d655413F5e029073baD621", ABI, wallet1);
const mcToken2 = new ethers.Contract("0xFac60b04D7Ade6de72d655413F5e029073baD621", ABI, wallet2);

async function main() {
  console.log('Start MC Token cross chain transfer test...');
  // current balance
  let balance = await mcToken1.balanceOf(wallet1.address);
  console.log('wallet on chain1 MCT balance:', ethers.utils.formatEther(balance));
  balance = await mcToken2.balanceOf(wallet2.address);
  console.log('wallet on chain2 MCT balance:', ethers.utils.formatEther(balance));

  console.log('Transfer 100 MCT from chain1 to chain2...');
  await mcToken1.crossTo(2, '0xFac60b04D7Ade6de72d655413F5e029073baD621', wallet2.address, ethers.utils.parseEther("100"), '300000', {value: '300000000000000'});

  console.log('Wait for 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 50000));

  balance = await mcToken1.balanceOf(wallet1.address);
  console.log('wallet on chain1 MCT balance:', ethers.utils.formatEther(balance));
  balance = await mcToken2.balanceOf(wallet2.address);
  console.log('wallet on chain2 MCT balance:', ethers.utils.formatEther(balance));

  console.log('Transfer 100 MCT from chain2 to chain1...');
  await mcToken2.crossTo(1, '0xFac60b04D7Ade6de72d655413F5e029073baD621', wallet1.address, ethers.utils.parseEther("100"), '300000', {value: '300000000000000'});

  console.log('Wait for 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 50000));

  balance = await mcToken1.balanceOf(wallet1.address);
  console.log('wallet on chain1 MCT balance:', ethers.utils.formatEther(balance));
  balance = await mcToken2.balanceOf(wallet2.address);
  console.log('wallet on chain2 MCT balance:', ethers.utils.formatEther(balance));

  console.log('done!');
}

main().then(console.log).catch(console.error).finally(() => process.exit(0));