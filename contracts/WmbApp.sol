// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./utils/ExcessivelySafeCall.sol";
import "./interfaces/IWmbGateway.sol";
import "./interfaces/IWmbReceiver.sol";

/**
 * @title WmbApp
 * @dev Abstract contract to be inherited by applications to use Wanchain Message Bridge for send and receive messages
 */
abstract contract WmbApp is AccessControl, Initializable, IWmbReceiver {
    // Import the ExcessivelySafeCall library for safe external function calls
    using ExcessivelySafeCall for address;

    // The address of the WMB Gateway contract
    address public wmbGateway;

    // A boolean flag indicating whether the block mode is enabled
    bool public blockMode;

    // A mapping of remote chains and addresses that are trusted to send messages to this contract
    // fromChainId => fromAddress => trusted
    mapping (uint => mapping(address => bool)) public trustedRemotes;

    // A mapping of failed messages by their chain ID, address, and message ID, with the value being the message hash
    // This is used to keep track of failed messages in order to retry them later
    // fromChainId => fromAddress => messageId => messageHash
    mapping (uint => mapping(address => mapping(bytes32 => bytes32))) public failedMessages;

    event MessageFailed(
        bytes32 indexed messageId,
        uint256 indexed fromChainId,
        address indexed from,
        bytes data,
        bytes reason
    );

    event RetryMessageSuccess(
        uint256 indexed fromChainId,
        address indexed from,
        bytes32 indexed messageId,
        bytes32 messageHash
    );

    /**
     * @dev Initializes the contract with the given admin, WMB Gateway address, and block mode flag
     * @param admin Address of the contract admin
     * @param _wmbGateway Address of the WMB Gateway contract
     * @param _blockMode Whether to use block mode or non-block mode on WMB message execution failure
     */
    function initialize(address admin, address _wmbGateway, bool _blockMode) public initializer {
        // Initialize the AccessControl module with the given admin
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        wmbGateway = _wmbGateway;
        blockMode = _blockMode;
    }

    /**
     * @dev Function to receive a WMB message from the WMB Gateway
     * @param data Message data
     * @param messageId Message ID
     * @param fromChainId ID of the chain the message is from
     * @param from Address of the contract the message is from
     */
    function wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) external {
        // Only the WMB gateway can call this function
        require(msg.sender == wmbGateway, "WmbApp: Only WMB gateway can call this function");
        require(trustedRemotes[fromChainId][from], "WmbApp: Remote is not trusted");
        if (blockMode) {
            _wmbReceive(data, messageId, fromChainId, from);
        } else {
            (bool success, bytes memory reason) = address(this).excessivelySafeCall(gasleft(), 150, abi.encodeWithSelector(this.nonblockingWmbReceive.selector, data, messageId, fromChainId, from));
            // try-catch all errors/exceptions
            if (!success) {
                _storeFailedMessage(data, messageId, fromChainId, from, reason);
            }
        }
    }

    // @dev internal use only for safe non-blocking call to _wmbReceive
    function nonblockingWmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) public {
        require(msg.sender == address(this), "WmbApp: Only this contract can call this function");
        _wmbReceive(data, messageId, fromChainId, from);
    }

    /**
     * @notice Override this function to handle received WMB messages
     * @dev Function to handle received WMB messages
     * @param data Message data
     * @param messageId Message ID
     * @param fromChainId ID of the chain the message is from
     * @param from Address of the message sender on source chain
     * 
     */
    function _wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) internal virtual;

    /**
     * @dev Stores the failed message in the `failedMessages` mapping and emits a `MessageFailed` event
     * @param data The data of the failed message
     * @param messageId The ID of the failed message
     * @param fromChainId The ID of the chain the message was sent from
     * @param from The address the message was sent from
     * @param _reason The reason why the message failed
     */
    function _storeFailedMessage(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from,
        bytes memory _reason
    ) internal virtual {
        failedMessages[fromChainId][from][messageId] = keccak256(data);
        emit MessageFailed(messageId, fromChainId, from, data, _reason);
    }

    /**
     * @notice Retry a failed message by resending the same data
     * @param data The data of the failed message
     * @param messageId The ID of the failed message
     * @param fromChainId The ID of the source chain
     * @param from The address of the source contract
     */
    function retryMessage(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) public payable virtual {
        // assert there is message to retry
        bytes32 messageHash = failedMessages[fromChainId][from][messageId];
        require(messageHash != bytes32(0), "WmbApp: no stored message");
        require(keccak256(data) == messageHash, "WmbApp: invalid message data");
        // clear the stored message
        delete failedMessages[fromChainId][from][messageId];
        // execute the message. revert if it fails again
        _wmbReceive(data, messageId, fromChainId, from);
        emit RetryMessageSuccess(fromChainId, from, messageId, messageHash);
    }


}