// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract MultiSigVerifier {
    using EnumerableSet for EnumerableSet.AddressSet;
 
    EnumerableSet.AddressSet private owners;
    EnumerableSet.AddressSet private signers;

    uint256 public threshold;

    modifier onlySelf() {
        require(msg.sender == address(this), "only self");
        _;
    }

    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);

    constructor(address[] memory _owners, uint256 _threshold) {
        require(_owners.length > 0, "owners length must > 0");
        require(_threshold > 0, "threshold must > 0");
        require(_threshold <= _owners.length, "threshold must <= owners length");
        for (uint256 i = 0; i < _owners.length; i++) {
            owners.add(_owners[i]);
            emit OwnerAdded(_owners[i]);
        }
        threshold = _threshold;
    }

    function getOwners() public view returns (address[] memory) {
        address[] memory result = new address[](owners.length());
        for (uint256 i = 0; i < owners.length(); i++) {
            result[i] = owners.at(i);
        }
        return result;
    }

    function addOwner(address owner) public onlySelf {
        require(!owners.contains(owner), "owner already exists");
        owners.add(owner);
        emit OwnerAdded(owner);
    }

    function swapOwner(address oldOwner, address newOwner) public onlySelf {
        require(owners.contains(oldOwner), "owner not exists");
        owners.remove(oldOwner);
        owners.add(newOwner);
        emit OwnerRemoved(oldOwner);
        emit OwnerAdded(newOwner);
    }

    function removeOwner(address owner) public onlySelf {
        require(owners.contains(owner), "owner not exists");
        owners.remove(owner);
        emit OwnerRemoved(owner);
    }

    function execTransaction(address to, bytes calldata data, bytes memory signatures) public {
        bytes32 dataHash = keccak256(abi.encodePacked(to, data));
        require(verify(dataHash, signatures), "invalid signatures");
        (bool success, bytes memory returnData) = to.call(data);
        require(success, string(returnData));
    }

    /// @dev verifies signatures
    /// @param dataHash hash of the data to be verified
    /// @param signatures concatenated rsv signatures, format {bytes32 r}{bytes32 s}{uint8 v}
    function verify(bytes32 dataHash, bytes memory signatures) public returns (bool) {
        uint256 count = signatures.length / 65;
        require(count >= threshold, "insufficient signatures");
        for (uint256 i = 0; i < count; i++) {
            (uint8 v, bytes32 r, bytes32 s) = signatureSplit(signatures, i);
            address signer = ecrecover(dataHash, v, r, s);
            require(owners.contains(signer), "invalid signer");
            require(!signers.contains(signer), "duplicate signer");
            signers.add(signer);
        }
        bool success = signers.length() >= threshold;

        // clear signers 
        for (uint256 i = 0; i < signers.length(); i++) {
            signers.remove(signers.at(i));
        }

        return success;
    }

    /// @dev divides bytes signature into `uint8 v, bytes32 r, bytes32 s`.
    /// @notice Make sure to peform a bounds check for @param pos, to avoid out of bounds access on @param signatures
    /// @param pos which signature to read. A prior bounds check of this parameter should be performed, to avoid out of bounds access
    /// @param signatures concatenated rsv signatures
    function signatureSplit(bytes memory signatures, uint256 pos)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let signaturePos := mul(0x41, pos)
            r := mload(add(signatures, add(signaturePos, 0x20)))
            s := mload(add(signatures, add(signaturePos, 0x40)))
            // Here we are loading the last 32 bytes, including 31 bytes
            // of 's'. There is no 'mload8' to do this.
            //
            // 'byte' is not working due to the Solidity parser, so lets
            // use the second best option, 'and'
            v := and(mload(add(signatures, add(signaturePos, 0x41))), 0xff)
        }
    }
}