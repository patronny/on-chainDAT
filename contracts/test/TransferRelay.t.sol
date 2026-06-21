// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest} from "./Base.t.sol";
import {BaseStrategy} from "../src/BaseStrategy.sol";
import {LineaDATTransferRelay} from "../src/LineaDATTransferRelay.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @notice Tests for LineaDATTransferRelay AND the previously-uncovered $LDAT
///         transfer gate (BaseStrategy._afterTokenTransfer). Proves: direct
///         wallet-to-wallet reverts, the relay only works once whitelisted, the
///         two-hop is mandatory, the 1% fee burns to DEAD, the relay holds no
///         leftover balance, allowance is consumed exactly, and revoking the
///         distributor flag re-blocks transfers.
contract TransferRelayTest is BaseTest {
    LineaDATTransferRelay internal relay;

    address internal recipient = address(0xC0FFEE);
    uint256 internal constant AMT = 1000 ether; // 1000 LDAT
    uint256 internal constant FEE = AMT / 100; // 10 LDAT (1%)

    function setUp() public override {
        super.setUp();
        relay = new LineaDATTransferRelay(address(strategy), address(poolMgr));
    }

    /* ------------------------------------------------------------------ */
    /*                              HELPERS                                */
    /* ------------------------------------------------------------------ */

    /// @notice Seed `to` with `amount` $LDAT by routing through a temporarily
    ///         whitelisted factory (the factory holds the full mint).
    function _seedLDAT(address to, uint256 amount) internal {
        vm.prank(owner);
        strategy.setDistributor(address(factory), true);
        vm.prank(address(factory));
        strategy.transfer(to, amount);
        vm.prank(owner);
        strategy.setDistributor(address(factory), false);
    }

    function _whitelistRelay(bool status) internal {
        vm.prank(owner);
        strategy.setDistributor(address(relay), status);
    }

    /* ------------------------------------------------------------------ */
    /*                          GATE COVERAGE                             */
    /* ------------------------------------------------------------------ */

    function test_directWalletToWallet_reverts() public {
        _seedLDAT(alice, AMT);
        vm.prank(alice);
        vm.expectRevert(BaseStrategy.InvalidTransfer.selector);
        strategy.transfer(recipient, AMT);
    }

    function test_oneHopTransferFrom_reverts() public {
        // Even with the relay whitelisted, a single transferFrom(user -> recipient)
        // (neither side a distributor) must revert: proves the two-hop is mandatory.
        _whitelistRelay(true);
        _seedLDAT(alice, AMT);
        vm.prank(alice);
        strategy.approve(address(this), AMT);
        vm.expectRevert(BaseStrategy.InvalidTransfer.selector);
        strategy.transferFrom(alice, recipient, AMT);
    }

    /* ------------------------------------------------------------------ */
    /*                          RELAY BEHAVIOR                            */
    /* ------------------------------------------------------------------ */

    function test_send_revertsWhenRelayNotWhitelisted() public {
        _seedLDAT(alice, AMT);
        vm.prank(alice);
        strategy.approve(address(relay), AMT);
        // hop 1 (alice -> relay) reverts in the gate; SafeTransferLib wraps it.
        vm.prank(alice);
        vm.expectRevert(SafeTransferLib.TransferFromFailed.selector);
        relay.send(recipient, AMT);
    }

    function test_send_succeeds_chargesFee_burnsToDead_noLeftover() public {
        _whitelistRelay(true);
        _seedLDAT(alice, AMT);

        uint256 deadBefore = strategy.balanceOf(DEAD);

        vm.prank(alice);
        strategy.approve(address(relay), AMT);
        vm.prank(alice);
        relay.send(recipient, AMT);

        assertEq(strategy.balanceOf(recipient), AMT - FEE, "recipient gets 99%");
        assertEq(strategy.balanceOf(DEAD) - deadBefore, FEE, "1% burned to DEAD");
        assertEq(strategy.balanceOf(alice), 0, "sender drained");
        assertEq(strategy.balanceOf(address(relay)), 0, "relay holds no leftover");
        assertEq(strategy.allowance(alice, address(relay)), 0, "allowance fully consumed");
    }

    function test_send_burnCounterIncrementsByFee() public {
        // The burn metric everywhere is balanceOf(DEAD); confirm a transfer moves it.
        _whitelistRelay(true);
        _seedLDAT(alice, AMT);
        uint256 deadBefore = strategy.balanceOf(DEAD);
        vm.prank(alice);
        strategy.approve(address(relay), AMT);
        vm.prank(alice);
        relay.send(recipient, AMT);
        assertEq(strategy.balanceOf(DEAD), deadBefore + FEE);
    }

    function test_revokeDistributor_reblocks() public {
        _whitelistRelay(true);
        _whitelistRelay(false);
        _seedLDAT(alice, AMT);
        vm.prank(alice);
        strategy.approve(address(relay), AMT);
        vm.prank(alice);
        vm.expectRevert(SafeTransferLib.TransferFromFailed.selector);
        relay.send(recipient, AMT);
    }

    /* ------------------------------------------------------------------ */
    /*                         INPUT VALIDATION                           */
    /* ------------------------------------------------------------------ */

    function test_send_toZero_reverts() public {
        _whitelistRelay(true);
        vm.expectRevert(LineaDATTransferRelay.InvalidRecipient.selector);
        relay.send(address(0), AMT);
    }

    function test_send_toRelay_reverts() public {
        _whitelistRelay(true);
        vm.expectRevert(LineaDATTransferRelay.InvalidRecipient.selector);
        relay.send(address(relay), AMT);
    }

    function test_send_toPoolManager_reverts() public {
        _whitelistRelay(true);
        vm.expectRevert(LineaDATTransferRelay.InvalidRecipient.selector);
        relay.send(address(poolMgr), AMT);
    }

    function test_send_zeroAmount_reverts() public {
        _whitelistRelay(true);
        vm.expectRevert(LineaDATTransferRelay.ZeroAmount.selector);
        relay.send(recipient, 0);
    }

    function test_send_insufficientAllowance_reverts() public {
        _whitelistRelay(true);
        _seedLDAT(alice, AMT);
        vm.prank(alice);
        strategy.approve(address(relay), AMT - 1);
        vm.prank(alice);
        vm.expectRevert(SafeTransferLib.TransferFromFailed.selector);
        relay.send(recipient, AMT);
    }

    function test_send_insufficientBalance_reverts() public {
        _whitelistRelay(true);
        _seedLDAT(alice, AMT - 1);
        vm.prank(alice);
        strategy.approve(address(relay), AMT);
        vm.prank(alice);
        vm.expectRevert(SafeTransferLib.TransferFromFailed.selector);
        relay.send(recipient, AMT);
    }

    function test_constructor_zeroAddress_reverts() public {
        vm.expectRevert(LineaDATTransferRelay.ZeroAddress.selector);
        new LineaDATTransferRelay(address(0), address(poolMgr));
        vm.expectRevert(LineaDATTransferRelay.ZeroAddress.selector);
        new LineaDATTransferRelay(address(strategy), address(0));
    }

    /* ------------------------------------------------------------------ */
    /*                               FUZZ                                 */
    /* ------------------------------------------------------------------ */

    function testFuzz_send_conservesAndBurns(uint256 amount) public {
        amount = bound(amount, 100, 100_000_000 ether);
        _whitelistRelay(true);
        _seedLDAT(alice, amount);

        uint256 deadBefore = strategy.balanceOf(DEAD);
        uint256 fee = amount / 100;

        vm.prank(alice);
        strategy.approve(address(relay), amount);
        vm.prank(alice);
        relay.send(recipient, amount);

        assertEq(strategy.balanceOf(recipient), amount - fee, "recipient = amount - fee");
        assertEq(strategy.balanceOf(DEAD) - deadBefore, fee, "fee burned");
        assertEq(strategy.balanceOf(address(relay)), 0, "no leftover on relay");
        assertEq(strategy.balanceOf(alice), 0, "sender drained");
    }
}
