// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATHook} from "../src/LineaDATHook.sol";
import {ILineaDATFactory} from "../src/Interfaces.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Phase 3.5 — mine a CREATE2 salt for LineaDATHook on Base Sepolia.
///
/// Required hook permission flags = 0x2444
///   = BEFORE_INITIALIZE | AFTER_ADD_LIQUIDITY | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA
/// Address must satisfy `address & 0x3FFF == 0x2444`.
///
/// Uses the **standard Foundry CREATE2 deployer** (0x4e59...956c) which is verified live on Base Sepolia.
/// The salt mined here can be used directly with `cast send <DEPLOYER> <salt+initcode>` to deploy the hook.
///
/// USAGE (read-only, no broadcast):
///   forge script script/MineHookBaseSepolia.s.sol:MineHookBaseSepolia \
///     --rpc-url https://base-sepolia-rpc.publicnode.com -vvv
contract MineHookBaseSepolia is Script {
    /// @notice Standard Foundry CREATE2 deployer — verified live on Base Sepolia (cast code returned bytecode)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @notice Required hook permission bits (matches LineaDATHook.getHookPermissions)
    uint160 constant REQUIRED_FLAGS = 0x2444;

    /// @notice Maximum salts to try before giving up
    uint256 constant MAX_SALT = 20_000_000;

    // === Live Phase 3 Base Sepolia addresses ===
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINEADAT_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;
    address constant FACTORY = 0xeDCA75CdAbcca93399c22fc1815035C71F5f77A6;
    address constant FEE_ADDRESS = 0xbc6af64859dF1008c8187F94dF89323000dEE668; // deployer/owner

    function run() external view returns (address hookAddr, bytes32 salt, bytes memory initCode) {
        bytes memory creationCode = abi.encodePacked(
            type(LineaDATHook).creationCode,
            abi.encode(
                IPoolManager(POOL_MANAGER),
                LINEADAT_PROXY,
                ILineaDATFactory(FACTORY),
                FEE_ADDRESS
            )
        );
        bytes32 codeHash = keccak256(creationCode);

        console.log("=== MINING LineaDATHook on Base Sepolia ===");
        console.log("CREATE2 deployer:", CREATE2_DEPLOYER);
        console.log("PoolManager:     ", POOL_MANAGER);
        console.log("LineaDAT proxy:  ", LINEADAT_PROXY);
        console.log("Factory:         ", FACTORY);
        console.log("Fee address:     ", FEE_ADDRESS);
        console.log("Required flags:  0x2444 (BEFORE_INIT | AFTER_ADD_LIQ | AFTER_SWAP | AFTER_SWAP_DELTA)");
        console.log("");

        for (uint256 i = 0; i < MAX_SALT; i++) {
            bytes32 trySalt = bytes32(i);
            address predicted = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, trySalt, codeHash))))
            );
            if ((uint160(predicted) & 0x3FFF) == REQUIRED_FLAGS) {
                console.log("=== HOOK MINED ===");
                console.log("salt (uint):", i);
                console.logBytes32(trySalt);
                console.log("address:", predicted);
                console.log("address & 0x3FFF (expected 0x2444):", uint160(predicted) & 0x3FFF);
                console.log("");
                console.log("=== DEPLOY COMMAND (run with deployer PK) ===");
                console.log("cast send", CREATE2_DEPLOYER);
                console.log("  data = salt(32) || initcode  -- use the script's `initCode` return value");
                return (predicted, trySalt, creationCode);
            }
        }
        revert("Mining failed: no salt found in MAX_SALT range. Increase MAX_SALT.");
    }
}
