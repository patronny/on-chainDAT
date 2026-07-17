# Transfer relay

Purpose: let holders move $LDAT wallet-to-wallet even though the token is
non-transferable by design, without touching the live proxy's code. Read
`docs/ARCHITECTURE.md` first for the contract family and the owner/keeper key
split - this doc covers the one deliberate gap in the transfer gate:
`contracts/src/LineaDATTransferRelay.sol`, live on Linea at
0xe6e4bAff1E8b186420733833A043Ae28132195dB, plus its owner activation, the
/transfer UI, and the tests that shipped with it.

## How it works

1. **Why plain transfers revert at all.** `_afterTokenTransfer` in
   `contracts/src/BaseStrategy.sol` allows mint, moves where a global or
   local distributor is the logical from/to, and PoolManager moves covered
   by the hook-set transient allowance - everything else reverts
   `InvalidTransfer` [inv: transfers-distributor-gated]. WHY: the TokenWorks
   fork's economics require every trade to route through the v4 pool so the
   hook fee funds treasury buy-and-burn; a free wallet-to-wallet path would
   be a fee-free OTC bypass of exactly that fee.
2. **Why a separate relay, and why two hops.** The gate checks the LOGICAL
   from/to, not msg.sender, so even a whitelisted relay cannot do a single
   `transferFrom(user, recipient)` - neither end is a distributor. `send(to,
   amount)` therefore two-hops: `transferFrom(user -> relay)`, burn the fee
   `relay -> DEAD`, `transfer(relay -> recipient)`; every hop passes solely
   because the relay is a distributor. The relay is stateless, ownerless and
   non-upgradeable, with `LDAT` and `POOL_MANAGER` fixed at construction -
   its tiny bytecode is the only thing gating the move, so it is kept
   permanently minimal. The live proxy's code was never changed; the only
   on-chain action was one reversible `setDistributor(relay, true)`.
3. **The 1% fee is burned, not collected.** `FEE_BPS` is a constant 100;
   fee = amount/100 (amounts under 100 wei round to a zero fee - dust).
   WHY burn to DEAD instead of reducing supply: every burn counter reads
   `balanceOf(DEAD)` [inv: burn-reads-dead-balance] - the supply API, the
   snapshot route, the status page, the burned card, the Telegram monitor -
   so transfer burns surfaced in all metrics on day one with zero accounting
   changes, and off-pool moves keep a real economic cost.
4. **Recipient guards encode real failure modes.** `to` may not be the zero
   address, the relay itself, or the PoolManager - a bare ERC20 transfer
   into the v4 PoolManager credits no delta and is locked forever. Zero
   amounts revert.
5. **Activation was one owner call.** Deployed inert 2026-06-21 by the hot
   keeper EOA (`contracts/script/DeployTransferRelay.s.sol`, hard chainid
   59144 guard); a fresh relay does nothing until the proxy owner calls
   `setDistributor(relay, true)`. The then-owner cold Keycard signed it via
   `tools/relay-whitelist-signer.html` - a self-contained local page (no
   libraries, no network calls except the wallet's RPC) built because
   Lineascan's "Write as Proxy" is broken for this Solady clone. The page
   preflights owner match, `relay.LDAT() == proxy`, current `isDistributor`
   state and an eth_call dry-run before enabling Sign, then re-reads
   `isDistributor` after confirmation.
6. **Frontend.** `frontend/src/app/transfer/page.tsx` renders
   `frontend/src/components/transfer-card.tsx`: a data-driven TOKENS array
   (each token paired with its own relay; a future DAT is one added line),
   recipient validation (zero/relay blocked, self-send warned - the fee is
   still charged), exact-amount `approve` then `relay.send`, a live 99%/1%
   breakdown, and txBusy gating [inv: tx-busy-guard]. The address is
   `ADDR.relay` in `frontend/src/lib/wagmi.ts`: NEXT_PUBLIC_RELAY_ADDRESS
   override with a hardcoded mainnet fallback, safe because the relay is
   immutable [inv: vercel-env-overrides]. ABI in
   `frontend/src/lib/abis/relay.ts`; the public fee disclosure lives at
   `frontend/src/app/docs/transfer/page.tsx`.
7. **Tests were half the point.** Before the relay the gate itself had zero
   coverage - `InvalidTransfer` appeared in no test and
   `contracts/test/Edge.t.sol` skipped its distributor case.
   `contracts/test/TransferRelay.t.sol` (14 tests incl. a fuzz conservation
   test) covers: direct wallet-to-wallet reverts, one-hop `transferFrom`
   reverts, two-hop charges 1% to DEAD + delivers 99% + relay ends at zero
   balance + allowance consumed, revoke re-blocks, and every guard reverts.
   `contracts/test/ForkTransferRelay.t.sol` is the Linea-fork e2e against
   the LIVE proxy and a real holder, run green before the mainnet deploy.

## Owns

`contracts/src/LineaDATTransferRelay.sol`,
`contracts/script/DeployTransferRelay.s.sol`,
`contracts/test/TransferRelay.t.sol`, `contracts/test/ForkTransferRelay.t.sol`,
`tools/relay-whitelist-signer.html`, `frontend/src/app/transfer/page.tsx`,
`frontend/src/components/transfer-card.tsx`, `frontend/src/lib/abis/relay.ts`,
`frontend/src/app/docs/transfer/page.tsx`.

## Local invariants

[inv: transfers-distributor-gated] - the gate mechanism sits in
`contracts/src/BaseStrategy.sol` (`_afterTokenTransfer`); this doc owns its
one sanctioned bypass. Reads [inv: burn-reads-dead-balance],
[inv: tx-busy-guard], [inv: vercel-env-overrides] and
[inv: distributor-whitelist-after-swapper-redeploy] as inputs.

## Verify

- `cast call 0xe6e4bAff1E8b186420733833A043Ae28132195dB "LDAT()(address)"
  --rpc-url https://rpc.linea.build` - must return the live proxy
  0x02F289E429655d0C0D713A7dFD26850A81f7cFC5.
- `cast call 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5
  "isDistributor(address)(bool)" 0xe6e4bAff1E8b186420733833A043Ae28132195dB
  --rpc-url https://rpc.linea.build` - true means transfers are live.
- Unit tests: `forge test --match-contract '^TransferRelayTest$' -vv` from
  `contracts/foundry.toml`'s directory (the anchors matter: the bare pattern
  also matches ForkTransferRelayTest, which fails without `--fork-url`).
- Fork e2e: `forge test --match-contract ForkTransferRelay --fork-url
  https://rpc.linea.build -vv` (see the owner-prank gotcha below).
- UI: https://www.on-chaindat.com/transfer; a test send surfaces the 1% burn
  in the success panel and the Burned counter.

## Related memory

Full path: /Users/berlenkayauheni/.claude/projects/-Users-berlenkayauheni-Desktop-LineaDAT/memory/
- project_transfer_relay.md - live-in-prod record: addresses, fee design,
  signer page, test scope, optional leftovers.
- Obsidian work log (gitignored, obsidian/LineaDAT Work Log.md): the
  2026-06-21 relay entries (security research, build+deploy+verify,
  activation, prod ship, plus UI tweaks) and the two 2026-07-12 Safe
  migration entries (PREP and DONE).

## Gotchas

- **The owner is a 2-of-3 Safe since 2026-07-12**
  (0xd2bb57d3862C20f14c30860381C7116F73762945). Every future
  `setDistributor` (revoking, or whitelisting a new relay) is a Safe
  transaction; `tools/relay-whitelist-signer.html` hardcodes the old Keycard
  EOA as OWNER and is dead for owner ops - kept as the historical record
  (see tools/transfer-ownership-to-safe.html (deliberately local, never committed) for the migration page).
- Same staleness inside `contracts/test/ForkTransferRelay.t.sol`: it pranks
  the old Keycard for `setDistributor`, which no longer matches `owner()` on
  a current fork - prank `owner()` instead when re-running it.
- The launch seeder 0xB8b2EDeC4ea37FF2aeA534BfD0F6ce1B9C48484c is STILL a
  distributor: `factoryEscape` in `contracts/src/LineaDATStrategy.sol`
  whitelists its recipient and the deploy never unset it. Revoking is the
  standing optional leftover (harmless: the seeder holds locked liquidity
  and has no transfer code path), now a Safe tx.
- A redeployed relay is a new address and starts inert until whitelisted
  [inv: distributor-whitelist-after-swapper-redeploy]; also update
  FALLBACK_RELAY in `frontend/src/lib/wagmi.ts` and the Vercel env.
- Relay transfers are invisible to the indexer (it handles only the hook's
  Trade event and the protocol buy/sell events, no Transfer/Sent), so
  they never inflate trading volume - deliberate. The `Sent` event is the
  only relay-specific on-chain trace.
- The Telegram BURN alert (`.github/scripts/monitor.py`) triggers on any
  DEAD-balance delta: a large relay transfer produces a burn spike that is
  NOT a keeper buy - check for a matching `Sent` event before celebrating.
- The card approves the exact amount per send (no infinite approvals), and
  MAX submits the exact balance bigint, not the rounded display string.
