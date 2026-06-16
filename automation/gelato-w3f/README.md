# LDAT Gelato Web3 Function - Keeper

Replaces the unreliable GitHub Actions cron with Gelato's decentralized keeper
network. Gelato runs the function on schedule, off-chain checks state, and
submits `bot.executeRound(roundId)` only when conditions are met.

## Why Gelato vs GitHub Actions cron

| | GitHub Actions cron | Gelato W3F |
|---|---|---|
| Reliability | scheduled runs frequently skipped on free tier | SLA-backed decentralized executor pool |
| Cost | free | free (200K execs/month tier) |
| Trigger | time-based only | time-based **or** state-based via custom logic |
| Execution | runs in CI, signs with PK secret | Gelato submits tx; you fund a 1Balance account |
| Mainnet-ready | brittle | what real protocols use (TokenWorks, Karak, Gearbox, etc.) |

## Setup

### 1. Install Gelato Web3 Functions CLI

```bash
cd automation/gelato-w3f
npm install
```

### 2. Local test the function

```bash
npm test
```

You should see logs of the function reading on-chain state and either returning
`canExec: true` with calldata or `canExec: false` with a reason.

### 3. Deploy the function to IPFS

```bash
npm run deploy
```

The CLI prints an IPFS CID - copy it.

### 4. Create the task on app.gelato.network

1. Open https://app.gelato.network/functions
2. Click "Deploy New Task"
3. Network: **Base Sepolia** (chainId 84532)
4. Trigger: **Time-based**, every **30 minutes**
5. What to execute: **Web3 Function** → paste the IPFS CID from step 3
6. User args: leave the defaults from `userArgs.json` or override
7. Pay with: **1Balance** (deposit ~0.05 ETH worth of native gas - covers
   thousands of executions)
8. Confirm

### 5. Disable the GitHub Actions keeper

Once Gelato is running:

```bash
gh workflow disable "LDAT Keeper"
```

## How the function decides whether to fire

```
exec if:
  availableFunds >= buyThreshold       (= 0.001 ETH on testnet)
  OR  lastBagId > lastBagSeen          (new bag just listed)
  OR  ethToTwap > 0 AND changed        (TWAP burn pending)

else: canExec=false (Gelato does not submit a tx; no gas spent)
```

State-aware triggering means we **don't pay gas for no-op runs** - unlike GH
Actions which submitted a tx every cron tick. This is the main upgrade.

## Phase 4 mainnet checklist

When migrating to Linea:

1. Update `userArgs.json` with mainnet bot + strategy addresses
2. Re-deploy the function (`npm run deploy`)
3. Create new Gelato task on Linea (chainId 59144)
4. Top up 1Balance with mainnet ETH
5. Test once via "Manually trigger" button on app.gelato.network
6. Disable the testnet task

The function code itself is chain-agnostic - only `userArgs` and the Gelato
network selection change.
