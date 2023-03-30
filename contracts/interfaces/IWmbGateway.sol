// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

/**
 * @title IWmbGateway
 * @dev Interface for the Wanchain Message Bridge Gateway contract
 */
interface IWmbGateway {
    /**
     * @dev Sends a message to a contract on another chain
     * @param targetChainId ID of the target chain
     * @param targetContract Address of the target contract
     * @param messageData Data to send in the message
     * @param gasLimit Gas limit for the message call
     * @return messageId The unique identifier of the message
     */
    function sendMessage(
        uint256 targetChainId,
        address targetContract,
        bytes calldata messageData,
        uint256 gasLimit
    ) external payable returns (bytes32 messageId);

    /**
     * @dev Receives a message sent from another chain and verifies the signature of the sender.
     * @param sourceChainId ID of the source chain
     * @param sourceContract Address of the source contract
     * @param targetContract Address of the target contract
     * @param messageData Data sent in the message
     * @param nonce Nonce value to prevent replay attacks
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
        uint256 sourceChainId,
        address sourceContract,
        address targetContract,
        bytes calldata messageData,
        uint256 nonce,
        uint256 gasLimit,
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
     * @dev Checks if a failed message is stored
     * @param _srcChainId ID of the source chain
     * @param _srcAddress Address of the source contract
     * @param _targetContract Address of the target contract
     * @return bool Whether a failed message is stored for the given contract and chain
     * 
     * When a failed message is detected, it will block all subsequent messages and prevent them from being processed. To continue processing messages, it is necessary to manually retry the failed message or force its resumption.
     */
    function hasStoredFailedMessage(uint _srcChainId, address _srcAddress, address _targetContract) external view returns (bool);

    /**
     * @dev Retries a failed message
     * @param _srcChainId ID of the source chain
     * @param _srcAddress Address of the source contract
     * @param _targetContract Address of the target contract
     * @param messageData Data to send in the retry message
     */
    function retryFailedMessage(uint _srcChainId, address _srcAddress, address _targetContract, bytes calldata messageData) external;

    /**
     * @dev Forces resumption of a failed message's receipt, Only when the _targetContract needs to resume the message flow in blocking mode and clear the stored message
     * @param _srcChainId ID of the source chain
     * @param _srcAddress Address of the source contract
     */
    function forceResumeReceive(uint _srcChainId, address _srcAddress) external;
}
