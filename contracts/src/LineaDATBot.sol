// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "solady/auth/Ownable.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

import {IERC20} from "./Interfaces.sol";

/// @notice External strategy interface — only the parts LineaDATBot calls.
/// We define this locally (not in Interfaces.sol) so the bot has a tight ABI and doesn't pull in unrelated functions.
interface ILineaDATStrategyView {
    function availableFunds() external view returns (uint256);
    function bagSize() external view returns (uint256);
    function lastBagId() external view returns (uint256);
    function onSale(uint256 bagId) external view returns (uint256);
    function ethToTwap() external view returns (uint256);
    function twapIncrement() external view returns (uint256);
    function lastTwapBlock() external view returns (uint256);
    function twapDelayInBlocks() external view returns (uint256);

    function buyTokens() external;
    function sellTokens(uint256 bagId) external payable;
    function processTokenTwap() external;
}

/// @notice LineaDAT atomic keeper bot.
/// @dev Runs `executeRound()` from a trusted keeper EOA. Each round attempts up to 3 atomic actions:
///        1. buyTokens() — if availableFunds >= buyThreshold AND bot has enough underlying
///        2. sellTokens(bagId) — if onSale[bagId] is affordable AND bot has enough ETH
///        3. processTokenTwap() — if ethToTwap >= twapIncrement AND twapDelay has elapsed
///
///      Each action wrapped in try/catch — if any individual action reverts (e.g. someone front-ran the bag,
///      a swap-fee deposit just landed, etc.), the round still completes the remaining actions. The whole
///      round is atomic from the standpoint of state mutation: there's no half-state where we approved tokens
///      but didn't buy.
///
///      Bot architecture chosen: option (a) Multicall-bot, NOT MEV-bundle bot. Justification:
///        - LineaDAT's slow-rug protection (getMaxPriceForBuy ramp) makes frontrunning economically pointless
///          — every bot pays the same `availableFunds()` regardless of timing
///        - L2 (Linea, Base) gas is cheap → atomic batched calls are cheaper than separate txs
///        - No off-chain runner needed → smaller attack surface, no leaked private keys on fly.io
///        - Keeper can be triggered from any cron service (cron-job.org, GitHub Actions, Chainlink Automation)
///
/// @dev Funded with: tLINEA tokens (for buyTokens — bot sells underlying for ETH), and ETH (for sellTokens —
///                     bot buys bags back from itself / others, and for processTokenTwap which costs gas).
///
///      In practice on testnet, sellTokens isn't a profitable action for the bot directly — the 1.2× markup is
///      a profit FOR the protocol, not for the bag-buyer-back. But we include it for completeness so bags don't
///      sit unsold forever during testnet validation. On mainnet (Phase 4) we'd disable sellTokens in the bot.
contract LineaDATBot is Ownable, ReentrancyGuard {
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  IMMUTABLE STATE                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice The LineaDAT strategy contract this bot interacts with.
    ILineaDATStrategyView public immutable strategy;

    /// @notice The underlying ERC20 (LINEA on mainnet, tLINEA on testnet).
    IERC20 public immutable underlying;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   MUTABLE CONFIG                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Trusted EOA allowed to call executeRound(). Owner can rotate this.
    address public keeper;

    /// @notice Minimum availableFunds required for the bot to attempt buyTokens. Default: 0.02 ether.
    uint256 public buyThreshold;

    /// @notice Maximum bag list price the bot will pay for sellTokens. Default: 1 ether (cap to limit risk).
    uint256 public maxSellPrice;

    /// @notice How many recent bags to scan when looking for a sellable bag. Default: 10.
    uint256 public scanDepth;

    /// @notice If true, bot attempts processTokenTwap() in each round. Default: true.
    bool public twapEnabled;

    /// @notice If true, bot attempts sellTokens (testnet validation). Mainnet should set to false.
    bool public sellEnabled;

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                       EVENTS                        */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    event RoundExecuted(uint256 indexed roundId, bool boughtBag, uint256 bagsSold, bool processedTwap);
    event BoughtBag(uint256 indexed bagId, uint256 paidWei, uint256 listPriceWei);
    event SoldBag(uint256 indexed bagId, uint256 spentWei);
    event ProcessedTwap(uint256 ethToTwapBefore, uint256 ethToTwapAfter, uint256 rewardWei);
    event KeeperRotated(address indexed previousKeeper, address indexed newKeeper);
    event ConfigUpdated(string field, uint256 newValue);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                       ERRORS                        */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    error OnlyKeeper();
    error ZeroAddress();

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                     CONSTRUCTOR                     */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @param _strategy LineaDAT strategy proxy address
    /// @param _underlying The ERC-20 token to feed into buyTokens (tLINEA on testnet, $LINEA on mainnet)
    /// @param _keeper Initial keeper EOA address (cron-job runner)
    /// @param _owner Owner — can rotate keeper, withdraw funds, change config
    constructor(address _strategy, address _underlying, address _keeper, address _owner) {
        if (_strategy == address(0) || _underlying == address(0) || _keeper == address(0) || _owner == address(0)) {
            revert ZeroAddress();
        }
        strategy = ILineaDATStrategyView(_strategy);
        underlying = IERC20(_underlying);
        keeper = _keeper;

        // Sane defaults
        buyThreshold = 0.02 ether; // = buyIncrement; below this paid is too small to cover gas
        maxSellPrice = 1 ether; // hard cap — bot won't buy bags listed above this
        scanDepth = 10;
        twapEnabled = true;
        sellEnabled = true;

        _initializeOwner(_owner);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   ACCESS CONTROL                    */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert OnlyKeeper();
        _;
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  MAIN ROUND ENTRY                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Runs one bot round. Tries: 1) buyTokens, 2) sellTokens up to N bags, 3) processTokenTwap.
    /// @dev Each step is independent — if step N reverts, step N+1 still runs.
    /// @param roundId Caller-supplied identifier for log correlation. Not used on-chain.
    function executeRound(uint256 roundId) external onlyKeeper nonReentrant {
        bool boughtBag = _tryBuy();
        uint256 bagsSold = sellEnabled ? _trySell() : 0;
        bool processedTwap = twapEnabled ? _tryTwap() : false;

        emit RoundExecuted(roundId, boughtBag, bagsSold, processedTwap);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                   ACTION HANDLERS                   */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function _tryBuy() internal returns (bool) {
        uint256 funds = strategy.availableFunds();
        if (funds < buyThreshold) return false;

        uint256 bag = strategy.bagSize();
        if (underlying.balanceOf(address(this)) < bag) return false;

        // Approve strategy to pull bag from us
        underlying.approve(address(strategy), bag);

        try strategy.buyTokens() {
            uint256 newBagId = strategy.lastBagId();
            uint256 listPrice = strategy.onSale(newBagId);
            emit BoughtBag(newBagId, funds, listPrice);
            return true;
        } catch {
            // Reset approval if buy failed (defense in depth)
            underlying.approve(address(strategy), 0);
            return false;
        }
    }

    function _trySell() internal returns (uint256 sold) {
        uint256 lastBag = strategy.lastBagId();
        if (lastBag == 0) return 0;

        uint256 lower = lastBag > scanDepth ? lastBag - scanDepth + 1 : 1;
        for (uint256 bagId = lower; bagId <= lastBag; bagId++) {
            uint256 listPrice = strategy.onSale(bagId);
            if (listPrice == 0 || listPrice > maxSellPrice) continue;
            if (address(this).balance < listPrice) break; // can't afford any more

            try strategy.sellTokens{value: listPrice}(bagId) {
                emit SoldBag(bagId, listPrice);
                sold++;
            } catch {
                // Bag race-condition'd by another buyer; continue
            }
        }
    }

    function _tryTwap() internal returns (bool) {
        uint256 ethToTwap = strategy.ethToTwap();
        // Mirror strategy.processTokenTwap's own guard: only revert on ethToTwap == 0.
        // The strategy gracefully handles dust (ethToTwap < twapIncrement → burn whatever's there),
        // so the bot doesn't impose a second threshold. This also avoids a deadlock where fee
        // accumulation stalls just below twapIncrement and the burn pipeline never drains.
        if (ethToTwap == 0) return false;

        uint256 lastTwap = strategy.lastTwapBlock();
        uint256 delay = strategy.twapDelayInBlocks();
        if (block.number < lastTwap + delay) return false;

        try strategy.processTokenTwap() {
            uint256 ethAfter = strategy.ethToTwap();
            emit ProcessedTwap(ethToTwap, ethAfter, 0);
            return true;
        } catch {
            return false;
        }
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                    OWNER CONFIG                     */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    function setKeeper(address _keeper) external onlyOwner {
        if (_keeper == address(0)) revert ZeroAddress();
        emit KeeperRotated(keeper, _keeper);
        keeper = _keeper;
    }

    function setBuyThreshold(uint256 _v) external onlyOwner {
        buyThreshold = _v;
        emit ConfigUpdated("buyThreshold", _v);
    }

    function setMaxSellPrice(uint256 _v) external onlyOwner {
        maxSellPrice = _v;
        emit ConfigUpdated("maxSellPrice", _v);
    }

    function setScanDepth(uint256 _v) external onlyOwner {
        scanDepth = _v;
        emit ConfigUpdated("scanDepth", _v);
    }

    function setTwapEnabled(bool _v) external onlyOwner {
        twapEnabled = _v;
        emit ConfigUpdated("twapEnabled", _v ? 1 : 0);
    }

    function setSellEnabled(bool _v) external onlyOwner {
        sellEnabled = _v;
        emit ConfigUpdated("sellEnabled", _v ? 1 : 0);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                     WITHDRAWALS                     */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Withdraw underlying tokens (e.g., recover unused tLINEA capital after testnet)
    function withdrawUnderlying(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        SafeTransferLib.safeTransfer(address(underlying), to, amount);
        emit Withdrawn(address(underlying), to, amount);
    }

    /// @notice Withdraw ETH (e.g., recover unused balance after testnet)
    function withdrawETH(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        SafeTransferLib.forceSafeTransferETH(to, amount);
        emit Withdrawn(address(0), to, amount);
    }

    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */
    /*                  RECEIVE / FALLBACK                 */
    /* ™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™™ */

    /// @notice Accepts ETH from buyTokens payouts and from processTokenTwap reward.
    receive() external payable {}
}
