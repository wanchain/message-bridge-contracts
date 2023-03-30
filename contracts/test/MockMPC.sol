// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../interfaces/IWanchainMPC.sol";

contract MockMPC is IWanchainMPC {
    function getStoremanGroupConfig(bytes32 /*id*/) external view override returns (bytes32, uint8, uint, uint, uint, uint, uint, bytes memory, bytes memory, uint, uint) {
        return (0x1234567890123456789012345678901234567890123456789012345678901234, 1, 1000, 1, 2, 1, 2, abi.encodePacked("group public key 1"), abi.encodePacked("group public key 2"), block.timestamp - 100, block.timestamp + 3600);
    }

    function verify(
        uint /*curveId*/, 
        bytes32 /*signature*/, 
        bytes32 /*groupKeyX*/, 
        bytes32 /*groupKeyY*/, 
        bytes32 /*randomPointX*/, 
        bytes32 /*randomPointY*/, 
        bytes32 /*message*/
    ) external override pure returns (bool) {
        return true;
    }
}
