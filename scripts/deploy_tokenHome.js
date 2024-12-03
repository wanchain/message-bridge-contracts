const hre = require("hardhat");

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  const Logic = await hre.ethers.getContractFactory("ERC20TokenHome");
  const instance = await Logic.deploy(
    "0xDDddd58428706FEdD013b3A761c6E40723a7911d",
    "0x88C6efA3306437a80a8546A03a92b0854C16d25D",
  );
  await instance.deployed();
  console.log("ERC20TokenHome deployed to:", instance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

