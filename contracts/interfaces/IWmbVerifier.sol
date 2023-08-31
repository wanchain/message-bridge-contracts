// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWmbVerifier {
    function verify(bytes32 dataHash, bytes memory sigInfo) external view returns (bool);
}
