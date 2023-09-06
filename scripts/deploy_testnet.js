// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const fs = require('fs');

// admin address 
const ADMIN = '0xF6eB3CB4b187d3201AfBF96A38e62367325b29F9';
// current chain bip44 chainId
const bip44_chainId = "2147484614";

// contract address for MPC signature verification
const CROSS_ADDRESS = {
  '2153201998': '', // wanchain testnet
  '2147483708': '', // ethereum testnet
  '2147492648': '', // Avalanche testnet
  '2147484198': '', // XDC testnet
  '1073741826': '', // arb testnet
  '2147484262': '', // opt testnet
  '2147484614': '', //polygon mumbai
};

// fee calculation
const feeInfo = {
  '2153201998': { // wanchain
    coinPriceUsd: 0.249,
    gasPrice: 2e9,
  },
  '2147483708': { // ethereum
    coinPriceUsd: 1622,
    gasPrice: 0.02e9,
  },
  '2147492648': { // Avalanche
    coinPriceUsd: 16.98,
    gasPrice: 50e9,
  },
  '2147484198': {
    coinPriceUsd: 0.033,
    gasPrice: 1e9,
  },
  '1073741826': {
    coinPriceUsd: 1622,
    gasPrice: 0.1e9,
  },
  '2147484262': {
    coinPriceUsd: 1622,
    gasPrice: 0.01e9,
  },
  '2147484614': {
    coinPriceUsd: 0.555,
    gasPrice: 2e9,
  },
}

// supported dst chains and base fee
let supporedChainIds = Object.keys(SMG_PROXY);

let supportedDstChains = {};
supporedChainIds.map((chainId) => {
  supportedDstChains[chainId] = {
    baseFee: (feeInfo[chainId].coinPriceUsd * feeInfo[chainId].gasPrice / feeInfo[bip44_chainId].coinPriceUsd).toFixed(0),
  };
});

console.log('supportedDstChains', supportedDstChains);

// remove current chain from supportedDstChains
delete supportedDstChains[bip44_chainId];

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  const WmbGateway = await hre.ethers.getContractFactory("WmbGateway");
  const wmbGateway = await WmbGateway.deploy();
  await wmbGateway.deployed();
  console.log("WmbGatewayDelegate deployed to:", wmbGateway.address);

  const deployed = {
    wmbGateway: wmbGateway.address,
    admin: ADMIN,
  }

  fs.writeFileSync(`deployed/${hre.network.name}_v2.json`, JSON.stringify(deployed, null, 2));
  console.log('done!', 'Result saved to deployed/' + hre.network.name + '.json');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
