const hre = require("hardhat");

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  
  const FeeCenter = await hre.ethers.getContractFactory("FeeCenter");
  const feeCenter = await FeeCenter.deploy();
  await feeCenter.deployed();
  console.log("FeeCenter implementation deployed to:", feeCenter.address);

  console.log("please Manually upgrade the implementation to", feeCenter.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
