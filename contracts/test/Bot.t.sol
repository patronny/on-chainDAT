// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest} from "./Base.t.sol";
import {LineaDATBot, ILineaDATStrategyView} from "../src/LineaDATBot.sol";

/// @notice LineaDATBot test suite — verifies the keeper-bot's atomic round logic, access control,
/// and configuration knobs. Bot is funded with tLINEA (mocked $LINEA) + ETH and is registered as a
/// distributor on the strategy so its underlying-token transfers don't get blocked by `_afterTokenTransfer`.
contract BotTest is BaseTest {
    LineaDATBot internal bot;
    address internal keeper = address(0xC107); // crontask runner EOA
    address internal botOwner = address(0x90);

    function setUp() public override {
        super.setUp();

        // Deploy bot
        bot = new LineaDATBot(address(strategy), address(linea), keeper, botOwner);

        // Whitelist bot as a distributor on the strategy (so its sellTokens-receive doesn't get blocked
        // by transient-allowance checks). In production we wouldn't need this, but in unit-test scaffolding
        // the test contract is the hook, which is more permissive than the real hook.
        vm.prank(owner);
        strategy.setDistributor(address(bot), true);

        // Fund bot with tLINEA (1.5M = 10 bag quantities) and ETH (50 ETH for sellTokens / gas)
        linea.mint(address(bot), 1_500_000 * 1e18);
        vm.deal(address(bot), 50 ether);
    }

    // =====================================================================================
    //                                ACCESS CONTROL
    // =====================================================================================

    function test_constructor_setsImmutables() public view {
        assertEq(address(bot.strategy()), address(strategy));
        assertEq(address(bot.underlying()), address(linea));
        assertEq(bot.keeper(), keeper);
        assertEq(bot.owner(), botOwner);
    }

    function test_constructor_revertsOnZeroStrategy() public {
        vm.expectRevert(LineaDATBot.ZeroAddress.selector);
        new LineaDATBot(address(0), address(linea), keeper, botOwner);
    }

    function test_constructor_revertsOnZeroUnderlying() public {
        vm.expectRevert(LineaDATBot.ZeroAddress.selector);
        new LineaDATBot(address(strategy), address(0), keeper, botOwner);
    }

    function test_constructor_revertsOnZeroKeeper() public {
        vm.expectRevert(LineaDATBot.ZeroAddress.selector);
        new LineaDATBot(address(strategy), address(linea), address(0), botOwner);
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(LineaDATBot.ZeroAddress.selector);
        new LineaDATBot(address(strategy), address(linea), keeper, address(0));
    }

    function test_executeRound_revertsForNonKeeper() public {
        vm.prank(botA);
        vm.expectRevert(LineaDATBot.OnlyKeeper.selector);
        bot.executeRound(1);
    }

    function test_executeRound_succeedsForKeeper() public {
        vm.prank(keeper);
        bot.executeRound(1);
        // No assertion — just that it doesn't revert
    }

    // =====================================================================================
    //                              BUY ACTION (executeRound)
    // =====================================================================================

    function test_executeRound_skipsBuyWhenAvailableFundsBelowThreshold() public {
        // No fees added → availableFunds = 0
        uint256 lineaBefore = linea.balanceOf(address(bot));
        uint256 ethBefore = address(bot).balance;

        vm.prank(keeper);
        bot.executeRound(1);

        // No buy happened
        assertEq(linea.balanceOf(address(bot)), lineaBefore, "no LINEA spent");
        assertEq(address(bot).balance, ethBefore, "no ETH received");
        assertEq(strategy.lastBagId(), 0, "no bag created");
    }

    function test_executeRound_buysWhenAvailableFundsAboveThreshold() public {
        // Disable sell + twap to isolate buy logic (bot would otherwise self-sell its just-created bag)
        vm.startPrank(botOwner);
        bot.setSellEnabled(false);
        bot.setTwapEnabled(false);
        vm.stopPrank();

        // Add enough fees so availableFunds >= buyThreshold (default 0.02 ETH)
        _addFees(0.5 ether);
        vm.roll(block.number + 30); // ramp up

        uint256 lineaBefore = linea.balanceOf(address(bot));
        uint256 ethBefore = address(bot).balance;
        uint256 expectedFunds = strategy.availableFunds();

        vm.prank(keeper);
        bot.executeRound(1);

        assertEq(strategy.lastBagId(), 1, "one bag created");
        assertEq(linea.balanceOf(address(bot)), lineaBefore - BAG_SIZE, "BAG_SIZE LINEA spent");
        assertEq(address(bot).balance, ethBefore + expectedFunds, "ETH received = availableFunds");
    }

    function test_executeRound_skipsBuyWhenInsufficientUnderlying() public {
        // Drain bot's LINEA below BAG_SIZE
        vm.prank(botOwner);
        bot.withdrawUnderlying(botOwner, 1_500_000 * 1e18 - 1);

        _addFees(0.5 ether);
        vm.roll(block.number + 30);

        vm.prank(keeper);
        bot.executeRound(1);

        assertEq(strategy.lastBagId(), 0, "no bag - bot underfunded");
    }

    function test_setBuyThreshold_blocksLowAvailableFunds() public {
        // Bump threshold above what addFees will produce
        vm.prank(botOwner);
        bot.setBuyThreshold(10 ether);

        _addFees(0.5 ether);
        vm.roll(block.number + 5);

        vm.prank(keeper);
        bot.executeRound(1);

        assertEq(strategy.lastBagId(), 0, "buy skipped due to threshold");
    }

    // =====================================================================================
    //                              SELL ACTION (executeRound)
    // =====================================================================================

    function test_executeRound_sellsExistingBag() public {
        // Create a bag (via direct buyTokens from external bot, so listPrice exists)
        _addFees(0.1 ether);
        vm.roll(block.number + 5);
        _approveLINEA(botA, BAG_SIZE);
        vm.prank(botA);
        strategy.buyTokens();

        uint256 bagId = strategy.lastBagId();
        uint256 listPrice = strategy.onSale(bagId);
        assertGt(listPrice, 0, "bag listed");
        assertLe(listPrice, bot.maxSellPrice(), "list price within bot's cap");

        uint256 ethToTwapBefore = strategy.ethToTwap();
        uint256 botEthBefore = address(bot).balance;
        uint256 botLineaBefore = linea.balanceOf(address(bot));

        // Now bot tries to sell-buy-back this bag. We need the bot to NOT also try to buy a NEW bag in
        // the same round (otherwise lastBagId increments and we test wrong thing). Drain currentFees
        // by setting threshold high.
        vm.prank(botOwner);
        bot.setBuyThreshold(100 ether);

        vm.prank(keeper);
        bot.executeRound(1);

        // Bag was bought back from contract
        assertEq(strategy.onSale(bagId), 0, "bag no longer on sale");
        assertEq(strategy.ethToTwap(), ethToTwapBefore + listPrice, "ethToTwap += listPrice");
        assertEq(address(bot).balance, botEthBefore - listPrice, "bot ETH -= listPrice");
        assertEq(linea.balanceOf(address(bot)), botLineaBefore + BAG_SIZE, "bot got BAG_SIZE LINEA back");
    }

    function test_setSellEnabled_disabledSkipsSell() public {
        // Create a bag
        _addFees(0.1 ether);
        vm.roll(block.number + 5);
        _approveLINEA(botA, BAG_SIZE);
        vm.prank(botA);
        strategy.buyTokens();
        uint256 bagId = strategy.lastBagId();

        // Disable sell
        vm.prank(botOwner);
        bot.setSellEnabled(false);
        vm.prank(botOwner);
        bot.setBuyThreshold(100 ether);

        vm.prank(keeper);
        bot.executeRound(1);

        assertGt(strategy.onSale(bagId), 0, "bag still listed - sell skipped");
    }

    function test_setMaxSellPrice_blocksExpensiveBags() public {
        _addFees(2 ether);
        vm.roll(block.number + 200); // big ramp → big paid → big listPrice
        _approveLINEA(botA, BAG_SIZE);
        vm.prank(botA);
        strategy.buyTokens();
        uint256 bagId = strategy.lastBagId();
        uint256 listPrice = strategy.onSale(bagId);
        assertGt(listPrice, 0.5 ether, "expensive list price");

        // Bot won't pay for this bag (cap below list price)
        vm.prank(botOwner);
        bot.setMaxSellPrice(0.5 ether);
        vm.prank(botOwner);
        bot.setBuyThreshold(100 ether);

        vm.prank(keeper);
        bot.executeRound(1);

        assertEq(strategy.onSale(bagId), listPrice, "bag still listed - too expensive");
    }

    // =====================================================================================
    //                              TWAP ACTION (executeRound)
    // =====================================================================================

    function test_executeRound_skipsTwapWhenEthBelowIncrement() public {
        // ethToTwap starts at 0
        vm.prank(keeper);
        bot.executeRound(1);
        // Just verify it didn't revert and ethToTwap is still 0
        assertEq(strategy.ethToTwap(), 0);
    }

    function test_setTwapEnabled_disabledSkipsTwap() public {
        vm.prank(botOwner);
        bot.setTwapEnabled(false);
        vm.prank(keeper);
        bot.executeRound(1);
        // No revert
    }

    // =====================================================================================
    //                              CONFIG MANAGEMENT
    // =====================================================================================

    function test_setKeeper_byOwner() public {
        address newKeeper = address(0xC108);
        vm.prank(botOwner);
        bot.setKeeper(newKeeper);
        assertEq(bot.keeper(), newKeeper);

        // Old keeper can't run rounds
        vm.prank(keeper);
        vm.expectRevert(LineaDATBot.OnlyKeeper.selector);
        bot.executeRound(1);

        // New keeper can
        vm.prank(newKeeper);
        bot.executeRound(1);
    }

    function test_setKeeper_revertsForNonOwner() public {
        vm.prank(keeper);
        vm.expectRevert();
        bot.setKeeper(address(0xC109));
    }

    function test_setKeeper_revertsOnZero() public {
        vm.prank(botOwner);
        vm.expectRevert(LineaDATBot.ZeroAddress.selector);
        bot.setKeeper(address(0));
    }

    function test_setBuyThreshold_byOwner() public {
        vm.prank(botOwner);
        bot.setBuyThreshold(0.1 ether);
        assertEq(bot.buyThreshold(), 0.1 ether);
    }

    function test_setMaxSellPrice_byOwner() public {
        vm.prank(botOwner);
        bot.setMaxSellPrice(2 ether);
        assertEq(bot.maxSellPrice(), 2 ether);
    }

    function test_setScanDepth_byOwner() public {
        vm.prank(botOwner);
        bot.setScanDepth(20);
        assertEq(bot.scanDepth(), 20);
    }

    function test_configSetters_revertForNonOwner() public {
        vm.startPrank(keeper);
        vm.expectRevert();
        bot.setBuyThreshold(0);
        vm.expectRevert();
        bot.setMaxSellPrice(0);
        vm.expectRevert();
        bot.setScanDepth(0);
        vm.expectRevert();
        bot.setTwapEnabled(false);
        vm.expectRevert();
        bot.setSellEnabled(false);
        vm.stopPrank();
    }

    // =====================================================================================
    //                              WITHDRAWALS
    // =====================================================================================

    function test_withdrawUnderlying_byOwner() public {
        uint256 botBalBefore = linea.balanceOf(address(bot));
        uint256 amount = 100_000 * 1e18;

        vm.prank(botOwner);
        bot.withdrawUnderlying(botOwner, amount);

        assertEq(linea.balanceOf(botOwner), amount);
        assertEq(linea.balanceOf(address(bot)), botBalBefore - amount);
    }

    function test_withdrawUnderlying_revertsForNonOwner() public {
        vm.prank(keeper);
        vm.expectRevert();
        bot.withdrawUnderlying(keeper, 1);
    }

    function test_withdrawUnderlying_revertsOnZeroTo() public {
        vm.prank(botOwner);
        vm.expectRevert(LineaDATBot.ZeroAddress.selector);
        bot.withdrawUnderlying(address(0), 1);
    }

    function test_withdrawETH_byOwner() public {
        uint256 botBalBefore = address(bot).balance;
        uint256 ownerBalBefore = botOwner.balance;
        uint256 amount = 5 ether;

        vm.prank(botOwner);
        bot.withdrawETH(botOwner, amount);

        assertEq(botOwner.balance, ownerBalBefore + amount);
        assertEq(address(bot).balance, botBalBefore - amount);
    }

    function test_withdrawETH_revertsForNonOwner() public {
        vm.prank(keeper);
        vm.expectRevert();
        bot.withdrawETH(keeper, 1);
    }

    // =====================================================================================
    //                              EVENT EMISSIONS
    // =====================================================================================

    function test_executeRound_emitsRoundExecuted() public {
        // We don't pre-stage anything → all 3 actions return false
        vm.expectEmit(true, false, false, true);
        emit LineaDATBot.RoundExecuted(42, false, 0, false);
        vm.prank(keeper);
        bot.executeRound(42);
    }

    function test_executeRound_emitsBoughtBag() public {
        _addFees(0.5 ether);
        vm.roll(block.number + 30);

        vm.expectEmit(true, false, false, false);
        emit LineaDATBot.BoughtBag(1, 0, 0); // bagId=1, paid/listPrice not checked
        vm.prank(keeper);
        bot.executeRound(1);
    }

    function test_setKeeper_emitsKeeperRotated() public {
        address newKeeper = address(0xC108);

        vm.expectEmit(true, true, false, false);
        emit LineaDATBot.KeeperRotated(keeper, newKeeper);

        vm.prank(botOwner);
        bot.setKeeper(newKeeper);
    }

    // =====================================================================================
    //                              INTEGRATED MULTI-ROUND
    // =====================================================================================

    function test_multipleRounds_buyAndSellSequence() public {
        // Round 1: only buy (sell + twap disabled)
        vm.startPrank(botOwner);
        bot.setSellEnabled(false);
        bot.setTwapEnabled(false);
        vm.stopPrank();

        _addFees(0.1 ether);
        vm.roll(block.number + 5);

        vm.prank(keeper);
        bot.executeRound(1);
        assertEq(strategy.lastBagId(), 1, "round 1 bought");
        assertGt(strategy.onSale(1), 0, "round 1: bag listed");

        // Round 2: re-enable sell, raise buyThreshold so we don't buy again, bot sells the bag back
        vm.startPrank(botOwner);
        bot.setSellEnabled(true);
        bot.setBuyThreshold(100 ether);
        vm.stopPrank();

        uint256 ethToTwapBefore = strategy.ethToTwap();
        vm.prank(keeper);
        bot.executeRound(2);
        assertEq(strategy.onSale(1), 0, "round 2: bag no longer on sale");
        assertGt(strategy.ethToTwap(), ethToTwapBefore, "round 2: ethToTwap grew (sold bag back)");

        // Round 3: nothing to do
        vm.prank(keeper);
        bot.executeRound(3);
    }
}
