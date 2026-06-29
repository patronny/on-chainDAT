# 30. TokenWorks Incidents and Hacky Fixes

A complete registry of publicly known bugs, exploits, and architectural design flaws in the TokenStrategy ecosystem. We account for all of these cases **in the LDAT source code before deployment**, rather than as wrappers on top (the way TokenWorks did).

## Scope disclaimer

What was **not found** in public sources (important to record - this does not mean the bugs do not exist, it means they are not public):
- Reentrancy in the `beforeSwap` / `afterSwap` hook of TokenStrategy - no public disclosure found
- Incorrect `sqrtPriceX96` in the hook - not found
- Treasury drain via a substituted pool - not found
- Proxy / upgradeability vulns - irrelevant (contracts renounced on legacy deployments)
- Fee-on-transfer interaction bugs - not found
- DOS vectors - not found
- Reactions from samczsun / pashov / spreekaway / DeFiHackLabs - not found
- Rekt.news article - not published (impact below their $1M+ threshold)
- Technical postmortem from Rhynotic on Medium / Mirror / HackMD - not found

`0xleastwood` is mentioned as an "auditor" after the pause on 2025-09-28 ("no critical findings, but minor fixes and improvements were applied") - but a **public report does not exist**, only an indirect mention in a Twitter index.

## Incident 1 - PNKSTR ETH-drain bug + wrapper fix

| Field | Value |
|---|---|
| **Date** | approximately September 6-9, 2025 (after the September 6 launch) |
| **Token** | $PNKSTR |
| **Bug class** | Auth check / withdraw helper |
| **Impact** | $0 (whitehat disclosure, not exploited) |

### Summary

Community auditor `@0xQuit` (Yuga Labs VP of Blockchain) discovered a bug through which it was theoretically possible to drain the ETH accumulated in the PunkStrategy contract. The exact technical details were not publicly disclosed. Given the architecture (8% trade fee -> internal balance -> automatic purchase of a floor Punk via the CryptoPunks marketplace), the most likely bug classes are:
- an incorrect auth check on the internal `buyPunk()` / `withdraw` helper
- an incorrect cost check when calling the CryptoPunks `buyPunk(uint)` - which would allow passing a minimal price and pocketing the excess ETH
- an issue with `transferEther` / fallback - the refund went to the caller rather than to the owner contract

### Fix (the classic "crutch on top of the contract")

> "A patch was developed quickly through a wrapper smart contract, thus avoiding the headaches of a token migration" (Bankless)

- **The base ERC-20 was not changed** (it is renounced - nothing can be changed)
- A wrapper contract was deployed on top, which now serves as the entry point for all logic
- The old contract remained in trading as the ERC-20 itself, but its critical functions are effectively no longer used
- This is what explains the remark from docs.tokenstrategy.com: **"Trades are NOT enforced through the hook"** for PNKSTR

### Lesson for LDAT

🔴 **Do NOT renounce ownership immediately.** We start non-renounced (you chose this option), preserving the ability to patch the implementation via UUPS upgrade.

🔴 **The hook must be swappable through an owner-only setter** (this already exists in v3 as `updateHookAddress`).

🔴 **All ETH movements inside the contract go through an invariant checker** (balance before vs after, no-leftover-allowed).

## Incident 2 - Slow-rug of 181.706 ETH ($813K) ⚠️ MOST IMPORTANT

| Field | Value |
|---|---|
| **Date** | September 20, 2025, ~3 hours after launch |
| **Token** | $APESTR, $PUDGYSTR, $MOONSTR/$BIRBSTR, $MEEBSTR, $DICKSTR (5 tokens simultaneously) |
| **Bug class** | Design flaw + ops omission |
| **Impact** | **181.706 ETH ≈ $813,400** left the protocol treasury of 5 strategies into a single actor |
| **Arbitrageur address** | `0xa3d297423b17a3894dddd582dc41ff20e237ab75` |

### Summary

**Anti-snipe architecture:** the buy fee starts at **95%** and decreases by 1%/min down to a 10% resting level. At peak interest the pool accumulated more ETH than was needed for the floor NFT of the respective collections.

**Architectural difference from PNKSTR:** CryptoPunks has an on-chain marketplace (`buyPunk`), while other collections do not. Therefore the NFT purchase did not happen automatically from the contract but had to be triggered externally (a bot, a call to a trigger function).

**The team did not deploy a bot** for these 5 tokens.

As a result, an external arbitrageur over 3 hours bought 10 BAYC, 7 Moonbirds, 5 Pudgy Penguins, 4 Meebits and sold them into the strategies (exploiting the raised fee floor strategy buying), extracting the delta between the real floor and the strategy's accumulated pool - a net profit of **181.706 ETH ≈ $813,400**.

### Fix (also external)

- Rhynotic's tweet: "We're fixing the frontend, but there's no exploit. The fees pooled up fast, and bots took the arb. Sadly the frontend "Buy Target NFT" button would have helped prevent this... Back to fixing"
- **0xQuit** personally wrote and deployed a private bot to call `buyTarget` as soon as the floor was reached
- Nothing was pushed into the contract - again a crutch on the outside: frontend + bot

### Slow-rug math - why `buyIncrement` specifically is critical

Source: [`BaseStrategy.getMaxPriceForBuy`, `availableFunds`](../research/tokenworks-sources/src_strategies_BaseStrategy.sol).

```
getMaxPriceForBuy() = (block.number - lastBuyBlock + 1) * buyIncrement
availableFunds()    = min(currentFees, getMaxPriceForBuy())
```

The bot wants to obtain the **maximum `availableFunds`** under the condition that `availableFunds > marketPrice(bagSize)`. Profit per single call:

```
profit = availableFunds - marketPrice(bagSize) - gas
```

After the call, `lastBuyBlock = block.number` - the ceiling resets. The bot earns a profit **only when it manages to wait for the ceiling to grow above the market**, and this profit is bounded by `min(currentFees, getMaxPriceForBuy)`.

**Comparison of modes:**

| Parameter | NFTStrategy gen-2 (slow-rug 2025-09-20) | WBTCSTR gen-3 | LDAT (our parameters) |
|---|---|---|---|
| `buyIncrement` | low (~0.001-0.01 ETH/block) | **0.1 ETH/block** | **0.02 ETH/block** |
| Block time | 12 seconds (mainnet) | 12 seconds | **3 seconds (Linea)** |
| `bagSize` cost | ~5 ETH (Punk floor) | 0.54 ETH | **0.236 ETH** |
| Ceiling catch-up time to bagSize | hours -> days | 5.4 blocks ≈ 65 sec | **12 blocks ≈ 36 sec** |
| Premium accumulation window | large | minimal | **minimal** |
| Single-bot risk | **critical** | low | **low** |

**Attack figures for 2025-09-20:** 181.706 ETH went to a single arbitrageur over ~3 hours across 5 tokens simultaneously => ~12.1 ETH/hour/token. With an assumed `buyIncrement ≈ 0.005 ETH`, the ceiling gained ~1.5 ETH per hour - but `currentFees` accrued even faster (the high initial fee curve = 99->10% compressed hundreds of ETH into the treasury within minutes). This was the breach.

**The WBTCSTR fix** - they raised `buyIncrement` to 0.1 ETH/block. On the market 0.0125 wBTC = 0.3 ETH => the ceiling catches up to the market in 3 blocks ≈ 36 seconds.

**LDAT approach:** `buyIncrement = 0.02 ETH/block` × Linea 3-sec blocks = **6.67 ETH/min of potential ceiling growth**. At a bagSize of 0.236 ETH the catch-up = **12 blocks ≈ 36 sec** (the same equivalent as WBTCSTR on mainnet).

### Lessons for LDAT

🔴 **A bot for buy-target is mandatory at launch.** 2 bots (active + standby), 3 ETH of capital in total (see [`50-lineadat-spec.md`](50-lineadat-spec.md)).

🔴 **We copy the buy fee curve from v3 exactly (99% -> 10% over 89 minutes).** You chose this option for the trust of the copy. We keep it under the protection of a high `buyIncrement` + the bot.

🔴 **A per-tx ceiling is already built into v3** via `getMaxPriceForBuy` (formula: `(blocks+1) × buyIncrement`).

## Incident 3 - SquiggleStrategy NFT-swap exploit ⚠️

| Field | Value |
|---|---|
| **Date** | September 28, 2025 |
| **Token** | SquiggleStrategy |
| **Bug class** | **Implementation bug** - incorrect validation of the incoming NFT |
| **Impact** | Leakage of valuable Chromie Squiggles from the treasury (tens of ETH eq); replaced with cheap "Day One AB: Genesis", "Construction Token" |

### Summary

The attacker found that the SquiggleStrategy contract allowed **swapping an NFT inside the strategy** - giving the strategy a low-value NFT and taking out a high-value Chromie Squiggle held by the strategy.

**Root of the bug:** Chromie Squiggles, Day One AB, and Construction Token share **the same ERC-721 contract** of Art Blocks Curated (`0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a`). With Art Blocks, all Curated projects are tokens of a single ERC-721, differing only by `tokenId` range (`projectId * 1_000_000 + mintNumber`).

The strategy validated the "accepted NFT" **by the contract address, not by the `(contract, projectId)` pair**. The attacker sent the strategy IDs from the "Day One AB" / "Construction Token" collections (a different projectId but the same contract), the strategy accepted them as a "valid Squiggle" and handed out a real Squiggle in exchange.

### Fix

- Via X: "We are actively investigating an exploit on the SquiggleStrategy contract. All other strategies remain unaffected"
- Pause of the remaining NFTStrategy tokens for an "audit"
- They did not go for a contract fix (SquiggleStrategy is renounced); the strategy was effectively written off as dead

### Lessons for LDAT

🟢 **For LDAT this bug is not directly applicable** - our underlying is an ERC-20 (`$LINEA`), where there is no projectId-within-contract problem.

🔴 **But the principle is broader:** underlying validation must be strict. We check `address(underlying) == LINEA_ADDRESS` with an immutable constant at initialize and on every fee processing.

🔴 **If the underlying is a fee-on-transfer token, a rebase token, or a blacklist token**, our code must detect this and refuse. $LINEA is a standard non-rebasing ERC-20 without fee-on-transfer (verified from the `L2LineaToken` source on Lineascan).

🔴 **Slither + Aderyn + manual review** - the critical final stage. This class of bug is caught by Slither in a minute.

## Incident 4 - High initial fee window (95-99%): a structural vulnerability

| Field | Value |
|---|---|
| **Date** | chronic (from 2025-09-20 onward at every launch) |
| **Tokens** | all strategies using the decay-fee schedule |
| **Bug class** | Design flaw |
| **Impact** | See Incident 2 |

### Summary

According to `docs.tokenstrategy.com`: "Buy tax starts at 99% and decreases 1% per minute to prevent sniping". Sources report different numbers - 95% (the first NFTStrategy batch), then 99% (TokenStrategy permissionless). Decay of -1%/min down to 10%.

This is **not the usual anti-snipe**: over 89 minutes the fee -> 10%, and throughout this entire period any purchase pays a huge fee that instantly goes into the treasury. This is what led to Incident 2.

### Lesson for LDAT

🟡 **You chose to copy 99% -> 10% over 89 minutes** for trust. This is acceptable under the conditions:
- `buyIncrement = 0.02 ETH/block` is high => the ceiling catches up quickly
- Our own bot is active from launch (2 bots, 3 ETH of capital)
- The frontend "Buy Target $LINEA" button is available from the moment of deploy

If these 3 conditions are met, a slow-rug is mathematically almost impossible. If even one falls away, we will repeat the incident of 2025-09-20.

## Incident 5 - PNKSTR without a hook: fees enforced ONLY off-contract

| Field | Value |
|---|---|
| **Class** | Pre-v2 architecture |
| **Impact** | A trade on any non-Uniswap DEX bypasses the fee entirely |

### Summary

PNKSTR was deployed before TokenWorks introduced the Uniswap v4 hook. Trade fee enforcement was entirely off-contract: docs.tokenstrategy.com openly states "Trades are NOT enforced through the hook". In practice, any DEX other than their Uniswap pool does not pay the fee - this means arbitrage routes bypass the treasury.

### Fix

Since v2 (REKTSTR) and v3 (WBTCSTR) - all trade fees are enforced through the Uniswap v4 hook. Any swap in their pool pays the fee (via `_afterSwap`).

### Lesson for LDAT

🟢 **Already built into v3 => we copy it as is.** Hook permissions = `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta`.

⚠️ **But this works only in our pool.** If someone creates a shadow-pool LDAT/USDC on some DEX - the fee does not work there. We cannot prevent this (open ERC-20), but we can refrain from providing liquidity to such shadow pools.

## Summary table

| Incident | Date | Token | Class | Impact | Real fix | What we do in LDAT |
|---|---|---|---|---|---|---|
| 1 | Sep 6-9, 2025 | PNKSTR | auth check / withdraw | $0 (whitehat) | Wrapper contract on top | Non-renounced owner + UUPS proxy -> we can patch |
| 2 | Sep 20, 2025 | 5 NFTStrategy | slow-rug design | **$813K** to a single actor | Frontend + private bot | 2 of our bots from launch + high `buyIncrement` 0.02 ETH/block |
| 3 | Sep 28, 2025 | SquiggleStrategy | NFT validation | tens of ETH | Strategy abandoned | N/A for ERC-20; valid `address(underlying)` immutable |
| 4 | chronic | all NFTStrategy | high initial fee | See incident 2 | Bot + frontend | A copy of 99->10% protected by the bot + `buyIncrement` |
| 5 | architecture | PNKSTR | fees off-contract | obfuscated | Introduction of the hook in v2/v3 | Hook with `afterSwap` (like v3) |
