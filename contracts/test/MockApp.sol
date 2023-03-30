// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../WmbApp.sol";

contract MockApp is WmbApp {
    bytes32 public receivedMessageId;
    bytes public receivedMessageData;
    uint256 public receivedFromChainId;
    address public receivedFrom;

    constructor(address admin, address _wmbGateway, bool _blockMode) WmbApp() {
        initialize(admin, _wmbGateway, _blockMode);
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) internal override {
        receivedMessageId = messageId;
        receivedMessageData = data;
        receivedFromChainId = fromChainId;
        receivedFrom = from;
    }
}
