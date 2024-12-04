// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Address.sol";
import "../../app/WmbAppV2.sol";

contract NativeTokenHome is WmbAppV2 {

    address public tokenRemote;
    uint256 public remoteChainId;

    event SendTokenToRemote(uint256 indexed toChainId, address indexed from, address indexed to, uint256 amount);
    event ReceiveTokenFromRemote(uint256 indexed fromChainId, address indexed from, address indexed to, uint256 amount);
    event ConfigTokenRemote(address tokenRemote);

    constructor(address _wmbGateway) WmbAppV2(_wmbGateway) {}

    function configTokenRemote(uint256 _remoteChainId, address _tokenRemote) external onlyOwner {
        tokenRemote = _tokenRemote;
        remoteChainId = _remoteChainId;
        setTrustedRemote(remoteChainId, tokenRemote, true);
        emit ConfigTokenRemote(tokenRemote);
    }

    function send(address to) payable external {
        require(tokenRemote != address(0), "tokenRemote not set");
        require(to != address(0), "Invalid receiver address");
        require(msg.value > 0, "Value must be greater than 0");
        _dispatchMessageV2(remoteChainId, tokenRemote, 300_000, abi.encode(msg.sender, to, msg.value));
        emit SendTokenToRemote(remoteChainId, msg.sender, to, msg.value);
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 /*messageId*/,
        uint256 fromChainId,
        address /*from*/
    ) override internal {
        (address fromAccount, address to, uint256 amount) = abi.decode(data, (address, address, uint256));
        Address.sendValue(payable(to), amount);
        emit ReceiveTokenFromRemote(fromChainId, fromAccount, to, amount);
    }
}