// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {LineaDATTransferRelay} from "../src/LineaDATTransferRelay.sol";

/// @notice Deploys LineaDATTransferRelay on Linea mainnet, bound to the live
///         $LDAT proxy and the Linea Uniswap v4 PoolManager.
///
/// @dev The relay is INERT after deploy: it does nothing until the owner (cold
///      Keycard) calls `LineaDATStrategy.setDistributor(relay, true)` on the
///      proxy. That owner step is NOT done here (the deployer is the hot keeper
///      EOA, not the owner). Verify the contract on Lineascan, then hand the
///      owner the prepared setDistributor calldata (local signing page).
///
/// USAGE (deployer = hot keeper EOA; KEEPER_PK via a /tmp env file, never echoed):
///   forge script script/DeployTransferRelay.s.sol:DeployTransferRelay \
///     --rpc-url "$INFURA_OPS" --broadcast --private-key "$KEEPER_PK" -vvv
///
/// VERIFY:
///   forge verify-contract <RELAY_ADDR> \
///     src/LineaDATTransferRelay.sol:LineaDATTransferRelay \
///     --verifier-url 'https://api.etherscan.io/v2/api?chainid=59144' \
///     --etherscan-api-key "$ETHERSCAN_API_KEY" \
///     --constructor-args $(cast abi-encode "c(address,address)" $LDAT $POOL_MANAGER)
contract DeployTransferRelay is Script {
    // Verified on-chain 2026-06-21: symbol()=="LDAT", VERSION()==4.
    address constant LDAT = 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5;
    // Linea Uniswap v4 PoolManager (docs/40-linea-infrastructure.md, Deploy.s.sol).
    address constant POOL_MANAGER = 0x248083Fb965359d82b06C1F5322480Dcfc1AD857;

    function run() external {
        require(block.chainid == 59144, "not Linea mainnet");

        vm.startBroadcast();
        LineaDATTransferRelay relay = new LineaDATTransferRelay(LDAT, POOL_MANAGER);
        vm.stopBroadcast();

        console.log("LineaDATTransferRelay:", address(relay));
        console.log("  bound LDAT:        ", relay.LDAT());
        console.log("  bound POOL_MANAGER:", relay.POOL_MANAGER());
        console.log("---");
        console.log("NEXT: verify on Lineascan, then owner signs setDistributor(relay, true).");
        console.log("setDistributor calldata:");
        console.logBytes(abi.encodeWithSignature("setDistributor(address,bool)", address(relay), true));
    }
}
