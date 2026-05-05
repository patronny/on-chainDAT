// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {LineaDATSeeder} from "../src/LineaDATSeeder.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @notice Phase 3.5 — Initialize Uniswap v4 pool and seed single-sided liquidity on Base Sepolia.
///
/// SEQUENCE:
///   1. Deploy new LineaDATStrategy implementation (with factoryEscape function)
///   2. UUPS upgrade the existing proxy to the new impl
///   3. Deploy LineaDATSeeder
///   4. proxy.factoryEscape(seeder, 1e27) — moves all tokens from factory to seeder
///   5. factory.setLoadingLiquidity(true)
///   6. seeder.seedAndLock(poolKey, sqrtPriceX96, tickLower, tickUpper, liquidity)
///   7. factory.setLoadingLiquidity(false)
///
/// The LP position is permanently locked inside the seeder contract (no withdraw function).
///
/// USAGE:
///   forge script script/SeedLiquidityBaseSepolia.s.sol:SeedLiquidityBaseSepolia \
///     --rpc-url https://base-sepolia-rpc.publicnode.com \
///     --broadcast --private-key $PRIVATE_KEY -vvv
contract SeedLiquidityBaseSepolia is Script {
    // === Live Phase 3.5 Base Sepolia addresses ===
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINEADAT_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;
    address constant FACTORY = 0xeDCA75CdAbcca93399c22fc1815035C71F5f77A6;
    address constant HOOK = 0x61116044DC8eB623A618021cEDB14836D6512444;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // === Pool config (locked per Phase 4 spec, but we tune tick range for testnet) ===
    // sqrtPriceX96 will be derived from tickUpper using TickMath.
    int24 constant TICK_LOWER = -887220; // min tick at spacing 60
    int24 constant TICK_UPPER = 180000;  // approx 1 ETH ≈ 6.6e7 LineaDAT (FDV ~$66M with 1B supply)
                                         // exact FDV doesn't matter for testnet — what matters is tick mechanics
    int24 constant TICK_SPACING = 60;
    uint24 constant DYNAMIC_FEE_FLAG = 0x800000;

    uint256 constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1B

    // For single-sided LP at currentTick == tickUpper, all currency1 (LineaDAT), no currency0 (ETH).
    // Liquidity L is bounded by: amount1 = L * (sqrtP_b - sqrtP_a)
    // Solving: L = amount1 / (sqrtP_b - sqrtP_a)

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia (chainId 84532)");

        address deployer = msg.sender;
        console.log("=== Phase 3.5 SeedLiquidity ===");
        console.log("Deployer:", deployer);
        console.log("");

        // === Step 1: Deploy new LineaDATStrategy impl ===
        vm.startBroadcast();

        LineaDATStrategy newImpl = new LineaDATStrategy();
        console.log("[1] New LineaDATStrategy impl:", address(newImpl));

        // === Step 2: UUPS upgrade proxy → newImpl ===
        LineaDATStrategy proxy = LineaDATStrategy(payable(LINEADAT_PROXY));
        proxy.upgradeToAndCall(address(newImpl), "");
        console.log("[2] Proxy upgraded to new impl");

        // === Step 3: Deploy seeder ===
        LineaDATSeeder seeder = new LineaDATSeeder(IPoolManager(POOL_MANAGER));
        console.log("[3] LineaDATSeeder:", address(seeder));

        // === Step 4: Drain factory's tokens to seeder ===
        proxy.factoryEscape(address(seeder), TOTAL_SUPPLY);
        console.log("[4] factoryEscape -> seeder. seeder LineaDAT balance:", proxy.balanceOf(address(seeder)));

        // === Step 5: Set loadingLiquidity flag on factory ===
        LineaDATFactory factory = LineaDATFactory(payable(FACTORY));
        factory.setLoadingLiquidity(true);
        console.log("[5] factory.loadingLiquidity = true");

        // === Step 6: Initialize pool + add LP via seeder ===
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // NATIVE ETH
            currency1: Currency.wrap(LINEADAT_PROXY),
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });

        // sqrtPriceX96 at tickUpper means currentTick == tickUpper, position 100% currency1.
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(TICK_UPPER);
        console.log("[6.1] PoolKey computed. sqrtPriceX96:", sqrtPriceX96);

        // Compute liquidity from amount1 at tickUpper:
        // amount1 = L * (sqrt(P_b) - sqrt(P_a)) when currentTick == tickUpper
        // Wait: at currentTick == tickUpper, position is exactly at upper boundary, formula is:
        // amount1 = L * (sqrt(P_b) - sqrt(P_a)) for the FULL range
        // But active liquidity at boundary: position holds all currency1 if currentTick >= tickUpper
        // So L * (sqrtPb - sqrtPa) / 2^96 = amount1
        // We want amount1 = TOTAL_SUPPLY → L = TOTAL_SUPPLY * 2^96 / (sqrtPb - sqrtPa)
        uint160 sqrtPa = TickMath.getSqrtPriceAtTick(TICK_LOWER);
        uint160 sqrtPb = TickMath.getSqrtPriceAtTick(TICK_UPPER);
        uint256 liquidity = (TOTAL_SUPPLY * (1 << 96)) / (sqrtPb - sqrtPa);
        console.log("[6.2] Computed liquidity L:", liquidity);
        require(liquidity <= type(uint128).max, "L overflow uint128");

        seeder.seedAndLock(key, sqrtPriceX96, TICK_LOWER, TICK_UPPER, int256(liquidity));
        console.log("[6.3] Pool initialized + liquidity locked in seeder");

        // === Step 7: Unset loadingLiquidity ===
        factory.setLoadingLiquidity(false);
        console.log("[7] factory.loadingLiquidity = false");

        vm.stopBroadcast();

        console.log("");
        console.log("=== SEED COMPLETE ===");
        console.log("Pool:    ETH/LineaDAT, fee=DYNAMIC, hook=", HOOK);
        console.log("Seeder:  ", address(seeder));
        console.log("LP:      locked permanently inside seeder (no withdraw fn)");
    }
}
