// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {LineaDATHook} from "../src/LineaDATHook.sol";
import {ILineaDATFactory} from "../src/Interfaces.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Phase 3.5 - deploy LineaDATHook on Base Sepolia using the mined CREATE2 salt.
///
/// Salt was mined by MineHookBaseSepolia.s.sol; we re-derive predicted addr here as a sanity check.
///
/// USAGE:
///   forge script script/DeployHookBaseSepolia.s.sol:DeployHookBaseSepolia \
///     --rpc-url https://base-sepolia-rpc.publicnode.com \
///     --broadcast --private-key $PRIVATE_KEY -vvv
contract DeployHookBaseSepolia is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Mined salt (see broadcast/mined/hook-base-sepolia.json)
    bytes32 constant SALT = 0x0000000000000000000000000000000000000000000000000000000000004d75;
    address constant EXPECTED_HOOK = 0x61116044DC8eB623A618021cEDB14836D6512444;

    // Live Phase 3 Base Sepolia constructor args
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant LINEADAT_PROXY = 0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2;
    address constant FACTORY = 0xeDCA75CdAbcca93399c22fc1815035C71F5f77A6;
    address constant FEE_ADDRESS = 0xbc6af64859dF1008c8187F94dF89323000dEE668;

    function run() external {
        require(block.chainid == 84532, "Must be on Base Sepolia (chainId 84532)");

        bytes memory initCode = abi.encodePacked(
            type(LineaDATHook).creationCode,
            abi.encode(
                IPoolManager(POOL_MANAGER),
                LINEADAT_PROXY,
                ILineaDATFactory(FACTORY),
                FEE_ADDRESS
            )
        );

        // Sanity check: predict and compare to expected
        address predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, SALT, keccak256(initCode)))))
        );
        require(predicted == EXPECTED_HOOK, "Predicted address mismatch - re-mine salt");
        console.log("Predicted hook address:", predicted);
        console.log("Already deployed?", predicted.code.length > 0);

        if (predicted.code.length > 0) {
            console.log("Hook already deployed - skipping");
            return;
        }

        // CREATE2 deployer expects calldata = salt(32) || initcode
        bytes memory deployData = abi.encodePacked(SALT, initCode);

        vm.startBroadcast();
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(deployData);
        vm.stopBroadcast();

        require(ok, "CREATE2 deploy call failed");
        console.log("CREATE2 deploy tx ok. Returned bytes len:", ret.length);

        // Foundry CREATE2 deployer (0x4e59...) returns the deployed address as 20 bytes
        require(predicted.code.length > 0, "Hook deploy failed: no code at predicted address");

        console.log("=== HOOK DEPLOYED ===");
        console.log("Hook address:", predicted);
        console.log("Code size:", predicted.code.length);
    }
}
