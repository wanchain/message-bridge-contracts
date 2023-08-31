// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWmbVerifier {
    function verify(bytes32 sigHash, bytes32 sigId, bytes memory sigInfo, bytes32 signature) external view returns (bool);
}
