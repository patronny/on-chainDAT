// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";

/// @notice Linea mainnet fork rehearsal of the rebrand ceremony: deploy the V4 impl,
///         then (impersonating the cold Keycard owner) upgradeToAndCall + rename in ONE tx -
///         exactly the transaction the owner will sign. Asserts every economic invariant
///         is byte-identical after the upgrade.
///
///         Run: forge test --match-contract ForkRenameUpgrade --fork-url https://rpc.linea.build -vv
contract ForkRenameUpgradeTest is Test {
    address constant PROXY = 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5;
    address constant KEYCARD_OWNER = 0x1470c542D60e83EcCFE005332f5789Bd669D027C;
    bytes32 constant ERC1967_IMPL_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function test_fork_upgradeAndRename_oneTx() public {
        if (block.chainid != 59144) {
            vm.skip(true);
        }

        LineaDATStrategy proxy = LineaDATStrategy(payable(PROXY));

        // Pre-upgrade ground truth (live mainnet state).
        assertEq(proxy.name(), "LineaDAT", "pre: name");
        assertEq(proxy.symbol(), "LINEADAT", "pre: symbol");
        assertEq(proxy.VERSION(), 3, "pre: live impl is v3");
        uint256 totalSupply = proxy.totalSupply();
        uint256 bagSize = proxy.bagSize();
        uint256 buyIncrement = proxy.buyIncrement();
        uint256 currentFees = proxy.currentFees();
        uint256 lastBagId = proxy.lastBagId();
        uint256 twapIncrement = proxy.twapIncrement();
        address tokenAddr = address(proxy.token());
        address hookAddr = proxy.hookAddress();
        uint256 proxyEth = PROXY.balance;

        // The ceremony: deploy V4 impl, then ONE owner tx = upgrade + rename.
        LineaDATStrategy implV4 = new LineaDATStrategy();
        vm.prank(KEYCARD_OWNER);
        proxy.upgradeToAndCall(
            address(implV4),
            abi.encodeCall(proxy.updateNameAndSymbol, ("LDAT", "LDAT"))
        );

        // Rename took effect.
        assertEq(proxy.name(), "LDAT", "post: name");
        assertEq(proxy.symbol(), "LDAT", "post: symbol");
        assertEq(proxy.VERSION(), 4, "post: impl is v4");
        assertEq(
            address(uint160(uint256(vm.load(PROXY, ERC1967_IMPL_SLOT)))),
            address(implV4),
            "post: impl slot points at V4"
        );

        // Economic state is untouched.
        assertEq(proxy.totalSupply(), totalSupply, "invariant: totalSupply");
        assertEq(proxy.bagSize(), bagSize, "invariant: bagSize");
        assertEq(proxy.buyIncrement(), buyIncrement, "invariant: buyIncrement");
        assertEq(proxy.currentFees(), currentFees, "invariant: currentFees");
        assertEq(proxy.lastBagId(), lastBagId, "invariant: lastBagId");
        assertEq(proxy.twapIncrement(), twapIncrement, "invariant: twapIncrement");
        assertEq(address(proxy.token()), tokenAddr, "invariant: underlying");
        assertEq(proxy.hookAddress(), hookAddr, "invariant: hook");
        assertEq(proxy.owner(), KEYCARD_OWNER, "invariant: owner");
        assertEq(PROXY.balance, proxyEth, "invariant: proxy ETH");

        // The factory-gated legacy setters are still factory-gated (nothing loosened).
        vm.prank(KEYCARD_OWNER);
        vm.expectRevert();
        proxy.updateName("X");

        // And a stranger still cannot rename.
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        proxy.updateNameAndSymbol("HACK", "HACK");
    }
}
