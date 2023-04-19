require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  mocha: {
    timeout: 100000000
  },
  networks: {
    wanchainTestnet: {
      url: "https://gwan-ssl.wandevs.org:46891",
      accounts: [process.env.PK],
      chainId: 999,
      gasPrice: 2e9,
      gas: 30000000,
    },
    wanchainMainnet: {
      url: "https://gwan-ssl.wandevs.org:56891",
      accounts: [process.env.PK],
      chainId: 999,
      gasPrice: 2e9,
    },
    goerli: {
      url: 'https://rpc.ankr.com/eth_goerli',
      accounts: [process.env.PK],
    },
  }
};
