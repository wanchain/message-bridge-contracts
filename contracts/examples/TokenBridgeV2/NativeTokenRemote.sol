// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../app/WmbAppV2.sol";

contract NativeTokenRemote is WmbAppV2, ERC20 {
    using SafeERC20 for IERC20;

    address public homeAddress;
    uint256 public homeChainId;

    event SendTokenToHome(uint256 indexed homeChainId, address indexed from, address indexed to, uint256 amount);
    event ReceiveTokenFromHome(uint256 indexed fromChainId, address indexed from, address indexed to, uint256 amount);

    constructor(
        address _wmbGateway, 
        address _homeAddress, 
        uint256 _homeChainId, 
        string memory _name, 
        string memory _symbol
    ) ERC20(_name, _symbol) WmbAppV2(_wmbGateway) {
        homeAddress = _homeAddress;
        homeChainId = _homeChainId;
        setTrustedRemote(_homeChainId, _homeAddress, true);
    }

    function send(address to, uint256 amount) external {
        require(homeAddress != address(0), "homeAddress not set");
        require(amount > 0, "Amount must be greater than 0");
        require(to != address(0), "Invalid receiver address");
        _burn(msg.sender, amount);
        _dispatchMessageV2(homeChainId, homeAddress, 300_000, abi.encode(msg.sender, to, amount));
        emit SendTokenToHome(homeChainId, msg.sender, to, amount);
    }

    function _wmbReceive(
        bytes calldata data,
        bytes32 /*messageId*/,
        uint256 fromChainId,
        address /*from*/
    ) override internal {
        (address fromAccount, address to, uint256 amount) = abi.decode(data, (address, address, uint256));
        _mint(to, amount);
        emit ReceiveTokenFromHome(fromChainId, fromAccount, to, amount);
    }
}