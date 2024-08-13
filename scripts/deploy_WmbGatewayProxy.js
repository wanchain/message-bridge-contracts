// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  const WmbGatewayProxy = await hre.ethers.getContractFactory("WmbGatewayProxy");
  const proxy = await WmbGatewayProxy.deploy(
    "0x10acBE3b9E6A2Ff7f341e5cbF4b6617741fF44aa", // WmbGateway address
    "0x9c5EBb12D1D26465523e04381aAA192a69a565CF", // upgrade admin groupApprove
    "0x", // data
  );
  await proxy.deployed();
  console.log("WmbGatewayProxy deployed to:", proxy.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
