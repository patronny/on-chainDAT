# on-chainDAT / LDAT

> **Brand reorg (2026-05-05).** Project umbrella renamed to **on-chainDAT** ([on-chaindat.com](https://on-chaindat.com)). The first mainnet launch will be **LDAT** (token `$LDAT`) - with the same architecture described below. The Phase 3 testnet continues to run under the name **LDAT** on Base Sepolia (we don't touch the deployed contracts - they live on until the Phase 4 cutover). Repo: `patronny/on-chainDAT`.

---

# LDAT - architecture (lives on Linea mainnet, Phase 4)

**LDAT** ($LDAT) - an ERC-20 strategy token on **Linea L2** with underlying **$LINEA**. An exact architectural copy of `wBTCStrategy` (ERC20Strategy v3 by TokenWorks, MIT) with minimal edits: the PNKSTR-burn is replaced with **LDAT-burn** (with the edge case "LDAT-burn = feeAddress while collection == LDAT_ADDRESS" - for launching the first token), parameters calibrated for Linea (block-time, $LINEA liquidity, bot economics).

## The key point in one line

10% trade-fee on each swap -> **80% treasury** (accumulating ETH for buying back $LINEA via a P2P offer) + **20% to the creator** (via redirecting the 10% LDAT-burn into feeAddress while collection == $LDAT itself) -> automatic yoyo cycle buy/relist 1.2x -> buy-and-burn LDAT via `processTokenTwap`.

## How it differs from the wBTCStrategy prototype

| Aspect | wBTCStrategy (prototype v3) | LDAT |
|---|---|---|
| Network | Ethereum mainnet (12s/block) | **Linea L2** (chainId 59144, ~2s/block) |
| Underlying | wBTC `0x2260fac5…c2c599` (8 decimals) | **$LINEA** `0x1789e004…bb04` (18 decimals) |
| Total supply | 1 000 000 000 × 10¹⁸ | **1 000 000 000 × 10¹⁸** (same) |
| Initial pool | single-sided 0 ETH + 1B WBTCSTR | **single-sided 0 ETH + 1B LDAT** |
| Initial FDV | ≈ $100 000 (sqrtPriceX96-derived) | **≈ $100 000** (same) |
| `bagSize` | 0.0125 wBTC ≈ $1 250 ≈ 0.54 ETH | **150 000 LINEA** ≈ $546 ≈ 0.236 ETH |
| `buyIncrement` | 0.1 ETH/block (mainnet 12s => 0.5 ETH/min) | **0.005 ETH/block** (immutable; slowed from 0.02, ~0.1-0.15 ETH/min) |
| `priceMultiplier` | 1200 (1.2x) | **1200 (1.2x)** |
| `twapIncrement` | 1.0 ETH | **0.05 ETH** (we'll ramp it up manually once the pool grows) |
| `twapDelayInBlocks` | 1 (12 seconds equivalent) | **4 (12 seconds equivalent)** |
| Buy-fee curve | 99% -> 10% over 89 minutes (-100bps/min) | **same** (copy) |
| Sell fee | 10% constant | **same** |
| Effective fee split | 90% treasury / 10% PNKSTR-burn / 0% feeAddress (since `feeAddressClaimedByOwner=0`) | **80% treasury / 10% LDAT-burn-redirected-to-creator / 10% creator** = **80/20 effective** |
| LDAT-burn block | PNKSTR-burn (hard-coded) | **LDAT-burn (if collection ≠ LDAT_ADDRESS), else into feeAddress** |
| Hook permissions | `beforeInitialize \| afterAddLiquidity \| afterSwap \| afterSwapReturnDelta` | **same (v3 pattern)** |
| Owner / renounce | TokenWorks owner not renounced (4+ months) | **owner = your Keycard EOA**, **renounce "never" with the option to do so at any moment** |
| Audit | None (Etherscan: "No Contract Security Audit Submitted") | None (slither + aderyn + manual review + 2-phase public testnet) |
| Attribution | - | **MIT header "based on TokenWorks ERC20Strategy v3"** |

## Status

🟢 **Phase 4 - LIVE on Linea mainnet (chainId 59144).** Contracts are deployed and verified on Lineascan; the site with the countdown - [www.on-chaindat.com](https://www.on-chaindat.com). Public trading opens via the on-chain gate (approximately 2026-06-09 18:00 UTC; exact time - per the countdown on the site, the date may shift).

Addresses (Linea mainnet 59144):
- **$LDAT token** (strategy proxy): [`0x02F289E429655d0C0D713A7dFD26850A81f7cFC5`](https://lineascan.build/address/0x02F289E429655d0C0D713A7dFD26850A81f7cFC5)
- Hook: [`0xA0FAD88E899D7a70179A473140111AB4016F6444`](https://lineascan.build/address/0xA0FAD88E899D7a70179A473140111AB4016F6444)
- Factory: [`0x127d80F16da8bF381Be26958721960BF76544E73`](https://lineascan.build/address/0x127d80F16da8bF381Be26958721960BF76544E73)
- Seeder (LP locked forever): [`0xB8b2EDeC4ea37FF2aeA534BfD0F6ce1B9C48484c`](https://lineascan.build/address/0xB8b2EDeC4ea37FF2aeA534BfD0F6ce1B9C48484c)

Parameters (locked, see [`docs/50-lineadat-spec.md`](docs/50-lineadat-spec.md)): bagSize 150 000 LINEA, buyIncrement 0.005 ETH (immutable), twapIncrement 0.05 ETH, supply 1B, fee split 80/20.

## Documents

- [`docs/00-overview.md`](docs/00-overview.md) - project pitch, key numbers, status
- [`docs/10-rektstr-v2-anatomy.md`](docs/10-rektstr-v2-anatomy.md) - deep dive into REKTSTR (ERC20Strategy v2, the first ERC-20 strategy)
- [`docs/20-wbtcstr-v3-anatomy.md`](docs/20-wbtcstr-v3-anatomy.md) - deep dive into WBTCSTR (ERC20Strategy v3, our main prototype)
- [`docs/30-tokenworks-incidents.md`](docs/30-tokenworks-incidents.md) - all publicly known TokenWorks incidents with the slow-rug math
- [`docs/40-linea-infrastructure.md`](docs/40-linea-infrastructure.md) - Uniswap v4 deployments on Linea, $LINEA token, liquidity by DEX
- [`docs/50-lineadat-spec.md`](docs/50-lineadat-spec.md) - **final LDAT spec** (contracts, parameters, fee, bot, UI)
- [`docs/60-deployment-runbook.md`](docs/60-deployment-runbook.md) - Anvil fork + Base Sepolia + Linea mainnet (step by step)
- [`docs/sources.md`](docs/sources.md) - all links

Additional data:
- [`research/tokenworks-sources/`](research/tokenworks-sources/) - verified WBTCSTR v3 sources (Etherscan)
- [`research/tokenworks-hook/`](research/tokenworks-hook/) - verified WBTCSTR v3 hook sources
- [`research/rektstr-v2/`](research/rektstr-v2/) - verified REKTSTR v2 sources (Sourcify)
- [`research/raw-rpc-data/`](research/raw-rpc-data/) - raw receipts and call-traces of the prototypes' launch tx

## Attribution

TokenStrategy / PunkStrategy / NFTStrategy / wBTCStrategy was built by **Adam Lizek (`@Rhynotic`)** as part of **TokenWorks** ([token.works](https://token.works/), GitHub `TOKEN-WORKS`). Legal entity: **Token Workshop, Inc.** All TokenWorks sources are under **MIT** - we fork with the MIT header "based on TokenWorks ERC20Strategy v3", exactly as the license requires.

**This is NOT Adam McBride** ([@adamamcbride](https://x.com/adamamcbride)) - he is an NFT archaeologist, in no way connected to TokenWorks. This confusion comes up often.
