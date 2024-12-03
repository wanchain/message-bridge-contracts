// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IWmbGatewayV2 {
    function dispatchMessageV2(uint256 toChainId, address to, uint256 gasLimit, bytes calldata data) external returns (bytes32 messageId);
}

abstract contract WmbAppV2 is Ownable {

    address public wmbGateway;

    mapping (uint => mapping(address => bool)) public trustedRemotes;

    event SetTrustedRemote(uint256 fromChainId, address from, bool trusted);

    constructor(address _wmbGateway) {
        wmbGateway = _wmbGateway;
    }

    function wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) virtual external {
        // Only the WMB gateway can call this function
        require(msg.sender == wmbGateway, "WmbApp: Only WMB gateway can call this function");
        require(trustedRemotes[fromChainId][from], "WmbApp: Remote is not trusted");
        _wmbReceive(data, messageId, fromChainId, from);
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 messageId,
        uint256 fromChainId,
        address from
    ) virtual internal;

    function _dispatchMessageV2(
        uint toChainId,
        address to,
        uint gasLimit,
        bytes memory data
    ) virtual internal returns (bytes32) {
        return IWmbGatewayV2(wmbGateway).dispatchMessageV2(toChainId, to, gasLimit, data);
    }

    function setTrustedRemote(uint fromChainId, address from, bool trusted) internal {
        trustedRemotes[fromChainId][from] = trusted;
        emit SetTrustedRemote(fromChainId, from, trusted);
    }
}