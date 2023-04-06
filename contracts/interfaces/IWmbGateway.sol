// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./IEIP5164.sol";

/**
 * @title IWmbGateway
 * @dev Interface for the Wanchain Message Bridge Gateway contract
 * @dev This interface is used to send and receive messages between chains
 * @dev This interface is based on EIP-5164
 * @dev It extends the EIP-5164 interface, adding a custom gasLimit feature.
 */
interface IWmbGateway is IEIP5164 {
    /**
     * @dev Sends a message to a contract on another chain
     * @param targetChainId ID of the target chain
     * @param targetContract Address of the target contract
     * @param messageData Data to send in the message
     * @param gasLimit Gas limit for the message call
     * @return messageId The unique identifier of the message
     */
    function sendCustomMessage(
        uint256 targetChainId,
        address targetContract,
        bytes calldata messageData,
        uint256 gasLimit
    ) external payable returns (bytes32 messageId);

    /**
     * @dev Receives a message sent from another chain and verifies the signature of the sender.
     * @param messageId Unique identifier of the message to prevent replay attacks
     * @param sourceChainId ID of the source chain
     * @param sourceContract Address of the source contract
     * @param targetContract Address of the target contract
     * @param messageData Data sent in the message
     * @param gasLimit Gas limit for the message call
     * @param smgID ID of the Wanchain Storeman Group that signs the message
     * @param r R component of the SMG MPC signature
     * @param s S component of the SMG MPC signature
     * 
     * This function receives a message sent from another chain and verifies the signature of the sender using the provided SMG ID and signature components (r and s). 
     * If the signature is verified successfully, the message is executed on the target contract. 
     * The nonce value is used to prevent replay attacks. 
     * The gas limit is used to limit the amount of gas that can be used for the message execution.
     */
    function receiveMessage(
        bytes32 messageId,
        uint256 sourceChainId,
        address sourceContract,
        address targetContract,
        bytes calldata messageData,
        uint256 gasLimit,
        bytes32 smgID, 
        bytes calldata r, 
        bytes32 s
    ) external;

    /**
     * @dev Receives a message sent from another chain and verifies the signature of the sender.
     * @param messageId Unique identifier of the message to prevent replay attacks
     * @param sourceChainId ID of the source chain
     * @param sourceContract Address of the source contract
     * @param messages Data sent in the message
     * @param smgID ID of the Wanchain Storeman Group that signs the message
     * @param r R component of the SMG MPC signature
     * @param s S component of the SMG MPC signature
     * 
     * This function receives a message sent from another chain and verifies the signature of the sender using the provided SMG ID and signature components (r and s). 
     * If the signature is verified successfully, the message is executed on the target contract. 
     * The nonce value is used to prevent replay attacks. 
     * The gas limit is used to limit the amount of gas that can be used for the message execution.
     */
    function receiveBatchMessage(
        bytes32 messageId,
        uint256 sourceChainId,
        address sourceContract,
        Message[] calldata messages,
        bytes32 smgID,
        bytes calldata r, 
        bytes32 s
    ) external;

    /**
     * @dev Estimates the fee required to send a message to a target chain
     * @param targetChainId ID of the target chain
     * @param gasLimit Gas limit for the message call
     * @return fee The estimated fee for the message call
     */
    function estimateFee(
        uint256 targetChainId,
        uint256 gasLimit
    ) external view returns (uint256 fee);

    /**
     * @dev Returns the chain ID of the current chain in slip-44 standard
     * @return The chain ID of the current chain in slip-44 standard
     */
    function getChainId() external view returns (uint256);

    /**
     * @dev Returns the nonce for a given source and target address pair
     * @param fromChainId ID of the source chain
     * @param toChainId ID of the target chain
     * @param fromAddress Address of the source contract
     * @param toAddress Address of the target contract
     * @return The nonce value for the given address pair
     */
    function getNonce(
        uint256 fromChainId,
        uint256 toChainId,
        address fromAddress,
        address toAddress
    ) external view returns (uint256);

    /**
     * @dev extend the EIP-5164 interface, adding a custom gasLimit feature.
     */
    event MessageDispatchedExtended(
        bytes32 indexed messageId,
        address indexed from,
        uint256 indexed toChainId,
        address to,
        bytes data,
        uint256 gasLimit
    );
}
