# 40. Linea L2 Infrastructure - Uniswap v4, $LINEA token, DEX liquidity

All facts below are confirmed by direct reads via `https://rpc.linea.build` and public APIs (DefiLlama, GeckoTerminal) as of `2026-05-01`.

## 1. Linea - core parameters

| Parameter | Value | Source |
|---|---|---|
| Chain ID | **59 144** | linea.build |
| RPC public endpoint | `https://rpc.linea.build` | Consensys |
| Block explorer | `https://lineascan.build` | |
| Block time (target) | 2 seconds | Consensys |
| **Block time (observed, 01.05.2026)** | **~3 seconds** | measured across the 5 latest blocks (latest=30462907, ts diff ~3-4 sec/block) |
| Native asset | ETH (via L2 bridge) | |
| Latest block (at build time) | 30 462 907 | `eth_blockNumber` |

In the contracts we **use 3 seconds** for catch-up calculations (conservative). If Linea returns to 2-sec blocks - all formulas remain valid, catch-up will simply be faster.

## 2. $LINEA token - verified canonical L2

### Contract

| Field | Value |
|---|---|
| Address (proxy) | `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04` |
| Implementation (EIP-1967) | `0xe03F157dE67AC4b2A9a949D64d2A3C64Ffa1BC55` |
| Proxy Admin (EIP-1967) | `0x0ccbf317EDF1F960fE49B659B6d17cBC596DfADa` |
| Verified | YES - `L2LineaToken`, Solidity 0.8.30, optimizer 10M runs |
| Author | Consensys Software Inc. |
| Type | **Canonical Linea L2 token** (TransparentUpgradeableProxy) |
| name / symbol / decimals | "Linea" / "LINEA" / 18 |
| Total supply on Linea (01.05.2026) | **69 958 991 343** (~69.96 billion) |
| Fee-on-transfer | **No** (verified from source) |
| Rebase | **No** |
| Blacklist | **No** |

⚠️ **Do not confuse with the `0x1789…bb04` mainnet version** - this is the L2-native contract on Linea. We use **exactly this one** as the `underlying`.

### Price and liquidity

| Metric | Value | Source |
|---|---|---|
| Spot price | **$0.003642** | DefiLlama Coins |
| ETH price | **$2 317** | DefiLlama (CoinGecko) |
| 1 ETH = | **636 179 LINEA** | math |

## 3. $LINEA liquidity by DEX on Linea (TVL ranking)

Source: GeckoTerminal API as of 01.05.2026, 20 pools with $LINEA. We count only LINEA/WETH pools (relevant for our bot - it buys $LINEA with ETH).

| DEX | Pair | Fee tier | TVL | 24h Volume | ETH-side ≈ |
|---|---|---|---|---|---|
| **etherex-cl** | LINEA/WETH | **0.3%** | **$152 669** | $24 267 | ~12 ETH |
| etherex-cl | LINEA/WETH | 0.05% | $33 318 | $36 106 | ~7 ETH |
| syncswap-v2-1 | LINEA/WETH | - | $19 436 | $365 | ~4 ETH |
| lynex-linea | LINEA/WETH | 0.329% | $17 512 | $4 832 | ~3.6 ETH |
| etherex-cl | LINEA/WETH | 1% | $3 076 | 0 | < 1 ETH |
| oku-trade-linea | LINEA/WETH | 1% | $703 | $118 | < 1 ETH |
| pancakeswap-v3-linea | LINEA/WETH | 0.25% | $658 | 0 | < 1 ETH |
| iziswap-linea | LINEA/WETH | 1% | $634 | $2 | < 1 ETH |
| pancakeswap-v3-linea | LINEA/WETH | 0.01% | $217 | $3 | - |
| etherex-legacy | LINEA/WETH | - | $173 | $3 | - |

**Total LINEA/WETH liquidity:** ~$228 000 = **~50 ETH ETH-side**.
**Daily LINEA/WETH volume:** ~$70 000 = **~30 ETH/day**.

**The top 2 pools** (`etherex-cl 0.3%` + `0.05%`) hold **>80%** of all LINEA/WETH liquidity. The bot will route primarily through them.

LINEA/USDC pools also exist ($272k etherex-cl 0.01%), but they are irrelevant for our bot (it needs to swap ETH, not USDC).

## 4. Uniswap v4 deployments on Linea mainnet (chainId 59144)

**Source of truth**: `Uniswap/sdks` repo, `sdks/sdk-core/src/addresses.ts` lines 463-478 on the main branch - this is the same SDK that powers `app.uniswap.org`. Universal Router addresses - `sdks/universal-router-sdk/src/utils/constants.ts` lines 471-485.

**Verification:** every address checked via `eth_getCode` through `https://rpc.linea.build` - all return non-empty bytecode.

| Contract | Address | Bytecode size |
|---|---|---|
| **PoolManager** | `0x248083fb965359d82b06c1f5322480dcfc1ad857` | ~24 KB |
| **PositionManager** (POSM, NFT-LP) | `0xddcad5775b2816a87495f207731b3571d7ee3c76` | ~24 KB |
| **StateView** (read-only) | `0xe861de206e460a8b936b05ad3816520b58ccdf9b` | ~3.5 KB |
| **Quoter** | `0x2c125569c0bee20a66e33e5491c552b37ebd9934` | ~6 KB |
| **UniversalRouter V2_1_1 (v4-capable)** | `0x8B844f885672f333Bc0042cB669255f93a4C1E6b` | ~25 KB, deployed 2026-03-18 (block 29782392) |
| UniversalRouter V2_0 (v2/v3 only - NOT for v4) | `0x661e93cca42afacb172121ef892830ca3b70f08d` | ~20 KB |
| **WETH9** | `0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f` | - |
| **Permit2** (universal address) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | - |
| **CREATE2 deployer** | `0x0000000000FFe8B47B3e2130213B802212439497` | 4 211 bytes - present on Linea ✓ |

⚠️ **We use UniversalRouter V2_1_1** (`0x8B844f…`) - V2_0 does not support v4, only v2/v3.

### Linea Sepolia testnet (chainId 59141)

❌ **Uniswap v4 is NOT deployed on Linea Sepolia** as of 2026-05-01.

**Alternative for testnet:** Base Sepolia (chainId 84532) - Uniswap v4 is available there, block-time 2 seconds (close to Linea's 3s).

## 5. Pool key for LDAT

```solidity
PoolKey({
    currency0: Currency.wrap(address(0)),                              // native ETH
    currency1: Currency.wrap(LDAT_PROXY_ADDRESS),                  // LDAT
    fee: 0x800000,                                                     // DYNAMIC_FEE_FLAG
    tickSpacing: 60,
    hooks: IHooks(LDAT_HOOK_ADDRESS)
})
```

`address(0) < any ERC-20 address` lexicographically, so in the ETH+LDAT pair currency0 = `0x0` strictly.

## 6. Hook permissions for LDAT (CREATE2-mined)

The same 4 permissions as for WBTCSTR v3:
- `beforeInitialize` (bit 13, 0x2000)
- `afterAddLiquidity` (bit 10, 0x400)
- `afterSwap` (bit 6, 0x40)
- `afterSwapReturnDelta` (bit 2, 0x4)

Sum (lower 14 bits): `0x2444`.

**The hook address must have** `address & 0x3FFF == 0x2444`. This is achieved via CREATE2 mining (Uniswap `HookMiner`):

```solidity
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
(address hookAddr, bytes32 salt) = HookMiner.find(
    CREATE2_DEPLOYER,                   // 0x0000000000FFe8B47B3e2130213B802212439497
    uint160(0x2444),                    // permission bits
    type(LineaDATHook).creationCode,
    abi.encode(POOL_MANAGER, LDAT_PROXY, FACTORY, FEE_ADDRESS)
);
```

Mining usually takes 1-10 minutes on an M1/M2 Macbook.

## 7. Hook gas-budget on Linea

- **No hard gas cap** on the hook callback in v4-core
- Linea L2 gas is ~10x cheaper than mainnet (≈ $0.01 for a simple swap, ≈ $0.05 for a swap with a hook)
- An additional double swap (for `_afterSwap` on the ETH→LDAT purchase) adds ~150k gas = $0.02. Tolerable.

## 8. Deploy targets

| Stage | What | Where | When |
|---|---|---|---|
| **Phase 1 (local)** | Anvil fork Linea mainnet | localhost:8545 | before public testnet |
| **Phase 2 (public testnet)** | Base Sepolia mainnet (chainId 84532) | base-sepolia | one week before Linea mainnet deploy |
| **Phase 3 (production)** | Linea mainnet | rpc.linea.build | final launch |

Detailed runbook in [`60-deployment-runbook.md`](60-deployment-runbook.md).

## 9. Cross-chain examples (for inspiration)

- **Clanker** (Base, dynamic-fee hook for launches) - uses `beforeInitialize + afterSwap` flags
- **Aztec** token sale (CCA hook) - custom permission-checked swaps

These projects are not TokenWorks, but they show that Uniswap v4 hooks are **working infrastructure** on mainnet and L2 already today.

## 10. Verification log

```bash
# Linea RPC live
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://rpc.linea.build

# $LINEA total supply
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x1789e0043623282D5DCc7F213d703C6D8BAfBB04","data":"0x18160ddd"},"latest"],"id":1}' \
  https://rpc.linea.build
# → 0x...69958991343207624998012613676

# Uniswap v4 PoolManager on Linea (eth_getCode)
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":[ "0x248083fb965359d82b06c1f5322480dcfc1ad857","latest"],"id":1}' \
  https://rpc.linea.build
# → 0x6080... (~24KB)

# DefiLlama prices
curl -s "https://coins.llama.fi/prices/current/coingecko:ethereum,linea:0x1789e0043623282D5DCc7F213d703C6D8BAfBB04"

# GeckoTerminal LINEA pools
curl -s "https://api.geckoterminal.com/api/v2/networks/linea/tokens/0x1789e0043623282D5DCc7F213d703C6D8BAfBB04/pools"
```
