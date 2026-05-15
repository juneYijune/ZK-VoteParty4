require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Hardhat 本地网络
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    // Geth 本地私链
    geth: {
      url: "http://127.0.0.1:8558",
      chainId: 1337, // Geth dev 模式默认 chainId
      accounts: [
        "0x571ca58c9f94a06e195edf018f737d8d19985203510408871bfe2b46bf689c52"
      ],
      timeout: 60000
    },
    // Sepolia 测试网络
    sepolia: {
      url: "https://sepolia.infura.io/v3/3b7ef4876ed1416aaa401db920cd3253",
      chainId: 11155111,
      accounts: [
        "0x8bd5a41454be155bb21fa75ea52addf06f25780fb30e095673ad35147d04b23d"
      ],
      timeout: 60000,
      gasPrice: "auto"
    }
  }
};
