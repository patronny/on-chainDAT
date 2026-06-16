# LDAT indexer

Ponder indexer for the LDAT strategy + hook contracts. Indexes
`ERC20BoughtByProtocol`, `ERC20SoldByProtocol`, and hook `Trade` events
into a local pglite database and exposes them through an auto-generated
GraphQL API at `/graphql`.

## Local dev

```bash
cd automation/indexer
npm install

# Set real production addresses (or use defaults from .env.example).
export STRATEGY_ADDRESS=0x...
export HOOK_ADDRESS=0x...
export START_BLOCK=...
export PONDER_RPC_URL_84532=https://sepolia.base.org

# Recent block start to skip a 40M-block backfill on the public RPC.
START_BLOCK=41000000 DATABASE_SCHEMA=public npx ponder start
# → http://localhost:42069/graphql
```

Ponder dev mode (`ponder dev`) requires a TTY for its dashboard; on CI / inside
shell sessions, `ponder start` (production mode, plain logs) is more reliable.

## Deploy to Fly.io

One-time setup:

```bash
fly apps create lineastr-indexer --org personal
fly volumes create lineastr_indexer_data --region fra --size 1 --app lineastr-indexer

fly secrets set --app lineastr-indexer \
  PONDER_RPC_URL_84532=https://sepolia.base.org \
  STRATEGY_ADDRESS=0x... \
  HOOK_ADDRESS=0x... \
  START_BLOCK=...
```

Deploy:

```bash
fly deploy --app lineastr-indexer
```

The GraphQL endpoint is then available at
`https://lineastr-indexer.fly.dev/graphql`.

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `STRATEGY_ADDRESS` | yes | LDAT strategy proxy on Base Sepolia (deployed contract still has the legacy LINEASTR symbol on testnet - see Step 7) |
| `HOOK_ADDRESS` | yes | Uniswap v4 hook contract |
| `START_BLOCK` | yes | Block at or before strategy proxy deploy |
| `PONDER_RPC_URL_84532` | yes (in prod) | Base Sepolia RPC; default `https://sepolia.base.org` (low rate limits) |
| `DATABASE_SCHEMA` | yes | Postgres schema name; defaults to `public` |
| `PONDER_DATABASE_DIRECTORY` | no | pglite dir; default `./.ponder/pglite`, on Fly: `/data/pglite` |
