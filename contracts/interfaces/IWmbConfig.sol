// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IWmbConfig {
    /**
     * @dev Batch sets the base fee for different target chains
     * @param targetChainIds An array of target chain IDs
     * @param baseFees An array of base fee values, corresponding to the target chain IDs
     */
    function batchSetBaseFees(uint256[] calldata targetChainIds, uint256[] calldata baseFees) external;

    /**
     * @dev Sets the signature verification and contract addresses
     * @param signatureVerifier The address of the signature verification contract
     */
    function setSignatureVerifier(address signatureVerifier) external;

    /**
     * @dev Sets the maximum global gas limit
     * @param maxGasLimit The maximum global gas limit value to set
     */
    function setMaxGasLimit(uint256 maxGasLimit) external;
}
