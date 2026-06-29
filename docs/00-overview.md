# 00. Overview LDAT

## Pitch

**$LDAT** - an ERC-20 strategy token on **Linea L2** that automatically converts **10% of trade-fees** on its Uniswap v4 pool into **$LINEA**, accumulates them in the treasury via P2P buybacks, and burns its own supply through **buy-and-burn** funded by the accumulated sales. It is a "MicroStrategy for $LINEA", except the treasury is replenished not through a capital-raise but through DEX-trading of the token itself.

Architecturally - an **exact copy of TokenWorks' `wBTCStrategy` v3** (Adam Lizek / Rhynotic), recalibrated for Linea L2 and with the PNKSTR-burn replaced by an LDAT-burn (with an edge-case for self-launch). MIT-fork with attribution.

## What it delivers

- **To $LDAT holders** - a token with a deflationary supply (continuous buy-and-burn) and backing in the form of $LINEA in the treasury. The price of WBTCSTR relative to wBTC grows faster than wBTC - we reproduce this mechanism for the LDAT/LINEA pair.
- **To $LINEA holders** - a permanent buyer of $LINEA with growing volume (`bagSize = 150 000 LINEA` per cycle). The contract **never sells** $LINEA back the other way.
- **To the Linea ecosystem** - a flywheel that brings new ETH-trading volume onto L2 (volume → fees → underlying-buy → ETH lock in pool).
- **To the creator** - 20% of trade-fees via `feeAddress` (encoded by redirecting the 10% LDAT-burn into feeAddress while `collection == LDAT_ADDRESS`).

## Locked parameters (final)

| Parameter | Value | Comment |
|---|---|---|
| **Network** | Linea L2 (chainId 59144) | block-time ≈3 sec |
| **Underlying** | $LINEA `0x1789e004…bb04` | canonical L2 token |
| **Token name / symbol** | `LDAT` / **`LDAT`** | |
| **Total supply** | 1 000 000 000 × 10¹⁸ | one-time mint in `initialize`, burn only thereafter |
| **Decimals** | 18 | ERC-20 standard |
| **Initial pool** | single-sided: 0 ETH + 1B LDAT | LP-NFT to `0xdead` immediately |
| **Initial FDV** | ≈ $100 000 | sqrtPriceX96 calibrated for `1 ETH ≈ 40M LDAT` (like WBTCSTR) |
| **`bagSize`** | **150 000 LINEA** ≈ $546 ≈ 0.236 ETH | see rationale in `50-lineadat-spec.md` |
| **`buyIncrement`** | **0.02 ETH/block** | catch-up time ≈ 12 blocks ≈ 36 seconds at bagSize 0.236 ETH |
| **`priceMultiplier`** | **1200** (1.2× markup) | as in both prototypes |
| **`twapIncrement`** | **0.05 ETH** | we will ramp it up by hand via `setTwapIncrement` once the pool grows |
| **`twapDelayInBlocks`** | **4** | 12 seconds = mainnet equivalent (protection against same-block sandwich MEV) |
| **Buy-fee curve** | 99% → 10% over 89 minutes (−100 bps/min) | as in WBTCSTR (copied unchanged for trust) |
| **Sell-fee** | 10% constant | as in WBTCSTR |
| **Fee split** | 80% treasury / 10% LDAT-burn / 10% creator | technically: 80/10/10 as in v3, but the 10% LDAT-burn is redirected into feeAddress while `collection == LDAT_ADDRESS` ⇒ effectively **80% treasury / 20% creator** on $LDAT itself; for future strategies on Linea - 80/10/10 normal split |
| **`feeAddress`** | `0x6e0d01089976093680c881CcDcB79e0D046e2433` | your address for receiving the creator share |
| **Owner** | **`0x1470c542D60e83EcCFE005332f5789Bd669D027C`** (Keycard EOA, EIP-55 verified, fresh nonce=0 on both networks) | renounce "never" with the option to do so at any moment |
| **Pool currency0 / currency1** | `0x0` (native ETH) / LDAT | as in WBTCSTR; pool key checks `currency0.isAddressZero()` |
| **Pool fee flag** | `0x800000` (DYNAMIC_FEE_FLAG) | hook calculates fee dynamically |
| **Tick spacing** | 60 | standard for dynamic fee |
| **Hook permissions** | `beforeInitialize \| afterAddLiquidity \| afterSwap \| afterSwapReturnDelta` | as in v3 |
| **Bot working capital** | **3 ETH total** (2 on A + 1 on B) | conservative mode: `availableFunds() ≥ marketPrice × 1.10` |
| **Bot hosting** | fly.io (multi-region: A in EU, B in US) | ~$10/month |
| **Frontend stack** | Next.js 15 + wagmi v2 + RainbowKit + viem + Tailwind | hosted on Vercel |
| **Domain** | `on-chaindat.com` (already secured 2026-05-05) (you will buy it before launch) | |
| **Design** | 3 options to choose from → choice before merge | copy of tokenstrategy.com's structure, different palette |
| **Testnet** | Phase 1: Anvil fork of Linea mainnet, Phase 2: Base Sepolia public | final deploy on Linea mainnet |
| **MIT attribution** | header "based on TokenWorks ERC20Strategy v3 (MIT)" in every .sol file | |

## What is not locked right now

- ~~**Owner address**~~ ✅ locked: `0x1470c542D60e83EcCFE005332f5789Bd669D027C`
- **Bot-EOA #1, #2** - we generate fresh private keys when setting up fly.io
- **When we buy `on-chaindat.com` (already secured 2026-05-05)** - one week before launch
- **Design (3 options)** - will come after the contracts are written, before the public testnet

## Roadmap (after parameter lock)

1. **Stage 2 - contracts:** fork ERC20Strategy v3, patch `_processFees` (PNKSTR → LDAT-burn + edge-case redirect), parameters for Linea, MIT-header
2. **Stage 3 - Anvil fork:** run 100+ cycles locally, Foundry tests, slither + aderyn
3. **Stage 4 - Base Sepolia:** public testnet, you test the UI with Keycard, I catch bot bugs
4. **Stage 5 - Frontend:** copy of tokenstrategy.com structure, 3 design options to choose from
5. **Stage 6 - Mainnet deploy:** deploy contracts on Linea, seed 1B LDAT into pool, LP-NFT to dead, bot turns on at `deploymentTime` ts
6. **Stage 7 - Live monitoring:** dashboard in a Discord webhook (cycles, bot P&L, treasury growth)

## Side-by-side prototype comparison

| | REKTSTR (v2) | WBTCSTR (v3) | LDAT (forked v3) |
|---|---|---|---|
| Version | 2 | 3 | 3 (fork) |
| Network | Ethereum mainnet | Ethereum mainnet | **Linea L2** |
| Underlying | REKT (meme-token) | wBTC (BitGo) | **$LINEA (Consensys)** |
| Launch | 2025-12-13 00:06 UTC | 2026-01-13 22:00 UTC | TBD (Stage 6) |
| bagSize $-eq | $6 232 | $1 250 | **$546** |
| Owner status now | NOT renounced | NOT renounced | non-renounced from launch |
| Audit | no | no | no (slither + aderyn + manual) |

## Attribution

LDAT - MIT-fork of TokenWorks' ERC20Strategy v3 (`@token_works` / [token.works](https://token.works)). Lead: **Adam Lizek** (`@Rhynotic`). Legal entity: **Token Workshop, Inc.** All TokenWorks sources verified on Etherscan / Sourcify under MIT.
