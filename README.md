# Wanchain Message Bridge (WMB)

Wanchain Message Bridge (WMB) is a decentralized messaging protocol that allows messages to be transmitted between different blockchain networks, including Wanchain and other networks.

The protocol is implemented through the Wanchain Message Bridge smart contracts, which enable the transmission of messages between different chains.

The contract code mainly consists of two parts: one part is WmbGateway, and the other part is WmbApp and WmbRetryableApp.

## WMB Gateway

The WMB Gateway is a smart contract that acts as an intermediary between the Wanchain Message Bridge and the external blockchain networks. It provides a secure and efficient mechanism for transferring messages between the different networks. 

### Deployed SC address

#### Testnet

| Index | Chain Name | Gateway | Chain ID |
| --- | --- | --- | --- |
| 1 | Avalanche Fuji Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147492648 |
| 2 | Wanchain Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2153201998 |
| 3 | XDC Apothem Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147484198 |
| 4 | Ethereum Sepolia Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147483708 |
| 5 | Arbitrum Sepolia | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741826 |
| 6 | Optimism Sepolia | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147484262 |
| 7 | polygon amoy | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147484614 |
| 8 | energi | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147493445 |
| 9 | bitrock | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2154655314 |
| 10 | BSC Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 2147484362 |
| 11 | DIONE Odyssey Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741848 |
| 12 | PLYR TAU Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741849 |
| 13 | edeXa Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741850 |
| 14 | Base Sepolia Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741841 |
| 15 | Waterfall Testnet 9 | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741851 |
| 16 | 5ire Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741853 |
| 17 | Lummio Testnet | 0xDDddd58428706FEdD013b3A761c6E40723a7911d | 1073741854 |


#### Mainnet

| Index | Network | Address | Bip44 chainId |
| --- | --- | --- | --- |
| 1 | Polygon | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147484614 |
| 2 | BSC | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147484362 |
| 3 | Wanchain | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2153201998 |
| 4 | Avalanche | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147492648 |
| 5 | Optimism | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147484262 |
| 6 | Arbitrum | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741826 |
| 7 | Energi | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147493445 |
| 8 | Bitrock | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2154655314 |
| 9 | Ethereum | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 2147483708 |
| 10 | Meld (deprecated) | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741847 |
| 11 | Plyr | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741849 |
| 11 | Base | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741841 |
| 12 | Waterfall | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741851 |
| 13 | DIONE Mainnet | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741848 |

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
