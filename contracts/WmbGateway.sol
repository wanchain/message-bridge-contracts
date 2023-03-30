// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IEIP5164.sol";
import "./interfaces/IWmbGateway.sol";
import "./interfaces/IWmbConfig.sol";
import "./interfaces/IWanchainMPC.sol";
import "./interfaces/IWmbReceiver.sol";

/**
 * @title WmbGateway
 * @dev The main entry point of Wanchain cross-chain asset transfer system.
 *      The contract serves as a gateway for cross-chain transactions between different blockchain networks. 
 *      This contract supports two working modes: blocking and non-blocking mode.
 *      In blocking mode, if a target contract call fails, the channel blocks until the issue is resolved.
 *      In non-blocking mode, failed transactions are recorded in the dapp contract and do not block subsequent transaction executions.
 */
contract WmbGateway is AccessControl, Initializable, ReentrancyGuard, IEIP5164, IWmbGateway, IWmbConfig {
    // slip-0044 standands chainId for local chain
    uint256 public chainId;

    // Global maximum gas limit for a message
    uint256 public maxGasLimit;
    uint256 public minGasLimit;
    uint256 public defaultGasLimit;

    uint256 public maxMessageLength;

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
        uint256 messageLength;
        bytes32 messageHash;
        bytes32 messageId;
    }

    // Status of a Storeman Group
    enum GroupStatus { none, initial, curveSeted, failed, selected, ready, unregistered, dismissed }

    event MessageSent(
        address indexed sourceContract,
        uint indexed targetChainId,
        address indexed targetContract,
        uint sourceChainId,
        bytes messageData,
        uint256 nonce,
        uint256 gasLimit,
        bytes32 messageId
    );

    event MessageStored(
        uint256 indexed sourceChainId,
        address indexed sourceContract,
        address indexed targetContract,
        bytes messageData,
        uint256 nonce,
        uint256 gasLimit,
        bytes32 messageId,
        bytes reason
    );

    event MessageCleared(
        uint256 indexed sourceChainId,
        address indexed sourceContract,
        address indexed targetContract,
        uint256 nonce,
        bytes32 messageId
    );

    event MessageResumeReceive(
        uint256 indexed sourceChainId,
        address indexed sourceContract,
        address indexed targetContract,
        bytes32 messageId
    );
    

    function initialize(address admin, uint _chainId, address _signatureVerifier, address _wanchainStoremanAdminSC) public initializer {
        // Initialize the AccessControl module with the given admin
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        chainId = _chainId;
        maxGasLimit = 8_000_000;
        minGasLimit = 150_000;
        defaultGasLimit = 2_000_000;
        maxMessageLength = 10_000;
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
    ) public payable nonReentrant returns (bytes32 messageId) {
        uint256 nonce = ++nonces[chainId][targetChainId][msg.sender][targetContract];
        require(gasLimit >= minGasLimit, "WmbGateway: Gas limit too low");
        uint256 fee = estimateFee(targetChainId, gasLimit);
        require(msg.value >= fee, "WmbGateway: Insufficient fee");
        if (msg.value > fee) {
            Address.sendValue(payable(msg.sender), msg.value - fee);
        }

        require(messageData.length <= maxMessageLength, "WmbGateway: Message too long");

        messageId = keccak256(
            abi.encodePacked(
                chainId,
                msg.sender,
                targetChainId,
                targetContract,
                messageData,
                nonce
            )
        );

        emit MessageSent(
            msg.sender,
            targetChainId,
            targetContract,
            chainId,
            messageData,
            nonce,
            gasLimit,
            messageId
        );
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
                chainId,
                targetContract,
                messageData,
                nonce
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
        require(gasLimit <= maxGasLimit, "WmbGateway: Gas limit exceeds maximum");
        return baseFees[targetChainId] * gasLimit;
    }

    function getNonce(
        uint256 fromChainId,
        uint256 toChainId,
        address fromAddress,
        address toAddress
    ) public view returns (uint256) {
        return nonces[fromChainId][toChainId][fromAddress][toAddress];
    }

    function getChainId() public view returns (uint256) {
        return chainId;
    }

    // Checks if a failed message is stored
    function hasStoredFailedMessage(uint16 _srcChainId, address _srcAddress, address _targetContract) external view returns (bool) {
        StoredMessage storage sm = storedMessages[_srcChainId][_srcAddress][_targetContract];
        return sm.messageHash != bytes32(0);
    }

    // Retries a failed message
    function retryFailedMessage(uint16 _srcChainId, address _srcAddress, address _targetContract, bytes calldata messageData) external {
        StoredMessage storage sm = storedMessages[_srcChainId][_srcAddress][_targetContract];
        require(sm.messageHash != bytes32(0), "WmbGateway: No failed message stored");
        require(sm.messageLength == messageData.length, "WmbGateway: Invalid message length");
        require(sm.messageHash == keccak256(messageData), "WmbGateway: Invalid message hash");
        delete storedMessages[_srcChainId][_srcAddress][_targetContract];

        uint nonce = nonces[_srcChainId][chainId][_srcAddress][_targetContract];
        bytes32 messageId = keccak256(
            abi.encodePacked(
                _srcChainId,
                _srcAddress,
                chainId,
                _targetContract,
                messageData,
                nonce
            )
        );

        IWmbReceiver(_targetContract).wmbReceive(messageData, messageId, _srcChainId, _srcAddress);

        emit MessageCleared(_srcChainId, _srcAddress, _targetContract, nonce, messageId);
    }

    // Forces resumption of a failed message's receipt
    function forceResumeReceive(uint16 _srcChainId, address _srcAddress) external {
        // only the target contract could call resume function.
        address _targetContract = msg.sender;
        StoredMessage storage sm = storedMessages[_srcChainId][_srcAddress][_targetContract];
        require(sm.messageHash != bytes32(0), "WmbGateway: No failed message stored");

        delete storedMessages[_srcChainId][_srcAddress][_targetContract];
        
        emit MessageResumeReceive(_srcChainId, _srcAddress, _targetContract, sm.messageId);
    }

    /**
     * @dev Function for the WMB Gateway contract, to be used by the contract administrator.
     * These functions are only accessible to accounts with the DEFAULT_ADMIN_ROLE.
     */

    function batchSetBaseFees(uint256[] calldata _targetChainIds, uint256[] calldata _baseFees) external {
        // limit AccessControl
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        require(_targetChainIds.length == _baseFees.length, "WmbGateway: Invalid input");
        for (uint256 i = 0; i < _targetChainIds.length; i++) {
            baseFees[_targetChainIds[i]] = _baseFees[i];
        }
    }

    function setSignatureVerifier(address _signatureVerifier) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        signatureVerifier = _signatureVerifier;
    }

    function setGasLimit(uint256 _maxGasLimit, uint256 _minGasLimit, uint256 _defaultGasLimit) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        maxGasLimit = _maxGasLimit;
        minGasLimit = _minGasLimit;
        defaultGasLimit = _defaultGasLimit;
    }

    function setMaxMessageLength(uint256 _maxMessageLength) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        maxMessageLength = _maxMessageLength;
    }

    function withdrawFee(address payable _to) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        _to.transfer(address(this).balance);
    }

    /**
     * @dev Functions to adapt the EIP-5164 interface.
     */

    function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable returns (bytes32 messageId) {
        return sendMessage(toChainId, to, data, defaultGasLimit);
    }

    function dispatchMessageBatch(uint256 /*toChainId*/, Message[] calldata /*messages*/) external payable returns (bytes32 /*messageId*/) {
        revert("WmbGateway: Batch is not supported");
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

        require(status == uint8(GroupStatus.ready) && block.timestamp >= startTime && block.timestamp <= endTime, "WmbGateway: SMG is not ready");

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
        require(IWanchainMPC(signatureVerifier).verify(curveID, sig.s, PKx, PKy, Rx, Ry, sig.message), "WmbGateway: Signature verification failed");
    }

    function _receiveMessage(
        bytes32 messageId,
        ReceiveMsgData memory data
    ) internal {
        require(data.nonce == ++nonces[data.sourceChainId][chainId][data.sourceContract][data.targetContract], "WmbGateway: Invalid nonce");
        require(Address.isContract(data.targetContract), "WmbGateway: Target address is not a contract");

        // block if any message blocking
        StoredMessage storage sm = storedMessages[data.sourceChainId][data.sourceContract][data.targetContract];
        require(sm.messageHash == bytes32(0), "WmbGateway: The message is in blocking");
        
        try IWmbReceiver(data.targetContract).wmbReceive{gas: data.gasLimit}(data.messageData, messageId, data.sourceChainId, data.sourceContract) {
            // success, do nothing, end of the receive message function.
            emit MessageIdExecuted(data.sourceChainId, messageId);
        } catch (bytes memory reason) {
            // revert nonce if any uncaught errors/exceptions if the ua chooses the blocking mode
            storedMessages[data.sourceChainId][data.sourceContract][data.targetContract] = StoredMessage(uint64(data.messageData.length), keccak256(data.messageData), messageId);
            emit MessageStored(data.sourceChainId, data.sourceContract, data.targetContract, data.messageData, data.nonce, data.gasLimit, messageId, reason);
        }
    }
}
