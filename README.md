# Wanchain Message Bridge (WMB)

Wanchain Message Bridge (WMB) is a decentralized messaging protocol that allows messages to be transmitted between different blockchain networks, including Wanchain and other networks.

The protocol is implemented through the Wanchain Message Bridge smart contracts, which enable the transmission of messages between different chains.

The contract code mainly consists of two parts: one part is WmbGateway, and the other part is WmbApp and WmbRetryableApp.

## WMB Gateway

The WMB Gateway is a smart contract that acts as an intermediary between the Wanchain Message Bridge and the external blockchain networks. It provides a secure and efficient mechanism for transferring messages between the different networks. 

## WMB App

WMB App is a smart contract that can be inherited by third-party DApps to interact with the WMB Gateway. It provides a customizable interface for interacting with the WMB Gateway and handling incoming messages.

## WMB Retryable App

WMB Retryable App is a smart contract that can be inherited by third-party DApps to interact with the WMB Gateway. It provides a customizable interface for interacting with the WMB Gateway and handling incoming messages. It also provides a retry mechanism for handling failed messages.



