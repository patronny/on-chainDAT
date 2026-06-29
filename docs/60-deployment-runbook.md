# 60. Deployment Runbook - step-by-step LDAT launch plan

Full plan: writing contracts → Anvil fork → Base Sepolia → Linea mainnet.

## Phase 0 - preparation (current stage, before writing code)

- [x] Agreed on [`50-lineadat-spec.md`](50-lineadat-spec.md) (May 1, 2026)
- [x] Downloaded verified prototype sources: WBTCSTR v3, REKTSTR v2
- [ ] **You:** generate the Owner EOA on Keycard, send the public address
- [ ] **You:** buy `on-chaindat.com` (already secured 2026-05-05) (one week before launch)
- [ ] **Me:** generate Bot A and Bot B EOA private keys, hand them to you over a secure channel; you keep the private keys yourself, I use them only to sign in fly.io secrets

## Phase 1 - contracts (Stage 2)

### 1.1 Setup repo

```bash
mkdir -p contracts/{src,test,script,lib}
cd contracts
forge init --no-commit
```

### 1.2 Dependencies (Foundry)

```bash
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
forge install Uniswap/v4-router
forge install Uniswap/permit2
forge install Vectorized/solady
```

### 1.3 Files

Copy from `research/tokenworks-sources/` and `research/tokenworks-hook/` into `contracts/src/`, applying the patch list from [`50-lineadat-spec.md`§8](50-lineadat-spec.md):

```
contracts/src/
  LineaDATStrategy.sol      ← from ERC20Strategy.sol v3 + MIT-header
  BaseStrategy.sol          ← from BaseStrategy.sol v3 + MIT-header + setTwapIncrement
  LineaDATHook.sol          ← from ERC20StrategyHook.sol v3 + MIT-header + LDAT-burn rename + edge-case
  LineaDATFactory.sol       ← new (minimal, we do not clone the TokenWorks factory)
  Interfaces.sol            ← from src_Interfaces.sol with renames
```

### 1.4 Static analysis

```bash
forge build
slither contracts/src/ --filter-paths "lib/" --exclude-informational --exclude-low
aderyn contracts/
```

Goal: 0 high/medium findings.

### 1.5 Foundry tests

```
contracts/test/
  Strategy.t.sol            ← buy/sell/list cycle
  Hook.t.sol                ← swap fee logic, _processFees variants
  SlowRug.t.sol             ← slow-rug attempt, proving that availableFunds is bound
  Sandwich.t.sol            ← sandwich on processTokenTwap, proving that twapDelayInBlocks works
  Initialize.t.sol          ← full launch flow with initial pool seed
  Edge.t.sol                ← empty pool, zero fees, retry on reverted txs
```

Goal: ≥ 100 test cases, all green.

## Phase 2 - Anvil fork (local test)

### 2.1 Fork Linea mainnet

```bash
anvil --fork-url https://rpc.linea.build --port 8545
# in another terminal:
export RPC=http://localhost:8545
```

### 2.2 Deploy LDAT

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d  # anvil[0]
```

### 2.3 Simulate 1000 cycles

```bash
forge script contracts/script/SimulateCycles.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --sig "run(uint256)" 1000
```

Script:
1. Performs random swaps (50/50 buy/sell in our pool) with various sizes
2. After each swap - `vm.roll(block.number + 5)` (jump 5 blocks)
3. Periodically calls `buyTokens()` (from bot-EOA) when `availableFunds() ≥ marketPrice`
4. Periodically calls `sellTokens(bagId)` from a random buyer
5. When `ethToTwap > 0.05 ETH` - calls `processTokenTwap()`
6. Checks invariants: `currentFees ≥ 0`, `ethToTwap ≥ 0`, `totalSupply` decreases, `treasury LINEA` grows

### 2.4 Logging

All cycles in `out/anvil-simulation.json`. Analysis:
- Avg bot profit per cycle: must be **> 0.03 ETH**
- Slow-rug attempts (bot waits > 50 blocks and tries to take everything): must fail / yield a limited premium
- LDAT burn rate: 0.5-2% supply per week at $10k/day volume

## Phase 3 - Base Sepolia (public testnet, 7 days)

### 3.1 Deploy (DONE - 2026-05-03)

Live testnet addresses (Base Sepolia, chainId 84532):

| Contract | Address |
|---|---|
| MockTLINEA | `0x88a8D5ED5D1be44098F226EDf11C3160Fd76421F` |
| LineaDATStrategy impl | `0x739f49b48DA56D5C164722ad49A81B527c7b5542` |
| LineaDATFactory | `0xeDCA75CdAbcca93399c22fc1815035C71F5f77A6` |
| LDAT proxy | `0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2` |
| LineaDATBot | `0x5CAbfF553d8D7B9564CceE758A22b58c850d23Fc` |
| Deployer / Owner / Keeper EOA | `0xbc6af64859dF1008c8187F94dF89323000dEE668` |
| Deploy block | 41022811 |

⚠️ The underlying on Base Sepolia - there is no `$LINEA`. **MockTLINEA** ERC-20 is used (faucet 100k/hour, cap 100M).

### 3.2 Keeper deployment (GitHub Actions, NOT Fly)

Phase 3 uses a GitHub Actions cron, not Fly bots - `automation/keeper/`,
workflow `.github/workflows/keeper.yml`, schedule `*/120 * * * *` (every 2h,
12 runs/24h). Fallback mode: if the cron fails, the owner can manually trigger
`executeRound()` via the Basescan write-contract UI. Bot A/B redundancy + Discord
alerts - a SEPARATE Phase 4 task (see §4.3).

### 3.3 Frontend (DONE)

Production: <https://lineadat.vercel.app> (renamed 2026-05-05; old `lineastr.vercel.app` redirects). Custom domain `on-chaindat.com` - see §3.5. Vercel env tabs:
- `NEXT_PUBLIC_INDEXER_URL` - optional, default hardcoded to the Fly URL below
- `NEXT_PUBLIC_RPC_URL` - **do NOT set** drpc.org / blastapi.io, `wagmi-client.ts`
  auto-skips them anyway, but it is better to keep the slot for a CORS-friendly endpoint
- `NEXT_PUBLIC_*_ADDRESS` - addresses from the §3.1 table

### 3.4 Acceptance criteria for Phase 3

- [x] Frontend live, dashboard renders data from indexer / on-chain
- [x] Indexer GraphQL backfilled to tip (bags=7, swaps=27 as of 2026-05-04)
- [x] Owner successfully signed buy/sell tx via Keycard
- [ ] 7 days without keeper crashes
- [ ] ≥ 50 successful buyTokens / sellTokens cycles
- [ ] ≥ 5 processTokenTwap cycles
- [ ] Discord webhook alerts (Phase 3.6 - deferred)
- [ ] Bot B redundancy on Fly (Phase 3.6 - deferred)

## Phase 3.5 - Ponder indexer (production component)

Self-hosted GraphQL indexer on Fly, serving the Holdings / Sales / Swaps tables
in the frontend. We managed to drop the brute-force `eth_getLogs × 4500-chunk`
per visitor - now the indexer reads events once and serves the
ready merged history.

- App: `lineastr-indexer`, region `fra`, persistent volume `lineastr_indexer_data` (1 GB)
- Endpoint: `https://lineastr-indexer.fly.dev/graphql`
- Cost: ~$2/month
- Schema: `bag` (bagId pk, paid, listPrice, soldFor?, soldAt?, soldTxHash?, buyer?) + `swap` (id pk = `${blockNumber}-${logIndex}`)
- Backfill from deploy block: ~2 seconds

When changing the strategy/hook addresses (Phase 4 mainnet or any redeploy):

```bash
fly secrets set --app lineastr-indexer \
  STRATEGY_ADDRESS=0x... HOOK_ADDRESS=0x... START_BLOCK=...
fly deploy --app lineastr-indexer
```

The persistent volume (`lineastr_indexer_data`) stores the pglite db. If you change
the schema / event structure / need a full reindex - destroy + recreate the volume,
the backfill still takes seconds.

⚠️ **The Ponder RPC must be rate-stable.** Public endpoints (`publicnode`)
silently truncate `eth_getLogs` on multi-thousand-block ranges - the indexer
gets partial data without an error. The Tenderly gateway is used,
`https://base-sepolia.gateway.tenderly.co`. For mainnet - an Alchemy / Infura key.

### 3.5.1 RPC strategy (important for all of Phase 3+)

Browser-side `fallback()` chain in `frontend/src/lib/wagmi-client.ts`:
1. `NEXT_PUBLIC_RPC_URL` (if set AND not in the `KNOWN_NO_CORS` blacklist)
2. `https://sepolia.base.org`
3. `https://base-sepolia-rpc.publicnode.com`
4. `https://base-sepolia.gateway.tenderly.co`

`KNOWN_NO_CORS = /(?:drpc\.org|blastapi\.io)/i` - these endpoints do not return
`Access-Control-Allow-Origin` and block preflights. If they end up in the env -
they are automatically dropped, but it is still better to keep only
CORS-friendly RPC in the env.

## Phase 4 - Linea mainnet deploy (production)

⚠️ **This phase is irreversible. All pre-flight checks are MANDATORY.**

### 4.0 Known drift points (Codex audit 2026-05-04)

Before starting Phase 4, the following items must be closed in the code:

- [ ] Production deploy script rewritten: `Deploy.s.sol` currently reverts on HOOK_SALT,
  and the references in §4.3 to `DeployImplementations.s.sol` / `DeployFactory.s.sol` /
  `DeployLDAT.s.sol` do not yet exist
- [ ] Hook deploy with a correct immutable `lineaDATAddress` (predicting the proxy
  address via CREATE2 + mineHook salt in a single script)
- [ ] `LineaDATStrategy.factoryEscape` and `LineaDATFactory.updateHookAddressUnchecked` -
  testnet escape hatches, remove or fence off with a chain-id guard before mainnet
- [ ] `LineaDATBot.sellEnabled = false` by default for mainnet (testnet left as `true`)
- [ ] `LineaDATFactory.buyAndBurnLDAT` currently calls `swapExactTokensForTokens`,
  but the deployed UniversalRouter exposes `execute(...)` - rewrite for the v4 command flow
  (or unify through PoolManager unlock)
- [ ] Integration tests for real v4 hook fee processing + processTokenTwap +
  factory buy-and-burn (the current `Stress.t.sol` makes TWAP a no-op, `Sandwich.t.sol`
  is tolerant of swap-failure)
- [ ] Stage-aware chain/address config in the frontend (currently Base Sepolia hardcoded
  for hook, swapper, PoolManager slot0, Dexscreener slug)
- [ ] Keeper `package-lock.json` committed, deploy via `npm ci`

### 4.1 Pre-flight checks

- [ ] §4.0 drift points closed
- [ ] Phase 3 acceptance criteria 100%
- [ ] [`50-lineadat-spec.md`](50-lineadat-spec.md) reviewed by you again
- [ ] Slither + Aderyn 0 findings
- [ ] Bot capital 3 ETH collected on your wallet, ready to distribute to Bot A/B
- [ ] `on-chaindat.com` (already secured 2026-05-05) purchased and DNS points to Vercel

### 4.2 Hook mining

```bash
cd contracts/
forge script script/MineHook.s.sol --rpc-url https://rpc.linea.build
# outputs salt + predicted hookAddress
# remember it for the deploy
```

### 4.3 Deploy sequence

```bash
# 1. Deploy implementation contracts (BaseStrategy logic + Hook + Factory)
forge script script/DeployImplementations.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify \
  --etherscan-api-key $LINEASCAN_API_KEY \
  --private-key $DEPLOYER_PK

# 2. Deploy Factory + Hook (CREATE2 with salt from 4.2)
forge script script/DeployFactory.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify

# 3. Deploy LDAT proxy via Factory
forge script script/DeployLDAT.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify
# this script:
#   - calls factory.deployStrategy(LINEA, 150_000e18, hookAddress, "LDAT", "LDAT", 0.02e18, ownerKeycard)
#   - sets feeAddressClaimedByOwner[LDAT_PROXY] = 0x6e0d01089976093680c881CcDcB79e0D046e2433
#   - sets twapIncrement = 0.05e18
#   - sets twapDelayInBlocks = 4
#   - initializes Uniswap v4 pool with calibrated sqrtPriceX96
#   - seeds liquidity (1B LDAT single-sided)
#   - sends LP-NFT to 0xdead

# 4. Bot up
cd ../bot
fly deploy --app lineastr-bot-a
fly deploy --app lineastr-bot-b

# 5. Frontend up
cd ../frontend
vercel --prod
```

### 4.4 Post-launch monitoring (first 24 hours)

- [ ] Discord webhook live, on every cycle / processTokenTwap / alert
- [ ] Etherscan/Lineascan watcher on `LDAT_PROXY` events
- [ ] Every hour check `currentFees`, `ethToTwap`, `lastBuyBlock` via RPC
- [ ] Bot A/B health via the fly.io dashboard
- [ ] If something is wrong in the first 24 hours - you have owner privileges, fixes are possible via `updateHookAddress` or a UUPS upgrade

### 4.5 Post-launch growth (week 1-4)

- Day 1-7: collect baseline metrics (volume, cycles, burn-rate, treasury growth)
- Day 7: first retrospective - should `twapIncrement` be raised (if the ETH side of the pool > 5 ETH)?
- Day 14: check bot capital - is it growing? If not - analyze why
- Day 30: if everything is stable - public report on X/Discord, pursue an audit (if the ROI is justified)

## Phase 5 - Expansion (optional, after Phase 4 success)

After $LDAT has been working stably for ≥ 30 days:
- Launch a second token `$XYZSTR` where the underlying = $XYZ (another token on Linea), using the same factory
- On the second token fee split = 80% / 10% LDAT-burn / 10% creator (normal mode)
- Each new token → new $LDAT purchases via the `buy-and-burn` block → more LDAT deflation
- This is the "base for the next tokens on Linea" from your original request

## Rollback / emergency procedures

### If a critical bug is found in the first 24 hours

1. Owner calls `transferOwnership` to a multisig (if one already exists) or a paused-pattern (if we managed to add it)
2. UUPS upgrade implementation: `proxy.upgradeToAndCall(NEW_IMPL, "")` - replace with the patched implementation
3. Public statement on Discord/X - what was found, what we are fixing, no silent fixes

### If bots A and B go down at the same time

1. Discord alert after 10 minutes of downtime
2. You manually call `buyTokens()` via any wallet (Keycard through the MetaMask UI on Lineascan) - this is the equivalent of the frontend "Buy Target $LINEA" button
3. I bring the bots back up within an hour

### If the frontend goes down

The Vercel free tier usually has 99.9%+ uptime. If it is down - you have:
- A direct call via the Lineascan UI (verified contracts → Write Contract → buyTokens / sellTokens / processTokenTwap)
- A backup static Cloudflare Pages mirror on an old commit
