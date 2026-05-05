// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest, MockLINEA, MockPoolManager, MockUniversalRouter} from "./Base.t.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Tests the full deployment flow: factory ↔ implementation ↔ proxy clone.
contract InitializeTest is BaseTest {
    function test_factory_setsLineaDATAddressOnFirstDeploy() public view {
        // BaseTest.setUp deployed the LineaDAT strategy as the first one
        assertEq(factory.lineaDATAddress(), address(strategy));
    }

    function test_factory_mapsTokenToStrategy() public view {
        assertEq(factory.tokenToStrategy(address(linea)), address(strategy));
        assertEq(factory.startegyToToken(address(strategy)), address(linea));
    }

    function test_factory_revertsOnDuplicateDeploy() public {
        vm.expectRevert(LineaDATFactory.AlreadyDeployed.selector);
        factory.deployStrategy(address(linea), BAG_SIZE, "DupName", "DUP", owner, BUY_INCREMENT);
    }

    function test_factory_revertsOnNonOwnerDeploy() public {
        // Deploy a fresh second token to test
        MockLINEA token2 = new MockLINEA();
        vm.prank(botA);
        vm.expectRevert(); // Solady Ownable Unauthorized
        factory.deployStrategy(address(token2), BAG_SIZE, "Token2", "TOK2", owner, BUY_INCREMENT);
    }

    function test_factory_canDeploySecondStrategy() public {
        // Owner of factory is this test contract
        MockLINEA token2 = new MockLINEA();
        address strategy2 = factory.deployStrategy(
            address(token2), 100_000 * 1e18, "TokenStrategy2", "T2STR", owner, 0.01 ether
        );

        assertTrue(strategy2 != address(strategy), "second strategy is a separate clone");
        // First strategy (LineaDAT) was the lineaDATAddress sentinel — second deploy doesn't change it
        assertEq(factory.lineaDATAddress(), address(strategy));
        assertEq(factory.tokenToStrategy(address(token2)), strategy2);
    }

    function test_factory_revertsWhenLaunchDisabled() public {
        factory.disableLaunchUpgradeable();

        MockLINEA token2 = new MockLINEA();
        vm.expectRevert(LineaDATFactory.LaunchDisabled.selector);
        factory.deployStrategy(address(token2), BAG_SIZE, "X", "X", owner, BUY_INCREMENT);
    }

    function test_factory_revertsWithoutImpl() public {
        // Fresh factory with no impl set
        LineaDATFactory f = new LineaDATFactory(IPoolManager(address(poolMgr)), address(router));
        f.updateHookAddress(address(this));

        MockLINEA token2 = new MockLINEA();
        vm.expectRevert(LineaDATFactory.InvalidImplementation.selector);
        f.deployStrategy(address(token2), BAG_SIZE, "X", "X", owner, BUY_INCREMENT);
    }

    function test_factory_revertsWithoutHook() public {
        LineaDATFactory f = new LineaDATFactory(IPoolManager(address(poolMgr)), address(router));
        f.setStrategyImplementation(address(impl));

        MockLINEA token2 = new MockLINEA();
        vm.expectRevert(LineaDATFactory.InvalidHookAddress.selector);
        f.deployStrategy(address(token2), BAG_SIZE, "X", "X", owner, BUY_INCREMENT);
    }

    function test_proxy_immutableArgsContainFactoryRouterPoolManager() public view {
        assertEq(strategy.factory(), address(factory));
        assertEq(address(strategy.router()), address(router));
        assertEq(address(strategy.poolManager()), address(poolMgr));
    }

    function test_proxy_implementationPointsToImpl() public view {
        assertEq(strategy.getImplementation(), address(impl));
    }

    function test_proxy_initializeIsIdempotent() public {
        // Calling initialize again should revert (Solady Initializable)
        vm.expectRevert();
        strategy.initialize(address(linea), BAG_SIZE, address(this), "X", "X", BUY_INCREMENT, owner);
    }

    function test_proxy_nameAndSymbolStored() public view {
        assertEq(strategy.name(), "LineaDAT");
        assertEq(strategy.symbol(), "LINEADAT");
    }

    function test_proxy_decimalsAreEighteen() public view {
        assertEq(strategy.decimals(), 18);
    }

    function test_factory_setLoadingLiquidityFlag() public {
        assertEq(factory.loadingLiquidity(), false);
        factory.setLoadingLiquidity(true);
        assertEq(factory.loadingLiquidity(), true);
        factory.setLoadingLiquidity(false);
        assertEq(factory.loadingLiquidity(), false);
    }

    function test_factory_revertsOnInvalidImpl() public {
        vm.expectRevert(LineaDATFactory.InvalidImplementation.selector);
        factory.setStrategyImplementation(address(0));

        vm.expectRevert(LineaDATFactory.InvalidImplementation.selector);
        factory.setStrategyImplementation(address(0xCAFE)); // EOA with no code
    }

    function test_factory_revertsOnInvalidHook() public {
        vm.expectRevert(LineaDATFactory.InvalidHookAddress.selector);
        factory.updateHookAddress(address(0));

        vm.expectRevert(LineaDATFactory.InvalidHookAddress.selector);
        factory.updateHookAddress(address(0xCAFE));
    }
}
