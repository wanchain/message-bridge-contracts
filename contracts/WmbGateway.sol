// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IWmbGateway.sol";
import "./interfaces/IWmbConfig.sol";
import "./interfaces/IWanchainMPC.sol";
import "./interfaces/IWmbReceiver.sol";

/**
 * @title WmbGateway
 * @dev The main entry point of Wanchain cross-chain asset transfer system.
 *      The contract serves as a gateway for cross-chain transactions between different blockchain networks. 
 */
contract WmbGateway is AccessControl, Initializable, ReentrancyGuard, IWmbGateway, IWmbConfig {
    // slip-0044 standands chainId for local chain
    uint256 public chainId;

    // Global maximum gas limit for a message
    uint256 public maxGasLimit;
    uint256 public minGasLimit;

    uint256 public maxMessageLength;

    // Address of the signature verification contract
    address public signatureVerifier;

    // Address of the Wanchain Storeman Admin contract
    address public wanchainStoremanAdminSC;

    // Mapping of message IDs to message execution status
    mapping(bytes32 => bool) public messageExecuted;

    // Mapping of target chain IDs to base fees
    mapping(uint256 => uint256) public baseFees;

    // Mapping of messageId to gas limit
    mapping(bytes32 => uint256) public messageGasLimit;

    // Mapping of sourceChainId->dstChainId->sourceContract->targetContract->nonce to prevent replay attacks
    mapping(uint256 => mapping(uint256 => mapping(address => mapping(address => uint256)))) public nonces;

    // Mapping of target chain IDs to supported status
    mapping(uint256 => bool) public supportedDstChains;

    struct ReceiveMsgData {
        uint256 sourceChainId;
        address sourceContract;
        address targetContract;
        bytes messageData;
        uint256 gasLimit;
    }

    struct ReceiveBatchMsgData {
        uint256 sourceChainId;
        address sourceContract;
        Message[] messages;
        uint256 gasLimit;
    }

    struct SigData {
        bytes32 sigHash;
        bytes32 smgID; 
        bytes r;
        bytes32 s;
    }

    // Status of a Storeman Group
    enum GroupStatus { none, initial, curveSeted, failed, selected, ready, unregistered, dismissed }
    

    function initialize(address admin, uint _chainId, address _signatureVerifier, address _wanchainStoremanAdminSC) public initializer {
        // Initialize the AccessControl module with the given admin
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        chainId = _chainId;
        maxGasLimit = 8_000_000;
        minGasLimit = 150_000;
        maxMessageLength = 10_000;
        signatureVerifier = _signatureVerifier;
        wanchainStoremanAdminSC = _wanchainStoremanAdminSC;
    }

    /**
     * @dev Public interface functions for the WMB Gateway contract.
     */

    function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable nonReentrant returns (bytes32 messageId) {
        require(supportedDstChains[toChainId], "WmbGateway: Unsupported destination chain");
        require(msg.value >= minGasLimit * baseFees[toChainId], "WmbGateway: Fee too low");
        
        uint gasLimit = msg.value / baseFees[toChainId];
        messageId = _sendMessage(toChainId, to, data);
        messageGasLimit[messageId] = gasLimit;
        emit MessageDispatched(messageId, msg.sender, toChainId, to, data);
    }

    function dispatchMessageBatch(uint256 toChainId, Message[] calldata messages) external payable nonReentrant returns (bytes32 messageId) {
        require(supportedDstChains[toChainId], "WmbGateway: Unsupported destination chain");
        require(msg.value >= minGasLimit * baseFees[toChainId], "WmbGateway: Fee too low");
        
        uint length = messages.length;
        uint gasLimit = msg.value / baseFees[toChainId];

        for (uint256 i = 0; i < length; i++) {
            bytes32 subId = _sendMessage(toChainId, messages[i].to, messages[i].data);
            if (i == 0) {
                messageId = subId;
            } else {
                messageId = keccak256(abi.encodePacked(messageId, subId));
            }
        }

        messageGasLimit[messageId] = gasLimit;
        emit MessageBatchDispatched(messageId, msg.sender, toChainId, messages);
    }

    function estimateFee(
        uint256 targetChainId,
        uint256 gasLimit
    ) public view returns (uint256 fee) {
        require(supportedDstChains[targetChainId], "WmbGateway: Unsupported destination chain");
        require(gasLimit <= maxGasLimit, "WmbGateway: Gas limit exceeds maximum");
        if (gasLimit < minGasLimit) {
            return baseFees[targetChainId] * minGasLimit;
        }
        return baseFees[targetChainId] * gasLimit;
    }

    // Receives a message sent from another chain
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
    ) external {
        _receiveMessage(
            messageId,
            ReceiveMsgData(
                sourceChainId,
                sourceContract,
                targetContract,
                messageData,
                gasLimit
            )
        );

        bytes32 sigHash = keccak256(abi.encode(
            messageId,
            sourceChainId,
            sourceContract,
            chainId,
            targetContract,
            messageData
        ));

        // verify signature
        verifyMpcSignature(
            SigData(
                sigHash, smgID, r, s
            )
        );
    }

    // Receives a message sent from another chain
    function receiveBatchMessage(
        bytes32 messageId,
        uint256 sourceChainId,
        address sourceContract,
        Message[] calldata messages,
        uint256 gasLimit,
        bytes32 smgID,
        bytes calldata r, 
        bytes32 s
    ) external {
        _receiveBatchMessage(
            messageId,
            ReceiveBatchMsgData(
                sourceChainId,
                sourceContract,
                messages,
                gasLimit
            )
        );

        bytes32 sigHash = keccak256(abi.encode(
            messageId,
            sourceChainId,
            sourceContract,
            chainId,
            messages
        ));

        // verify signature
        verifyMpcSignature(
            SigData(
                sigHash, smgID, r, s
            )
        );
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

    function setGasLimit(uint256 _maxGasLimit, uint256 _minGasLimit) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        maxGasLimit = _maxGasLimit;
        minGasLimit = _minGasLimit;
    }

    function setMaxMessageLength(uint256 _maxMessageLength) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        maxMessageLength = _maxMessageLength;
    }

    function withdrawFee(address payable _to) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        _to.transfer(address(this).balance);
    }

    function setSupportedDstChains(uint256[] calldata targetChainIds, bool[] calldata supported) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "WmbGateway: Caller is not an admin");
        require(targetChainIds.length == supported.length, "WmbGateway: Invalid input");
        for (uint256 i = 0; i < targetChainIds.length; i++) {
            supportedDstChains[targetChainIds[i]] = supported[i];
        }
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
        require(IWanchainMPC(signatureVerifier).verify(curveID, sig.s, PKx, PKy, Rx, Ry, sig.sigHash), "WmbGateway: Signature verification failed");
    }

    function _sendMessage(
        uint256 targetChainId,
        address targetContract,
        bytes calldata messageData
    ) internal returns (bytes32 messageId) {
        uint256 nonce = ++nonces[chainId][targetChainId][msg.sender][targetContract];
        require(messageData.length <= maxMessageLength, "WmbGateway: Message too long");
        messageId = keccak256(
            abi.encodePacked(
            chainId,
            msg.sender,
            targetChainId,
            targetContract,
            messageData,
            nonce
        ));
    }

    function _receiveMessage(
        bytes32 messageId,
        ReceiveMsgData memory data
    ) internal {
        if(messageExecuted[messageId]) {
            revert MessageIdAlreadyExecuted({messageId: messageId});
        }
        messageExecuted[messageId] = true;
        
        try IWmbReceiver(data.targetContract).wmbReceive{gas: data.gasLimit}(data.messageData, messageId, data.sourceChainId, data.sourceContract) {
            emit MessageIdExecuted(data.sourceChainId, messageId);
        } catch (bytes memory reason) {
            revert MessageFailure({
                messageId: messageId,
                errorData: reason
            });
        }
    }

    function _receiveBatchMessage(
        bytes32 messageId,
        ReceiveBatchMsgData memory data
    ) internal {
        if(messageExecuted[messageId]) {
            revert MessageIdAlreadyExecuted({messageId: messageId});
        }
        messageExecuted[messageId] = true;
        
        uint length = data.messages.length;
        uint i = 0;
        for (i = 0; i < length; i++) {
            try IWmbReceiver(data.messages[i].to).wmbReceive{gas: gasleft()}(data.messages[i].data, messageId, data.sourceChainId, data.sourceContract) {
                // do nothing
            } catch (bytes memory reason) {
                revert MessageBatchFailure({
                    messageId: messageId,
                    messageIndex: i,
                    errorData: reason
                });
            }
        }
        
        emit MessageIdExecuted(data.sourceChainId, messageId);
    }
}
