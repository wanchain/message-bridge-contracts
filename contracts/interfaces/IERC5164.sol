// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

struct Message {
    address to;
    bytes data;
}

interface IERC5164 {

    event MessageDispatched(
        bytes32 indexed messageId,
        address indexed from,
        uint256 indexed toChainId,
        address to,
        bytes data,
    );

    event MessageBatchDispatched(
        bytes32 indexed messageId,
        address indexed from,
        uint256 indexed toChainId,
        Message[] messages
    );

    function dispatchMessage(uint256 toChainId, address to, bytes calldata data) external payable returns (bytes32 messageId);

    function dispatchMessageBatch(uint256 toChainId, Message[] calldata messages) external payable returns (bytes32 messageId);

    // MessageExecutor
    // MessageExecutors MUST append the ABI-packed (messageId, fromChainId, from) to the calldata for each message being executed.
    // to.call(abi.encodePacked(data, messageId, fromChainId, from));

    error MessageIdAlreadyExecuted(
        bytes32 messageId
    );

    error MessageFailure(
        bytes32 messageId,
        bytes errorData
    );

    error MessageBatchFailure(
        bytes32 messageId,
        uint256 messageIndex,
        bytes errorData
    );

    event MessageIdExecuted(
        uint256 indexed fromChainId,
        bytes32 indexed messageId
    );
}
