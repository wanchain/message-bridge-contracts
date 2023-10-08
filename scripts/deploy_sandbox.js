// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

// admin address 
const ADMIN = '0x5098E730Ca399634a0513b31ae12F26D405ecafd';
// current chain bip44 chainId
const BIP44_CHAIN_ID = hre.network.config.bip44ChainId

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  const WmbGateway = await hre.ethers.getContractFactory("WmbGateway");
  const wmbGateway = await WmbGateway.deploy();
  await wmbGateway.deployed();
  console.log("WmbGateway deployed to:", wmbGateway.address);
  const MockMPC = await hre.ethers.getContractFactory("MockMPC");
  const mockMPC = await MockMPC.deploy(BIP44_CHAIN_ID);
  await mockMPC.deployed();
  console.log("MockMPC deployed to:", mockMPC.address);

  await wmbGateway.initialize(ADMIN, mockMPC.address);
  await wmbGateway.setSupportedDstChains([1,2], [true, true]);
  await wmbGateway.batchSetBaseFees([1,2], ["1000000000", "1000000000"]);

  console.log('done!');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
