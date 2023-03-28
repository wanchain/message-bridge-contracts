// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract WmbGateway is AccessControl, Initializable, ReentrancyGuard {
    // slip-0044 standands chainId for local chain
    uint256 public chainId;


    function initialize(address admin, uint _chainId) public initializer {
        // Initialize the AccessControl module with the given admin
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        chainId = _chainId;
    }

    // Add your functions and modifiers here

}

