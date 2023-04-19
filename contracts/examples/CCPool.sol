// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../app/WmbApp.sol";

// Cross Chain Token Pool
contract CCPool is WmbApp {
    address public poolToken;

    // chain id => remote pool address
    mapping(uint => address) public remotePools;

    event Cross(uint256 indexed fromChainId, address indexed from, address indexed to, uint256 amount, string crossType);

    error RevertFailed (
        address from,
        address to,
        uint256 amount,
        uint256 fromChainId
    );

    constructor(address admin, address _wmbGateway, address _poolToken) WmbApp() {
        initialize(admin, _wmbGateway);
        poolToken = _poolToken;
    }

    function configRemotePool(uint256 chainId, address remotePool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        remotePools[chainId] = remotePool;
    }

    function crossTo(uint256 toChainId, address to, uint256 amount) public {
        require(remotePools[toChainId] != address(0), "remote pool not configured");

        IERC20(poolToken).transferFrom(msg.sender, address(this), amount);

        uint fee = estimateFee(toChainId, 800_000);

        _dispatchMessage(toChainId, remotePools[toChainId], abi.encode(msg.sender, to, amount, "crossTo"), fee);
    }

    // Transfer in enough native coin for fee. 
    receive() external payable {}

    function _wmbReceive(
        bytes calldata data,
        bytes32 /*messageId*/,
        uint256 fromChainId,
        address fromSC
    ) internal override {
        (address fromAccount, address to, uint256 amount, string memory crossType) = abi.decode(data, (address, address, uint256, string));
        if (IERC20(poolToken).balanceOf(address(this)) >= amount) {
            IERC20(poolToken).transfer(to, amount);
            emit Cross(fromChainId, fromAccount, to, amount, crossType);
        } else {
            if (keccak256(bytes(crossType)) == keccak256("crossTo")) {
                uint fee = estimateFee(fromChainId, 400_000);
                _dispatchMessage(fromChainId, fromSC, abi.encode(msg.sender, to, amount, "crossRevert"), fee);
            } else {
                revert RevertFailed(fromAccount, to, amount, fromChainId);
            }
        }
    }
}
