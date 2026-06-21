// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {BaseStrategy} from "../src/BaseStrategy.sol";
import {LineaDATTransferRelay} from "../src/LineaDATTransferRelay.sol";

/// @notice Linea mainnet fork e2e for the transfer relay: deploys the relay against
///         the LIVE $LDAT proxy + PoolManager, impersonates the cold Keycard owner to
///         whitelist it, then impersonates a REAL on-chain $LDAT holder to run a real
///         transfer. Proves the whole flow works against deployed bytecode before any
///         mainnet transaction is sent.
///
///         Run: forge test --match-contract ForkTransferRelay --fork-url https://rpc.linea.build -vv
contract ForkTransferRelayTest is Test {
    address constant LDAT = 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5;
    address constant POOL_MANAGER = 0x248083Fb965359d82b06C1F5322480Dcfc1AD857;
    address constant KEYCARD_OWNER = 0x1470c542D60e83EcCFE005332f5789Bd669D027C;
    // Real LDAT holder (verified on-chain 2026-06-21, EOA, ~32.5M LDAT balance).
    address constant HOLDER = 0x66D7f856b62F1668b54B63Ae2f6472e5d5BEf114;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address constant RECIPIENT = address(0xC0FFEE);
    uint256 constant AMT = 1000 ether; // 1000 LDAT
    uint256 constant FEE = AMT / 100; // 10 LDAT (1%)

    function test_fork_relay_realHolderTransfer() public {
        if (block.chainid != 59144) {
            vm.skip(true);
        }

        LineaDATStrategy strat = LineaDATStrategy(payable(LDAT));

        // Sanity: live token is the renamed LDAT, and our holder really holds it.
        assertEq(strat.symbol(), "LDAT", "live symbol");
        assertGe(strat.balanceOf(HOLDER), AMT, "holder has enough LDAT");

        // Deploy relay bound to the live token + pool manager.
        LineaDATTransferRelay relay = new LineaDATTransferRelay(LDAT, POOL_MANAGER);
        assertEq(relay.LDAT(), LDAT, "relay bound to live LDAT");

        // Before whitelisting: a direct wallet-to-wallet move still reverts.
        vm.prank(HOLDER);
        vm.expectRevert(BaseStrategy.InvalidTransfer.selector);
        strat.transfer(RECIPIENT, AMT);

        // The single owner action: whitelist the relay as a distributor.
        vm.prank(KEYCARD_OWNER);
        strat.setDistributor(address(relay), true);

        // Snapshot balances.
        uint256 holderBefore = strat.balanceOf(HOLDER);
        uint256 recipBefore = strat.balanceOf(RECIPIENT);
        uint256 deadBefore = strat.balanceOf(DEAD);

        // Real holder approves and transfers through the relay.
        vm.prank(HOLDER);
        strat.approve(address(relay), AMT);
        vm.prank(HOLDER);
        relay.send(RECIPIENT, AMT);

        // Recipient got 99%, 1% burned to DEAD, holder debited in full, relay clean.
        assertEq(strat.balanceOf(RECIPIENT), recipBefore + AMT - FEE, "recipient +99%");
        assertEq(strat.balanceOf(DEAD), deadBefore + FEE, "DEAD +1%");
        assertEq(strat.balanceOf(HOLDER), holderBefore - AMT, "holder -amount");
        assertEq(strat.balanceOf(address(relay)), 0, "relay holds nothing");
        assertEq(strat.allowance(HOLDER, address(relay)), 0, "allowance consumed");

        // Revoking re-blocks the relay.
        vm.prank(KEYCARD_OWNER);
        strat.setDistributor(address(relay), false);
        vm.prank(HOLDER);
        strat.approve(address(relay), AMT);
        vm.prank(HOLDER);
        vm.expectRevert(); // SafeTransferLib.TransferFromFailed (gate reverts hop 1)
        relay.send(RECIPIENT, AMT);
    }
}
