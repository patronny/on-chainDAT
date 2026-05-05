// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "solady/tokens/ERC20.sol";
import {LibClone} from "solady/utils/LibClone.sol";

import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {LineaDATFactory} from "../src/LineaDATFactory.sol";
import {ILineaDATStrategy} from "../src/Interfaces.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Mock $LINEA — minimal Solady ERC20, 18 decimals, large supply (mimics canonical Linea L2 token).
contract MockLINEA is ERC20 {
    function name() public pure override returns (string memory) {
        return "Linea";
    }

    function symbol() public pure override returns (string memory) {
        return "LINEA";
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mock PoolManager — only used as immutable arg in proxy bytecode. Strategy doesn't actually call into it
/// during unit tests because we use the test contract as the "hook" (msg.sender == hookAddress check).
contract MockPoolManager {
    fallback() external payable {}
    receive() external payable {}
}

/// @notice Mock UniversalRouter — strategy proxy holds it as an immutable arg. Not invoked during unit tests
/// (only invoked from BaseStrategy._buyAndBurnTokens during processTokenTwap, which we test separately).
contract MockUniversalRouter {
    fallback() external payable {}
    receive() external payable {}
}

/// @notice Shared test scaffolding: deploys factory + strategy impl + mock LINEA + factory.deployStrategy.
/// @dev Tests inheriting `BaseTest` can:
///   - Call `addFees{value: x}()` directly on `strategy` (this contract is hookAddress)
///   - Call `increaseTransferAllowance(x)` directly on `strategy`
///   - Use `mockHook = address(this)` for any hook-only check
abstract contract BaseTest is Test {
    // === Locked LineaDAT params (per docs/50-lineadat-spec.md) ===
    uint256 internal constant BAG_SIZE = 150_000 * 1e18; // 150 000 LINEA
    uint256 internal constant BUY_INCREMENT = 0.02 ether; // 0.02 ETH/block
    uint256 internal constant TWAP_INCREMENT = 0.05 ether;
    uint256 internal constant TWAP_DELAY = 4;

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // === Test actors ===
    address internal owner = address(0xA);
    address internal feeAddr = address(0xF);
    address internal botA = address(0xB07A);
    address internal buyer = address(0xBB);
    address internal alice = address(0xA11CE);

    // === Deployed contracts ===
    MockLINEA internal linea;
    MockPoolManager internal poolMgr;
    MockUniversalRouter internal router;
    LineaDATStrategy internal impl;
    LineaDATFactory internal factory;
    LineaDATStrategy internal strategy; // proxy

    function setUp() public virtual {
        // 1. Deploy mocks
        linea = new MockLINEA();
        poolMgr = new MockPoolManager();
        router = new MockUniversalRouter();

        // 2. Deploy factory (owner = this test contract by default)
        factory = new LineaDATFactory(IPoolManager(address(poolMgr)), address(router));

        // 3. Deploy strategy implementation
        impl = new LineaDATStrategy();

        // 4. Configure factory: set impl + hook (test contract acts as hook to bypass real hook checks)
        factory.setStrategyImplementation(address(impl));
        factory.updateHookAddress(address(this)); // test contract is the "hook"

        // 5. Deploy LineaDAT proxy (the self-launch token)
        address proxy = factory.deployStrategy(
            address(linea), BAG_SIZE, "LineaDAT", "LINEADAT", owner, BUY_INCREMENT
        );
        strategy = LineaDATStrategy(payable(proxy));

        // 6. Owner-side setup: tweak twap params (would normally go through hook.adminUpdateFeeAddress + setters)
        vm.startPrank(owner);
        strategy.setTwapIncrement(TWAP_INCREMENT);
        strategy.setTwapDelayInBlocks(TWAP_DELAY);
        vm.stopPrank();

        // 7. Fund test actors
        vm.deal(botA, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(address(this), 100 ether);

        // 8. Mint LINEA to actors so they can call buyTokens (sells LINEA → contract for ETH)
        linea.mint(botA, 10_000_000 * 1e18); // 10M LINEA = ~67 bag-quantities
        linea.mint(alice, 1_000_000 * 1e18);
    }

    /// @notice Helper: feed `amount` ETH into strategy.currentFees by calling addFees from this contract (= hook)
    function _addFees(uint256 amount) internal {
        strategy.addFees{value: amount}();
    }

    /// @notice Helper: ensure account has approved strategy for at least `amount` LINEA
    function _approveLINEA(address account, uint256 amount) internal {
        vm.prank(account);
        linea.approve(address(strategy), amount);
    }
}
