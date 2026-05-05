// SPDX-License-Identifier: MIT
// Based on TokenWorks Interfaces.sol v3 (MIT). Original: token.works
// Trimmed for LineaDAT: removed NFT/ERC-721/ERC-1155/PunkStrategy interfaces (not used).
pragma solidity >=0.7.5;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IUniswapV4Router04} from "v4-router/interfaces/IUniswapV4Router04.sol";

/// @title LineaDAT core interfaces
/// @notice Interfaces shared between LineaDATStrategy / BaseStrategy / LineaDATHook / LineaDATFactory.

/// @notice Standard ERC-20 with `owner()` getter (used by hook for `updateFeeAddressForCollection`)
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function owner() external view returns (address);
}

/// @notice Interface for global distributors (whitelisted addresses allowed to do fee-free transfers)
interface IGlobalDistributor {
    function isGlobalDistributor(address) external view returns (bool);
}

/// @notice Interface for fee-splitting contracts (legacy, kept for forward compatibility)
interface IFeeSplit {
    function processDeposit() external payable;
}

/// @notice Marker interface for routers that expose `msgSender()` (transient sender unwrap pattern)
interface IValidRouter {
    function msgSender() external view returns (address);
}

/// @notice Common strategy interface — shared between LineaDAT and any future LineaDAT-family strategies on Linea.
///         Base contract `BaseStrategy` implements all of this. Hook calls these via `IStrategy(collection).fn(...)`.
interface IStrategy {
    function factory() external view returns (address);
    function router() external view returns (address);
    function poolManager() external view returns (address);
    function owner() external view returns (address);
    function addFees() external payable;
    function setPriceMultiplier(uint256 _newMultiplier) external;
    function updateName(string memory _tokenName) external;
    function updateSymbol(string memory _tokenSymbol) external;
    function updateHookAddress(address _hookAddress) external;
    function increaseTransferAllowance(uint256 amountAllowed) external;
    function getTransferAllowance() external view returns (uint256);
    function getImplementation() external view returns (address);
    function upgradeToAndCall(address newImplementation, bytes memory data) external;
    function setGlobalDistributor(address distributor) external;
}

/// @notice Specialized interface for ERC-20 backed strategies (the only kind LineaDAT supports).
interface ILineaDATStrategy is IStrategy {
    function initialize(
        address _token,
        uint256 _bagSize,
        address _hook,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _buyIncrement,
        address _owner
    ) external;
}

/// @notice Base factory interface (functions called by hook + strategy)
interface IBaseStrategyFactory {
    function loadingLiquidity() external view returns (bool);
    function owner() external view returns (address);
    function strategyImplementation() external view returns (address);
    function setStrategyImplementation(address _strategyImplementation) external returns (address);
    function updateHookAddress(address _hookAddress) external returns (address);
    function disableLaunchUpgradeable() external;
    function updateLauncher(address _launcher, bool _authorized) external;
}

/// @notice LineaDAT factory interface — extends `IBaseStrategyFactory` with strategy-token mapping.
interface ILineaDATFactory is IBaseStrategyFactory {
    /// @notice Map underlying ERC-20 token => deployed strategy proxy
    function tokenToStrategy(address token) external view returns (address);
    /// @notice Map strategy proxy => underlying ERC-20 token. Original v3 typo `startegyToToken` preserved
    ///         to keep hook code byte-identical with TokenWorks v3 (hook calls `factory.startegyToToken(strategy)`).
    function startegyToToken(address strategy) external view returns (address);
    function ownerLaunchStrategy(
        address token,
        uint256 bagSize,
        string memory tokenName,
        string memory tokenSymbol,
        address strategyFeeAddress,
        uint256 buyIncrement
    ) external payable returns (address);
}
