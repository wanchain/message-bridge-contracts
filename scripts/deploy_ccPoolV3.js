const hre = require("hardhat");

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  const CCPoolV3 = await hre.ethers.getContractFactory("CCPoolV3");
  const ccPoolV3 = await CCPoolV3.deploy(deployer, '0x7280E3b8c686c68207aCb1A4D656b2FC8079c033', '0xdac17f958d2ee523a2206206994597c13d831ec7');
  await ccPoolV3.deployed();
  console.log("CCPoolV3 deployed to:", ccPoolV3.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

