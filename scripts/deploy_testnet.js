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
const SIGNATURE_VERIFIER = {
  '2153201998': '0x5dcab781bd5e1e7af64eec0686f6d618554f6340', // wanchain testnet
  '2147483708': '0x08bad1a48b0b08bf769f83ba30c1dad0f8bb8b6b', // ethereum testnet
  '2147492648': '0x0a5b5ea60930cca901bce3e3ad1772ebdd5065b8', // Avalanche testnet
  '2147484198': '0x35b90f99680c426bf6753a78c364b045115cb46e', // XDC testnet
  '1073741826': '0x6e81e127a280cd17bebc7704ce28a0226295a12b', // arb testnet
  '2147484262': '0x35b90f99680c426bf6753a78c364b045115cb46e', // opt testnet
  '2147484614': '0x4c12e6696fe23b15f2b911db7ca42b2d01cde84a', //polygon mumbai
};
// contract address for get smg info, oracle proxy on other evm chain or smgAdmin on wanchain
const SMG_PROXY = {
  '2153201998': '0xaA5A0f7F99FA841F410aafD97E8C435c75c22821', // wanchain testnet
  '2147483708': '0x0f0bf93bf16fd28294c637d855fc73b917ef5fcc', // ethereum testnet
  '2147492648': '0x302554d20c92461f4c57bad481797b6d5f422c45', // Avalanche testnet
  '2147484198': '0x9c843263bd9ae7277ab7c29c18e3f532894a0d35', // XDC testnet 
  '1073741826': '0x35b90f99680c426bf6753a78c364b045115cb46e', // arb testnet 
  '2147484262': '0x9b281146a04a67948f4601abda704016296017c5', // opt testnet
  '2147484614': '0xdff6a8699031a448c4cc130f2bfdd9d2db4e5877', // polygon mumbai
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

  const ProxyAdmin = await hre.ethers.getContractFactory("ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy();
  await proxyAdmin.deployed();
  console.log("ProxyAdmin deployed to:", proxyAdmin.address);
  const WmbGateway = await hre.ethers.getContractFactory("WmbGateway");
  const wmbGateway = await WmbGateway.deploy();
  await wmbGateway.deployed();
  console.log("WmbGatewayDelegate deployed to:", wmbGateway.address);

  const TransparentUpgradeableProxy = await hre.ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await TransparentUpgradeableProxy.deploy(
    wmbGateway.address,
    proxyAdmin.address,
    '0x'
  );
  await proxy.deployed();
  console.log("WmbGatewayProxy deployed to:", proxy.address);

  const wmbGatewayProxy = await WmbGateway.attach(proxy.address);
  let tx = await wmbGatewayProxy.initialize(deployer, bip44_chainId, SIGNATURE_VERIFIER[bip44_chainId], SMG_PROXY[bip44_chainId]);
  await tx.wait();

  console.log('WmbGatewayProxy initialized');

  tx = await wmbGatewayProxy.setSupportedDstChains(Object.keys(supportedDstChains), Object.values(supportedDstChains).map((v) => true));
  await tx.wait();
  console.log('WmbGatewayProxy setSupportedDstChains');

  tx = await wmbGatewayProxy.batchSetBaseFees(Object.keys(supportedDstChains), Object.values(supportedDstChains).map((v) => v.baseFee));
  await tx.wait();
  console.log('WmbGatewayProxy batchSetBaseFees');

  const MockApp = await hre.ethers.getContractFactory("MockApp");
  const mockApp = await MockApp.deploy(ADMIN, wmbGatewayProxy.address);
  await mockApp.deployed();
  console.log("MockApp deployed to:", mockApp.address);

  if (ADMIN.toLowerCase() !== deployer.toLowerCase()) {
    console.log('transfering ownership to', ADMIN, '...');
    tx = await proxyAdmin.transferOwnership(ADMIN);
    await tx.wait();
    tx = await wmbGatewayProxy.grantRole(await wmbGatewayProxy.DEFAULT_ADMIN_ROLE(), ADMIN);
    await tx.wait();
    tx = await wmbGatewayProxy.renounceRole(await wmbGatewayProxy.DEFAULT_ADMIN_ROLE(), deployer);
    await tx.wait();
  }

  const deployed = {
    proxyAdmin: proxyAdmin.address,
    wmbGatewayDelegate: wmbGateway.address,
    wmbGatewayProxy: wmbGatewayProxy.address,
    mockApp: mockApp.address,
    admin: ADMIN,
  }

  fs.writeFileSync(`deployed/${hre.network.name}.json`, JSON.stringify(deployed, null, 2));
  console.log('done!', 'Result saved to deployed/' + hre.network.name + '.json');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
