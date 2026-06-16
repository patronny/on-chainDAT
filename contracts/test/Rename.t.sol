// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest} from "./Base.t.sol";

/// @notice Tests the owner-gated updateNameAndSymbol path (V4) used for the 2026-06 rebrand.
///         updateName/updateSymbol stay factory-gated and the factory has no passthrough,
///         so this owner path is the only practical way to rename a live strategy.
contract RenameTest is BaseTest {
    function test_updateNameAndSymbol_byOwner() public {
        vm.prank(owner);
        strategy.updateNameAndSymbol("LDAT", "LDAT");
        assertEq(strategy.name(), "LDAT", "name updated");
        assertEq(strategy.symbol(), "LDAT", "symbol updated");
    }

    function test_updateNameAndSymbol_revertsForNonOwner() public {
        vm.prank(botA);
        vm.expectRevert();
        strategy.updateNameAndSymbol("LDAT", "LDAT");
    }

    function test_updateNameAndSymbol_revertsOnEmptyName() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Empty name"));
        strategy.updateNameAndSymbol("", "LDAT");
    }

    function test_updateNameAndSymbol_revertsOnEmptySymbol() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Empty symbol"));
        strategy.updateNameAndSymbol("LDAT", "");
    }

    function test_updateNameAndSymbol_doesNotTouchEconomicState() public {
        uint256 supplyBefore = strategy.totalSupply();
        uint256 bagBefore = strategy.bagSize();
        uint256 incrementBefore = strategy.buyIncrement();

        vm.prank(owner);
        strategy.updateNameAndSymbol("LDAT", "LDAT");

        assertEq(strategy.totalSupply(), supplyBefore, "supply untouched");
        assertEq(strategy.bagSize(), bagBefore, "bagSize untouched");
        assertEq(strategy.buyIncrement(), incrementBefore, "buyIncrement untouched");
        assertEq(strategy.owner(), owner, "owner untouched");
    }
}
