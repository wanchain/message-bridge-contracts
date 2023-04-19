// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const WmbGateway = await hre.ethers.getContractFactory("WmbGateway");
  const wmbGateway = await WmbGateway.deploy();
  await wmbGateway.deployed();
  console.log("WmbGateway deployed to:", wmbGateway.address);

  const MockApp = await hre.ethers.getContractFactory("MockApp");
  const mockApp = await MockApp.deploy('0x4Cf0A877E906DEaD748A41aE7DA8c220E4247D9e', wmbGateway.address);
  await mockApp.deployed();
  console.log("MockApp deployed to:", mockApp.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
