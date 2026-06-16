// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseTest} from "./Base.t.sol";
import {LineaDATStrategy} from "../src/LineaDATStrategy.sol";
import {BaseStrategy} from "../src/BaseStrategy.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @notice Tests the P2P bag-buy/sell mechanic of LineaDATStrategy.
contract StrategyTest is BaseTest {
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                INITIAL STATE INVARIANTS              */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function test_initialState_versionIs4() public view {
        assertEq(strategy.VERSION(), 4, "VERSION should be 4 (owner rename added)");
    }

    function test_initialState_totalSupplyIsBillion() public view {
        assertEq(strategy.totalSupply(), 1_000_000_000 * 1e18, "supply = 1B");
    }

    function test_initialState_factoryHasAllSupply() public view {
        // Per BaseStrategy.__BaseStrategy_init: _mint(factory(), MAX_SUPPLY)
        assertEq(strategy.balanceOf(address(factory)), 1_000_000_000 * 1e18);
    }

    function test_initialState_bagSizeIs150kLINEA() public view {
        assertEq(strategy.bagSize(), 150_000 * 1e18);
    }

    function test_initialState_buyIncrementIs005ETH() public view {
        assertEq(strategy.buyIncrement(), 0.005 ether);
    }

    function test_initialState_priceMultiplierIs1200() public view {
        assertEq(strategy.priceMultiplier(), 1200);
    }

    function test_initialState_twapIncrementIs05ETH() public view {
        assertEq(strategy.twapIncrement(), 0.05 ether);
    }

    function test_initialState_twapDelayIs4Blocks() public view {
        assertEq(strategy.twapDelayInBlocks(), 4);
    }

    function test_initialState_lastBagIdIsZero() public view {
        assertEq(strategy.lastBagId(), 0);
    }

    function test_initialState_currentFeesIsZero() public view {
        assertEq(strategy.currentFees(), 0);
    }

    function test_initialState_ownerIsAsConfigured() public view {
        assertEq(strategy.owner(), owner);
    }

    function test_initialState_underlyingIsLINEA() public view {
        assertEq(address(strategy.token()), address(linea));
    }

    function test_initialState_lastBuyBlockEqualsCreationBlock() public view {
        // BaseStrategy.__init sets lastBuyBlock = block.number
        assertEq(strategy.lastBuyBlock(), block.number);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  buyTokens - BAG CYCLE              */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function test_buyTokens_revertsOnZeroFees() public {
        // currentFees = 0 → availableFunds = 0 → revert NoZeroBuys
        _approveLINEA(botA, BAG_SIZE);
        vm.prank(botA);
        vm.expectRevert(LineaDATStrategy.NoZeroBuys.selector);
        strategy.buyTokens();
    }

    function test_buyTokens_succeedsWithFees() public {
        _addFees(0.5 ether);
        _approveLINEA(botA, BAG_SIZE);

        // Roll some blocks so getMaxPriceForBuy >= currentFees
        vm.roll(block.number + 30);

        uint256 botEthBefore = botA.balance;
        uint256 botLineaBefore = linea.balanceOf(botA);
        uint256 strategyLineaBefore = linea.balanceOf(address(strategy));
        uint256 expected = strategy.availableFunds();

        vm.prank(botA);
        strategy.buyTokens();

        // Bot sent BAG_SIZE LINEA, received `expected` ETH
        assertEq(linea.balanceOf(botA), botLineaBefore - BAG_SIZE);
        assertEq(linea.balanceOf(address(strategy)), strategyLineaBefore + BAG_SIZE);
        assertEq(botA.balance, botEthBefore + expected);

        // Strategy decremented currentFees and incremented lastBagId
        assertEq(strategy.currentFees(), 0.5 ether - expected);
        assertEq(strategy.lastBagId(), 1);
        assertEq(strategy.lastBuyBlock(), block.number);

        // bag listed for sale at expected x 1.2
        assertEq(strategy.onSale(1), expected * 1200 / 1000);
    }

    function test_buyTokens_revertsWhenLineaNotApproved() public {
        _addFees(0.5 ether);
        vm.roll(block.number + 30);

        // Bot has not approved
        vm.prank(botA);
        vm.expectRevert();
        strategy.buyTokens();
    }

    function test_buyTokens_revertsWhenLineaInsufficient() public {
        _addFees(0.5 ether);
        vm.roll(block.number + 30);

        // alice has only 1M LINEA, mints 1M but BAG_SIZE = 150k = ok in setUp
        // So mint a fresh actor with insufficient balance
        address poor = address(0x9999);
        linea.mint(poor, 100_000 * 1e18); // less than bagSize
        vm.prank(poor);
        linea.approve(address(strategy), BAG_SIZE);

        vm.prank(poor);
        vm.expectRevert(); // SafeTransferLib reverts
        strategy.buyTokens();
    }

    function test_buyTokens_resetsBuyBlockAfterCall() public {
        _addFees(0.5 ether);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + 30);

        vm.prank(botA);
        strategy.buyTokens();

        assertEq(strategy.lastBuyBlock(), block.number, "lastBuyBlock = current block");

        // Right after buy, getMaxPriceForBuy = (0+1)*0.005 = 0.005 ETH (very low, prevents same-block re-buy at high price)
        assertEq(strategy.getMaxPriceForBuy(), 0.005 ether);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*               sellTokens - BUY-BACK BAG             */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function test_sellTokens_succeedsWithExactPrice() public {
        // Set up bag #1
        _addFees(0.5 ether);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + 30);
        vm.prank(botA);
        strategy.buyTokens();

        uint256 listPrice = strategy.onSale(1);
        uint256 buyerLineaBefore = linea.balanceOf(buyer);

        vm.prank(buyer);
        strategy.sellTokens{value: listPrice}(1);

        assertEq(linea.balanceOf(buyer), buyerLineaBefore + BAG_SIZE);
        assertEq(strategy.onSale(1), 0);
        assertEq(strategy.ethToTwap(), listPrice, "ethToTwap accumulates sale ETH (NOT currentFees)");
    }

    function test_sellTokens_revertsOnWrongPrice() public {
        _addFees(0.5 ether);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + 30);
        vm.prank(botA);
        strategy.buyTokens();

        uint256 listPrice = strategy.onSale(1);
        vm.prank(buyer);
        vm.expectRevert(LineaDATStrategy.PriceTooLow.selector);
        strategy.sellTokens{value: listPrice - 1}(1);
    }

    function test_sellTokens_revertsOnNotForSale() public {
        // bagId 99 was never created
        vm.prank(buyer);
        vm.expectRevert(LineaDATStrategy.NotForSale.selector);
        strategy.sellTokens{value: 1 ether}(99);
    }

    function test_sellTokens_revertsOnDoubleSale() public {
        _addFees(0.5 ether);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + 30);
        vm.prank(botA);
        strategy.buyTokens();
        uint256 lp = strategy.onSale(1);
        vm.prank(buyer);
        strategy.sellTokens{value: lp}(1);

        // Second buyer tries same bag
        vm.prank(alice);
        vm.expectRevert(LineaDATStrategy.NotForSale.selector);
        strategy.sellTokens{value: lp}(1);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   list() PAGINATION                 */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function test_list_emptyWhenNoBags() public view {
        uint256[] memory bags = strategy.list();
        assertEq(bags.length, 1); // [0..0] = single 0-id slot
        assertEq(bags[0], 0);
    }

    function test_list_returnsAllBags() public {
        _approveLINEA(botA, 5 * BAG_SIZE);

        // Create 3 bags
        for (uint256 i = 0; i < 3; i++) {
            _addFees(0.4 ether);
            vm.roll(block.number + 25);
            vm.prank(botA);
            strategy.buyTokens();
        }

        uint256[] memory bags = strategy.list();
        assertEq(bags.length, 4); // [0..3]
        // bags[0] = onSale[0] = 0 (never used; bagId starts at 1)
        assertEq(bags[0], 0);
        for (uint256 i = 1; i < 4; i++) {
            assertGt(bags[i], 0, "active bag should have non-zero list price");
        }
    }

    function test_list_rangeRespected() public {
        _approveLINEA(botA, 5 * BAG_SIZE);
        for (uint256 i = 0; i < 3; i++) {
            _addFees(0.4 ether);
            vm.roll(block.number + 25);
            vm.prank(botA);
            strategy.buyTokens();
        }

        uint256[] memory bags = strategy.list(2, 3);
        assertEq(bags.length, 2);
    }

    function test_list_revertsOnInvalidRange() public {
        _approveLINEA(botA, 1 * BAG_SIZE);
        _addFees(0.4 ether);
        vm.roll(block.number + 25);
        vm.prank(botA);
        strategy.buyTokens();

        vm.expectRevert(LineaDATStrategy.InputsError.selector);
        strategy.list(5, 1);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*               updateBagSize gating                  */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function test_updateBagSize_succeedsBeforeAnyBuys() public {
        vm.prank(owner);
        strategy.updateBagSize(200_000 * 1e18);
        assertEq(strategy.bagSize(), 200_000 * 1e18);
    }

    function test_updateBagSize_succeedsAfterFirstBuy() public {
        // LineaDAT divergence from TokenWorks v3: bagSize can be retuned at any time
        // (v3 froze it permanently after the first buy via TokensAlreadyPurchased).
        // Rationale: $LINEA volatility on L2 makes a frozen bagSize a long-term liability.
        _addFees(0.5 ether);
        _approveLINEA(botA, BAG_SIZE);
        vm.roll(block.number + 30);
        vm.prank(botA);
        strategy.buyTokens();
        assertEq(strategy.lastBagId(), 1);

        vm.prank(owner);
        strategy.updateBagSize(200_000 * 1e18);
        assertEq(strategy.bagSize(), 200_000 * 1e18);
        // lastBuyBlock reset preserves v3 max-price-ramp behavior
        assertEq(strategy.lastBuyBlock(), block.number);
    }

    function test_updateBagSize_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(LineaDATStrategy.InputsError.selector);
        strategy.updateBagSize(0);
    }

    function test_updateBagSize_revertsForNonOwner() public {
        vm.prank(botA);
        vm.expectRevert(); // Solady Ownable Unauthorized
        strategy.updateBagSize(200_000 * 1e18);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*           addFees & priceMultiplier setter           */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function test_addFees_revertsForNonHook() public {
        vm.prank(botA);
        vm.expectRevert(BaseStrategy.OnlyHook.selector);
        strategy.addFees{value: 1 ether}();
    }

    function test_addFees_succeedsForHook() public {
        // BaseTest: address(this) is hookAddress
        strategy.addFees{value: 0.5 ether}();
        assertEq(strategy.currentFees(), 0.5 ether);
    }

    function test_setPriceMultiplier_succeedsForFactory() public {
        vm.prank(address(factory));
        strategy.setPriceMultiplier(2000); // 2x markup
        assertEq(strategy.priceMultiplier(), 2000);
    }

    function test_setPriceMultiplier_revertsOnLowValue() public {
        vm.prank(address(factory));
        vm.expectRevert(); // InvalidMultiplier
        strategy.setPriceMultiplier(1000); // < 1100 minimum
    }

    function test_setPriceMultiplier_revertsOnHighValue() public {
        vm.prank(address(factory));
        vm.expectRevert();
        strategy.setPriceMultiplier(10001); // > 10000 maximum
    }

    function test_setPriceMultiplier_revertsForNonFactory() public {
        vm.prank(owner);
        vm.expectRevert(); // NotFactory
        strategy.setPriceMultiplier(1500);
    }
}
