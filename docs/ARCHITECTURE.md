# Architecture - system map

LDAT is an on-chain Digital Asset Treasury (DAT) live on Linea (chainId
59144) since 2026-06-09. The $LDAT token trades against ETH on a Uniswap v4
pool whose hook charges a swap fee (buys decay 99% -> 10% over ~89 min from
launch, sells a flat 10%) and splits it 80/10/10. The treasury's 80% share
accumulates as ETH in the strategy proxy; an off-chain keeper converts it
into 150,000 $LINEA bags that are relisted at 1.2x cost, and bag-sale
proceeds are TWAP-burned into $LDAT sent to the dead address. Wallet-to-
wallet transfers are gated [inv: transfers-distributor-gated]; the only
user transfer path is the whitelisted 1%-burn TransferRelay. This doc is
the Tier 1 map: the four planes, the capital loop, repo and deployment
boundaries, addresses, the data model, entry points, and generated vs
tracked files. Rules that must never regress live in `docs/INVARIANTS.md`
and are referenced here as `[inv: <name>]`, not restated.

## Four planes

1. ON-CHAIN (Linea 59144, `contracts/`, Foundry). `contracts/src/LineaDATHook.sol`
   (CREATE2-mined address, v4 permission flags 0x2444) sits on the ETH/LDAT
   pool inside the singleton PoolManager: it enforces the scheduled-launch
   gate, computes the decaying dynamic fee, and splits every fee in ETH
   80/10/10 (see the capital loop). `contracts/src/LineaDATStrategy.sol`
   (UUPS proxy over `contracts/src/BaseStrategy.sol`, a TokenWorks v3 fork)
   is the $LDAT ERC20 + treasury + bag machine; renamed on-chain from
   LineaDAT/LINEADAT to LDAT on 2026-06-20 (VERSION 4). `contracts/src/LineaDATFactory.sol`
   (owner-only) deploys and registers strategy proxies; the LDAT self-launch
   is registration #1. `contracts/src/LineaDATSeeder.sol` holds the full 1B
   single-sided LP, permanently locked (no removeLiquidity).
   `contracts/src/LineaDATTransferRelay.sol` is the stateless ownerless
   two-hop relay (1% fee burned to DEAD) that lets users transfer around
   the gate [inv: transfers-distributor-gated]. Owner of strategy + factory
   (and thus hook admin) = the cold Keycard EOA. Trades route through the
   standard Uniswap UniversalRouter + Permit2 with a v4 Quoter slippage
   floor (option C, 2026-06-04) - no custom swapper on mainnet
   [inv: distributor-whitelist-after-swapper-redeploy].
   `contracts/src/LineaDATBot.sol` is testnet-lineage only; mainnet has no
   on-chain bot.
2. KEEPER LOOP (external, private repo patronny/lineadat-keeper, Fly app
   lineadat-keeper, exactly one machine [inv: single-keeper-instance]).
   The strategy entry points buyTokens / sellTokens / processTokenTwap are
   permissionless - the keeper is just the fastest arbitrageur, operated
   from the hot EOA 0xc31EC88cFF212292Ca706399f00F7b829fD4e87b. It watches
   availableFunds, sources a bag of $LINEA on the Etherex CL pool
   (quotes exact-out, executes exact-in [inv: exact-input-on-etherex]),
   calls buyTokens for an instantly net-positive round, and fires the TWAP
   burn. It exposes /status, consumed by the ops plane and the frontend
   proxy. Community bots can do everything the keeper does.
3. DATA PLANE. The Ponder indexer (`automation/indexer/`, Fly app
   lineadat-indexer, pglite on a Fly volume) ingests strategy + hook events
   into bag/swap tables (`automation/indexer/src/index.ts`) and serves
   GraphQL via Hono (`automation/indexer/src/api/index.ts`). The frontend
   (`frontend/`, Next.js 15 App Router, Vercel project lineadat with root
   directory frontend/) reads all shared on-chain state through the
   CDN-cached `frontend/src/app/api/snapshot/route.ts` multicall - one
   origin read per ~15s globally, regardless of visitors
   [inv: rpc-cost-not-per-visitor]. The browser reaches the indexer and
   keeper status only via the same-origin proxies
   `frontend/src/app/api/indexer/route.ts` and
   `frontend/src/app/api/keeper-status/route.ts` (nodejs runtime; fly.dev
   is unreachable from sanctioned regions) [inv: same-origin-proxies].
   Every RPC client is the shared Infura-first fallback transport in
   `frontend/src/lib/rpc.ts` [inv: rpc-failover-infura-first]. Pool id and
   slot0 key are derived at runtime in `frontend/src/lib/abis/poolmanager.ts`
   [inv: pool-id-derived-at-runtime]. Post-launch the chart is a
   GeckoTerminal embed (`frontend/src/components/chart-or-countdown.tsx`);
   the native chart keeps its corrupt-tick defenses
   [inv: chart-corrupt-tick-defense]. UI is theme-locked and verified at
   five widths [inv: theme-lock-responsive-matrix]; tx buttons stay
   disabled through mining [inv: tx-busy-guard]; docs.on-chaindat.com
   308-redirects to www /docs/* [inv: docs-subdomain-308-not-rewrite].
4. OPS PLANE. The always-on Fly worker lineadat-monitor
   (`automation/monitor/fly.toml`) runs `.github/scripts/monitor.py` in
   MONITOR_LOOP mode every 60s against free endpoints only (CDN snapshot,
   keeper /status, indexer healthz + GraphQL, RPC failover state, bag /
   burn / trade deltas) and pushes Telegram alerts; probes assert live
   values, not envelope shape [inv: snapshot-live-data-validation]. The GH
   Actions cron `.github/workflows/monitor.yml` is a manual one-shot backup
   (workflow_dispatch only). `.github/workflows/indexnow.yml` pings
   Bing/Yandex on content pushes [inv: indexnow-key-immutable];
   `.github/workflows/docs-lint.yml` runs the canon-docs lint on every push.

## The capital loop

```
   swap on the ETH/LDAT v4 pool
   (fee: buys decay 99% -> 10% over ~89 min, sells flat 10%)
                |
                v
   LineaDATHook fee split (ETH)
     |- 80% -> strategy proxy currentFees (treasury)
     |- 10% -> creator (LDAT-burn share, redirected on the self-launch)
     '- 10% -> creator (feeAddressClaimedByOwner)
        (creator total = 2% of volume at the settled 10% fee)
                |
                v
   drip: currentFees unlocks at buyIncrement = 0.005 ETH/block;
   availableFunds = min(currentFees, getMaxPriceForBuy())
                |
                v
   keeper: buys 150k $LINEA on Etherex (exact-in), then buyTokens()
   pulls the bag in, pays out availableFunds, lists the bag at
   onSale[bagId] = paid x 1.2 (priceMultiplier = 1200)
                |
                v
   anyone: sellTokens(bagId) pays the exact list price in ETH,
   takes the 150k $LINEA
                |
                v
   ethToTwap += salePrice
                |
                v
   processTokenTwap(): every >= twapDelayInBlocks (4), one tranche of
   twapIncrement (0.05 ETH) minus a 0.5% caller reward is swapped
   ETH -> LDAT on the same hooked pool; output goes to 0x...dEaD
```

The drip rate is locked forever [inv: buyincrement-immutable]; the 10%
creator claim must be re-made after any proxy redeploy
[inv: fee-address-claim-after-redeploy]; treasury USD metrics sum list
prices, not spot [inv: valuations-use-list-price]; burned supply is
balanceOf(DEAD), never a totalSupply delta [inv: burn-reads-dead-balance].

## Repo and deployment boundaries

- THIS repo (patronny/LineaDAT, public): `contracts/` (sources, deploy
  scripts, ~15 Foundry test suites, vendored libs in `contracts/lib/` -
  committed checkouts, not submodules), `frontend/`, `automation/indexer/`,
  `automation/monitor/` (Dockerfile + fly.toml wrapping the shared monitor
  script; build context is repo root), `automation/gelato-w3f/` (keeper
  experiment, not in prod), `.github/` (workflows + shared scripts),
  `docs/` (this canon plus numbered research/spec/runbook docs 00-90),
  `tools/` (single-file HTML pages for cold-wallet owner signing),
  `research/` (raw TokenWorks/REKTSTR analysis artifacts).
- External keeper repo: patronny/lineadat-keeper (private). Holds the
  buy/sell/twap loop, Etherex integration, and the /status server; kept
  out of the public repo deliberately. Its local mount point
  automation/keeper/ is gitignored and absent on a fresh clone.
- Fly.io apps: lineadat-indexer (one machine + 3GB volume), lineadat-keeper
  (one machine, ever [inv: single-keeper-instance]), lineadat-monitor
  (worker, no inbound service). Secrets live in Fly secrets, never in git.
- Vercel: project lineadat, root directory frontend/, git-connected to
  main (push = production deploy). There is NO vercel.json - all settings
  and the load-bearing NEXT_PUBLIC_*_ADDRESS envs live in the dashboard
  [inv: vercel-env-overrides]. The local link (.vercel/) is gitignored.
- DNS: on-chaindat.com (GoDaddy) -> Vercel; docs.on-chaindat.com is a
  308 alias [inv: docs-subdomain-308-not-rewrite].
- Gitignored but operationally critical: obsidian/ (work log, incident
  log, audits - the project's episodic memory), .env at repo root (keys,
  tokens, and the canonical LINEADAT_* live address book), brand/ (logo
  and Hub assets).

## Addresses and environments

Linea mainnet 59144 (live; deploy block 30878663). Production addresses
reach the frontend via Vercel envs, not the checked-in fallbacks
[inv: vercel-env-overrides]; the canonical list is mirrored in the
gitignored root .env as LINEADAT_*.

| Contract | Address |
|----------|---------|
| $LDAT strategy proxy | 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5 |
| Strategy impl (initial; UUPS-upgraded for the LDAT rename) | 0x6472ECBfDbbd0AAdd23E75fa8304112609E543c1 |
| LineaDATFactory | 0x127d80F16da8bF381Be26958721960BF76544E73 |
| LineaDATHook | 0xA0FAD88E899D7a70179A473140111AB4016F6444 |
| LineaDATSeeder (locked LP) | 0xB8b2EDeC4ea37FF2aeA534BfD0F6ce1B9C48484c |
| LineaDATTransferRelay | 0xe6e4bAff1E8b186420733833A043Ae28132195dB |
| Swapper (deployed, unused - option C) | 0xe784C85c308caFcA7A869d8938fe5DdfD027f696 |
| Uniswap v4 PoolManager | 0x248083Fb965359d82b06C1F5322480Dcfc1AD857 |
| UniversalRouter (V2_1_1) | 0x8B844f885672f333Bc0042cB669255f93a4C1E6b |
| Permit2 | 0x000000000022D473030F116dDEE9F6B43aC78BA3 |
| v4 Quoter (slippage floor) | 0x2c125569c0bee20a66e33e5491c552b37ebd9934 |
| Canonical $LINEA (underlying) | 0x1789e0043623282D5DCc7F213d703C6D8BAfBB04 |
| Etherex CL QuoterV2 (bag pricing) | 0xE660C95E17884b6C81B01445EFC24556f8ABa037 |

Base Sepolia 84532 (frozen Phase 3/3.5 testnet lineage, symbol LINEASTR
then LDAT; contracts still deployed but unmaintained). These are the
checked-in fallbacks in `frontend/src/lib/wagmi.ts`,
`automation/indexer/ponder.config.ts` (deploy block 41112701), and
`frontend/src/lib/abis/poolmanager.ts` (the PoolManager one): strategy
0x615937AE1eB71248DA407F39AcFea9288CF1784F, hook
0x512dd6871eb3a28aD07885A9B75a2e26eDa2a444, factory
0x8498c8542ea2d9BC0CeD3d21EF22d43Dea750A1B, bot
0x8FC3c32fd69D714413C1ecD66FA4067b08eE3532, faucet
0x50910c9cA9262051f3697Ab09450773287516c6E, tLINEA
0x88a8D5ED5D1be44098F226EDf11C3160Fd76421F, PoolManager
0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408.

## Data model

- Snapshot payload (the body object in `frontend/src/app/api/snapshot/route.ts`,
  all bigints as decimal strings, CDN-cached s-maxage=15 + SWR 30): name,
  symbol, totalSupply, bagSize, buyIncrement, priceMultiplier, currentFees,
  ethToTwap, twapIncrement, twapDelayInBlocks, lastBuyBlock, lastTwapBlock,
  lastBagId, availableFunds, maxPriceForBuy, treasuryUnderlying ($LINEA
  held), burned (balanceOf DEAD [inv: burn-reads-dead-balance]), slot0 +
  sqrtPriceX96, deploymentTime (launch ts), feeBuy / feeSell (live hook
  fee), poolLineadat (LDAT held by PoolManager), blockNumber,
  bagMarketPriceWei (Etherex quote for one bag). Consumed via
  `frontend/src/hooks/useSnapshot.ts`.
- Indexer entities (`automation/indexer/ponder.schema.ts`): bag - one row
  per ERC20BoughtByProtocol (paid, listPrice; soldFor / soldAt / buyer
  filled by ERC20SoldByProtocol); swap - one row per hook Trade event
  (trader, side, ethAmount, tokenAmount, sqrtPriceX96), deliberately
  including the keeper's TWAP-burn buys as real volume.
- Key on-chain views (`contracts/src/BaseStrategy.sol` /
  `contracts/src/LineaDATStrategy.sol`): currentFees (accrued treasury
  ETH), getMaxPriceForBuy() (drip ceiling), availableFunds() (spendable
  now), bagSize, onSale(bagId) + list() / list(startId, endId) (live list prices
  [inv: valuations-use-list-price]), ethToTwap (burn backlog),
  priceMultiplier, isDistributor [inv: transfers-distributor-gated].

## Entry points and commands

- Contracts: `forge build` / `forge test` in `contracts/` (unit + fuzz +
  fork suites in `contracts/test/`). Mainnet deploy =
  `contracts/script/Deploy.s.sol` (atomic hook-mine + deploy + seed +
  handover; step 6b is load-bearing [inv: fee-address-claim-after-redeploy]);
  relay deploy = `contracts/script/DeployTransferRelay.s.sol`; testnet
  lineage under the other `contracts/script/` files. Runbook:
  `docs/60-deployment-runbook.md`, spec: `docs/50-lineadat-spec.md`.
- Frontend: `npm run dev` / `build` / `lint` / `typecheck` in `frontend/`.
  Production deploys on push to main; manual deploys run npx vercel --prod
  from REPO ROOT (root directory is frontend/, running inside frontend/
  double-resolves the path). Verify envs after every deploy
  [inv: vercel-env-overrides].
- Indexer: `npm run dev` (ponder dev) in `automation/indexer/`; prod
  deploy = fly deploy -c `automation/indexer/fly.linea.toml` after bumping
  PONDER_DATABASE_DIRECTORY [inv: indexer-fresh-pglite-dir].
- Monitor: fly deploy . --config `automation/monitor/fly.toml` from repo
  root; loop settings in that fly.toml, checks in `.github/scripts/monitor.py`.
- Docs lint: node `scripts/docs-lint.mjs` - backtick paths exist, INV
  markers match `docs/INVARIANTS.md`, xrefs resolve, no long dashes, no
  Cyrillic [inv: no-em-dash] [inv: repo-english-only].
- Owner (Keycard) operations: `tools/relay-whitelist-signer.html` and
  tools/transfer-ownership-to-safe.html (local, untracked), opened locally, no build.
- Break-glass: `frontend/scripts/break-glass-swap.mjs` trades against the
  v4 pool via UniversalRouter directly if the site is down.

## Generated vs tracked

- Generated + gitignored, rebuilt locally: contracts cache/ out/
  broadcast/, frontend/.next/, node_modules/, UI-test screenshot dirs and
  root-level scratch *.png.
- Generated + tracked: `automation/indexer/generated/` (Ponder codegen
  GraphQL schema; regenerate via npm run codegen, never hand-edit).
- Tracked + frozen: `frontend/public/8152797bdb756f9c95f5ad2505b1a19b.txt`
  (IndexNow key file [inv: indexnow-key-immutable]).
- Gitignored but critical (see boundaries above): obsidian/, .env,
  brand/, automation/keeper/, .vercel/.
- Deliberately local, never committed: tools/transfer-ownership-to-safe.html
  (owner ops page tied to a pending governance step).
