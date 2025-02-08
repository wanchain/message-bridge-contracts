require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        }
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: "london"
        }
      }
    ]
  },
  networks: {
    hardhat: {
      bip44_chainId: 1,
      chainId: 8888,
      mining: {
        auto: true,
        // interval: 5000
      },
      accounts: {
        mnemonic: "rule guard corn kidney giraffe town beef comic exercise shift depend arch",
        count: 5,
        initialIndex: 0,
        path: "m/44'/60'/0'/0",
        accountsBalance: "1000000000000000000000000",
      },
    },
    chain1: {
      bip44ChainId: 1,
      chainId: 8888,
      url: "http://localhost:18545",
      accounts: ["0xed90a083f22658db3b557a22832b5d719e65764eb3169053d96f6221725bbfd2"] // Sandbox PRIVATE_KEY do not use in production
    },
    chain2: {
      bip44ChainId: 2,
      chainId: 9999,
      url: "http://localhost:28545",
      accounts: ["0xed90a083f22658db3b557a22832b5d719e65764eb3169053d96f6221725bbfd2"] // Sandbox PRIVATE_KEY do not use in production
    },
  }
};
