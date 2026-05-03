// SPDX-License-Identifier: MIT
// LINEASTRFactory — minimal owner-only factory for LINEASTR strategy deployments on Linea L2.
// Inspired by TokenWorks ERC20StrategyFactory pattern (MIT) but trimmed: no permissionless launchpad,
// no NFT/ERC-1155 deploy paths, no recursive strategies. Owner deploys LINEASTR first, then optionally
// future tokens that share the same hook + factory + buy-and-burn LINEASTR mechanic.
pragma solidity ^0.8.26;

import {LibClone} from "solady/utils/LibClone.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IUniswapV4Router04} from "v4-router/interfaces/IUniswapV4Router04.sol";

import {ILineastrStrategy, ILineastrFactory} from "./Interfaces.sol";

/// @title LINEASTRFactory — deploy + register LINEASTR-family strategy proxies
/// @notice Owner-only. LINEASTR (the self-launch token) MUST be deployed first; subsequent strategies
///         use the same hook and pay 10% of trade fees back as buy-and-burn LINEASTR (handled in hook).
contract LINEASTRFactory is Ownable, ReentrancyGuard {
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                     CONSTANTS                       */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Dead address used to burn LINEASTR on future-strategy buy-and-burn cycles
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Universal Router on Linea (V2_1_1, v4-capable)
    address public immutable universalRouter;
    /// @notice Uniswap v4 Pool Manager on Linea
    IPoolManager public immutable poolManager;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   STATE VARIABLES                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Address of the BaseStrategy/LINEASTRStrategy implementation (UUPS proxy target)
    address public strategyImplementation;

    /// @notice Default hook address for new strategies (CREATE2-mined)
    address public hookAddress;

    /// @notice Address of the LINEASTR token itself — set on the first call to `deployStrategy`.
    ///         Used by the hook to detect the self-launch edge case in `_processFees`.
    address public lineastrAddress;

    /// @notice Map underlying ERC-20 token => deployed strategy proxy
    mapping(address => address) public tokenToStrategy;
    /// @notice Map strategy proxy => underlying ERC-20 token (typo `startegy` matches TokenWorks v3 to keep hook code byte-identical)
    mapping(address => address) public startegyToToken;

    /// @notice Set to true while a new strategy's pool is being seeded with single-sided liquidity.
    ///         Hook reads this in `_beforeInitialize` and `_afterAddLiquidity` to allow exactly one liquidity add.
    bool public loadingLiquidity;

    /// @notice Whether `deployStrategy` is permitted (can be disabled by owner once LINEASTR ecosystem is mature)
    bool public launchEnabled = true;

    /// @notice Whitelist of authorized launcher addresses (optional — only used if owner enables)
    mapping(address => bool) public authorizedLaunchers;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                       EVENTS                        */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    event StrategyDeployed(
        address indexed underlying, address indexed strategy, string name, string symbol, uint256 bagSize
    );
    event LineastrAddressSet(address indexed lineastrAddress);
    event HookAddressSet(address indexed hookAddress);
    event ImplementationSet(address indexed implementation);
    event LineastrBoughtAndBurned(uint256 ethSpent, uint256 lineastrBurned);

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    CUSTOM ERRORS                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    error LaunchDisabled();
    error UnauthorizedLauncher();
    error AlreadyDeployed();
    error InvalidImplementation();
    error InvalidHookAddress();
    error LineastrNotSet();

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    CONSTRUCTOR                      */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @param _poolManager Linea Uniswap v4 PoolManager (`0x248083fb965359d82b06c1f5322480dcfc1ad857`)
    /// @param _universalRouter Linea Universal Router V2_1_1 (`0x8B844f885672f333Bc0042cB669255f93a4C1E6b`)
    constructor(IPoolManager _poolManager, address _universalRouter) {
        poolManager = _poolManager;
        universalRouter = _universalRouter;
        _initializeOwner(msg.sender);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  ADMIN FUNCTIONS                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Sets the BaseStrategy/LINEASTRStrategy implementation (UUPS proxy target)
    function setStrategyImplementation(address _impl) external onlyOwner returns (address) {
        if (_impl == address(0) || _impl.code.length == 0) revert InvalidImplementation();
        strategyImplementation = _impl;
        emit ImplementationSet(_impl);
        return _impl;
    }

    /// @notice Sets the hook address (CREATE2-mined, must satisfy `address & 0x3FFF == 0x2444`)
    function updateHookAddress(address _hook) external onlyOwner returns (address) {
        if (_hook == address(0) || _hook.code.length == 0) revert InvalidHookAddress();
        hookAddress = _hook;
        emit HookAddressSet(_hook);
        return _hook;
    }

    /// @notice TESTNET-ONLY hook setter that accepts any non-zero address (including EOAs).
    /// @dev Used in Phase 3 (Base Sepolia) where the deployer EOA acts as a stand-in for the real
    ///      CREATE2-mined LINEASTRHook. The hook contract itself is not needed because we don't
    ///      run a real Uniswap v4 pool on testnet — strategy P2P mechanics (buyTokens, sellTokens)
    ///      work without a pool. Phase 4 (Linea mainnet) MUST use `updateHookAddress` with a real
    ///      hook deployed via CREATE2.
    function updateHookAddressUnchecked(address _hook) external onlyOwner returns (address) {
        if (_hook == address(0)) revert InvalidHookAddress();
        hookAddress = _hook;
        emit HookAddressSet(_hook);
        return _hook;
    }

    /// @notice Permanently disables `deployStrategy` (no more new tokens via this factory)
    function disableLaunchUpgradeable() external onlyOwner {
        launchEnabled = false;
    }

    /// @notice Enable/disable a specific launcher address
    function updateLauncher(address _launcher, bool _authorized) external onlyOwner {
        authorizedLaunchers[_launcher] = _authorized;
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  DEPLOY FUNCTION                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Owner-only: deploy a new strategy proxy backed by `_token`.
    /// @dev First call sets `lineastrAddress = strategyProxy` (the LINEASTR self-launch).
    ///      Subsequent calls deploy future LINEASTR-family strategies (e.g. ETH-backed, USDC-backed).
    /// @param _token Underlying ERC-20 (e.g. $LINEA `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04`)
    /// @param _bagSize Size of one bag in underlying token units (18-decimals → 150_000e18 for LINEASTR)
    /// @param _tokenName Strategy token name (e.g. "LineaStrategy")
    /// @param _tokenSymbol Strategy token symbol (e.g. "LINEASTR")
    /// @param _strategyOwner Owner EOA for the deployed proxy
    /// @param _buyIncrement Maximum-price-for-buy ramp per block (e.g. 0.02e18 wei = 0.02 ETH for LINEASTR)
    /// @return strategy The deployed strategy proxy address
    function deployStrategy(
        address _token,
        uint256 _bagSize,
        string memory _tokenName,
        string memory _tokenSymbol,
        address _strategyOwner,
        uint256 _buyIncrement
    ) external onlyOwner nonReentrant returns (address strategy) {
        if (!launchEnabled) revert LaunchDisabled();
        if (strategyImplementation == address(0)) revert InvalidImplementation();
        if (hookAddress == address(0)) revert InvalidHookAddress();
        if (tokenToStrategy[_token] != address(0)) revert AlreadyDeployed();

        // Pack immutable args for ERC1967 clone (matches BaseStrategy.factory()/router()/poolManager() expected layout)
        bytes memory immutableArgs = abi.encodePacked(address(this), universalRouter, address(poolManager));

        // ERC1967 + immutable args: BaseStrategy.factory()/router()/poolManager() use LibClone.argsOnERC1967
        strategy = LibClone.deployERC1967(strategyImplementation, immutableArgs);

        ILineastrStrategy(strategy).initialize(
            _token, _bagSize, hookAddress, _tokenName, _tokenSymbol, _buyIncrement, _strategyOwner
        );

        tokenToStrategy[_token] = strategy;
        startegyToToken[strategy] = _token;

        // First deploy = LINEASTR self-launch — record lineastrAddress for hook self-launch detection
        if (lineastrAddress == address(0)) {
            lineastrAddress = strategy;
            emit LineastrAddressSet(strategy);
        }

        emit StrategyDeployed(_token, strategy, _tokenName, _tokenSymbol, _bagSize);
    }

    /// @notice Wrapper kept for ABI compat with `ILineastrFactory.ownerLaunchStrategy`
    function ownerLaunchStrategy(
        address _token,
        uint256 _bagSize,
        string memory _tokenName,
        string memory _tokenSymbol,
        address _strategyOwner,
        uint256 _buyIncrement
    ) external payable returns (address) {
        // Reuse the onlyOwner deploy
        return this.deployStrategy(_token, _bagSize, _tokenName, _tokenSymbol, _strategyOwner, _buyIncrement);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*           LIQUIDITY-LOAD COORDINATION FLAG          */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Owner-only: toggle the loadingLiquidity flag. Hook reads it in `_beforeInitialize` and
    ///         `_afterAddLiquidity` to allow the single seed-liquidity event for a new strategy.
    /// @dev Workflow: deploy script sets flag → calls PoolManager.initialize + PositionManager.mint
    ///      (which triggers hook callbacks that pass the `loadingLiquidity` check) → unsets flag.
    function setLoadingLiquidity(bool _loading) external onlyOwner {
        loadingLiquidity = _loading;
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*           BUY-AND-BURN LINEASTR (FUTURE)            */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Receive ETH from hook `_processFees` (10% LINEASTR-burn share) on future strategies.
    /// @dev On the LINEASTR self-launch the hook redirects this share to feeAddress instead, so this
    ///      function is only ever invoked from future strategies' fee processing.
    receive() external payable {
        // Anyone can also send ETH (e.g. donation) — accept silently
    }

    /// @notice Buy LINEASTR with `amountIn` ETH from the LINEASTR/ETH pool and send to dead address.
    /// @dev Callable by anyone once `lineastrAddress` is set; intended to be triggered periodically by a
    ///      keeper (or paid 0.5% reward via a separate mechanism — out of scope for v1).
    /// @param amountIn Amount of ETH from this contract's balance to spend
    function buyAndBurnLineastr(uint256 amountIn) external nonReentrant returns (uint256 burned) {
        if (lineastrAddress == address(0)) revert LineastrNotSet();
        require(amountIn > 0 && amountIn <= address(this).balance, "Bad amount");

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(lineastrAddress),
            fee: 0x800000, // DYNAMIC_FEE_FLAG (matches BaseStrategy._buyAndBurnTokens)
            tickSpacing: 60,
            hooks: IHooks(hookAddress)
        });

        BalanceDelta delta = IUniswapV4Router04(payable(universalRouter)).swapExactTokensForTokens{value: amountIn}(
            amountIn,
            0, // amountOutMin: 0 (acceptable here because buy-and-burn is non-time-sensitive and we want to burn whatever we get)
            true, // zeroForOne (ETH → LINEASTR)
            key,
            "",
            DEAD_ADDRESS,
            block.timestamp
        );

        burned = uint256(int256(delta.amount1()));
        emit LineastrBoughtAndBurned(amountIn, burned);
    }
}
