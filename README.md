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
| 1 | Avalanche Fuji Testnet | 0x8Ee72C8194ec8A527B1D4981742727437091C913 | 2147492648 |
| 2 | Wanchain Testnet | 0xEB14407Edc497a73934dE08D5c3079BB1F5f145D | 2153201998 |
| 3 | XDC Apothem Testnet | 0x8c1b9daD87BFC48DF48b15baA19d0FB163030169 | 2147484198 |
| 4 | Ethereum Sepolia Testnet | 0x6c6bab7105d72c7b30bda46cb390e67a0acd8c05 | 2147483708 |
| 5 | Arbitrum Sepolia | 0x5f7778d1fd697ae79aa11e5b628d6f51d4ef7b95 | 1073741826 |
| 6 | Optimism Sepolia | 0x0c7a6313411c15cd3a0f5ffec922af3d8a1b900d | 2147484262 |
| 7 | polygon amoy | 0x5522976caf971e0000183ab20cab8ebba9a90cdc | 2147484614 |
| 8 | energi | 0x9e8aafd785f8cc9aebb4b6fbf817ee988e85fede | 2147493445 |
| 9 | bitrock | 0xd4b5f10d61916bd6e0860144a91ac658de8a1437 | 2154655314 |
| 10 | Kanazawa(Meld Testnet) | 0x30de9d1d358ff1b60fb8057235aac35e23b7650f | 1073741847 |
| 11 | BSC Testnet | 0x7198eb89cc364cdd8c81ef6c39c597712c070ac6 | 2147484362 |
| 12 | DIONE Odyssey Testnet | 0x265b967af0cb6477fc0074e9f388fb2ba0befd18 | 1073741848 |
| 13 | PLYR TAU Testnet | 0xc12cf8cc8eff1f39c9e60da81d11745c25c59501 | 1073741849 |
| 14 | edeXa Testnet | 0x3a737d703a11d426f337233ed3e15e2a992258ee | 1073741850 |
| 15 | Base Sepolia Testnet | 0xb1cfdd539890678a17a79b390c72e2619fae866b | 1073741841 |
| 16 | Waterfall Testnet 9 | 0x10ce92bda0f7a184a1c2de322aa1a22938098442 | 1073741851 |
| 17 | 5ire Testnet | 0x30de9d1d358ff1b60fb8057235aac35e23b7650f | 1073741853 |

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
| 14 | 5ire Testnet | 0x7280E3b8c686c68207aCb1A4D656b2FC8079c033 | 1073741853 |

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
