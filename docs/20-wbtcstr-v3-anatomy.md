# 20. WBTCSTR - Anatomy of ERC20Strategy v3 (our main prototype)

Deep dive into `wBTCStrategy` on Ethereum mainnet. This is the **direct prototype of LDAT** - we fork the v3 sources with MIT attribution, recalibrated for Linea. All facts below are confirmed via RPC calls through `https://eth.drpc.org` and raw receipts / call traces in [`research/raw-rpc-data/`](../research/raw-rpc-data/) (2026-05-01).

## 1. Contract addresses

| Role | Address | Verified |
|---|---|---|
| **WBTCSTR ERC-20 token (proxy)** | `0x7af2a142c3486a9726791098e6415b768513e363` | ✅ Solady LibClone ERC1967 |
| **ERC20Strategy v3 implementation** | `0xb1a3015b61e4eac9253a674c6942cdc5dd8de510` | ✅ Etherscan + Sourcify |
| **ERC20StrategyHook** | `0x9f8f375b2d246da6be816b453f13d43d8240a444` | ✅ Etherscan + Sourcify |
| **TokenStrategy Factory** | `0x9f834e16b709c0781537186e7bb09de42a000a0a` | ✅ `IERC20StrategyFactory` |
| **TokenWorks Launchpad entry** | `0xd7b44667d1eb4f5fbb5d64b1c640358ee3e72cf5` | proxy (124 bytes) |
| **TokenWorks Launchpad implementation** | `0x8d05e9a6c48a0dedcf3d9e33221eb7fafd731926` | implementation |
| **TokenWorks fee splitter (1.0 ETH receiver)** | `0x7851a8ab05a35d82771202665b94d25a1b084aa9` | contract |
| **TokenWorks ops treasury (0.8 of 1.0 ETH)** | `0x1966780f08b1699fb57e05ed2d7654e3ec64390d` | contract |
| **Uniswap v4 PoolManager** | `0x000000000004444c5dc75cb358380d2e3de08a90` | Uniswap canonical |
| **Uniswap v4 PositionManager (LP NFT)** | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | Uniswap canonical |
| **Universal Router (V4Router04)** | `0x00000000000044a361ae3cac094c9d1b14eece97` | immutable arg in proxy |
| **Permit2** | `0x000000000022d473030f116ddee9f6b43ac78ba3` | canonical |
| **Underlying (canonical wBTC)** | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` | BitGo |
| **PNKSTR burn target** | `0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf` | TokenWorks PunkStrategy |
| **Owner** | `0x019817ad02a31b990433542097be29d97613e8cb` | EOA Adam Lizek, **NOT renounced** as of 01.05.2026 |
| **Default `feeAddress` in hook** | `0x23ddfb0cc40682ad90bd4269a602141b7e481c5a` | EOA, received 0.2 ETH from launch fee, **does NOT receive trade fees** (see section 8) |
| **Burn address** | `0x000000000000000000000000000000000000dEaD` | - |

## 2. Launch (exact RPC data)

| Parameter | Value |
|---|---|
| **Launch tx** | [`0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd`](https://etherscan.io/tx/0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd) |
| **Block** | **24 228 624** (`0x171b310`) |
| **Timestamp** | `1768341623` = **2026-01-13T22:00:23Z** |
| **Deployer EOA** | `0xf748879edbe8cca140940788163d7be4d2a2e46a` |
| **Tx value** | **1.0 ETH** |
| **Distribution of this ETH** (from `debug_traceTransaction`) | 0.8 ETH → TokenWorks ops treasury, 0.2 ETH → default feeAddress |
| **ETH in Uniswap v4 pool at launch** | **0** (zero, single-sided) |

## 3. PoolKey wBTCStrategy/ETH in Uniswap v4

```
currency0    = 0x0000000000000000000000000000000000000000  (native ETH - sentinel)
currency1    = 0x7af2a142c3486a9726791098e6415b768513e363  (WBTCSTR)
fee          = 0x800000  (DYNAMIC_FEE_FLAG - fee computed by the hook)
tickSpacing  = 60
hooks        = 0x9f8f375b2d246da6be816b453f13d43d8240a444
```

`poolId = keccak256(abi.encode(poolKey)) = 0xa883541e1a4ff07c04ba497c72c7f80cffe2bf37d43910c6b5579857c73c4f96`.

**In the `Initialize` event (log[4]) the fee slot emits `0`**, not `0x800000`. This is a v4 quirk: the dynamic flag is stored in the poolKey, but the event omits it.

## 4. Initial pool (single-sided seed)

From the `Initialize` event and `ModifyLiquidity` event of the launch tx:

| Parameter | Value |
|---|---|
| `sqrtPriceX96` | **501 082 896 750 095 888 663 770 159 906 816** (≈ 5.01 × 10³²) |
| Initial `tick` | **+175 052** |
| Initial price `P` (token1/token0) | `(sqrtP/2⁹⁶)² ≈ 4 × 10⁷` ⇒ **40 000 000 WBTCSTR / 1 ETH** |
| Initial price of 1 token | at ETH≈$4k: **$0.0001** |
| Initial FDV | 1B × $0.0001 = **$100 000** |
| Liquidity range | `tickLower = −887 220` (MIN_TICK for spacing 60), `tickUpper = +175 020` |
| `liquidityDelta` | 158 372 218 983 990 412 488 087 |
| Reserves token0 (ETH) | **0** (currentTick > tickUpper ⇒ position is 100% in token1) |
| Reserves token1 (WBTCSTR) | **≈ 999 999 999.999 WBTCSTR** (the entire supply minus 558 wei on rounding) |
| LP-NFT (PositionManager v4) tokenId | **132 829** → minted to `0x0…dEaD` ⇒ **locked forever** |

The pool is a **one-sided bonding curve**: the first buyer arrives with ETH, takes WBTCSTR, and the price moves up along the concentrated curve. ETH first enters the pool only via a swap.

## 5. Pattern: ERC1967 + Solady LibClone + immutable args

WBTCSTR is a **minimal proxy clone** (Solady `LibClone` with ERC1967 storage slot). Bytecode proxy (121 bytes) + 60 bytes of immutable args:

```
363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3
9f834e16b709c0781537186e7bb09de42a000a0a   <- factory  (immutable arg #1)
00000000000044a361ae3cac094c9d1b14eece97   <- universalRouter (immutable arg #2)
000000000004444c5dc75cb358380d2e3de08a90   <- poolManager (immutable arg #3)
```

## 6. Storage layout (proxy slots, verified RPC 2026-05-01)

The layout is defined by `BaseStrategy` in v3.

| Slot | Hex value (latest) | Decoded | Field |
|---|---|---|---|
| 0 | `0x016345785d8a0000` | **0.1 ETH** | `buyIncrement` |
| 1 | `wBTCStrategy` packed | "wBTCStrategy" | `tokenName` |
| 2 | `WBTCSTR` packed | "WBTCSTR" | `tokenSymbol` |
| 3 | `0x9f8f375b…0a444` | hook addr | `hookAddress` (changeable via `updateHookAddress` `onlyOwner`) |
| 4 | `0x4b0` | **1200** | `priceMultiplier` |
| 5 | `0x0252afcaff9e2a99` | ≈ 0.167389 ETH | `currentFees` |
| 6 | `0x00` | 0 | `ethToTwap` |
| 7 | `0x0de0b6b3a7640000` | **1.0 ETH** | `twapIncrement` |
| 8 | `0x01` | **1** | `twapDelayInBlocks` |
| 9 | `0x0173eecc` | 24 374 476 | `lastTwapBlock` |
| 10 | `0x017c9613` | 24 942 099 | `lastBuyBlock` |
| 11 | mapping | - | `isDistributor` |
| 12 | `0x0` | zeroAddr | `globalDistributor` (mainnet uses the `GLOBAL_DISTRIBUTION_HANDLER` constant) |

**Storage at launch block (verified `eth_getStorageAt(proxy, slot, 0x171b310)`):** `currentFees=0`, `lastBuyBlock=24228624` (written in `__BaseStrategy_init`), `lastTwapBlock=0`, the rest are defaults.

## 7. Activated Uniswap v4 hook flags

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: true,
        afterInitialize: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: true,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false,
        beforeSwap: false,
        afterSwap: true,
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: false,
        afterSwapReturnDelta: true,
        afterAddLiquidityReturnDelta: false,
        afterRemoveLiquidityReturnDelta: false
    });
}
```

The hook address `0x9f8f375b…0a444` has its low 14 bits = `0x2444` = `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta`. This is a valid CREATE2-mined hook address for the Uniswap v4 permission system.

**This is the key difference from PunkStrategy v1**, where `beforeSwap` was used to intercept the fee. ERC20StrategyHook v3 moved to `afterSwap + afterSwapReturnDelta`:
- more gas-efficient (no double processing of the swap path)
- decoupling from input swap params
- the hook returns the delta via bookkeeping rather than manipulating the swap input
- eliminates a class of MEV attacks on the input side

## 8. Fee distribution (exact logic from the sources)

Source: [`research/tokenworks-hook/ERC20StrategyHook.sol:176-197`](../research/tokenworks-hook/ERC20StrategyHook.sol).

```solidity
uint256 depositAmount = (feeAmount * 80) / 100;          // 80%
uint256 pnkstrAmount  = (feeAmount * 10) / 100;          // 10%
uint256 ownerAmount   = feeAmount - depositAmount - pnkstrAmount;  // 10%

SafeTransferLib.forceSafeTransferETH(address(erc20StrategyFactory), pnkstrAmount);

address feeRecipient = feeAddressClaimedByOwner[collection];
if (feeRecipient == address(0)) {
    depositAmount += ownerAmount;                         // ⬅ 10% merges into treasury
} else {
    SafeTransferLib.forceSafeTransferETH(feeRecipient, ownerAmount);
}
INFTStrategy(collection).addFees{value: depositAmount}();
```

**For WBTCSTR `feeAddressClaimedByOwner=0`** (`eth_getStorageAt(hook, keccak256(WBTCSTR ‖ slot2))=0`). Therefore the **effective split = 90% treasury / 10% PNKSTR-burn / 0% feeAddress**, not 8/1/1 as public sources claim.

| Share | Where | Actual for WBTCSTR |
|---|---|---|
| 80% | `INFTStrategy(collection).addFees` → `currentFees` proxy | 80% |
| 10% | factory ← buy-and-burn PNKSTR | 10% |
| 10% | `feeAddressClaimedByOwner[collection]`, otherwise added to the 80% | **+80% = 90% total in treasury** |

PNKSTR-burn mechanism: the factory receives ETH via `forceSafeTransferETH`, and on its side it has its own ETH→PNKSTR routing through V4 → `0xdead`.

**For LDAT we rename this block** to LDAT-burn, with an edge case: while `collection == LDAT_ADDRESS` - `lineaDATBurnAmount` is redirected into `feeAddress` ⇒ effectively **80/20** on $LDAT itself. For future strategies - the normal 80/10/10 split (see [`50-lineadat-spec.md`](50-lineadat-spec.md)).

## 9. Hook constructor v3

```solidity
constructor(
    IPoolManager _poolManager,
    IPunkStrategy _punkStrategy,
    IERC20StrategyFactory _erc20StrategyFactory,
    address _feeAddress
)
```

In LDAT we replace the `_punkStrategy` parameter with `_lineaDATAddress` - but the meaning is the same (the address of the token whose percentages go into buy-and-burn).

## 10. Flywheel: what actually happens

### 10.1 Swap-side fee path (`_afterSwap` in the hook)

Source: [`research/tokenworks-hook/ERC20StrategyHook.sol:290-354`](../research/tokenworks-hook/ERC20StrategyHook.sol).

1. **ExactOutput prohibited.** If `params.amountSpecified > 0` - `revert ExactOutputNotAllowed`. Only ExactInput.
2. **Fee currency selection.** `specifiedTokenIs0 = (amountSpecified < 0) == zeroForOne`. As a result:
   - **Buy (ETH→WBTCSTR)**: the fee is withheld **in WBTCSTR (output side)**, then immediately `_swapToEth(key, feeAmount)` swaps them back into ETH through **the same pool** (`PoolManager.swap` with `zeroForOne=false` and `MAX_PRICE_LIMIT`). This is a "double swap" - the user pays the price impact twice.
   - **Sell (WBTCSTR→ETH)**: the fee is **in ETH immediately** - no re-swap.
3. **Dynamic fee bps** (`calculateFee`):
   - Sell: always **`DEFAULT_FEE = 1000` bps = 10.0%**.
   - Buy: starting rate **`STARTING_BUY_FEE = 9900` bps = 99.0%**, drops by **100 bps per minute** (`feeReductions = minutesPassed * 100`) until it reaches 10%. Time to plateau = **(9900−1000)/100 = 89 minutes**.
4. **TransferAllowance bookkeeping** via transient slot 0 in the proxy.
5. **`manager.take(feeCurrency, hook, feeAmount)`** pulls the fee to the hook.
6. **`_processFees(collection, feeAmountInETH)`** distributes it (see section 8).
7. **`emit Trade(collection, sqrtPriceX96, amount0, amount1)`** via `StateLibrary.getSlot0`.

### 10.2 Treasury-side: bag-buy cycle (`buyTokens` in the proxy)

**A P2P offer. The underlying contract does NO on-chain swap.** Source: [`research/tokenworks-sources/ERC20Strategy.sol:151-187`](../research/tokenworks-sources/ERC20Strategy.sol).

```solidity
function buyTokens() external nonReentrant {
    uint256 funds = availableFunds();
    if (funds == 0) revert NoZeroBuys();
    uint256 bagId = (++lastBagId);
    uint256 tokenBalanceBefore = token.balanceOf(address(this));
    SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), bagSize); // take wBTC from the caller
    if (token.balanceOf(address(this)) != tokenBalanceBefore + bagSize) revert BalanceMismatch();
    currentFees -= funds;
    onSale[bagId] = (funds * priceMultiplier) / 1000;     // list at funds × 1.2
    lastBuyBlock = block.number;                          // RESETS the getMaxPriceForBuy ceiling
    SafeTransferLib.forceSafeTransferETH(msg.sender, funds);
    emit ERC20BoughtByProtocol(bagId, funds, listPrice);
}
```

**Price per bag** = `availableFunds()`, where
```
availableFunds() = min(currentFees, getMaxPriceForBuy())
getMaxPriceForBuy() = (block.number - lastBuyBlock + 1) * buyIncrement
```

`buyIncrement = 0.1 ETH/block` for WBTCSTR (slot 0). At a 12s block time on mainnet the ceiling grows at a rate of **0.5 ETH/min = 30 ETH/hour**.

**There is NO bot reward here.** The bot's incentive is the difference between `availableFunds()` and the market price of `bagSize` wBTC.

### 10.3 Treasury-side: bag-sell (`sellTokens` in the proxy)

```solidity
function sellTokens(uint256 bagId) external payable nonReentrant {
    uint256 salePrice = onSale[bagId];
    if (salePrice == 0) revert NotForSale();
    if (msg.value != salePrice) revert PriceTooLow();
    delete onSale[bagId];
    token.transfer(msg.sender, bagSize);
    ethToTwap += salePrice;            // ETH into the TWAP-buyback bucket (NOT back into currentFees)
    emit ERC20SoldByProtocol(bagId, salePrice, msg.sender);
}
```

A P2P offer at a fixed price `listPrice = paid × 1.2`. The buyer must send **exactly** `salePrice` ETH (no more, no less - otherwise `PriceTooLow`).

ETH from sales → a separate `ethToTwap` bucket (an important invariant: deposited fees → bag-buys, bag-sales → buy-and-burn).

### 10.4 Treasury-side: buy-and-burn (`processTokenTwap` in BaseStrategy)

```solidity
function processTokenTwap() external nonReentrant {
    if (ethToTwap == 0) revert NoETHToTwap();
    if (block.number < lastTwapBlock + twapDelayInBlocks) revert TwapDelayNotMet();
    uint256 burnAmount = ethToTwap < twapIncrement ? ethToTwap : twapIncrement;
    uint256 reward = (burnAmount * 5) / 1000;             // 0.5% caller
    burnAmount -= reward;
    ethToTwap -= burnAmount + reward;
    lastTwapBlock = block.number;
    _buyAndBurnTokens(burnAmount);                         // ETH → WBTCSTR via V4 router → 0xdead
    SafeTransferLib.forceSafeTransferETH(msg.sender, reward);
}
```

This is the **only** place in the system where the contract itself performs an on-chain swap (`IUniswapV4Router04(router()).swapExactTokensForTokens`). And this swap buys **its own WBTCSTR**, not the underlying. The caller receives a 0.5% reward in ETH.

## 11. Configuration parameters (exact numbers, verified)

| Parameter | Value | Source |
|---|---|---|
| Total swap fee (sell) | **10.00%** (`DEFAULT_FEE = 1000` bps) | hook constants |
| Total swap fee (buy at launch) | **99.00%** (`STARTING_BUY_FEE = 9900` bps) | hook constants |
| Buy fee decay | **−100 bps/min** down to the 1000 bps (10%) plateau | `calculateFee` |
| Time to reach the plateau (buy) | **89 minutes** = (9900−1000)/100 | arithmetic |
| Fee split (actual) | **90% treasury / 10% PNKSTR-burn / 0% feeAddress** | `_processFees` + `feeAddressClaimedByOwner=0` |
| `priceMultiplier` | 1200 (1.2× markup) | proxy slot 4 |
| `bagSize` | 1 250 000 (= 0.0125 wBTC, 8 decimals) | `bagSize()` |
| `buyIncrement` | **0.1 ETH/block** | proxy slot 0 |
| `twapIncrement` | **1.0 ETH** | proxy slot 7 |
| `twapDelayInBlocks` | **1** | proxy slot 8 |
| Total supply | 1 000 000 000 × 10¹⁸ | `totalSupply()` |
| Decimals | 18 | |
| Pool initial sqrtPriceX96 | 5.01 × 10³² | Initialize event |
| Pool initial tick | +175 052 | Initialize event |
| Pool initial price | 40M WBTCSTR / 1 ETH ≈ $0.0001 token | math |
| Initial FDV | ≈ $100 000 | math |
| Liquidity range | tickLower = −887 220, tickUpper = +175 020 | ModifyLiquidity event |
| Liquidity delta | 158 372 218 983 990 412 488 087 | ModifyLiquidity event |
| Initial pool reserves | 0 ETH + ≈1B WBTCSTR (single-sided) | math |
| LP-NFT tokenId | 132 829 → `0x...dEaD` | log[5] receipt |
| Deployer launch fee | 1.0 ETH (0.8/0.2 split) | trace |
| Burned (as of 30.04.2026) | ≈ 108M WBTCSTR (~10.8% supply) | UI nftstrategy.fun |
| Treasury (as of 30.04.2026) | 0.15 wBTC + 0.167 ETH | UI / slot 5 |
| Realized profit since launch | +1.99 ETH (12 cycles) | UI |
| `feeAddress` (hook default) | `0x23ddfb0c...e481c5a` | hook slot 0 |
| `feeAddressClaimedByOwner[WBTCSTR]` | 0 | hook mapping(slot=2) |
| `deploymentTime[WBTCSTR]` | 1 768 341 623 | hook mapping(slot=1) |
| Owner | `0x019817ad...e8cb` (not renounced) | `owner()` |
| Compiler | Solidity 0.8.30, optimizer 200 runs, **Cancun** | Etherscan |
| Block time mainnet | 12 seconds | PoS constant |

## 12. Custom errors

In the hook:
```
ExactOutputNotAllowed, HookNotImplemented, InvalidCollection, NotCollectionOwner,
NotNFTStrategy, NotNFTStrategyFactoryOwner, NotPoolManager, Reentrancy
```

In the ERC20Strategy proxy:
```
AllowanceOverflow, AllowanceUnderflow, AlreadyInitialized, BalanceMismatch,
InputsError, InsufficientAllowance, InsufficientBalance, InvalidInitialization,
InvalidMultiplier, InvalidPermit, InvalidTransfer, NewOwnerIsZeroAddress,
NoETHToTwap, NoHandoverRequest, NoZeroBuys, NotEnoughEth, NotFactory,
NotForSale, NotInitializing, OnlyHook, Permit2AllowanceIsFixedAtInfinity,
PermitExpired, PriceTooHigh, PriceTooLow, Reentrancy, TokensAlreadyPurchased,
TotalSupplyOverflow, TwapDelayNotMet, Unauthorized, UnauthorizedCallContext,
UpgradeFailed
```

In LDAT we keep `ExactOutputNotAllowed`, `NotPoolManager`, `Reentrancy`, and rename the NFT-related ones to `NotStrategy` / `NotStrategyFactoryOwner`.

## 13. Verified sources

In [`research/tokenworks-sources/`](../research/tokenworks-sources/) (proxy + BaseStrategy):
```
ERC20Strategy.sol
src_strategies_BaseStrategy.sol
src_Interfaces.sol
lib/solady/* (auth, tokens, utils)
lib/v4-core/* (interfaces, libraries, types)
lib/v4-router/* (router interface)
lib/v4-router/lib/permit2/* (Permit2 interfaces)
```

In [`research/tokenworks-hook/`](../research/tokenworks-hook/) (hook):
```
ERC20StrategyHook.sol
src_Interfaces.sol
lib/v4-core/* (including StateLibrary, TickMath, Position, FullMath, FixedPoint128)
lib/v4-periphery/* (BaseHook, ImmutableState)
lib/solady/* (ReentrancyGuard, SafeTransferLib)
```

## 14. Verification log (RPC)

Queries executed on `2026-05-01` through `https://eth.drpc.org`:

```bash
# 1. Launch block - bisect over eth_getCode(proxy, block) → 24228624 (0x171b310)
# 2. eth_getTransactionByHash(0xd444a9db...) → from=0xf748879edbe..., value=1.0 ETH
# 3. eth_getTransactionReceipt(0xd444a9db...) → 12 logs including:
#    - log[1]  ERC20.Transfer(from=0, to=factory, 1B WBTCSTR)        - initial mint
#    - log[3]  Permit2.Approval(factory, WBTCSTR, PositionManager)    - for the seed
#    - log[4]  PoolManager.Initialize(...) sqrtPriceX96=5.01e32, tick=+175052
#    - log[5]  PositionManager.Transfer(0 → 0xdead, tokenId=132829)   - LP NFT into dead
#    - log[6]  PoolManager.ModifyLiquidity(tl=-887220, tu=+175020, L=1.58e23)
#    - log[8]  ERC20.Transfer(factory → PoolManager, 1B-558 WBTCSTR)  - seed token
# 4. debug_traceTransaction(0xd444a9db...) → 1.0 ETH split: 0.8 → ops, 0.2 → feeAddress
# 5. eth_getStorageAt(proxy, 0..10, latest) → all slot values from section 6 confirmed
# 6. eth_getStorageAt(hook, keccak256(WBTCSTR ‖ 1)) = 1768341623 (deploymentTime)
# 7. eth_getStorageAt(hook, keccak256(WBTCSTR ‖ 2)) = 0x0 (no custom feeRecipient)
# 8. eth_getStorageAt(hook, 0x0) = 0x23ddfb0c...e481c5a (default feeAddress)
```

Raw data - in [`research/raw-rpc-data/wbtcstr-launch-receipt.json`](../research/raw-rpc-data/wbtcstr-launch-receipt.json) and [`research/raw-rpc-data/wbtcstr-launch-calltrace.json`](../research/raw-rpc-data/wbtcstr-launch-calltrace.json).

## 15. Etherscan / Sourcify links

- WBTCSTR proxy: <https://etherscan.io/address/0x7af2a142c3486a9726791098e6415b768513e363#code>
- ERC20Strategy v3 implementation: <https://etherscan.io/address/0xb1a3015b61e4eac9253a674c6942cdc5dd8de510#code>
- ERC20StrategyHook v3: <https://etherscan.io/address/0x9f8f375b2d246da6be816b453f13d43d8240a444#code>
- Factory: <https://etherscan.io/address/0x9f834e16b709c0781537186e7bb09de42a000a0a#code>
- Launch tx: <https://etherscan.io/tx/0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd>
- LP-NFT (tokenId 132829, sent to 0xdead): <https://etherscan.io/token/0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e?a=132829>
- TokenStrategy UI: <https://www.tokenstrategy.com/strategies/0x7af2a142c3486a9726791098e6415b768513e363>
