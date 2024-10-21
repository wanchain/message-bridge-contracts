require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  mocha: {
    timeout: 100000000
  },
  networks: {
    dioneMainnet:{
      url: "https://node.dioneprotocol.com/ext/bc/D/rpc",
      accounts: [process.env.PK],
      bip44ChainId: 1073741848,
    },
    waterfallMainnet: {
      url: "https://rpc.waterfall.network",
      accounts: [process.env.PK],
    },
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
      chainId: 888,
      gasPrice: 2e9,
      gas: 30000000,
    },
    goerli: {
      url: 'https://rpc.ankr.com/eth_goerli',
      accounts: [process.env.PK],
    },
    fuji: {
      url: 'https://ava-testnet.public.blastapi.io/ext/bc/C/rpc',
      accounts: [process.env.PK],
      chainId: 43113,
    },
    xdcTestnet: {
      url: 'https://erpc.apothem.network',
      accounts: [process.env.PK],
    },
    arbitrumGoerli: {
      url: 'https://arbitrum-goerli.publicnode.com',
      accounts: [process.env.PK],
    },
    optimisticGoerli: {
      url: 'https://optimism-goerli.publicnode.com',
      accounts: [process.env.PK],
      gasPrice: 0.01e9,
    },
    polygonMumbai: {
      url: 'https://polygon-mumbai-bor.publicnode.com',
      accounts: [process.env.PK],
    },
    polygon: {
      url: 'https://polygon-bor.publicnode.com',
      accounts: [process.env.PK],
    },
    mainnet: {
      url: 'https://ethereum.publicnode.com',
      accounts: [process.env.PK],
    }
  },
  etherscan: {
    apiKey: {
    }
  }
};
