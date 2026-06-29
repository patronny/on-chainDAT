# 50. LDAT - Final Specification

This is a **locked** spec. All parameters approved by the user (May 1, 2026). Any changes go through an explicit `git rm` + a new revision of this document.

## 1. Identifier and base semantics

| Field | Value |
|---|---|
| **Token name** | `LDAT` |
| **Token symbol** | **`LDAT`** | (deployed symbol is all-caps; `name` stays `LDAT`)
| **Decimals** | 18 |
| **Total supply** | 1 000 000 000 × 10¹⁸ |
| **Underlying** | $LINEA `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04` (canonical L2 token, 18 dec, not fee-on-transfer, not rebase) |
| **Network** | Linea L2 (chainId 59 144) |
| **Architecture version** | ERC20Strategy v3 forked, MIT-attributed |

## 2. Key parameters (final-locked)

| Parameter | Value | Rationale |
|---|---|---|
| `bagSize` | **150 000 LINEA** = 150 000 × 10¹⁸ | $546 ≈ 0.236 ETH; 1.97% TVL of the top pool, slippage ~2%, see §6 |
| `buyIncrement` | **0.005 ETH/block** = 5 × 10¹⁵ wei (IMMUTABLE, set in initialize) | catch-up bagSize ≈ 47 blocks at Linea ~2-sec blocks; slowed from 0.02 to stretch the slow-rug ramp |
| `priceMultiplier` | **1200** (= 1.2× markup) | copy of v3, the bot earns a 20% premium |
| `twapIncrement` | **0.05 ETH** = 5 × 10¹⁶ wei | conservative for a thin pool, we raise `setTwapIncrement` manually once the pool grows |
| `twapDelayInBlocks` | **4** (= 12 seconds on Linea) | protection against same-block sandwich MEV; equivalent to mainnet `1×12s` |
| `STARTING_BUY_FEE` | **9 900** bps (99%) | copy of v3 |
| `DEFAULT_FEE` | **1 000** bps (10%) - buy after decay AND sell always | copy of v3 |
| Buy-fee decay rate | **−100 bps/min** | copy of v3, plateaus in 89 min |
| Fee split (technical) | **80% / 10% / 10%** = treasury / LDAT-burn / creator | copy of v3, see §3 |
| Fee split (effective for $LDAT self-launch) | **80% / 20%** = treasury / creator | edge-case: LDAT-burn redirected to feeAddress while collection == LDAT_ADDRESS |

## 3. Fee split - exact logic

Source to modify: [`research/tokenworks-hook/ERC20StrategyHook.sol:_processFees`](../research/tokenworks-hook/ERC20StrategyHook.sol).

### Patch v3 → LDAT version

```solidity
// LDAT-version of _processFees:
function _processFees(address collection, uint256 feeAmount) internal {
    if (feeAmount == 0) return;

    uint256 depositAmount   = (feeAmount * 80) / 100;     // 80% always treasury
    uint256 lineaDATAmount  = (feeAmount * 10) / 100;     // 10% LDAT-burn (renamed from PNKSTR)
    uint256 ownerAmount     = feeAmount - depositAmount - lineaDATAmount;  // 10% creator

    // === EDGE CASE: for the LDAT token itself, 10% LDAT-burn redirected to feeAddress ===
    if (collection == LDAT_ADDRESS) {
        // On $LDAT itself there is nowhere to burn itself via the factory
        // → send to feeAddress (creator), effective split 80/20
        SafeTransferLib.forceSafeTransferETH(feeAddress, lineaDATAmount);
    } else {
        // For future strategies on Linea: 10% → factory → swap ETH→LDAT → 0xdead
        SafeTransferLib.forceSafeTransferETH(address(strategyFactory), lineaDATAmount);
    }

    // 10% creator (or added to treasury if feeAddressClaimedByOwner=0)
    address feeRecipient = feeAddressClaimedByOwner[collection];
    if (feeRecipient == address(0)) {
        depositAmount += ownerAmount;
    } else {
        SafeTransferLib.forceSafeTransferETH(feeRecipient, ownerAmount);
    }

    INFTStrategy(collection).addFees{value: depositAmount}();
}
```

### What needs to be set at initialize

`feeAddressClaimedByOwner[LDAT_PROXY] = 0x6e0d01089976093680c881CcDcB79e0D046e2433` (our feeAddress).

⚠️ **If not set** - ownerAmount merges into treasury (like WBTCSTR), creator gets 0 from sell-fees. This is a **mandatory step** in the deployment runbook.

### Effective schemes

**For $LDAT (self-launch):**
- 80% treasury (via `addFees`)
- 10% creator (LDAT-burn redirect)
- 10% creator (`feeAddressClaimedByOwner` → feeAddress)
- = **80% treasury / 20% creator**

**For a future token `$XYZSTR` (e.g. $ETHSTR on Linea):**
- 80% treasury (accumulates ETH to buy back the ETH-bag - well, figuratively, the underlying)
- 10% LDAT-burn (factory → ETH→LDAT swap → dead)
- 10% creator
- = **80% treasury / 10% LDAT-burn / 10% creator**

This is **shared code**, behavior depends on which token is launched. This is exactly the "base for the next tokens on Linea".

## 4. Initial pool (single-sided seed)

| Parameter | Value |
|---|---|
| PoolKey.currency0 | `0x0000000000000000000000000000000000000000` (native ETH) |
| PoolKey.currency1 | `LDAT_PROXY_ADDRESS` (TBD after deploy) |
| PoolKey.fee | `0x800000` (DYNAMIC_FEE_FLAG) |
| PoolKey.tickSpacing | 60 |
| PoolKey.hooks | `LDAT_HOOK_ADDRESS` (TBD after CREATE2 mining) |
| Initial sqrtPriceX96 | calibrated to `1 ETH ≈ 40 000 000 LDAT` (currentTick ≈ +175 052 with 18-decimals on both sides) |
| Initial price 1 LDAT | ≈ $0.0001 (at ETH=$2 317) |
| Initial FDV | ≈ $100 000 |
| ModifyLiquidity range | tickLower = −887 220, tickUpper ≈ +175 020 (32 ticks below initial tick for single-sided lock) |
| Liquidity reserves | 0 ETH + ~1 000 000 000 LDAT (minus ~1k wei for rounding) |
| LP-NFT (PositionManager) | tokenId TBD → minted to `0x000…dEaD` immediately |

**The exact sqrtPriceX96** at ETH ≈ $2 317 at the moment of launch will be recomputed by the deploy script: the goal is initial price `1 LDAT = (target_FDV $100k) / 1B / ETH_price = $0.0001 / $2 317 = 4.3 × 10⁻⁸ ETH = 4.3 × 10¹⁰ wei = 1 LDAT / 23 165 248 ETH-units`.

`sqrtPriceX96 = sqrt(token1/token0) × 2⁹⁶`. If `token1/token0 = 23 165 248` (LDAT per ETH), then `sqrtP = 4 813.03`, `sqrtPriceX96 = 4 813.03 × 2⁹⁶ ≈ 3.81 × 10²⁹`. We will recompute the scenario precisely at the moment of deploy against the current ETH price.

## 5. Bot architecture

### 5.1 Deployment

| Component | Technology | Host |
|---|---|---|
| **Bot A** (primary) | Node.js 22 + TypeScript + viem v2 | fly.io EU region (Frankfurt) |
| **Bot B** (standby) | identical | fly.io US region (Ashburn) |
| **Heartbeat / failover** | fly.io healthcheck → automatic restart; Discord webhook alert on > 5 minutes downtime | |
| **Monitoring** | Discord webhook (real-time logs) + simple dashboard on Vercel (read-only RPC) | |

### 5.2 Working capital

| Bot | ETH in wallet (start) |
|---|---|
| **Bot A** | **2 ETH** (≈$4 634) |
| **Bot B** (standby) | **1 ETH** (≈$2 317) |
| **Total upfront** | **3 ETH** ≈ **$6 951** |

On successful steady-state the capital grows (each cycle +0.04 ETH profit). If it drops below **0.5 ETH** on a bot - Discord alert, you top up from holdings.

### 5.3 Bot algorithm (pseudocode)

```typescript
async function tick() {
  const fees     = await read('currentFees', LDAT_PROXY);
  const maxBuy   = await read('getMaxPriceForBuy', LDAT_PROXY);
  const avail    = min(fees, maxBuy);

  // Quote $LINEA price via aggregator (Lynex / Etherex / KyberSwap / Odos)
  const linePrice = await bestQuote('LINEA', 'WETH', BAG_SIZE_LINEA);  // ETH per bag
  const breakeven = linePrice + GAS_BUFFER;                             // ~0.005 ETH gas

  // Conservative mode: 10% buffer instead of 5% (less risk, fewer cycles)
  if (avail >= breakeven * 1.10) {
    // Atomic-ish (multicall if supported, otherwise 2 raw txs):
    await buy_LINEA_via_aggregator(BAG_SIZE_LINEA);
    await approve(LINEA, LDAT_PROXY, BAG_SIZE_LINEA);
    await call('buyTokens()', LDAT_PROXY);
    log(`+cycle profit ≈ ${avail - linePrice} ETH`);
  }
}

setInterval(tick, BLOCK_TIME_MS);  // 3000ms
```

### 5.4 Failover logic

- Bot B reads `lastBuyBlock` via RPC every 60 seconds. If for **3 minutes** `lastBuyBlock` has not moved **AND** `availableFunds() ≥ marketPrice × 1.10` (= trigger condition) - this means Bot A is silent. Bot B takes over the work.
- When Bot A returns: both see that `lastBuyBlock` is fresh, both return to normal mode (B waits for the trigger).

## 6. Frontend

| Parameter | Value |
|---|---|
| **Stack** | Next.js 15 (App Router) + wagmi v2 + RainbowKit + viem + TailwindCSS |
| **Hosting** | Vercel (free tier) |
| **Domain** | `on-chaindat.com` (already secured 2026-05-05) (buy a week before launch on GoDaddy) |
| **Structure** | single-page: hero (price + supply + burned + treasury holdings) → swap card (ETH↔LDAT via UniversalRouter V2_1_1) → **Actions card** (3 buttons, see §6.1) → recent trades feed → footer |
| **Design** | 3 options to choose from: (a) Linea-style blue, (b) dark/neon, (c) academic minimalism. Final choice before mainnet deploy |

### 6.1 Actions card (exact copy of the tokenstrategy.com pattern + one addition of ours)

Three buttons in one block:

```
┌─────────────────────────────────────────────────────┐
│ Actions                                              │
├─────────────────────────────────────────────────────┤
│ [1] Sell $LINEA → Strategy                          │
│     Step 1: Approve $LINEA                          │
│     Step 2: Sell 150 000 LINEA, get X.XX ETH        │
│     (shows premium: «+0.05 ETH vs Etherex»)         │
├─────────────────────────────────────────────────────┤
│ [2] Buy bag at 1.2× from Strategy  ← our addition   │
│     Best deal: bag #N, 150 000 LINEA for 0.45 ETH  │
│     (shows: «save $X vs market price»)              │
│     disabled if no profitable bag available         │
├─────────────────────────────────────────────────────┤
│ [3] Burn LDAT (+0.5% reward)                    │
│     if ethToTwap = 0 → disabled «No ETH to Burn»    │
│     else active: «Burn min(ethToTwap, 0.05) ETH»   │
└─────────────────────────────────────────────────────┘
```

**Button 1 - Sell $LINEA → Strategy.** Equivalent of `Approve $WBTC + buyTokens()` at TokenWorks (see their UI in the user's screenshot). Two-step flow:
- Step 1 (`approve`): `LINEA.approve(LDAT_PROXY, 150_000e18)` - one-time.
- Step 2 (`buyTokens`): call `LDAT_PROXY.buyTokens()` - the contract pulls 150k LINEA, pays `availableFunds()` ETH to the user.
- UI live-reads: `availableFunds` from the proxy, `marketPrice(150 000 LINEA)` via GeckoTerminal API + Etherex/Lynex quote, displays the **premium** = the difference. If premium ≤ 0 - the button shows «Not profitable yet - wait for fees to accumulate» (not disabled, the user can still click).

**Button 2 - Buy bag at 1.2× from Strategy.** Equivalent of `sellTokens(bagId)` - this is **our addition** (TokenWorks does not have this as a separate button, they do it via a list of bags). UI:
- Reads `lastBagId`, then for each `bagId in [1..lastBagId]` calls `onSale[bagId]` (read-only).
- Filters non-zero (= active bags in the listing).
- Computes "for which `listPrice / 150 000 LINEA` is below the current market price of $LINEA" → shows the top-1.
- The button calls `LDAT_PROXY.sellTokens{value: listPrice}(bagId)` - the contract gives out 150k LINEA, the user pays exactly `listPrice`.
- If all bags are unprofitable - the button is disabled with tooltip «No profitable bag - market price is below Strategy listings».
- This is the **frontend-equivalent of `0xca60e8f0`** (sell-side bag-buyer on WBTCSTR, 77% of all `sellTokens()`). It attracts organic buyers of $LINEA through the strategy.

**Button 3 - Burn LDAT (+0.5% reward).** Exact copy of the WBTCSTR pattern. UI:
- Live-reads `ethToTwap` from the proxy.
- Disabled if `ethToTwap == 0n` with the label «No ETH to Burn - wait for next bag-sale».
- Active otherwise: «Burn `min(ethToTwap, 0.05) ETH` → buys & burns ≈ X LDAT. Reward: `0.5% × min(ethToTwap, 0.05)` ETH ≈ $0.5».
- Calls `LDAT_PROXY.processTokenTwap()`.

### 6.2 Live data feed

Sources for all the numbers in the UI:
- On-chain (via wagmi/viem, frequency: every block via `watchBlocks`):
  - `currentFees`, `ethToTwap`, `lastBuyBlock`, `lastBagId`, `availableFunds()`, `getMaxPriceForBuy()` - proxy slots
  - `LINEA.balanceOf(LDAT_PROXY)` - treasury inventory
  - `totalSupply()` − `balanceOf(0xdead)` - circulating supply (a measure of "how much has already been burned")
  - `onSale[bagId]` for all active bags
- Off-chain (REST polling every 30 seconds):
  - GeckoTerminal `/api/v2/networks/linea/tokens/0x1789e004…bb04/pools` - the current price of $LINEA for premium calculation
  - DefiLlama `/coins.llama.fi/prices/current/coingecko:ethereum` - ETH-USD for conversion

## 7. Owner and admin policy

| Field | Value |
|---|---|
| **Owner** | **`0x1470c542D60e83EcCFE005332f5789Bd669D027C`** (user's Keycard EOA, EIP-55 verified, fresh nonce=0 on Ethereum + Linea as of 2026-05-01) |
| **`feeAddress`** | **`0x6e0d01089976093680c881CcDcB79e0D046e2433`** |
| **Renounce** | **"Never" with the option to do it at any moment** - non-renounced at start, if needed (e.g. if a critical bug is found and we have successfully fixed it) renounce is done in one transaction `transferOwnership(0xdead)` or `renounceOwnership()` |
| **Admin functions available to owner** | `updateHookAddress`, `setDistributor`, `_authorizeUpgrade` (UUPS), `setPriceMultiplier` (via factory), `updateBagSize` (only while `lastBagId == 0`), `setTwapIncrement` (planned to add as an `onlyOwner` setter on top of v3) |
| **Pre-launch checklist for the owner wallet** | (1) ≥ 0.05 ETH on Linea for gas for deploy + initialize + post-init settings; (2) the key is stored only on the Keycard, **never** uploaded to host servers; (3) for every admin-tx - manual signing via the Keycard ↔ MetaMask flow |

## 8. What needs to change in the v3 sources for LDAT

List of concrete edits relative to [`research/tokenworks-sources/`](../research/tokenworks-sources/) and [`research/tokenworks-hook/`](../research/tokenworks-hook/):

### `BaseStrategy.sol`
- [ ] Add MIT-header `// Based on TokenWorks ERC20Strategy v3 (MIT). Original: token.works`
- [ ] Change `GLOBAL_DISTRIBUTION_HANDLER` (hardcoded `0xDf99…9B2D` on mainnet) - to the address for Linea **or zero** (the code has a fallback `block.chainid == 1 ? CONST : globalDistributor`, for Linea the `globalDistributor` storage var will be used, which the owner sets via `setGlobalDistributor`)
- [ ] Add a `setTwapIncrement(uint256)` `onlyOwner` setter (needed to ramp up twapIncrement once the pool grows; v3 has no such thing - needs to be added carefully)
- [ ] **Do not change storage layout** - all fields in the same order for compatibility with indexers

### `ERC20Strategy.sol`
- [ ] Add MIT-header
- [ ] `VERSION()` → returns 3 (we fork v3, we do not make 4)
- [ ] The `buyTokens` / `sellTokens` / `list` / `updateBagSize` logic - unchanged

### `ERC20StrategyHook.sol`
- [ ] Add MIT-header
- [ ] Rename `IPunkStrategy punkStrategy` → `address lineaDATAddress`
- [ ] In `_processFees`:
  - rename `pnkstrAmount` → `lineaDATAmount`
  - add a branch `if (collection == lineaDATAddress) { send to feeAddress } else { send to factory for buy-and-burn }`
- [ ] Rename errors `NotNFTStrategy` → `NotStrategy`, `NotNFTStrategyFactoryOwner` → `NotStrategyFactoryOwner`
- [ ] Rename event `Trade.nftStrategy` → `strategy`

### Factory (new, ours - we do not use the TokenWorks factory)
- [ ] Our minimal factory, deploy LDAT proxy + hook + initialize pool + seed liquidity + send LP-NFT to dead. Inspiration - TokenWorks Factory `0x9f834e16…000a0a`, but we do not clone the launchpad logic (we do not need the `ownerLaunchStrategy` permissionless flow).
- [ ] The factory holds `LDAT_ADDRESS` immutable - after the first deploy it is fixed
- [ ] The factory has logic for buy-and-burn LDAT (receives ETH from the hook via `forceSafeTransferETH`, swaps ETH→LDAT via UniversalRouter V2_1_1, sends to dead) - this is used only on future strategies, not on LDAT itself

## 9. Parameters for `initialize()`

```solidity
// Deploy script - pseudocode
LineaDATStrategy proxy = factory.deployStrategy({
    underlying:        0x1789e0043623282D5DCc7F213d703C6D8BAfBB04,  // $LINEA
    bagSize:           150_000 * 1e18,                              // 150 000 LINEA
    hook:              minedHookAddress,                            // CREATE2-mined
    tokenName:         "LDAT",
    tokenSymbol:       "LDAT",
    buyIncrement:      0.005 ether,                                 // 5 × 10¹⁵ wei (immutable)
    owner:             ownerKeycardEOA
});

// After initialize:
hook.adminUpdateFeeAddress(
    address(proxy),
    0x6e0d01089976093680c881CcDcB79e0D046e2433  // feeAddressClaimedByOwner[LDAT] = creator
);

proxy.setPriceMultiplier(1200);   // 1.2× markup (default is already 1200, but we set it explicitly)
// twapIncrement default = 1 ETH in v3, we need 0.05 ETH - add a setter:
proxy.setTwapIncrement(0.05 ether);
proxy.setTwapDelayInBlocks(4);    // 12 seconds on Linea
```

## 10. Security - pre-deploy checklist

- [ ] **Slither** on all .sol files - 0 high/medium findings
- [ ] **Aderyn** - 0 high findings
- [ ] **Foundry tests** - 100+ scenarios:
  - happy path: buy → sell → buy-and-burn cycle
  - bot front-running: 2 bots in the same block, competition
  - slow-rug attempt: bot waits N blocks, we check that `availableFunds` → bound by `currentFees`
  - sandwich attack on `processTokenTwap`
  - re-entrancy via ERC-777 underlying - but `$LINEA` is not ERC-777, ok
  - empty pool: calling `buyTokens` / `sellTokens` / `processTokenTwap` when the balance is 0
- [ ] **Manual review** of Adam Lizek's mistakes from [`30-tokenworks-incidents.md`](30-tokenworks-incidents.md):
  - feeAddressClaimedByOwner set ✓
  - bot deployed before launch ✓
  - frontend «Buy Target $LINEA» button ready ✓
- [ ] **Anvil fork test** - 1000 cycles in an accelerated simulation (jump 100 blocks, mine, check invariants)
- [ ] **Base Sepolia public test** - minimum 7 days, you test the UI from a real Keycard

## 11. Live benchmark from prototypes (how to calibrate expectations)

Data from an RPC scan 2026-05-01 (see [`research/raw-rpc-data/`](../research/raw-rpc-data/)):

### WBTCSTR (108 days since launch, our main prototype)

| Metric | WBTCSTR | LDAT target (90 days) | Rationale |
|---|---|---|---|
| Cycles `buyTokens` (bag-creates) | 34 | **≥ 45** | our bot is more active from launch + Linea is faster (3s vs 12s blocks) |
| Cycles `sellTokens` (bag-sales) | 22 (= 65% of buy) | **≥ 35** (= 78%) | our UI with the «Buy bag at 1.2×» button makes the sell-flow visible to organic users |
| Active bag inventory (unsold) | 12/34 = 35% | **≤ 22%** | the sell-side button should reduce the "stagnation" |
| `processTokenTwap` cycles | 24 | **≥ 30** | the reward ($0.5/click on Linea) makes it callable by random users |
| Realized protocol profit (ListPrice − PaidPrice) | +1.99 ETH | **≥ +1.5 ETH** | our bagSize is 2× smaller, so the absolute amount is lower, but cycle frequency is higher |
| Avg cycles/day | 0.31 | **≥ 0.5** | |
| Avg margin/cycle | +0.090 ETH | **+0.045 ETH** | proportional to bagSize (0.236 vs 0.45 ETH) |

### Bot leaderboard on WBTCSTR (for comparison with our bot)

| Bot | Calls | Share | Architecture |
|---|---|---|---|
| `0xaf682de1...11f7d` | 13 (38%) | smart-contract bot, profit withdrawn immediately (balance 0 ETH) |
| `0xc31a49d1...1c649` | 3 (9%) | smart-contract bot, holds 19.93 ETH of capital |
| `0x00000f91...0cac` | 3 (9%) | smart-contract bot (vanity) |
| `0xe08d97e1...d015` | 2 (6%) | smart-contract bot |
| 13 different EOAs | 1 each (38% in total) | random users via the UI |

**Conclusion:** WBTCSTR is dominated by the **smart-contract bot pattern** (62% of all cycles from 4 bots). Our 2 EOA-bots will be simpler at start, but less efficient. Plan: **in version 2 of the bots** switch to the smart-contract pattern (like `0xaf682de1`) - flashbot-like, atomic swap+buyTokens in one tx.

### Sell-side benchmark

`0xca60e8f0...aa76` bought **17 of 22 bags** (77%) on WBTCSTR for 9.67 ETH. This is the **main sell-side arbitrageur**, who most likely used the list of bags via the TokenWorks UI. Our button #2 (`Buy bag at 1.2×`) should **democratize** this flow for random users.

### What this means financially

With WBTCSTR-baseline parameters over a 90-day horizon we forecast for LDAT (after my adjustments):

- **Treasury growth:** ≥ 1.5 ETH realized profit + 8 × bagSize ≈ 1.2M LINEA in inventory ⇒ **~$2 800 USD in treasury**
- **Burn cumulative:** ≥ 30 × 0.04 ETH × 2.5M LDAT/ETH ≈ **3M LDAT burned** = 0.3% supply
- **Bot ROI (ours):** +1.5 ETH / 3 ETH capital = **+50%** over 90 days - this is **enough** to cover hosting + gas and still have margin

⚠️ **Warning:** these numbers are based on the **WBTCSTR baseline**, which itself is a relatively dead market (0.31 cycles/day). If LDAT gets **more** interest (a wave of meme-buyers, a CEX listing, etc.) - the numbers grow ×3-10. If **less** (like REKTSTR, 3 cycles over 5 months) - the flywheel will be nearly stalled.
