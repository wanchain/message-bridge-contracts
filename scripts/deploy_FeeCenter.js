const hre = require("hardhat");

const UPGRADE_ADMIN_ADDRESS = "0xff72713c834a96f3c2f28145b4f05e5faf39e572";

async function main() {
  let deployer = (await hre.ethers.getSigner()).address;
  console.log('Deploying on', hre.network.name, 'with account', deployer);
  
  const FeeCenter = await hre.ethers.getContractFactory("FeeCenter");
  const feeCenter = await FeeCenter.deploy();
  await feeCenter.deployed();
  console.log("FeeCenter implementation deployed to:", feeCenter.address);

  const TransparentUpgradeableProxy = await hre.ethers.getContractFactory("TransparentUpgradeableProxy");
  const proxy = await TransparentUpgradeableProxy.deploy(
    feeCenter.address, // FeeCenter implementation address
    UPGRADE_ADMIN_ADDRESS, // upgrade admin address
    "0x", // initialization data
  );
  await proxy.deployed();
  console.log("TransparentUpgradeableProxy deployed to:", proxy.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
