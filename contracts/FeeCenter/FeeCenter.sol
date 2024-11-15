// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FeeCenter is AccessControl, Initializable, ReentrancyGuard {
    using Address for address;
    using SafeERC20 for IERC20;

    // Platform fee, 10000 means 100%
    uint256 public platformFee;

    address[] public supportedTokens;

    mapping(address => bool) public isSupportedToken;
    
    // User balance mapping: user => token => amount
    mapping(address => mapping(address => int256)) public userBalances;

    // Approved spender mapping: user => spender => approved
    mapping(address => mapping(address => bool)) public approvedSpenders;

    // Mapping from spender to user
    mapping(address => address) public spenderToUser;

    // Add new mapping to track all spenders for each user
    mapping(address => address[]) public userSpenders;

    // Accumulated fees mapping: token => amount
    mapping(address => uint256) public accumulatedFees;

    // Mapping from To ChainId to fee token
    mapping(uint256 => address) public chainIdToFeeToken;
    
    bytes32 public constant FEE_WITHDRAWER_ROLE = keccak256("FEE_WITHDRAWER_ROLE");
    
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // Add constant for native token representation
    address public constant NATIVE_COIN = address(0);

    event TokenAdded(address token);
    event TokenRemoved(address token);
    event FeesDeposited(address user, address token, uint256 amount);
    event FeesWithdrawn(address user, address token, uint256 amount);
    event FeesSpent(address indexed user, address indexed spender, uint256 fromChainId, uint256 toChainId, address token, uint256 amount, int256 newBalance);
    event SpenderApproved(address user, address spender, bool approved);
    event FeesCollected(address admin, address token, uint256 amount);
    event InsufficientFees(address indexed user, address indexed token, uint256 required, int256 current);

    function initialize(address owner, address feeWithdrawer, address agent) public initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(FEE_WITHDRAWER_ROLE, feeWithdrawer);
        _grantRole(AGENT_ROLE, agent);
        platformFee = 2000; // 20%
    }

    function configToChainToken(uint256 toChainId, address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token != NATIVE_COIN) {
            require(token.isContract(), "Token must be a contract");
        }
        isSupportedToken[token] = true;
        chainIdToFeeToken[toChainId] = token;
        supportedTokens.push(token);
        emit TokenAdded(token);
    }

    function depositFees(address token, uint256 amount) external nonReentrant payable {
        if (token == NATIVE_COIN) {
            require(msg.value == amount, "Invalid native token amount");
            userBalances[msg.sender][NATIVE_COIN] += int256(amount);
            emit FeesDeposited(msg.sender, NATIVE_COIN, amount);
        } else {
            require(isSupportedToken[token], "Unsupported token");
            require(msg.value == 0, "Native token not expected");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            userBalances[msg.sender][token] += int256(amount);
            emit FeesDeposited(msg.sender, token, amount);
        }
    }

    function withdrawFees(address token, uint256 amount) external nonReentrant {
        require(token == NATIVE_COIN || isSupportedToken[token], "Unsupported token");
        require(userBalances[msg.sender][token] >= int256(amount), "Insufficient balance");
        userBalances[msg.sender][token] -= int256(amount);
        
        if (token == NATIVE_COIN) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        emit FeesWithdrawn(msg.sender, token, amount);
    }

    function approveSpender(address spender, bool approved) external {
        require(spender != address(0), "Invalid spender address");
        approvedSpenders[msg.sender][spender] = approved;
        spenderToUser[spender] = msg.sender;
        
        if (approved) {
            // If approving a new spender, add to the user's spender list
            bool exists = false;
            for (uint i = 0; i < userSpenders[msg.sender].length; i++) {
                if (userSpenders[msg.sender][i] == spender) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                userSpenders[msg.sender].push(spender);
            }
        } else {
            // If revoking approval, remove from the user's spender list
            for (uint i = 0; i < userSpenders[msg.sender].length; i++) {
                if (userSpenders[msg.sender][i] == spender) {
                    userSpenders[msg.sender][i] = userSpenders[msg.sender][userSpenders[msg.sender].length - 1];
                    userSpenders[msg.sender].pop();
                    break;
                }
            }
            // Clear the spenderToUser mapping
            delete spenderToUser[spender];
        }
        
        emit SpenderApproved(msg.sender, spender, approved);
    }

    function isSpenderApproved(address spender) external view returns (bool) {
        return approvedSpenders[spenderToUser[spender]][spender];
    }

    function feeBalance(address spender, uint256 toChainId, uint256 amount) external view returns (bool enough, uint256 balance) {
        address token = chainIdToFeeToken[toChainId];
        uint256 amountAndFee = amount + amount * platformFee / 10000;
        enough = userBalances[spenderToUser[spender]][token] >= int256(amountAndFee);
        balance = uint256(userBalances[spenderToUser[spender]][token]);
    }

    function spendFees(address spender, uint256 fromChainId, uint256 toChainId, uint256 amount) external onlyRole(AGENT_ROLE) {
        address user = spenderToUser[spender];
        require(user != address(0), "Spender not registered");
        require(approvedSpenders[user][spender], "Spender not approved");
        address token = chainIdToFeeToken[toChainId];
        uint256 amountAndFee = amount + amount * platformFee / 10000;
        if (userBalances[user][token] < int256(amountAndFee)) {
            emit InsufficientFees(user, token, amountAndFee, userBalances[user][token]);
        }
        userBalances[user][token] -= int256(amountAndFee);
        accumulatedFees[token] += amountAndFee;
        emit FeesSpent(user, spender, fromChainId, toChainId, token, amountAndFee, userBalances[user][token]);
    }

    function collectFees(address token, uint256 amount) public onlyRole(FEE_WITHDRAWER_ROLE) {
        require(accumulatedFees[token] >= amount, "Insufficient accumulated fees");
        accumulatedFees[token] -= amount;
        
        if (token == NATIVE_COIN) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Native token transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        emit FeesCollected(msg.sender, token, amount);
    }

    function collectAllFees() external {
        for (uint i = 0; i < supportedTokens.length; i++) {
            collectFees(supportedTokens[i], accumulatedFees[supportedTokens[i]]);
        }
    }

    function setPlatformFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= 10000, "Fee exceeds 100%");
        platformFee = newFee;
    }

    function getUserBalance(address user, address token) external view returns (int256) {
        return userBalances[user][token];
    }

    function getUserBalances(address user) external view returns (address[] memory tokens, uint8[] memory decimals, int256[] memory balances) {
        tokens = supportedTokens;
        decimals = new uint8[](supportedTokens.length);
        balances = new int256[](supportedTokens.length);
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] != NATIVE_COIN) {
                decimals[i] = ERC20(supportedTokens[i]).decimals();
            } else {
                decimals[i] = 18;
            }
            balances[i] = userBalances[user][supportedTokens[i]];
        }
    }

    function getAllAccumulatedFees() external view returns (address[] memory tokens, uint8[] memory decimals, uint256[] memory amounts) {
        tokens = supportedTokens;
        decimals = new uint8[](supportedTokens.length);
        amounts = new uint256[](supportedTokens.length);
        for (uint i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] != NATIVE_COIN) {
                decimals[i] = ERC20(supportedTokens[i]).decimals();
            } else {
                decimals[i] = 18;
            }
            amounts[i] = accumulatedFees[supportedTokens[i]];
        }
    }

    // Add new helper function to get all spenders for a user
    function getUserSpenders(address user) external view returns (address[] memory) {
        return userSpenders[user];
    }

    // Add receive function to accept native tokens
    receive() external payable {
        // Only accept direct transfers if they're from a valid interaction
        revert("Direct transfers not supported");
    }
}
