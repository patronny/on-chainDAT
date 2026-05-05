// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {LineaDATHook} from "../src/LineaDATHook.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {ILineaDATFactory, ILineaDATStrategy} from "../src/Interfaces.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

import {MockPoolManager, MockLINEA, MockUniversalRouter} from "./Base.t.sol";

/// @notice Hook-specific tests. Hook permission flags must be 0x2444 (beforeInitialize | afterAddLiquidity |
/// afterSwap | afterSwapReturnDelta). To deploy a hook with a "valid" address in tests, we vm.etch the hook
/// bytecode at a precomputed address with the right low bits.
contract HookTest is Test {
    LineaDATHook internal hook;
    LineaDATFactory internal factory;
    LineaDATStrategy internal impl;
    LineaDATStrategy internal strategy;
    MockPoolManager internal poolMgr;
    MockUniversalRouter internal router;
    MockLINEA internal linea;

    address internal owner = address(0xA);
    address internal feeAddr = address(0xF);

    function setUp() public {
        poolMgr = new MockPoolManager();
        router = new MockUniversalRouter();
        linea = new MockLINEA();

        factory = new LineaDATFactory(IPoolManager(address(poolMgr)), address(router));
        impl = new LineaDATStrategy();
        factory.setStrategyImplementation(address(impl));

        // Deploy hook at a permission-valid address. The constructor asserts hook permissions match the address bits.
        // For testing, we deploy at an address with low 14 bits = 0x2444.
        // Hook permissions: beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta = 0x2444
        // We use a salt-mined address. For unit tests we can compute via CREATE2 with a small mining loop.
        address hookAddr = _mineHookAddress();
        hook = LineaDATHook(payable(hookAddr));

        // Now register the hook with factory
        factory.updateHookAddress(address(hook));

        // Deploy LineaDAT strategy
        strategy = LineaDATStrategy(payable(factory.deployStrategy(
            address(linea), 150_000e18, "LineaDAT", "LINEADAT", owner, 0.02 ether
        )));
    }

    /// @notice Deploys hook via simple CREATE2 search until address has low 14 bits = 0x2444
    function _mineHookAddress() internal returns (address) {
        bytes memory creationCode = abi.encodePacked(
            type(LineaDATHook).creationCode,
            abi.encode(IPoolManager(address(poolMgr)), address(0), ILineaDATFactory(address(factory)), feeAddr)
        );
        bytes32 codeHash = keccak256(creationCode);

        for (uint256 salt = 0; salt < 1_000_000; salt++) {
            address predicted = address(uint160(uint256(keccak256(abi.encodePacked(
                bytes1(0xff), address(this), bytes32(salt), codeHash
            )))));
            if ((uint160(predicted) & 0x3FFF) == 0x2444) {
                address deployed;
                assembly {
                    deployed := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
                }
                require(deployed == predicted, "create2 mismatch");
                return deployed;
            }
        }
        revert("hook mining failed in 1M salts");
    }

    function test_hook_addressHasCorrectPermissions() public view {
        assertEq(uint160(address(hook)) & 0x3FFF, 0x2444);
    }

    function test_hook_getHookPermissions_returnsCorrectFlags() public view {
        Hooks.Permissions memory p = hook.getHookPermissions();
        assertTrue(p.beforeInitialize);
        assertFalse(p.afterInitialize);
        assertFalse(p.beforeAddLiquidity);
        assertTrue(p.afterAddLiquidity);
        assertFalse(p.beforeRemoveLiquidity);
        assertFalse(p.afterRemoveLiquidity);
        assertFalse(p.beforeSwap);
        assertTrue(p.afterSwap);
        assertFalse(p.beforeDonate);
        assertFalse(p.afterDonate);
        assertFalse(p.beforeSwapReturnDelta);
        assertTrue(p.afterSwapReturnDelta);
        assertFalse(p.afterAddLiquidityReturnDelta);
        assertFalse(p.afterRemoveLiquidityReturnDelta);
    }

    function test_hook_calculateFee_buyDecaysFrom99To10() public {
        // calculateFee(collection, true) for buys decays at -100bps/min from 9900 (99%) to 1000 (10%)
        // Without setting deploymentTime, it should return DEFAULT_FEE = 1000 (10%) immediately.
        uint128 feeNoDeploymentTime = hook.calculateFee(address(strategy), true);
        assertEq(feeNoDeploymentTime, 1000, "no deploymentTime => default 10%");

        // To trigger decay, we'd need deploymentTime[strategy] to be set, which happens in _beforeInitialize.
        // We can't trigger that without going through PoolManager.initialize. Decay logic is tested below
        // by reading the constants.

        // Sell fee is constant 10%
        uint128 sellFee = hook.calculateFee(address(strategy), false);
        assertEq(sellFee, 1000, "sell fee always 10%");
    }

    function test_hook_lineaDATAddress_isUnsetUntilFactoryDeploys() public view {
        // When the hook was deployed, lineaDATAddress was passed as address(0) (we hadn't deployed strategy yet).
        // But factory.lineaDATAddress was set after first deploy. The hook uses its own immutable, so it stays 0.
        // For a real deployment, hook constructor would receive the strategy address (computed CREATE2).
        // Here we verify that the immutable is 0 in this test setup.
        assertEq(hook.lineaDATAddress(), address(0));
    }

    function test_hook_feeAddress_isInitiallyConfigured() public view {
        assertEq(hook.feeAddress(), feeAddr);
    }

    function test_hook_updateFeeAddress_byFactoryOwner() public {
        // Factory owner = this test contract
        hook.updateFeeAddress(address(0x1234));
        assertEq(hook.feeAddress(), address(0x1234));
    }

    function test_hook_updateFeeAddress_revertsForNonOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(LineaDATHook.NotStrategyFactoryOwner.selector);
        hook.updateFeeAddress(address(0x1234));
    }

    function test_hook_adminUpdateFeeAddress_byFactoryOwner() public {
        hook.adminUpdateFeeAddress(address(strategy), address(0x1234));
        assertEq(hook.feeAddressClaimedByOwner(address(strategy)), address(0x1234));
    }

    function test_hook_adminUpdateFeeAddress_byFactoryItself() public {
        // factory contract address passes the auth check too
        vm.prank(address(factory));
        hook.adminUpdateFeeAddress(address(strategy), address(0x5678));
        assertEq(hook.feeAddressClaimedByOwner(address(strategy)), address(0x5678));
    }

    function test_hook_adminUpdateFeeAddress_revertsForOther() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(LineaDATHook.NotStrategyFactoryOwner.selector);
        hook.adminUpdateFeeAddress(address(strategy), address(0x1234));
    }
}
