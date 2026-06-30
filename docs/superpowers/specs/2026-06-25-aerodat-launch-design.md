# AERODAT - launch design

- **Date:** 2026-06-25 (revision 2026-06-30: AERO/AERODAT pool selected + markup rule reworked; revision 2026-06-30b: recycle policy = variant B [principal recycles, margin burns] + all 6 borrow-improvements confirmed)
- **Status:** Approved 2026-06-30 - proceeding to implementation plan
- **Codename:** AERODAT ($AERODAT) - the first **main DAT of on-chainDAT on Base** (chain 8453)
- **Template:** the live LDAT launch on Linea ([project_mainnet_launch], 2026-06-09)

---

## 1. Goal and thesis

AERODAT is the second on-chainDAT launch and the **MAIN DAT for the Base ecosystem**. The token side copies LDAT, but the **treasury engine is replaced** with an active veAERO desk, and the **pool is chosen to be AERO-native**.

- **`AERO/AERODAT` pool** (Uniswap v4 with a custom hook). The token trades and is backed **in AERO** -> the purest "amplified AERO exposure" thesis: **a person who held AERO buys AERODAT and never exits their asset**, gaining a deflationary engine on top.
- The creator earns **2% of trades** (in AERO).
- Treasury engine: the treasury **buys undervalued veAERO veNFTs on Vexy, relists them below intrinsic value (but above its own cost), and votes them for max bribe-ROI. On sale the principal (its own cost) recycles into the next veAERO, while the margin plus all voting rewards are swapped into AERO -> buy back and burn AERODAT.**

---

## 2. Scope

**In scope:** the AERODAT token + the AERO/AERODAT pool + launch, the new veAERO treasury engine, reworking the hook/fee path for AERO, Base deploy/keeper/indexer/monitor/frontend, multi-chain refactor of `DAT*`.

**Deferred:** the side->main tribute (we fix it before the first real Base side-DAT); whitelisting treasury veNFTs for a last-hour vote (governance-gated, impractical).

---

## 3. What is copied from LDAT vs what is new

**Copied unchanged (token side):**
| Component | Behavior |
|---|---|
| Token | Non-transferable Solady ERC20, UUPS proxy, `MAX_SUPPLY = 1e9` to the factory, distributor-gated `_afterTokenTransfer` |
| Launch gate | `scheduledLaunchTime` (decaying buy-fee + trading-open gate) |
| Fee split | 80% treasury / 10% burn share / 10% creator; on the main DAT both shares go to the creator = **2% of trades** |
| Owner | The same cold Keycard `0x1470c542D60e83EcCFE005332f5789Bd669D027C` |
| Deployer/keeper | The same hot EOA `0xc31E...e87b` (needs Base ETH for gas + AERO for seed/operations) |
| Frontend | on-chaindat.com, AERODAT at `/dats/[address]` |

**NEW (departure from the LDAT copy - more work and more audit):**
- **Pool and fees in AERO, not in ETH.** The hook `_beforeInitialize` currently requires `currency0 == ETH` -> rewritten for **AERO as the quote asset**; the entire fee path (`_processFees`, `addFees`, the 2% payout, `_buyAndBurnTokens`) is migrated from native ETH to **ERC20 AERO**. Burn = AERO -> AERODAT.
- **The entire treasury engine** (see section 5).

**LDAT footgun checklist carried over:** claim the fee-address after deploy; check `NEXT_PUBLIC_*` env after a Vercel redeploy.

---

## 4. Codebase refactor (`DAT*`, multi-chain)

```
contracts/src/
  AbstractDATStrategy.sol   // shared: non-transferable ERC20 + gate + addFees + buy&burn + UUPS
  BagDATStrategy.sol        // existing fungible-bag engine (LDAT) - rename only
  VeAeroDATStrategy.sol     // NEW: veAERO veNFT desk (AERODAT)
  DATFactory.sol / DATHook.sol (AERO variant) / DATSeeder.sol / DATBot.sol / DATTransferRelay.sol
contracts/script/  DeployBase.s.sol  MineHookBase.s.sol
```
**Constraint:** the `AbstractDATStrategy` storage layout must remain compatible with the live LDAT proxy (compatibility test).

---

## 5. Treasury engine - veAERO desk (core)

### 5.1 State ("the book")
- An enumerable set of owned veAERO `tokenId`s, each with a **recorded purchase price in AERO** (for the markup guard and P&L).
- AERO balance (from pool fees).

### 5.2 Weekly keeper cycle (keeper triggers, contract executes + guards)
1. **Purchase** - the keeper searches off-chain for the most undervalued listing on Vexy; the contract calls `Vexy.buyListing(listingId)`, paying in **AERO**. Records `tokenId -> cost`.
2. **Relist** - `Vexy.createListing(...)` in **AERO** per the rule in 5.3.
3. **Vote** - `Voter.vote(tokenId, pools, weights)` for the pools chosen by the keeper, **right before the last hour** (the last hour reverts `NotWhitelistedNFT`; window `[+1h, week-1h]`, weekly epochs, Thu 00:00 UTC).
4. **Claim + burn** - claims bribes+fees of the **previous** epoch (they arrive as an assortment of tokens), swaps each one -> **AERO** (`minOut`), then buy&burn AERODAT to `DEAD`. *(Rebase auto-compounds into the lock, it does not go into the burn.)*
5. **Recycle principal + burn margin (variant B, owner-chosen 2026-06-30)** - on a sale, split the net AERO proceeds: the **principal** (the recorded `cost`) returns to the treasury AERO balance to fund the next purchase (the book self-sustains); the **margin** (`netProceeds - cost`) is buy&burned into AERODAT. So principal recycles, while margin + step-4 yield are the burn fuel. Constraint: `min_margin` must exceed the 1% Vexy fee so the net margin stays positive after Vexy takes its cut.

### 5.3 MARKUP RULE (corrected 2026-06-30 - replaces the former "exactly 1.2x of the purchase price")

Intrinsic value `I = locked.amount` (the AERO inside the veNFT, read on-chain from VotingEscrow). We compute **from I, not from the purchase price** - otherwise, with a small discount, the markup ends up above I and the position does not sell ("dead weight").

- **Purchase guard (discount floor `d_min`, default 25%):** we buy only if `cost <= I * (1 - d_min)`. We skip small discounts.
- **Relist rule (target discount `s_target`, default 10%):** we set `price = I * (1 - s_target)` - always **below I -> always sells**. On-chain corridor: `cost * (1 + min_margin) <= price <= I * (1 - s_floor)`; the keeper sets the real price inside it. If the corridor is empty (the purchase discount is small) -> we do not sell at a loss, we hold and vote.
- **Margin = `I * (d_min - s_target)`** at minimum - it comes out of the discount spread (~+20% over cost when buying at the floor; the deeper the discount, the more).
- **No dead weight:** an unsold veNFT keeps voting/farming; we sell when the market allows.

`d_min` and `s_target` are owner settings, we will tune them to the live Vexy market (discount telemetry - section 8).

### 5.4 Reward classes (what becomes burn fuel vs what stays in the book)
- **Bribes + fees:** claimed an epoch later; an assortment of tokens -> swap into AERO with `minOut` -> burn fuel.
- **Sale margin:** on selling a veNFT, `margin = netProceeds - cost` -> burn fuel; the `cost` (principal) recycles into the treasury AERO balance (variant B, section 5.2 step 5).
- **Rebase:** auto-`depositFor` into the lock -> enriches the position being sold, does not exit into AERO.

---

## 6. Trust and security model

**Roles**
- **Keeper (hot `0xc31E`)** = liveness/optimization: buy (within the guard corridor), relist (within the corridor), vote (any pools), claim+swap+burn (the exit is forced into DEAD), wrap/swap. **Cannot** transfer a veNFT to an arbitrary address, withdraw funds, change the owner, or upgrade.
- **Owner (cold Keycard)** = custody/governance: upgrade, keeper appointment, currency whitelist, budget/`d_min`/`s_target`/`maxPrice`, emergency rescue, pause.

**THE MAIN THREAT - keeper self-dealing on purchases.** `buyListing` pays the seller; a malicious keeper could list their own junk veNFT high and force the treasury to buy it. Mitigation (in the AERO design - **without an oracle**):
- **On-chain bond:** `cost <= I * (1 - d_min)` (section 5.3) - we pay strictly less than the intrinsic value in AERO. No oracle is needed since both the price and I are in AERO.
- **Owner budget for purchases per epoch + `maxPrice`** - bound the radius.
- Bottom line: the keeper can waste money within the limit, but cannot steal.

**Anti-rug limits (borrowed from iAERO - CONFIRMED 2026-06-30):**
- minting AERODAT - only at init to the factory, there is no other path;
- buy&burn and core flows cannot be frozen in a way that locks up value;
- `rescue`/emergency - under owner+timelock;
- **on-chain vote transparency:** emit the full vote breakdown as an event (borrowed - so we are not accused of voting for pools we are reselling ourselves).

**Audit + timelock (CONFIRMED 2026-06-30):** a named third-party audit before launch + a timelock on sensitive owner actions (changing `d_min`/`s_target`/keeper/swapper whitelist) - this gets us ahead of both competitors (AeroStrategy and iAERO are unaudited / without a timelock).

**Empirical test before capital:** on live Base, vote with a veNFT and in the same epoch `transferFrom` it - confirm that the transfer lock was not reinstated by an Aerodrome upgrade.

---

## 7. Verified integration facts (Base 8453)

| Contract | Address | Note |
|---|---|---|
| veAERO / VotingEscrow | `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4` | a vote only blocks `withdraw`/`merge`, NOT transfer; `locked.amount` = intrinsic value I |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | `vote/reset/claimBribes/claimFees`; window `[+1h, week-1h]` |
| RewardsDistributor | `0x227f65131A261548b057215bB1D5Ab2997964C7d` | rebase `claim`, compounds into the lock |
| **AERO** | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | pool quote asset + desk working currency + burn currency |
| Vexy Marketplace | `0x6b478209974BD27e6cf661FEf86C68072b0d6738` | `createListing`/`buyListing`, approval-based, 1% fee, settlement in USDC/WETH/**AERO**, listing <=60d, no EOA guard |

**Still to verify:** Uniswap v4 PoolManager / Universal Router / Permit2 on Base; swap routes for bribe-tokens -> AERO.

---

## 8. Off-chain stack (for Base)

- **Keeper:** weekly bot - pick the most discounted listing (>= `d_min`), pick the pools with max bribe-ROI, the reward->AERO routes, run the 5-step cycle in the voting window.
- **Indexer (Ponder):** `fly.base.toml`, chainId 8453, AERO/AERODAT pool, `aerodat-indexer.fly.dev` instance, `/api/indexer` proxy.
- **Monitor:** AERODAT in `monitor.py` (keeper/vote/claim/burn/book value/RPC) -> Telegram.
- **Frontend:** Base (8453) in wagmi; AERODAT at `/dats/[address]`.
- **CONFIRMED 2026-06-30 (borrowed from AeroStrategy):** live discount telemetry (the current best discount on Vexy, `d_min`), **MNAV-KPI + auto-burn-report by the bot on X** (burned X for $Y, total burned Z%, treasury, MNAV). Off-chain only - does not touch the contracts, so it can ship after launch if time-boxed.

---

## 9. Launch parameters

| Parameter | Value |
|---|---|
| Supply | 1e9 (constant) |
| `buyIncrement` | veAERO purchase drip, **in AERO**, recompute for the Base block time ~2s |
| Decay buy-fee | 99% -> 10%, 100 bps/min |
| Seed liquidity | **in AERO** (ETH + % supply -> now AERO + % supply) - confirm the size |
| `d_min` (purchase discount floor) | 25% (setting) |
| `s_target` (target sell discount) | 10% (setting) |
| `scheduledLaunchTime` | set closer to launch |

---

## 10. Risks and open items

1. **Keeper self-dealing on purchases** - mitigated by the bond `cost <= I*(1-d_min)` + budget; a security pass is mandatory.
2. **AERO pair = price in a floating asset** - the AERODAT chart is noisy from AERO volatility; "number go up" is harder to market.
3. **Accessibility/volume** - a purchase goes through the hop ETH->AERO->AERODAT (the router itself, +slippage); volume is existential for the model (the AeroStrategy lesson).
4. **Reworking the hook/fee path for AERO** - more code and audit surface than a clean LDAT copy.
5. **Discount depth on Vexy** - the margin depends on the availability of listings >= `d_min`; no deep ones -> we simply do not buy (the book votes).
6. **Bribe-token liquidity** - swap into AERO with slippage; routes + minOut, skip dust.
7. **Aerodrome upgrade risk** (reinstating the transfer lock) - empirical test + monitoring.
8. **Storage layout** of LDAT after the refactor.
9. **MNAV<1** (the token below treasury value) - a structural risk of all treasury tokens without a buyback; levers: aggressive visible buy&burn + relist profit + volume.

---

## 11. Phases

1. Refactor `DAT*` + `AbstractDATStrategy` + layout compatibility test + green suite.
2. `VeAeroDATStrategy` + **reworking the hook/fee path for AERO** + Vexy/Voter/VotingEscrow integration + tests (markup guard 5.3, self-dealing guard, fork tests against live Aerodrome+Vexy).
3. Base deploy config (mining the v4 hook for AERO/AERODAT, addresses) + scripts.
4. Deploy to Base (hot key) + verification.
5. **Security pass** (self-dealing + anti-rug limits) + **named audit**.
6. Keycard ceremony: seed (AERO), `adminUpdateFeeAddress`, keeper, limits/`d_min`/`s_target`, launch gate.
7. Fork e2e: purchase -> relist -> vote -> claim -> sale -> burn.
8. Keeper + indexer + monitor on Base.
9. Frontend: Base in wagmi + AERODAT + discount/MNAV telemetry + responsive pass.
10. Launch gate -> trading. Work-log entry.

---

## Verification (summary)
- forge build + suite green; the tests prove: the keeper does not withdraw veNFTs / does not redirect proceeds; `cost <= I*(1-d_min)` is enforced; a relist is never above I; the margin corridor is respected.
- Fork e2e of the full cycle against live Aerodrome+Vexy.
- Empirical vote-then-transfer on the live VotingEscrow before capital.
- Prod: AERODAT trades in the AERO pair; 2% to the creator in AERO; burns in the counters.
