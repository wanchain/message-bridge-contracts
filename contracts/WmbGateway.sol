// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IEIP5164.sol";
import "./interfaces/IEIP6170.sol";
import "./interfaces/IWmbGateway.sol";
import "./interfaces/IWmbConfig.sol";
import "./interfaces/IWanchainMPC.sol";
import "./interfaces/IWmbReceiver.sol";

contract WmbGateway is AccessControl, Initializable, ReentrancyGuard, IEIP5164, IEIP6170, IWmbGateway, IWmbConfig {
    // slip-0044 standands chainId for local chain
    uint256 public chainId;

    // Global maximum gas limit for a message
    uint256 public maxGasLimit;

    // Address of the signature verification contract
    address public signatureVerifier;

    // Address of the Wanchain Storeman Admin contract
    address public wanchainStoremanAdminSC;

    // Mapping of target chain IDs to base fees
    mapping(uint256 => uint256) public baseFees;

    // Mapping of sourceChainId->dstChainId->sourceContract->targetContract->nonce to prevent replay attacks
    mapping(uint256 => mapping(uint256 => mapping(address => mapping(address => uint256)))) public nonces;

    mapping(uint256 => mapping(address => mapping(address => StoredMessage))) public storedMessages;

    struct ReceiveMsgData {
        uint256 sourceChainId;
        address sourceContract;
        address targetContract;
        bytes messageData;
        uint256 nonce;
        uint256 gasLimit;
    }

    struct SigData {
        bytes32 message;
        bytes32 smgID; 
        bytes r;
        bytes32 s;
    }

    struct StoredMessage {
        uint256 payloadLength;
        address targetContract;
        bytes32 messageHash;
    }

    // Status of a Storeman Group
    enum GroupStatus { none, initial, curveSeted, failed, selected, ready, unregistered, dismissed }

    event MessageStored(
        uint256 indexed sourceChainId,
        address indexed sourceContract,
        address indexed targetContract,
        bytes32 messageData,
        uint256 nonce,
        uint256 gasLimit,
        bytes reason
    );

    function initialize(address admin, uint _chainId, uint _maxGasLimit, address _signatureVerifier, address _wanchainStoremanAdminSC) public initializer {
        // Initialize the AccessControl module with the given admin
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        chainId = _chainId;
        maxGasLimit = _maxGasLimit;
        signatureVerifier = _signatureVerifier;
        wanchainStoremanAdminSC = _wanchainStoremanAdminSC;
    }

    /**
     * @dev Public interface functions for the WMB Gateway contract.
     */

    // Sends a message to a contract on another chain
    function sendMessage(
        uint256 targetChainId,
        address targetContract,
        bytes calldata messageData,
        uint256 gasLimit
    ) external payable nonReentrant {
        // TODO: Implement send function
    }

    // Receives a message sent from another chain
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
    ) external {
        bytes32 messageId = keccak256(
            abi.encodePacked(
                sourceChainId,
                sourceContract,
                targetContract,
                messageData,
                nonce,
                gasLimit
            )
        );

        _receiveMessage(
            messageId,
            ReceiveMsgData(
                sourceChainId,
                sourceContract,
                targetContract,
                messageData,
                nonce,
                gasLimit
            )
        );

        // verify signature
        verifyMpcSignature(
            SigData(
                messageId, smgID, r, s
            )
        );
    }

    // Estimates the fee required to send a message to a target chain
    function estimateFee(
        uint256 targetChainId,
        uint256 gasLimit
    ) public view returns (uint256 fee) {
        require(gasLimit <= maxGasLimit, "Gas limit exceeds maximum");
        return baseFees[targetChainId] * gasLimit;
    }

    function getNonce(
        uint256 fromChainId,
        uint256 toChainId,
        address fromAddress,
        address toAddress
    ) public view returns (uint256) {
        // TODO: Implement nonce function
    }

    function getChainId() public view returns (uint256) {
        return chainId;
    }

    // Checks if a failed message is stored
    function hasStoredFailedMessage(uint16 _srcChainId, address _srcAddress, address _targetContract) external view returns (bool) {
        // TODO: Implement hasStoredFailedMessage function
        return false;
    }

    // Retries a failed message
    function retryFailedMessage(uint16 _srcChainId, address _srcAddress, address _targetContract, bytes calldata messageData) external {
        // TODO: Implement retryFailedMessage function
    }

    // Forces resumption of a failed message's receipt
    function forceResumeReceive(uint16 _srcChainId, address _srcAddress, address _targetContract) external {
        // TODO: Implement forceResumeReceive function
    }

    /**
     * @dev Function for the WMB Gateway contract, to be used by the contract administrator.
     * These functions are only accessible to accounts with the DEFAULT_ADMIN_ROLE.
     */

    function batchSetBaseFees(uint256[] calldata _targetChainIds, uint256[] calldata _baseFees) external {
        // limit AccessControl
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not an admin");
        require(_targetChainIds.length == _baseFees.length, "Invalid input");
        for (uint256 i = 0; i < _targetChainIds.length; i++) {
            baseFees[_targetChainIds[i]] = _baseFees[i];
        }
    }

    function setSignatureVerifier(address _signatureVerifier) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not an admin");
        signatureVerifier = _signatureVerifier;
    }

    function setMaxGasLimit(uint256 _maxGasLimit) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not an admin");
        maxGasLimit = _maxGasLimit;
    }

    /**
     * @dev Functions to adapt the EIP-6170 interface.
     */

    function sendMessage(
        bytes memory chainId_,
        bytes memory receiver_,
        bytes memory message_,
        bytes memory data_
    ) external payable returns (bool) {
        return false;
    }

    function receiveMessage(
        bytes memory chainId_,
        bytes memory sender_,
        bytes memory message_,
        bytes memory data_
    ) external payable returns (bool) {
        return false;
    }

    /**
     * @dev Functions to adapt the EIP-5164 interface.
     */

    function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable returns (bytes32 messageId) {
        return bytes32(0);
    }

    function dispatchMessageBatch(uint256 toChainId, Message[] calldata messages) external payable returns (bytes32 messageId) {
        return bytes32(0);
    }

    /**
     * @dev Internal Functions.
     */

    /// @notice                                 check the storeman group is ready or not
    /// @param smgID                            ID of storeman group
    /// @return curveID                         ID of elliptic curve
    /// @return PK                              PK of storeman group
    function acquireReadySmgInfo(bytes32 smgID)
        internal
        view
        returns (uint curveID, bytes memory PK)
    {
        uint8 status;
        uint startTime;
        uint endTime;
        (,status,,,,curveID,,PK,,startTime,endTime) = IWanchainMPC(wanchainStoremanAdminSC).getStoremanGroupConfig(smgID);

        require(status == uint8(GroupStatus.ready) && block.timestamp >= startTime && block.timestamp <= endTime, "PK is not ready");

        return (curveID, PK);
    }

    /// @notice       convert bytes to bytes32
    /// @param b      bytes array
    /// @param offset offset of array to begin convert
    function bytesToBytes32(bytes memory b, uint offset) internal pure returns (bytes32 result) {
        assembly {
            result := mload(add(add(b, offset), 32))
        }
    }

    /**
     * @dev Verifies an MPC signature for a given message and Storeman Group ID
     * @param sig The signature to verify
     */
    function verifyMpcSignature(SigData memory sig) internal {
        uint curveID;
        bytes memory PK;

        // Acquire the curve ID and group public key for the given Storeman Group ID
        (curveID, PK) = acquireReadySmgInfo(sig.smgID);

        // Extract the X and Y components of the group public key
        bytes32 PKx = bytesToBytes32(PK, 0);
        bytes32 PKy = bytesToBytes32(PK, 32);

        // Extract the X and Y components of the signature
        bytes32 Rx = bytesToBytes32(sig.r, 0);
        bytes32 Ry = bytesToBytes32(sig.r, 32);

        // Verify the signature using the Wanchain MPC contract
        require(IWanchainMPC(signatureVerifier).verify(curveID, sig.s, PKx, PKy, Rx, Ry, sig.message), "Signature verification failed");
    }

    function _receiveMessage(
        bytes32 messageId,
        ReceiveMsgData memory data
    ) internal {
        require(data.nonce == ++nonces[data.sourceChainId][chainId][data.sourceContract][data.targetContract], "Invalid nonce");
        require(Address.isContract(data.targetContract), "Target contract is not a contract");
        
        try IWmbReceiver(data.targetContract).wmbReceive{gas: data.gasLimit}(data.messageData, messageId, data.sourceChainId, data.sourceContract) {
            // success, do nothing, end of the receive message function.
        } catch (bytes memory reason) {
            // revert nonce if any uncaught errors/exceptions if the ua chooses the blocking mode
            storedMessages[data.sourceChainId][data.sourceContract][data.targetContract] = StoredMessage(uint64(data.messageData.length), data.targetContract, keccak256(data.messageData));
            emit MessageStored(data.sourceChainId, data.sourceContract, data.targetContract, data.messageData, data.nonce, data.gasLimit, reason);
        }

    }

}
