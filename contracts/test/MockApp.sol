// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../WmbApp.sol";

contract MockApp is WmbApp {
    
    struct MessageData {
        bytes32 messageId;
        bytes data;
        uint256 fromChainId;
        address from;
    }

    mapping(bytes32 => MessageData) public receivedMessages;

    constructor(address admin, address _wmbGateway, bool _blockMode) WmbApp() {
        initialize(admin, _wmbGateway, _blockMode);
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) internal override {
        receivedMessages[messageId] = MessageData(messageId, data, fromChainId, from);
    }
}
