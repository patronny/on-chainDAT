## Raw RPC data

Raw data from Ethereum / Linea RPC, collected during the research pass on 2026-05-01. Used as a source of truth for the REKTSTR / WBTCSTR anatomies and for $LINEA analytics on Linea.

### Files

| File | Source | What is inside |
|---|---|---|
| `wbtcstr-launch-receipt.json` | `eth_getTransactionReceipt(0xd444a9db...)` via `https://eth.drpc.org` | 12 launch logs of WBTCSTR (Mint, Initialize, ModifyLiquidity, PositionManager LP-NFT mint→0xdead, StrategyDeployed) |
| `wbtcstr-launch-calltrace.json` | `debug_traceTransaction({tracer: callTracer})` | Full call tree of the launch tx - shows that 1.0 ETH → 0.8 ops + 0.2 feeAddress, **0 ETH in PoolManager** ⇒ single-sided seed |

### Key facts proven by this data

- **WBTCSTR launch:** block 24228624 (`0x171b310`), timestamp 1768341623 = `2026-01-13T22:00:23Z`
- **REKTSTR launch:** block 24000001, timestamp 1765584383 = `2025-12-13T00:06:23Z`
- **WBTCSTR initial pool reserves:** 0 ETH + ~1B WBTCSTR (single-sided), tickLower=−887220, tickUpper=+175020, sqrtPriceX96=5.01e32, currentTick=+175052
- **WBTCSTR LP-NFT (PositionManager):** tokenId 132829 → minted to `0x0...dead` ⇒ liquidity locked forever
- **fee split in WBTCSTR (actual):** 90% treasury / 10% PNKSTR-burn / 0% feeAddress (because `feeAddressClaimedByOwner[WBTCSTR]=0` ⇒ ownerAmount merges into treasury)

### Verification commands (reproducible)

```bash
RPC=https://eth.drpc.org

# 1. Storage slots WBTCSTR proxy
for i in 0 3 4 5 6 7 8 9 10; do
  curl -sS -X POST -H "Content-Type: application/json" \
    --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getStorageAt\",\"params\":[\"0x7af2a142c3486a9726791098e6415b768513e363\",\"0x$(printf %x $i)\",\"latest\"],\"id\":1}" "$RPC"
done

# 2. Hook deploymentTime[WBTCSTR] (mapping at slot 1)
# key = keccak256(abi.encode(WBTCSTR_addr, 1))
# Python: from eth_hash.auto import keccak; keccak(bytes.fromhex("..."*) + (1).to_bytes(32,"big")).hex()

# 3. $LINEA pools on Linea - GeckoTerminal:
curl https://api.geckoterminal.com/api/v2/networks/linea/tokens/0x1789e0043623282D5DCc7F213d703C6D8BAfBB04/pools

# 4. ETH/LINEA prices via DefiLlama:
curl https://coins.llama.fi/prices/current/coingecko:ethereum,linea:0x1789e0043623282D5DCc7F213d703C6D8BAfBB04
```
