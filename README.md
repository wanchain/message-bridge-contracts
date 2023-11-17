# Wanchain Message Bridge (WMB)

Wanchain Message Bridge (WMB) is a decentralized messaging protocol that allows messages to be transmitted between different blockchain networks, including Wanchain and other networks.

The protocol is implemented through the Wanchain Message Bridge smart contracts, which enable the transmission of messages between different chains.

The contract code mainly consists of two parts: one part is WmbGateway, and the other part is WmbApp and WmbRetryableApp.

## WMB Gateway

The WMB Gateway is a smart contract that acts as an intermediary between the Wanchain Message Bridge and the external blockchain networks. It provides a secure and efficient mechanism for transferring messages between the different networks. 

### Deployed SC address

#### Testnet

| Network | Contract Address |
| --- | --- |
| Wanchain Testnet | [0xEB14407Edc497a73934dE08D5c3079BB1F5f145D](https://testnet.wanscan.org/address/0xEB14407Edc497a73934dE08D5c3079BB1F5f145D) |
| Ethereum Goerli Testnet  | [0x9454C2F15F308098163623D5E7deCe366793efD3](https://goerli.etherscan.io/address/0x9454C2F15F308098163623D5E7deCe366793efD3) |
| Avalanche Fuji Testnet | [0x8Ee72C8194ec8A527B1D4981742727437091C913](https://testnet.snowtrace.io/address/0x8Ee72C8194ec8A527B1D4981742727437091C913) |
| XDC testnet | [0x8c1b9daD87BFC48DF48b15baA19d0FB163030169](https://apothem.xinfinscan.com/address/xdc8c1b9daD87BFC48DF48b15baA19d0FB163030169#transactions) |
| Arbitrum Goerli Testnet | [0x294B79d3D13DAb36C51C8E4Cf3c2Cd3948F0bA4C](https://testnet.arbiscan.io/address/0x294B79d3D13DAb36C51C8E4Cf3c2Cd3948F0bA4C) |
| Optimism Goerli Testnet | [0x9B9492466F70e0dA0f4ef0aC27a53550B0769232](https://goerli-optimism.etherscan.io/address/0x9B9492466F70e0dA0f4ef0aC27a53550B0769232) |
| Polygon Mumbai Testnet | [0x61F4aBa60A158E180521264a793fCb2901fCe998](https://mumbai.polygonscan.com/address/0x61F4aBa60A158E180521264a793fCb2901fCe998) |

#### Mainnet

| Network | Address | Bip44 chainId |
| --- | --- | --- |
| Polygon | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147484614 |
| BSC | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147484362 |
| Wanchain | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2153201998 |
| Avalanche | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147492648 |
| Optimism | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147484262 |
| Arbitrum | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741826 |
| Energi | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147493445 |


## WMB App

WMB App is a smart contract that can be inherited by third-party DApps to interact with the WMB Gateway. It provides a customizable interface for interacting with the WMB Gateway and handling incoming messages.

## WMB Retryable App

WMB Retryable App is a smart contract that can be inherited by third-party DApps to interact with the WMB Gateway. It provides a customizable interface for interacting with the WMB Gateway and handling incoming messages. It also provides a retry mechanism for handling failed messages.


## Compile & Test

```
// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
import "@wandevs/message/contracts/app/WmbApp.sol";

contract MyContract is WmbApp {
    
    constructor(address admin, address _wmbGateway) WmbApp() {
        initialize(admin, _wmbGateway);
        // 你的初始化代码
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address fromSC
    ) internal override {
		// do something you want...
    }

    function sendMessage(
        uint256 toChainId, address toAddress, 
        bytes memory msgData, uint256 gasLimit) public payable {
        uint256 fee = estimateFee(toChainId, gasLimit);
        require(msg.value >= fee, "Insufficient fee");
        _dispatchMessage(toChainId, toAddress, msgData, msg.value);
    }

    function sendMessageBatch(
        uint256 toChainId, Message[] memory messages, uint256 gasLimit) 
        public payable {
        uint256 fee = estimateFee(toChainId, gasLimit);
        require(msg.value >= fee, "Insufficient fee");
        _dispatchMessageBatch(toChainId, messages, msg.value);
    }
}

```

## Sandbox Environment

Check [sandbox.md](./sandbox.md) for more details.