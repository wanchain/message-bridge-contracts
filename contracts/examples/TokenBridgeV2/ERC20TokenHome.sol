// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../app/WmbAppV2.sol";

contract ERC20TokenHome is WmbAppV2 {
    using SafeERC20 for IERC20;

    address public tokenAddress;
    address public tokenRemote;
    uint256 public remoteChainId;

    event SendTokenToRemote(uint256 indexed toChainId, address indexed from, address indexed to, uint256 amount);
    event ReceiveTokenFromRemote(uint256 indexed fromChainId, address indexed from, address indexed to, uint256 amount);
    event ConfigTokenRemote(address tokenRemote);

    constructor(address _wmbGateway, address _tokenAddress) WmbAppV2(_wmbGateway) {
        tokenAddress = _tokenAddress;
    }

    function configTokenRemote(uint256 _remoteChainId, address _tokenRemote) external onlyOwner {
        tokenRemote = _tokenRemote;
        remoteChainId = _remoteChainId;
        setTrustedRemote(remoteChainId, tokenRemote, true);
        emit ConfigTokenRemote(tokenRemote);
    }

    function send(address to, uint256 amount) external {
        require(tokenRemote != address(0), "tokenRemote not set");
        require(amount > 0, "Amount must be greater than 0");
        require(to != address(0), "Invalid receiver address");
        uint balance = IERC20(tokenAddress).balanceOf(address(this));
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        uint newBalance = IERC20(tokenAddress).balanceOf(address(this));
        uint receivedAmount = newBalance - balance;
        _dispatchMessageV2(remoteChainId, tokenRemote, 300_000, abi.encode(msg.sender, to, receivedAmount));
        emit SendTokenToRemote(remoteChainId, msg.sender, to, receivedAmount);
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 /*messageId*/,
        uint256 fromChainId,
        address /*from*/
    ) override internal {
        (address fromAccount, address to, uint256 amount) = abi.decode(data, (address, address, uint256));
        IERC20(tokenAddress).safeTransfer(to, amount);
        emit ReceiveTokenFromRemote(fromChainId, fromAccount, to, amount);
    }
}