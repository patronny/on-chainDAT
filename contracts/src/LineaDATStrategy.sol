// SPDX-License-Identifier: MIT
// Based on TokenWorks ERC20Strategy v3 (MIT). Original: token.works
pragma solidity ^0.8.26;

import {ERC20} from "solady/tokens/ERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

import {BaseStrategy} from "./BaseStrategy.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @title LineaDATStrategy - An ERC20 strategy token backed by $LINEA on Linea L2
/// @author Based on TokenWorks ERC20Strategy v3 (MIT)
/// @notice This contract implements an ERC20 token backed by $LINEA.
///         Users can trade the token on Uniswap V4, and the contract uses trading fees to buy bags of the underlying token.
/// @dev Uses ERC1967 proxy pattern with immutable args for gas-efficient upgrades
contract LineaDATStrategy is BaseStrategy {
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™                ™™™™™™™™™™™                ™™™™™™™™™™™ */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™               ™™™™™™™™™™™™™              ™™™™™™™™™™  */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™              ™™™™™™™™™™™™™              ™™™™™™™™™™™  */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™             ™™™™™™™™™™™™™™            ™™™™™™™™™™™   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™            ™™™™™™™™™™™™™™™            ™™™™™™™™™™™   */
    /*                ™™™™™™™™™™™            ™™™™™™™™™™™           ™™™™™™™™™™™™™™™           ™™™™™™™™™™™    */
    /*                ™™™™™™™™™™™             ™™™™™™™™™™          ™™™™™™™™™™™™™™™™™          ™™™™™™™™™™™    */
    /*                ™™™™™™™™™™™             ™™™™™™™™™™          ™™™™™™™™™™™™™™™™™          ™™™™™™™™™™     */
    /*                ™™™™™™™™™™™              ™™™™™™™™™™        ™™™™™™™™™™™™™™™™™™™        ™™™™™™™™™™™     */
    /*                ™™™™™™™™™™™              ™™™™™™™™™™™       ™™™™™™™™™ ™™™™™™™™™       ™™™™™™™™™™™      */
    /*                ™™™™™™™™™™™               ™™™™™™™™™™      ™™™™™™™™™™ ™™™™™™™™™™      ™™™™™™™™™™™      */
    /*                ™™™™™™™™™™™               ™™™™™™™™™™      ™™™™™™™™™   ™™™™™™™™™      ™™™™™™™™™™       */
    /*                ™™™™™™™™™™™                ™™™™™™™™™™    ™™™™™™™™™™    ™™™™™™™™™    ™™™™™™™™™™        */
    /*                ™™™™™™™™™™™                 ™™™™™™™™™™   ™™™™™™™™™     ™™™™™™™™™™  ™™™™™™™™™™™        */
    /*                ™™™™™™™™™™™                 ™™™™™™™™™™  ™™™™™™™™™™     ™™™™™™™™™™  ™™™™™™™™™™         */
    /*                ™™™™™™™™™™™                  ™™™™™™™™™™™™™™™™™™™™       ™™™™™™™™™™™™™™™™™™™™          */
    /*                ™™™™™™™™™™™                   ™™™™™™™™™™™™™™™™™™         ™™™™™™™™™™™™™™™™™™           */
    /*                ™™™™™™™™™™™                   ™™™™™™™™™™™™™™™™™™         ™™™™™™™™™™™™™™™™™™           */
    /*                ™™™™™™™™™™™                    ™™™™™™™™™™™™™™™™           ™™™™™™™™™™™™™™™™            */
    /*                ™™™™™™™™™™™                     ™™™™™™™™™™™™™™             ™™™™™™™™™™™™™™             */
    /*                ™™™™™™™™™™™                     ™™™™™™™™™™™™™™             ™™™™™™™™™™™™™™             */
    /*                ™™™™™™™™™™™                      ™™™™™™™™™™™™               ™™™™™™™™™™™™              */

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                     CONSTANTS                       */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice The token this strategy is tied to
    ERC20 public token;
    /// @notice The amount of tokens this strategy buys per call
    uint256 public bagSize;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   STATE VARIABLES                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Mapping of bagId (block.number) => price
    mapping(uint256 => uint256) public onSale;
    /// @notice id of the last bag of tokens bought
    uint256 public lastBagId;

    /// @notice Storage gap for future upgrades (prevents storage collisions)
    uint256[50] private __gap;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   CUSTOM EVENTS                     */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Emitted when the protocol buys from the token
    event ERC20BoughtByProtocol(
        uint256 indexed bagId,
        uint256 purchasePrice,
        uint256 listPrice
    );
    /// @notice Emitted when the protocol buys from the token
    event ERC20SoldByProtocol(
        uint256 indexed bagId,
        uint256 price,
        address buyer
    );

    /// @notice Emitted when the owner() updates bagSize
    event UpdatedBagSize(uint256 newBagSize);

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    CUSTOM ERRORS                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice given ERC20 bag id is not currently for sale
    error NotForSale();
    /// @notice Sent ETH amount is less than the bag sale price
    error PriceTooLow();
    /// @notice Call didn't result in buying the right amount of the token
    error BalanceMismatch();
    /// @notice triggered when trying to buy tokens for 0
    error NoZeroBuys();
    /// @notice triggered when there is an error in inputs
    error InputsError();
    /// @notice unlockCallback called by something other than the PoolManager
    error NotPoolManager();

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    CONSTRUCTOR                      */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Constructor calls BaseStrategy() to disable initializers
    /// @dev This is required for the proxy pattern to work correctly
    constructor() BaseStrategy() {}

    /// @notice Initializes the contract with required addresses and permissions
    /// @param _token Address of the underlying ERC20 contract
    /// @param _bagSize Size of the bag of token to buy at once
    /// @param _hook Address of the StrategyHook contract
    /// @param _tokenName Name of the token
    /// @param _tokenSymbol Symbol of the token
    /// @param _buyIncrement Buy increment for the token
    /// @param _owner Owner of the contract
    function initialize(
        address _token,
        uint256 _bagSize,
        address _hook,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _buyIncrement,
        address _owner
    ) external initializer {
        require(_token != address(0), "Invalid token");
        require(_bagSize != 0, "Invalid bag size");

        token = ERC20(_token);
        bagSize = _bagSize;

        __BaseStrategy_init(
            _hook,
            _tokenName,
            _tokenSymbol,
            _buyIncrement,
            _owner
        );
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                 GETTERS                             */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @dev this must be incremented whenever there is any change in BaseStrategy or this strategy
    function VERSION() public pure override returns (uint256) {
        return 4;
    }

    /// @notice Owner-only escape hatch to drain LineaDAT tokens from the factory address.
    /// @dev Phase 3.5 testnet helper. The factory holds the entire 1B mint after deployStrategy
    ///      (BaseStrategy.__BaseStrategy_init mints to factory()), but our minimal LineaDATFactory
    ///      lacks a seedLiquidity orchestration. This function lets the owner pull tokens out so a
    ///      script can run the v4 pool seed flow externally. Phase 4 mainnet must replace this with
    ///      a proper factory.seedLiquidity(...) function (see TODO docs/85-phase-3-5-results.md).
    ///
    ///      Marks `to` as a distributor before the transfer so _afterTokenTransfer's whitelist
    ///      check passes. Caller is responsible for unsetting via setDistributor(to, false) later.
    function factoryEscape(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        isDistributor[to] = true;
        _transfer(factory(), to, amount);
    }

    /// @notice Override TWAP burn path to use PoolManager.unlock instead of router().
    /// @dev Phase 3.5 testnet fix. Inherited BaseStrategy.processTokenTwap calls
    ///      router().swapExactTokensForTokens which is the v4-router interface; the
    ///      Base Sepolia UniversalRouter at 0x492E...4104 only exposes execute(commands,
    ///      inputs) and reverts on the v4-router selector. Phase 4 mainnet must replace
    ///      this with a proper UniversalRouter call once the right router is deployed
    ///      with the v4-router-compatible interface (or migrate to v4-router lib's UR04).
    function processTokenTwap() external override nonReentrant {
        if (ethToTwap == 0) revert NoETHToTwap();
        if (block.number < lastTwapBlock + twapDelayInBlocks) revert TwapDelayNotMet();

        uint256 burnAmount = twapIncrement;
        if (ethToTwap < twapIncrement) burnAmount = ethToTwap;

        uint256 reward = (burnAmount * 5) / 1000;
        burnAmount -= reward;

        ethToTwap -= burnAmount + reward;
        lastTwapBlock = block.number;

        // Swap ETH -> LineaDAT via PoolManager.unlock; takes LineaDAT straight to dead.
        poolManager().unlock(abi.encode(burnAmount));

        SafeTransferLib.forceSafeTransferETH(msg.sender, reward);
    }

    /// @notice PoolManager unlock callback for processTokenTwap. NOT for general use.
    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager())) revert NotPoolManager();
        uint256 burnAmount = abi.decode(raw, (uint256));

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(this)),
            fee: 0x800000, // DYNAMIC_FEE_FLAG
            tickSpacing: 60,
            hooks: IHooks(hookAddress)
        });

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(burnAmount),
            sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
        });

        BalanceDelta delta = poolManager().swap(key, params, "");
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        // Settle ETH owed to the pool
        if (amount0 < 0) {
            poolManager().settle{value: uint256(uint128(-amount0))}();
        }
        // Take LineaDAT straight to dead address - burns supply
        if (amount1 > 0) {
            poolManager().take(key.currency1, DEAD_ADDRESS, uint256(uint128(amount1)));
        }

        emit BoughtAndBurned(int256(amount0), int256(amount1));
        return "";
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                 MECHANISM FUNCTIONS                 */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Buys {bagSize} tokens from {msg.sender} using the {availableFunds()} and relist
    /// @dev callers needs to give allowance to current contract for transfer
    function buyTokens() external nonReentrant {
        uint256 funds = availableFunds();

        // this prevents tokens from being locked in contract because if salePrice == 0
        // tokens would be seen as not on sale
        if (funds == 0) {
            revert NoZeroBuys();
        }

        uint256 bagId = (++lastBagId);

        uint256 tokenBalanceBefore = token.balanceOf(address(this));

        SafeTransferLib.safeTransferFrom(
            address(token),
            msg.sender,
            address(this),
            bagSize
        );

        // TODO: not certain this is needed but it doesn't hurt to double check, right?
        if (token.balanceOf(address(this)) != tokenBalanceBefore + bagSize) {
            revert BalanceMismatch();
        }

        currentFees -= funds;

        uint256 listPrice = (funds * priceMultiplier) / 1000;
        onSale[bagId] = listPrice;

        // Update last buy block to reset max price calculation
        lastBuyBlock = block.number;

        SafeTransferLib.forceSafeTransferETH(msg.sender, funds);

        emit ERC20BoughtByProtocol(bagId, funds, listPrice);
    }

    /// @notice Sell a bag that was previously bought and listed
    /// @param bagId The ID of the bag to sell
    function sellTokens(uint256 bagId) external payable nonReentrant {
        // Get sale price
        uint256 salePrice = onSale[bagId];

        // Verify bag is for sale
        if (salePrice == 0) revert NotForSale();

        // Verify sent ETH matches sale price
        if (msg.value != salePrice) revert PriceTooLow();

        // Remove from sale
        delete onSale[bagId];

        // Transfer tokens to buyer
        token.transfer(msg.sender, bagSize);

        // Add sale price to fees
        ethToTwap += salePrice;

        emit ERC20SoldByProtocol(bagId, salePrice, msg.sender);
    }

    /// @notice Update the bag size
    /// @param newBagSize The new bag size to set
    /// @dev LineaDAT divergence from TokenWorks v3: v3 reverts with TokensAlreadyPurchased once
    ///      lastBagId != 0, freezing bagSize permanently after the first buy. With $LINEA being a
    ///      volatile L2 token, a frozen bagSize becomes too thick (price up) or too thin (price
    ///      down) for the bot and frontend Sell flow. We allow the owner to retune at any time;
    ///      the only protected invariant is that newBagSize > 0. lastBuyBlock reset preserves
    ///      v3 behavior (resets the getMaxPriceForBuy ramp so accrual restarts cleanly).
    function updateBagSize(uint256 newBagSize) external onlyOwner {
        if (newBagSize == 0) revert InputsError();
        bagSize = newBagSize;

        // Update last buy block to reset max price calculation
        lastBuyBlock = block.number;
        emit UpdatedBagSize(newBagSize);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  GETTER FUNCTIONS                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Returns all onSale prices from id 0 to {lastBagId} included
    /// @dev switch to list(start, end) if this function ever revert because too much gas
    /// @return bags all onSale prices from id 0 to lastBagId
    function list() external view returns (uint256[] memory bags) {
        return list(0, lastBagId);
    }

    /// @notice Returns all onSale prices from id {startId} to {endId} included
    /// @param startId the id of the first bag
    /// @param endId the id of the last bag
    /// @return bags all onSale prices from id {startId} to {endId}
    function list(
        uint256 startId,
        uint256 endId
    ) public view returns (uint256[] memory bags) {
        if (endId < startId) {
            revert InputsError();
        }

        uint256 length = endId - startId + 1;
        bags = new uint256[](length);

        for (uint256 i; i < length; i++) {
            bags[i] = onSale[startId + i];
        }
    }
}
