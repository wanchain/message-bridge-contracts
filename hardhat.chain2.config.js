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
      bip44_chainId: 2,
      chainId: 9999,
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
    }
  },
};
