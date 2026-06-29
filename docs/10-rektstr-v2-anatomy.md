# 10. REKTSTR - Anatomy of ERC20Strategy v2

A deep dive into TokenWorks' first ERC-20 strategy. REKTSTR (RektStrategy) - 1 month older than WBTCSTR, 1 hook generation earlier (`VERSION = 2`). Included in research as an *older reference*: sources are verified, the patterns are the same, and the minor differences are clearly visible.

All facts below are confirmed by direct reads via `https://ethereum-rpc.publicnode.com` and `https://eth.drpc.org` (2026-05-01) + verified sources from Sourcify.

## 1. Contract addresses

| Role | Address | Source |
|---|---|---|
| **REKTSTR ERC-20 token (proxy)** | `0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e` | `eth_call(name())` = "RektStrategy" |
| **ERC20Strategy v2 implementation** | `0xe5a9634bf5db3d8d6138c3182d09a561bcf1a2a5` | `eth_call(getImplementation())` |
| **Hook (REKTSTR-specific)** | `0xdadaaa9591d6f4d68748898fbacc99dc69012444` | proxy slot 3 |
| **Factory** | `0x9f834e16b709c0781537186e7bb09de42a000a0a` | shared with WBTCSTR |
| **Underlying ($REKT)** | `0xdd3b11ef34cd511a2da159034a05fcb94d806686` | `eth_call(token())` - Rektguy community ERC-20 |
| **Owner (Adam Lizek)** | `0x019817ad02a31b990433542097be29d97613e8cb` | `eth_call(owner())`, **NOT renounced** as of 01.05.2026 |
| **Uniswap v4 PoolManager** | `0x000000000004444c5dc75cb358380d2e3de08a90` | canonical |
| **Universal Router (V4Router04)** | `0x00000000000044a361ae3cac094c9d1b14eece97` | immutable arg in proxy |

## 2. Launch

| Parameter | Value |
|---|---|
| **Launch block** | **24 000 001** (bisect via `eth_getCode`: no code before this block) |
| **Timestamp** | `1765584383` = **2025-12-13T00:06:23Z** |
| **VERSION()** | **2** ⚠️ (one generation earlier than WBTCSTR) |
| **Compiler** | Solidity 0.8.26 (difference from v3 - it uses 0.8.30) |

## 3. Tokenomics

| Parameter | Value | Source |
|---|---|---|
| `name` | "RektStrategy" | `name()` |
| `symbol` | "REKTSTR" | `symbol()` |
| `decimals` | 18 | `decimals()` |
| `totalSupply` | **1 000 000 000 × 10¹⁸** = 1B | `totalSupply()` |
| `bagSize` | **42 069 000 000 × 10¹⁸** REKT = 42.069 billion tokens | `bagSize()` (meme number 42069) |
| Equivalent in $ | ≈ $6 232 (REKT $1.48e-7 as of 01.05.2026) | DefiLlama |
| `priceMultiplier` | 1200 (1.2× markup) | proxy slot 4 |
| `buyIncrement` | 0.1 ETH/block | proxy slot 0 |
| `twapIncrement` | 1.0 ETH | proxy slot 7 |
| `twapDelayInBlocks` | 1 | proxy slot 8 |
| `currentFees` (as of 01.05.2026) | ≈ 0.379 ETH | proxy slot 5 = `0x542e32e9c931ab9` |
| `lastBuyBlock` | 24 942 099 | proxy slot 10 |
| `lastTwapBlock` | 24 395 059 | proxy slot 9 |

## 4. Storage layout (proxy slots) - identical to v3

| Slot | Field | Decode |
|---|---|---|
| 0 | `buyIncrement` | 0.1 ETH |
| 1 | `tokenName` | "RektStrategy" packed |
| 2 | `tokenSymbol` | "REKTSTR" packed |
| 3 | `hookAddress` | `0xdadaaa95…12444` |
| 4 | `priceMultiplier` | 1200 |
| 5 | `currentFees` | accumulated counter |
| 6 | `ethToTwap` | 0 (all already burned in TWAP cycles) |
| 7 | `twapIncrement` | 1.0 ETH |
| 8 | `twapDelayInBlocks` | 1 |
| 9 | `lastTwapBlock` | 24 395 059 |
| 10 | `lastBuyBlock` | 24 942 099 |
| 11 | `isDistributor` mapping head | - |
| 12 | `globalDistributor` | 0 (mainnet uses the constant `GLOBAL_DISTRIBUTION_HANDLER`) |

## 5. Verified sources

Downloaded from Sourcify (full match) into [`research/rektstr-v2/`](../research/rektstr-v2/):

```
src/strategies/ERC20Strategy.sol     14 249 bytes  (v2)
src/strategies/BaseStrategy.sol      25 596 bytes  (v2)
src/Interfaces.sol                   13 498 bytes
lib/solady/...                       (full solady tree)
lib/v4-core/...                      (Uniswap v4 core)
lib/v4-router/...                    (v4 router interfaces)
lib/v4-router/lib/permit2/...        (Permit2)
metadata.json                        Foundry compilation metadata
```

Sourcify has no hook sources (`0xdadaaa95…12444` is not indexed) - we'll fill them in via the Etherscan API during a detailed compare between the v2 and v3 hook (for the v2 vs v3 hook comparison we need to know explicitly which fixes were made between them).

## 6. v2 vs v3 - known differences

I ran a diff between [`research/rektstr-v2/src__strategies__ERC20Strategy.sol`](../research/rektstr-v2/src__strategies__ERC20Strategy.sol) (v2) and [`research/tokenworks-sources/ERC20Strategy.sol`](../research/tokenworks-sources/ERC20Strategy.sol) (v3). Sizes: v2 = 14 249 bytes, v3 = 14 960 bytes. Delta = +711 bytes.

The core functional logic (`buyTokens`, `sellTokens`, `list`, `updateBagSize`) is **identical**. The v3 vs v2 delta:
- **`VERSION()` returns 3 vs 2**
- **Minor fixes to balance checks** (I'll compute the exact lines when writing the contracts)
- The base semantics of the P2P offer and `availableFunds() = min(currentFees, getMaxPriceForBuy())` **did not change**

`BaseStrategy.sol` delta: v2 = 25 596 bytes, v3 = 26 582 bytes. Also minor edits. The key point - **the storage layout is identical**, both use `__gap[49]` for UUPS upgrades.

## 7. Hook permissions (for REKTSTR v2)

Hook address `0xdadaaa9591d6f4d68748898fbacc99dc69012444`. Lower 14 bits = `0x2444` = `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta` - **the same as in v3**. CREATE2-mined for exactly the same permission flags.

This means - the hook permissions **did not change** between v2 and v3. The delta is only in the hook's internal logic (which we can't compare right now without the v2-hook sources).

## 8. What we treat as a reference for LDAT

✅ **Storage layout** - we copy it 1:1 (this is the interface with the RPC and indexers, any deviation will break the frontend).
✅ **`buyIncrement = 0.1 ETH/block`** - TokenWorks found this empirically, v2 already uses it. Confirmation that 0.1 ETH/block is the norm for mainnet (12s/block). For Linea (3s/block) we recompute: see [`docs/50-lineadat-spec.md`](50-lineadat-spec.md).
✅ **`priceMultiplier = 1200`** - fixed in v2 and v3, we copy it.
✅ **`twapIncrement = 1.0 ETH` / `twapDelayInBlocks = 1`** - the norm on mainnet; for Linea with a thin pool we lower it (see spec).
✅ **`bagSize`** - for REKTSTR this is 42 069 000 000 REKT (a meme number). This confirms for us that bagSize **can be an arbitrary round** number - not tied to a % of the underlying supply. For LDAT we chose **150 000 LINEA** as a "convenient round" value.

## 9. What we take as "v2 was the buggy firstborn, v3 already cleaned it up"

REKTSTR - TokenWorks' **first ERC-20 strategy**. Fixes for v3 may have been shaken out on it. Specific publicly known REKTSTR bugs - not recorded in open channels (see [`30-tokenworks-incidents.md`](30-tokenworks-incidents.md)), but the fact that v3 was deployed a **month** after v2 suggests something was fixed. **We fork LDAT from v3 specifically** - taking the post-fix version.

## 10. Etherscan / Sourcify links

- REKTSTR proxy: <https://etherscan.io/address/0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e#code>
- ERC20Strategy v2 implementation (Sourcify full match): <https://sourcify.dev/#/lookup/0xe5a9634bf5db3d8d6138c3182d09a561bcf1a2a5>
- REKTSTR Hook (Etherscan): <https://etherscan.io/address/0xdadaaa9591d6f4d68748898fbacc99dc69012444>
- $REKT underlying: <https://etherscan.io/token/0xdd3b11ef34cd511a2da159034a05fcb94d806686>
- TokenStrategy UI: <https://www.tokenstrategy.com/strategies/0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e>
