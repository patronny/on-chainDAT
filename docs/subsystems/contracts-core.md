# Contracts core

Purpose: the on-chain machine behind $LDAT - the strategy token, the v4
hook that taxes every swap, the owner-only factory, and the burn pipeline.
Read `docs/ARCHITECTURE.md` first for how contracts, keeper, indexer, and
frontend fit together; this doc goes deeper into `contracts/src/` and why
it diverges from its TokenWorks ERC20Strategy v3 ancestor.
`docs/50-lineadat-spec.md` is the locked parameter spec it implements.

## How it works

1. **$LDAT is the strategy contract.** `contracts/src/LineaDATStrategy.sol`
   plus abstract `contracts/src/BaseStrategy.sol` (TokenWorks v3 fork, MIT)
   form a solady ERC20 behind an ERC1967 UUPS proxy - live at
   0x02F289E429655d0C0D713A7dFD26850A81f7cFC5 on Linea (59144), backed by
   canonical $LINEA; the 1B MAX_SUPPLY mints to the factory at initialize.
   factory/router/poolManager are immutable proxy args
   (LibClone.argsOnERC1967) that no upgrade can repoint. VERSION() returns
   4: the 2026-06-20 on-chain rename to LDAT went through
   upgradeToAndCall(implV4 0xC4B9...7aAd) calling updateNameAndSymbol, an
   owner-gated LineaDAT addition (updateName/updateSymbol are factory-gated
   with no passthrough). _authorizeUpgrade is onlyOwner (cold Keycard EOA).
2. **Transfers are whitelisted, not free.** _afterTokenTransfer in
   `contracts/src/BaseStrategy.sol` reverts InvalidTransfer unless from/to
   is in isDistributor, or the move touches the PoolManager under a
   transient allowance (tstore slot 0) only the hook grants during a swap
   or the liquidity seed [inv: transfers-distributor-gated]. Mints are
   exempt, and a v3 global-distributor path survives but is dormant:
   setGlobalDistributor is onlyFactory and LineaDATFactory never calls it,
   so the slot stays unset on Linea. The one user path is the whitelisted
   two-hop relay `contracts/src/LineaDATTransferRelay.sol` (1% fee burned
   to DEAD); a future DAT's custom swapper must be re-whitelisted after
   every redeploy [inv: distributor-whitelist-after-swapper-redeploy].
3. **The hook takes the swap fee and splits it 80/10/10.**
   `contracts/src/LineaDATHook.sol` lives at a CREATE2-mined address
   (address & 0x3FFF == 0x2444: beforeInitialize, afterAddLiquidity,
   afterSwap with return delta). Sells pay a flat 10%; buys start at 99%
   and decay 100 bps/min to the 10% floor over 89 minutes (snipe
   protection). _processFees splits every fee: 80% to the strategy treasury
   via addFees, 10% "LDAT-burn" share, 10% creator. On the LDAT self-launch
   the burn share is redirected to hook.feeAddress (the strategy cannot
   recursively buy-and-burn itself) and the creator share goes to
   feeAddressClaimedByOwner[proxy] - effective split 80/20. An unset claim
   mapping silently merges the creator share into treasury (90/10), so
   every proxy redeploy re-claims it, step 6b of
   `contracts/script/Deploy.s.sol` [inv: fee-address-claim-after-redeploy].
   Future DATs' burn share lands on the factory, whose permissionless
   buyAndBurnLineaDAT swaps it to 0xdead. The hook also reverts every
   exact-output swap (ExactOutputNotAllowed) - integrations are exact-in.
4. **The launch gate is the same timestamp as the fee-decay clock.**
   hook.setScheduledLaunchTime(ts) (factory-owner gated, future-only) feeds
   deploymentTime[LDAT]: pool init copies a still-future scheduledLaunchTime
   into it, and calls made after pool init re-stamp it directly. _afterSwap
   reverts NotYetLaunched before it, it is movable while still future, and
   AlreadyLaunched locks it once passed
   - this let mainnet deploy and seed ahead of the 2026-06-09 15:00 UTC
   public trading open.
5. **Fees drip into bag purchases on a per-block ramp.** addFees
   accumulates currentFees; availableFunds() is the smaller of currentFees
   and getMaxPriceForBuy() = (blocksSinceLastBuy + 1) * buyIncrement.
   buyIncrement is assigned once in initialize, no setter - live value
   0.005 ETH/block (~2.6-3.6 ETH/hr ceiling) [inv: buyincrement-immutable].
   WHY: slow-rug protection - a whale dump
   becomes many small buybacks over hours instead of one big buy at a bad
   price, at the conscious cost of hot volume backlogging ETH. addFees
   backsets lastBuyBlock on large deposits, so the ramp resumes from the
   previous currentFees instead of unlocking the whole deposit at once.
6. **Bag lifecycle.** buyTokens() (permissionless): the caller delivers one
   bagSize bag of $LINEA (live 150_000e18) and receives availableFunds()
   ETH; the bag is listed in onSale[bagId] at cost * priceMultiplier / 1000
   = 1.2x. sellTokens(bagId) (payable, exact list price) releases the bag
   and routes the ETH into ethToTwap. priceMultiplier (1200) is effectively
   frozen: setPriceMultiplier is onlyFactory and LineaDATFactory never
   calls it (shipped docs claimed otherwise; fixed in commit 7184fc1).
   updateBagSize is an owner-tunable
   LineaDAT divergence (v3 froze bagSize after the first buy; a volatile
   underlying makes a frozen bag too thick or thin). Treasury metrics value
   bags at these list prices [inv: valuations-use-list-price].
7. **TWAP burn.** processTokenTwap() (permissionless) spends
   min(twapIncrement, ethToTwap) per call - 0.5% to the caller as reward,
   the rest swapped and burned - at most once per
   twapDelayInBlocks (live 0.05 ETH / 4 blocks; both are owner-tunable
   LineaDAT additions). The strategy overrides the base path to swap
   through PoolManager.unlock + unlockCallback and take() the bought LDAT
   straight to DEAD_ADDRESS (origin: the testnet UniversalRouter reverted
   the v4-router selector). totalSupply never decreases - burned supply
   is balanceOf(DEAD) [inv: burn-reads-dead-balance]. The retained base
   _buyAndBurnTokens pins fee 0x800000: fee is hashed into the v4 poolId,
   and upstream v3's fee=0 targeted a nonexistent pool.
8. **Factory and the seed.** `contracts/src/LineaDATFactory.sol` is
   owner-only: deployStrategy clones an ERC1967 proxy with packed immutable
   args; the first deploy becomes lineaDATAddress (the hook's self-launch
   sentinel); loadingLiquidity is the only window the hook allows pool init
   and liquidity adds. Mainnet used factoryEscape to move the 1B mint into
   `contracts/src/LineaDATSeeder.sol`, which initialized the pool and holds
   the single-sided LP forever (no removeLiquidity). The startegyToToken
   typo is intentional - byte-identical with v3 hook code.
9. **Keeper surface and testnet legacy.** All protocol motion is
   permissionless: buyTokens, sellTokens, processTokenTwap,
   factory.buyAndBurnLineaDAT. The live keeper is an off-chain EOA (the
   external keeper repo on Fly) calling these directly; it buys $LINEA on
   the open market [inv: exact-input-on-etherex], runs as one machine
   [inv: single-keeper-instance], and never holds LDAT, so it needs no
   distributor whitelist. `contracts/src/LineaDATBot.sol` (Phase 3 on-chain
   keeper) is NOT deployed on mainnet; `contracts/src/LineaDATFaucet.sol`
   and `contracts/src/MockTLINEA.sol` are Base Sepolia only.
   `contracts/src/Interfaces.sol` is the shared interface set.

## Owns

Everything under `contracts/src/` and `contracts/script/`, the tests in
`contracts/test/`, `contracts/foundry.toml`, `contracts/remappings.txt`,
and the vendored lib checkouts in `contracts/lib/` (not submodules).

## Local invariants

[inv: buyincrement-immutable], [inv: transfers-distributor-gated], and
[inv: distributor-whitelist-after-swapper-redeploy] enforce in
`contracts/src/BaseStrategy.sol`; [inv: fee-address-claim-after-redeploy]
at step 6b of `contracts/script/Deploy.s.sol`. Register: `docs/INVARIANTS.md`.
Contract mechanics also feed the frontend-owned
[inv: burn-reads-dead-balance], [inv: valuations-use-list-price], and
[inv: pool-id-derived-at-runtime].

## Verify

- `cd contracts && forge test` runs the full suite; the Fork*.t.sol tests
  (e.g. `contracts/test/ForkTransferRelay.t.sol`) need a Linea RPC.
- cast call 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5 "VERSION()(uint256)"
  --rpc-url https://rpc.linea.build returns 4; "name()(string)" returns LDAT.
- grep -rn "buyIncrement =" over `contracts/src/` shows only the initialize
  assignment - no setter anywhere.
- balanceOf(0x...dEaD) grows after each TWAP burn; totalSupply stays 1e27.

## Gotchas

- ownerLaunchStrategy in `contracts/src/LineaDATFactory.sol` self-calls
  this.deployStrategy, making msg.sender the factory itself, so onlyOwner
  reverts - ABI-compat dead weight; use deployStrategy.
- priceMultiplier math divides by 1000, not 10000: 1200 means 1.2x
  (per-mille, despite the "basis points" natspec). Same stale-natspec trap
  on setDistributor: the comment says "factory" but it is onlyOwner.
- The seeder's "Phase 3.5 testnet helper" docstring is stale: the mainnet
  deploy uses it, the locked LP lives there permanently, and factoryEscape
  left it a permanent distributor (it whitelists, never unsets).
- Deployed testnet contracts keep the LINEASTR symbol; do not rename them.
