# Upgrade and launch runbook

Purpose: how contract bytecode reaches Linea and how it is allowed to
change afterward - the atomic launch script, the testnet-to-mainnet
lineage, the owner/upgrade ceremony, the off-chain re-wiring every
redeploy drags behind it, and the Phase G immutability endgame. Read
`docs/ARCHITECTURE.md` first for the four planes and the live address
table; `docs/subsystems/contracts-core.md` owns what the deployed code
does, this doc owns how it changes.

## How it works

1. **One atomic broadcast, deterministic addresses.** `contracts/script/Deploy.s.sol`
   (chainId-59144 guarded) does the whole launch in one forge run:
   pre-compute futureImpl / futureFactory from the deployer nonce and
   futureProxy as the factory's first CREATE, mine
   the hook's CREATE2 salt inline against that predicted proxy (flags
   0x2444), then broadcast everything - hook, impl, factory, config, the
   optional launch gate, proxy, TWAP params, the step-6b creator-fee
   claim [inv: fee-address-claim-after-redeploy], seeder, factoryEscape,
   seedAndLock in the loadingLiquidity window, ownership handover. Each
   step requires the predicted address - the hook constructor bakes in
   the proxy address, so a drifted address is a bricked launch. And
   buyIncrement must be right in env BEFORE broadcast [inv: buyincrement-immutable].
2. **The CREATE2+CREATE nonce offset trap.** futureImpl sits at deployer
   nonce+1, not nonce: the CREATE2-deployer call creating the hook
   consumes one EOA nonce as an ordinary tx - true only under real
   per-tx --broadcast, so a no-broadcast simulation reverts "Impl address
   mismatch" (a dry-run artifact, not a bug). The only honest rehearsal
   is anvil --fork-url plus a real --broadcast into the fork; the live
   run matched the fork prediction because the deployer nonce had not
   moved. Corollary: the deployer EOA is also the keeper EOA, so pause
   the keeper with fly scale count 0 before broadcasting (machine stop
   does NOT hold it down - auto_start wakes it; restore with count 1
   [inv: single-keeper-instance]) - one keeper tx mid-broadcast shifts
   every address.
3. **Lineage: Base Sepolia frozen, TestDAT proved the path.** Phase 3
   (`docs/80-phase-3-testnet-runbook.md`,
   `contracts/script/DeployBaseSepolia.s.sol` plus helpers) validated
   strategy and bot without a hook; Phase 3.5 added the mined hook, the
   pool seed, and the UUPS precedent
   (`contracts/script/UpgradeStrategyTwap.s.sol`). Those contracts keep
   the LINEASTR symbol, never renamed or redeployed. The mainnet dress
   rehearsal (`REHEARSAL-RUNBOOK.md`) ran the SAME Deploy.s.sol
   env-scaled to /100 as TestDAT ($TDAT) on real Linea, proving the full
   loop (fee -> bag -> sell -> TWAP burn to DEAD); the real launch was
   the same script minus the scaling env. TDAT is an abandoned zombie.
4. **The launch gate is a hook timestamp, not a frontend flag.**
   hook.setScheduledLaunchTime(ts) in `contracts/src/LineaDATHook.sol`
   (gated on lineaDATFactory.owner(), future-only) pre-sets
   deploymentTime at pool init; _afterSwap reverts NotYetLaunched until
   then, the same timestamp starts the 99%->10% buy-fee decay, and
   AlreadyLaunched locks it once passed. Moved twice in prod, fixed at
   1781017200 (2026-06-09 15:00 UTC) where it fired; rendered as the
   /dats/[address] countdown. Unset (0) opens trading at pool init.
5. **Owner model - three eras, all public on-chain.** The hot
   deployer/keeper EOA 0xc31EC88cFF212292Ca706399f00F7b829fD4e87b held
   temporary ownership through the pre-open tuning window; strategy AND
   factory then went to the cold Keycard EOA 0x1470c5...D027C before the
   public open, and since 2026-07-12 to the 2-of-3 Safe 0xd2bb...2945 (a
   Linea Hub listing requirement). The hook has NO owner - admin fns
   check lineaDATFactory.owner(), so two transferOwnership txs move all
   admin. Solady transferOwnership is 1-step and irreversible, so
   tools/transfer-ownership-to-safe.html (deliberately local, never committed) hard-gates signing on live
   getThreshold/getOwners/isOwner reads of the target. The hot EOA
   deploys bytecode and pays gas; no owner power since the handover.
6. **Impl upgrades are a ceremony; the rename is the precedent.**
   _authorizeUpgrade is onlyOwner, so an upgrade is: hot EOA deploys and
   verifies the new impl (gas only, no privileges), the owner signs
   upgradeToAndCall(newImpl, initCalldata), VERSION() bumps as receipt.
   The 2026-06-20 rename ($LINEADAT -> $LDAT) ran it: implV4
   0xC4B9...7aAd deployed hot, the Keycard signed upgradeToAndCall +
   updateNameAndSymbol("LDAT","LDAT") (VERSION 3 -> 4, the first real
   Keycard action; tests `contracts/test/Rename.t.sol`,
   `contracts/test/ForkRenameUpgrade.t.sol`). Since the Safe migration
   every owner action is a Safe transaction; the EOA-owner forge scripts
   and local signer pages are dead for owner ops, kept as templates.
7. **Every redeploy drags an off-chain checklist.** A new proxy re-claims
   the creator fee [inv: fee-address-claim-after-redeploy]; a future
   DAT's swapper is re-whitelisted
   [inv: distributor-whitelist-after-swapper-redeploy]. New addresses:
   Vercel NEXT_PUBLIC_*_ADDRESS envs override the `frontend/src/lib/wagmi.ts`
   fallbacks [inv: vercel-env-overrides]; the pool id stays derived
   [inv: pool-id-derived-at-runtime]; the indexer gets new
   STRATEGY_ADDRESS / HOOK_ADDRESS / START_BLOCK secrets plus a fresh
   pglite dir [inv: indexer-fresh-pglite-dir]; the keeper's STRATEGY_ADDR
   Fly secret repoints (`docs/subsystems/keeper.md`); Infura origin
   allowlists must include every serving domain or they 403 silently
   (`docs/subsystems/deploy-and-infra.md`).
8. **Phase G: the immutability endgame.** The Safe is the transitional
   owner for a 1-3 month post-launch window; when it closes, the plan is
   renounce/freeze FROM the Safe - renouncing strategy + factory
   ownership ends UUPS upgrades, tuning, and all hook admin at once.

## Owns

The process docs `REHEARSAL-RUNBOOK.md`, `docs/60-deployment-runbook.md`,
`docs/80-phase-3-testnet-runbook.md`, and the ceremony page
tools/transfer-ownership-to-safe.html (deliberately local, never committed). The
deploy scripts and contracts belong to `docs/subsystems/contracts-core.md`,
the Vercel/Fly/Infura surfaces to `docs/subsystems/deploy-and-infra.md`.

## Local invariants

None owned outright. Executes [inv: fee-address-claim-after-redeploy]
(marker at step 6b of `contracts/script/Deploy.s.sol`),
[inv: distributor-whitelist-after-swapper-redeploy], [inv: buyincrement-immutable],
[inv: vercel-env-overrides], [inv: pool-id-derived-at-runtime],
[inv: indexer-fresh-pglite-dir], and [inv: single-keeper-instance].

## Verify

- cd contracts && forge build && forge test (Fork*.t.sol need a Linea
  RPC). Before any real broadcast: anvil --fork-url <Linea RPC>, then the
  real Deploy.s.sol --broadcast into the fork - every require must pass.
- Live state via cast call: proxy 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5
  "VERSION()(uint256)" = 4, "name()(string)" = LDAT; "owner()(address)"
  on proxy and factory 0x127d80F16da8bF381Be26958721960BF76544E73 both =
  Safe 0xd2bb57d3862C20f14c30860381C7116F73762945; on the hook (address
  table in `docs/ARCHITECTURE.md`) scheduledLaunchTime() = 1781017200 and
  setScheduledLaunchTime reverts AlreadyLaunched.

## Gotchas

- `docs/60-deployment-runbook.md` Phase 4 describes a three-script deploy
  that never existed; `contracts/script/Deploy.s.sol` is reality.
- `contracts/script/MineHook.s.sol` and its BaseSepolia twin are
  standalone salt miners; the mainnet script mines inline.
- The rename ceremony's first tx reverted: hand-assembled calldata with
  an odd hex length was left-padded by the wallet, shifting the selector.
  Signer pages inject exact cast-generated calldata ever since.

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- project_mainnet_launch.md - live addresses, launch state, Phase G open.
- project_testdat_linea_rehearsal.md - the /100 TDAT rehearsal record.
- feedback_launch_gate.md - setScheduledLaunchTime semantics.
- feedback_fee_address_claim.md, feedback_swapper_distributor.md - the
  post-redeploy on-chain footguns.
