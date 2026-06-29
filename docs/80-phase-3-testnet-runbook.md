# Phase 3 - Base Sepolia Testnet Deployment Runbook

**Date:** 2026-05-01
**Status:** Ready to deploy (deploy script successfully tested on Anvil fork of Base Sepolia)
**Network:** Base Sepolia (chainId 84532)
**Deploy script:** [`contracts/script/DeployBaseSepolia.s.sol`](../contracts/script/DeployBaseSepolia.s.sol)

---

## What Phase 3 does

Phase 3 is the live validation of LDAT + the bot on a public testnet (Base Sepolia, ~7 days). Goals:

1. Confirm that LineaDATStrategy works correctly in a real L2 environment (block timing, gas, sequencer ordering)
2. Confirm that LineaDATBot successfully runs buyTokens / sellTokens cycles under a live keeper trigger (cron-job.org / GitHub Actions)
3. Frontend (Next.js + RainbowKit + wagmi) works with a real RPC and smart contracts
4. Collect metrics from a 7-day continuous run: number of successful rounds, average `paid` per buy, gas cost, time-to-sale

---

## Scope decisions (locked for Phase 3)

**Deployed:**
- ✅ `MockTLINEA` - testnet stub for $LINEA (faucet-enabled ERC20)
- ✅ `LineaDATStrategy` impl + proxy via `LineaDATFactory`
- ✅ `LineaDATBot` (multicall keeper-bot)
- ✅ Owner/keeper/feeAddress configured via env vars

**NOT deployed in Phase 3 (deferred to Phase 4 mainnet):**
- ❌ CREATE2-mined hook (`LineaDATHook`) - the deployer EOA is used as hookAddress instead
- ❌ Uniswap v4 pool init (requires a hook with the correct permission flags)
- ❌ LP-NFT seed (requires a pool)
- ❌ `processTokenTwap` execution (requires a pool for swaps - the bot's `_tryTwap` will catch the revert via try/catch and continue)

**Why this scope?** Phase 3's main goal is bot validation under live network conditions. P2P `buyTokens` / `sellTokens` do not depend on the Uniswap pool - they work via `currentFees` and `onSale` state. It is enough for the deployer EOA to be able to seed fees via `strategy.addFees{value:X}()` (it is also the hookAddress). Phase 4 mainnet will add the full hook + pool init.

---

## Pre-flight checklist

- [ ] Deployer EOA created, has ≥0.5 ETH on Base Sepolia
  - Faucet: https://www.alchemy.com/faucets/base-sepolia (or Coinbase, or QuickNode)
- [ ] RPC endpoint chosen:
  - **Default:** `https://base-sepolia.drpc.org` (no API key, ~50 RPS)
  - **Alternative 1:** `https://base-sepolia-rpc.publicnode.com` (no key, ~30 RPS)
  - **Alternative 2:** `https://sepolia.base.org` (default, ~25 RPS, occasional rate-limits)
  - **Premium:** `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` (with Alchemy free tier, ~25 RPS, 30M CU/month)
- [ ] All env vars ready:
  ```bash
  export BASE_SEPOLIA_RPC=https://base-sepolia.drpc.org
  export PRIVATE_KEY=0x...                       # deployer (also acts as hook)
  export OWNER_EOA=0x1470c542...                 # owner of strategy + bot + tLINEA (Keycard)
  export KEEPER_EOA=0x...                        # keeper EOA (can be same as deployer)
  export FEE_ADDRESS=0x6e0d0108...               # protocol fee recipient
  ```

---

## Deploy sequence

### Step 1 - Run the deploy script

```bash
cd contracts/

forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --private-key $PRIVATE_KEY \
  -vvvv
```

**Expected output:** addresses of all 5 contracts (MockTLINEA, impl, factory, proxy, bot) + summary with next steps.

**Estimated gas:** ~8.4M total = ~0.0001 ETH at typical Base Sepolia gas prices (~0.011 gwei). The deploy costs pennies.

### Step 2 - Save the addresses

After a successful deploy, forge will save the broadcast to `contracts/broadcast/DeployBaseSepolia.s.sol/84532/run-latest.json`. Extract the 5 addresses:

```bash
jq -r '.transactions[] | select(.contractAddress != null) | "\(.contractName): \(.contractAddress)"' \
  contracts/broadcast/DeployBaseSepolia.s.sol/84532/run-latest.json
```

Also copy the addresses into `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://base-sepolia.drpc.org
NEXT_PUBLIC_TLINEA_ADDRESS=0x...
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_STRATEGY_ADDRESS=0x...
NEXT_PUBLIC_BOT_ADDRESS=0x...
```

### Step 3 - Send ETH to the bot for sellTokens

The bot spends ETH on `sellTokens` (pays listPrice to bags). The owner sends 5 ETH to the bot's address:

```bash
cast send $BOT --value 5ether --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

### Step 4 - Verify on Basescan (Base Sepolia explorer)

```bash
forge verify-contract \
  --rpc-url $BASE_SEPOLIA_RPC \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY \
  $STRATEGY_IMPL_ADDR \
  src/LineaDATStrategy.sol:LineaDATStrategy
```

(Optional, but desirable for frontend transparency.)

### Step 5 - Set up the keeper cron

Option A - **GitHub Actions** (recommended):

Create `.github/workflows/keeper.yml`:

```yaml
name: LDAT Keeper
on:
  schedule:
    - cron: '*/10 * * * *'  # every 10 minutes
  workflow_dispatch:
jobs:
  run-round:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: |
          cd contracts
          forge script script/RunBotRound.s.sol:RunBotRound \
            --rpc-url ${{ secrets.BASE_SEPOLIA_RPC }} \
            --broadcast \
            --private-key ${{ secrets.KEEPER_PK }}
        env:
          BOT: ${{ secrets.BOT_ADDRESS }}
          ROUND_ID: ${{ github.run_number }}
```

Secrets needed: `BASE_SEPOLIA_RPC`, `KEEPER_PK`, `BOT_ADDRESS`.

Option B - **cron-job.org**:

cron-job.org makes HTTP requests, not txs, so you need to stand up a simple relay server (for example, a Vercel serverless function) that calls `bot.executeRound()` on an HTTP request. This adds complexity - it is better to use option A.

### Step 6 - Seed fees periodically

For the bot to have work (`availableFunds > 0`), someone has to top up `currentFees`. On testnet this is done by the deployer EOA via a helper script:

```bash
STRATEGY=0x... SEED_AMOUNT=0.05ether \
  forge script script/SeedFees.s.sol:SeedFees \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast --private-key $PRIVATE_KEY
```

Run every 1-2 hours (this can also be done via a GitHub Actions cron).

---

## Acceptance criteria for Phase 3

- [ ] Deploy script successfully executed on Base Sepolia
- [ ] Bot makes ≥ 50 successful `buyTokens` over 7 days of continuous operation
- [ ] Frontend connects to Base Sepolia, shows strategy state, lets users swap (via faucet → buy bag → sell bag flow)
- [ ] Keeper cron runs without failures for 7 days (≤ 5 missed rounds out of ~1000)
- [ ] All 3 frontend design variants are fully responsive on iPhone SE / iPhone 14 Pro / iPad / desktop
- [ ] Lighthouse mobile score ≥ 85
- [ ] Phase 3 metrics documented in `docs/80-phase-3-results.md` after the observation period

---

## What's next: Phase 4

After a successful Phase 3 → Phase 4 (Linea mainnet production):
1. CREATE2 hook mining + full hook deploy via `Deploy.s.sol`
2. Uniswap v4 pool initialization with calibrated `sqrtPriceX96`
3. LP-NFT seed with single-sided liquidity (1B LDAT, [-887220, +175020])
4. Transfer LP-NFT → `0x000…dEaD`
5. Lineascan verification of all contracts
6. Purchase of the `on-chaindat.com` domain (already secured 2026-05-05), deploy frontend on Vercel
7. Production keeper migration (if the testnet keeper is stable - keep the same architecture)
