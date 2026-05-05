// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @notice Local interface — v4-core checkout in lib/ doesn't expose this header.
interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}

/// @notice Phase 3.5 testnet helper — initializes a Uniswap v4 pool and seeds single-sided liquidity.
///
/// The LP position is owned by THIS contract (no NFT minted, no PositionManager involved).
/// Since this contract has no removeLiquidity function, the position is permanently locked
/// — equivalent to "LP-NFT → 0xdead" but without the NFT layer.
///
/// USAGE:
///   1. Deploy this contract
///   2. Strategy owner calls strategy.factoryEscape(seederAddress, amount) so seeder holds the tokens
///   3. Factory owner calls factory.setLoadingLiquidity(true)
///   4. Anyone calls seeder.seedAndLock(poolKey, sqrtPriceX96, tickLower, tickUpper, liquidity)
///   5. Factory owner calls factory.setLoadingLiquidity(false)
///
/// Phase 4 mainnet must replace this with a proper factory.seedLiquidity() function.
interface ILineaDATTokenLike {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract LineaDATSeeder is IUnlockCallback {
    IPoolManager public immutable poolManager;

    error NotPoolManager();
    error InsufficientBalance();

    event SeededAndLocked(
        bytes32 indexed poolId,
        address indexed currency1,
        uint128 liquidity,
        int128 amount0Settled,
        int128 amount1Settled
    );

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    struct SeedData {
        PoolKey key;
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
    }

    /// @notice Initializes the pool, then unlocks PoolManager to add single-sided liquidity.
    /// @param key The PoolKey (currency0=ETH, currency1=LineaDAT, hooks=real hook)
    /// @param sqrtPriceX96 Initial pool price (Q64.96 fixed-point)
    /// @param tickLower Lower tick of the LP range (must be on tickSpacing boundary)
    /// @param tickUpper Upper tick of the LP range (must be on tickSpacing boundary)
    /// @param liquidityDelta Liquidity to add (positive). Caller must have funded this contract with
    ///                       enough currency1 balance to cover the resulting amount1 owed.
    function seedAndLock(
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        int256 liquidityDelta
    ) external payable {
        poolManager.initialize(key, sqrtPriceX96);

        SeedData memory data = SeedData({
            key: key,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: liquidityDelta
        });

        poolManager.unlock(abi.encode(data));
    }

    /// @notice PoolManager unlock callback. Adds liquidity and settles currencies.
    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        SeedData memory data = abi.decode(raw, (SeedData));

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: data.tickLower,
            tickUpper: data.tickUpper,
            liquidityDelta: data.liquidityDelta,
            salt: bytes32(0)
        });

        // modifyLiquidity returns the delta the caller owes the pool
        // (negative = caller owes; positive = caller receives)
        (BalanceDelta delta, ) = poolManager.modifyLiquidity(data.key, params, "");

        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        // Settle currency0 (ETH if NATIVE 0x0)
        if (amount0 < 0) {
            uint256 owed0 = uint256(uint128(-amount0));
            if (Currency.unwrap(data.key.currency0) == address(0)) {
                // NATIVE ETH path
                poolManager.settle{value: owed0}();
            } else {
                poolManager.sync(data.key.currency0);
                ILineaDATTokenLike(Currency.unwrap(data.key.currency0)).transfer(address(poolManager), owed0);
                poolManager.settle();
            }
        }

        // Settle currency1 (LineaDAT — ERC20 transfer from this contract)
        if (amount1 < 0) {
            uint256 owed1 = uint256(uint128(-amount1));
            if (ILineaDATTokenLike(Currency.unwrap(data.key.currency1)).balanceOf(address(this)) < owed1) {
                revert InsufficientBalance();
            }
            poolManager.sync(data.key.currency1);
            ILineaDATTokenLike(Currency.unwrap(data.key.currency1)).transfer(address(poolManager), owed1);
            poolManager.settle();
        }

        emit SeededAndLocked(
            keccak256(abi.encode(data.key)),
            Currency.unwrap(data.key.currency1),
            uint128(uint256(data.liquidityDelta)),
            amount0,
            amount1
        );

        return "";
    }

    /// @notice Refund leftover ETH back to the seed initiator if any (we accept leftover ETH).
    receive() external payable {}
}
