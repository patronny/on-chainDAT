// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATHook} from "../src/LineaDATHook.sol";
import {ILineaDATFactory} from "../src/Interfaces.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Mine a CREATE2 salt that yields a hook address with the right Uniswap v4 permission flags.
///
/// Required flags = 0x2444 = `BEFORE_INITIALIZE | AFTER_ADD_LIQUIDITY | AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA`.
///
/// Uniswap v4 uses the **low 14 bits** of the hook address to validate which permissions are claimed.
/// We need: `address & 0x3FFF == 0x2444`.
///
/// Run:
///   forge script script/MineHook.s.sol:MineHook --rpc-url $RPC --sig "run(address,address,address,address)" \
///      $POOL_MANAGER $LINEADAT_PLACEHOLDER $FACTORY $FEE_ADDRESS
contract MineHook is Script {
    /// @notice Canonical CREATE2 deployer on Linea (verified via eth_getCode in research/raw-rpc-data)
    address constant CREATE2_DEPLOYER = 0x0000000000FFe8B47B3e2130213B802212439497;

    /// @notice Required hook permission bits (matches LineaDATHook.getHookPermissions)
    uint160 constant REQUIRED_FLAGS = 0x2444;

    /// @notice Maximum salts to try before giving up (10M is ~few minutes on M1/M2)
    uint256 constant MAX_SALT = 10_000_000;

    function run(address poolManager, address lineaDATAddress, address factoryAddr, address feeAddress)
        external
        view
        returns (address hookAddr, bytes32 salt)
    {
        bytes memory creationCode = abi.encodePacked(
            type(LineaDATHook).creationCode,
            abi.encode(IPoolManager(poolManager), lineaDATAddress, ILineaDATFactory(factoryAddr), feeAddress)
        );
        bytes32 codeHash = keccak256(creationCode);

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
                console.log("address & 0x3FFF (hex):", uint160(predicted) & 0x3FFF);
                return (predicted, trySalt);
            }
        }
        revert("Mining failed: no salt found in range. Increase MAX_SALT.");
    }
}
