// SPDX-License-Identifier: Apache-3.0

pragma solidity 0.8.18;

/// @title Cross-Chain Messaging interface
/// @dev Allows seamless interchain messaging.
/// @author Sujith Somraaj
/// Note: Bytes are used throughout the implementation to support non-evm chains.

interface IEIP6170 {
    /// @dev This emits when a cross-chain message is sent.
    /// Note: MessageSent MUST trigger when a message is sent, including zero bytes transfers.
    event MessageSent(
        bytes to,
        bytes toChainId,
        bytes message,
        bytes extraData
    );

    /// @dev This emits when a cross-chain message is received.
    /// MessageReceived MUST trigger on any successful call to receiveMessage(bytes chainId, bytes sender, bytes message) function.
    event MessageReceived(bytes from, bytes fromChainId, bytes message);

    /// @dev Sends a message to a receiving address on a different blockchain.
    /// @param chainId_ is the unique identifier of receiving blockchain.
    /// @param receiver_ is the address of the receiver.
    /// @param message_ is the arbitrary message to be delivered.
    /// @param data_ is a bridge-specific encoded data for off-chain relayer infrastructure.
    /// @return the status of the process on the sending chain.
    /// Note: this function is designed to support both evm and non-evm chains
    /// Note: proposing chain-ids be the bytes encoding their native token name string. For eg., abi.encode("ETH"), abi.encode("SOL") imagining they cannot override.
    function sendMessage(
        bytes memory chainId_,
        bytes memory receiver_,
        bytes memory message_,
        bytes memory data_
    ) external payable returns (bool);

    /// @dev Receives a message from a sender on a different blockchain.
    /// @param chainId_ is the unique identifier of the sending blockchain.
    /// @param sender_ is the address of the sender.
    /// @param message_ is the arbitrary message sent by the sender.
    /// @param data_ is an additional parameter to be used for security purposes. E.g, can send nonce in layerzero.
    /// @return the status of message processing/storage.
    /// Note: sender validation (or) message validation should happen before processing the message.
    function receiveMessage(
        bytes memory chainId_,
        bytes memory sender_,
        bytes memory message_,
        bytes memory data_
    ) external payable returns (bool);
}
