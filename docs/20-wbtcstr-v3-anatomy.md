# 20. WBTCSTR - Анатомия ERC20Strategy v3 (наш основной прототип)

Глубокий разбор `wBTCStrategy` на Ethereum mainnet. Это **прямой прототип LDAT** - мы форкаем v3-сурсы с MIT-атрибуцией, переcalibrated под Linea. Все факты ниже подтверждены RPC-вызовами через `https://eth.drpc.org` и сырыми receipt'ами / call-trace'ами в [`research/raw-rpc-data/`](../research/raw-rpc-data/) (2026-05-01).

## 1. Адреса контрактов

| Роль | Адрес | Verified |
|---|---|---|
| **WBTCSTR ERC-20 token (proxy)** | `0x7af2a142c3486a9726791098e6415b768513e363` | ✅ Solady LibClone ERC1967 |
| **ERC20Strategy v3 implementation** | `0xb1a3015b61e4eac9253a674c6942cdc5dd8de510` | ✅ Etherscan + Sourcify |
| **ERC20StrategyHook** | `0x9f8f375b2d246da6be816b453f13d43d8240a444` | ✅ Etherscan + Sourcify |
| **TokenStrategy Factory** | `0x9f834e16b709c0781537186e7bb09de42a000a0a` | ✅ `IERC20StrategyFactory` |
| **TokenWorks Launchpad entry** | `0xd7b44667d1eb4f5fbb5d64b1c640358ee3e72cf5` | proxy (124 байта) |
| **TokenWorks Launchpad implementation** | `0x8d05e9a6c48a0dedcf3d9e33221eb7fafd731926` | implementation |
| **TokenWorks fee splitter (1.0 ETH receiver)** | `0x7851a8ab05a35d82771202665b94d25a1b084aa9` | contract |
| **TokenWorks ops treasury (0.8 of 1.0 ETH)** | `0x1966780f08b1699fb57e05ed2d7654e3ec64390d` | contract |
| **Uniswap v4 PoolManager** | `0x000000000004444c5dc75cb358380d2e3de08a90` | Uniswap canonical |
| **Uniswap v4 PositionManager (LP NFT)** | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | Uniswap canonical |
| **Universal Router (V4Router04)** | `0x00000000000044a361ae3cac094c9d1b14eece97` | immutable arg в proxy |
| **Permit2** | `0x000000000022d473030f116ddee9f6b43ac78ba3` | canonical |
| **Underlying (canonical wBTC)** | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` | BitGo |
| **PNKSTR burn target** | `0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf` | TokenWorks PunkStrategy |
| **Owner** | `0x019817ad02a31b990433542097be29d97613e8cb` | EOA Adam Lizek, **НЕ renounced** на 01.05.2026 |
| **Default `feeAddress` в hook** | `0x23ddfb0cc40682ad90bd4269a602141b7e481c5a` | EOA, получил 0.2 ETH из launch fee, **trade fees НЕ получает** (см. п.8) |
| **Burn address** | `0x000000000000000000000000000000000000dEaD` | - |

## 2. Launch (точные данные RPC)

| Параметр | Значение |
|---|---|
| **Launch tx** | [`0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd`](https://etherscan.io/tx/0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd) |
| **Block** | **24 228 624** (`0x171b310`) |
| **Timestamp** | `1768341623` = **2026-01-13T22:00:23Z** |
| **Deployer EOA** | `0xf748879edbe8cca140940788163d7be4d2a2e46a` |
| **Tx value** | **1.0 ETH** |
| **Распределение этого ETH** (из `debug_traceTransaction`) | 0.8 ETH → TokenWorks ops treasury, 0.2 ETH → default feeAddress |
| **ETH в Uniswap v4 pool на launch** | **0** (ноль, single-sided) |

## 3. PoolKey wBTCStrategy/ETH в Uniswap v4

```
currency0    = 0x0000000000000000000000000000000000000000  (native ETH - sentinel)
currency1    = 0x7af2a142c3486a9726791098e6415b768513e363  (WBTCSTR)
fee          = 0x800000  (DYNAMIC_FEE_FLAG - fee рассчитывается хуком)
tickSpacing  = 60
hooks        = 0x9f8f375b2d246da6be816b453f13d43d8240a444
```

`poolId = keccak256(abi.encode(poolKey)) = 0xa883541e1a4ff07c04ba497c72c7f80cffe2bf37d43910c6b5579857c73c4f96`.

**В `Initialize` event (log[4]) в slot fee эмитится `0`**, не `0x800000`. Это особенность v4: dynamic-flag хранится в poolKey, но event пропускает его.

## 4. Initial pool (single-sided seed)

Из `Initialize` event и `ModifyLiquidity` event launch tx:

| Параметр | Значение |
|---|---|
| `sqrtPriceX96` | **501 082 896 750 095 888 663 770 159 906 816** (≈ 5.01 × 10³²) |
| Initial `tick` | **+175 052** |
| Initial price `P` (token1/token0) | `(sqrtP/2⁹⁶)² ≈ 4 × 10⁷` ⇒ **40 000 000 WBTCSTR / 1 ETH** |
| Initial price 1 token | при ETH≈$4k: **$0.0001** |
| Initial FDV | 1B × $0.0001 = **$100 000** |
| Liquidity range | `tickLower = −887 220` (MIN_TICK для spacing 60), `tickUpper = +175 020` |
| `liquidityDelta` | 158 372 218 983 990 412 488 087 |
| Reserves token0 (ETH) | **0** (currentTick > tickUpper ⇒ позиция на 100% в token1) |
| Reserves token1 (WBTCSTR) | **≈ 999 999 999.999 WBTCSTR** (весь supply минус 558 wei на rounding) |
| LP-NFT (PositionManager v4) tokenId | **132 829** → minted to `0x0…dEaD` ⇒ **залочено навсегда** |

Pool - **bonding-curve в одну сторону**: первый покупатель приходит с ETH, забирает WBTCSTR, цена идёт вверх по концентрированной кривой. ETH в pool впервые попадает только через swap.

## 5. Pattern: ERC1967 + Solady LibClone + immutable args

WBTCSTR - **minimal proxy clone** (Solady `LibClone` с ERC1967 storage slot). Bytecode proxy (121 байт) + 60 байт immutable args:

```
363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3
9f834e16b709c0781537186e7bb09de42a000a0a   <- factory  (immutable arg #1)
00000000000044a361ae3cac094c9d1b14eece97   <- universalRouter (immutable arg #2)
000000000004444c5dc75cb358380d2e3de08a90   <- poolManager (immutable arg #3)
```

## 6. Storage layout (proxy slots, verified RPC 2026-05-01)

Layout задан `BaseStrategy` в v3.

| Slot | Hex value (latest) | Decoded | Поле |
|---|---|---|---|
| 0 | `0x016345785d8a0000` | **0.1 ETH** | `buyIncrement` |
| 1 | `wBTCStrategy` packed | "wBTCStrategy" | `tokenName` |
| 2 | `WBTCSTR` packed | "WBTCSTR" | `tokenSymbol` |
| 3 | `0x9f8f375b…0a444` | hook addr | `hookAddress` (изменяемый через `updateHookAddress` `onlyOwner`) |
| 4 | `0x4b0` | **1200** | `priceMultiplier` |
| 5 | `0x0252afcaff9e2a99` | ≈ 0.167389 ETH | `currentFees` |
| 6 | `0x00` | 0 | `ethToTwap` |
| 7 | `0x0de0b6b3a7640000` | **1.0 ETH** | `twapIncrement` |
| 8 | `0x01` | **1** | `twapDelayInBlocks` |
| 9 | `0x0173eecc` | 24 374 476 | `lastTwapBlock` |
| 10 | `0x017c9613` | 24 942 099 | `lastBuyBlock` |
| 11 | mapping | - | `isDistributor` |
| 12 | `0x0` | zeroAddr | `globalDistributor` (mainnet uses `GLOBAL_DISTRIBUTION_HANDLER` константу) |

**Storage at launch block (verified `eth_getStorageAt(proxy, slot, 0x171b310)`):** `currentFees=0`, `lastBuyBlock=24228624` (записан в `__BaseStrategy_init`), `lastTwapBlock=0`, остальное - defaults.

## 7. Активированные Uniswap v4 hook flags

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

Адрес хука `0x9f8f375b…0a444` имеет младшие 14 бит = `0x2444` = `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta`. Это валидный CREATE2-mined хук-адрес для Uniswap v4 permission system.

**Это ключевое отличие от PunkStrategy v1**, где использовался `beforeSwap` для перехвата fee. ERC20StrategyHook v3 переехал на `afterSwap + afterSwapReturnDelta`:
- gas-эффективнее (нет двойной обработки swap path)
- decoupling от input swap params
- хук возвращает дельту через bookkeeping, а не манипулирует swap input
- исключает класс MEV-атак на input-side

## 8. Распределение fee (точная логика из исходников)

Источник: [`research/tokenworks-hook/ERC20StrategyHook.sol:176-197`](../research/tokenworks-hook/ERC20StrategyHook.sol).

```solidity
uint256 depositAmount = (feeAmount * 80) / 100;          // 80%
uint256 pnkstrAmount  = (feeAmount * 10) / 100;          // 10%
uint256 ownerAmount   = feeAmount - depositAmount - pnkstrAmount;  // 10%

SafeTransferLib.forceSafeTransferETH(address(erc20StrategyFactory), pnkstrAmount);

address feeRecipient = feeAddressClaimedByOwner[collection];
if (feeRecipient == address(0)) {
    depositAmount += ownerAmount;                         // ⬅ 10% сливается в treasury
} else {
    SafeTransferLib.forceSafeTransferETH(feeRecipient, ownerAmount);
}
INFTStrategy(collection).addFees{value: depositAmount}();
```

**Для WBTCSTR `feeAddressClaimedByOwner=0`** (`eth_getStorageAt(hook, keccak256(WBTCSTR ‖ slot2))=0`). Поэтому **эффективный split = 90% treasury / 10% PNKSTR-burn / 0% feeAddress**, а не 8/1/1 как пишут в публичных источниках.

| Доля | Куда | Реально для WBTCSTR |
|---|---|---|
| 80% | `INFTStrategy(collection).addFees` → `currentFees` proxy | 80% |
| 10% | factory ← buy-and-burn PNKSTR | 10% |
| 10% | `feeAddressClaimedByOwner[collection]`, иначе плюсуется к 80% | **+80% = 90% всего в treasury** |

PNKSTR-burn механизм: factory получает ETH через `forceSafeTransferETH`, на её стороне есть свой роутинг ETH→PNKSTR через V4 → `0xdead`.

**Для LDAT этот блок переименовываем** в LDAT-burn, с edge-case: пока `collection == LDAT_ADDRESS` - `lineaDATBurnAmount` redirected в `feeAddress` ⇒ эффективно **80/20** на самом $LDAT. Для будущих strategies - нормальный 80/10/10 split (см. [`50-lineadat-spec.md`](50-lineadat-spec.md)).

## 9. Конструктор хука v3

```solidity
constructor(
    IPoolManager _poolManager,
    IPunkStrategy _punkStrategy,
    IERC20StrategyFactory _erc20StrategyFactory,
    address _feeAddress
)
```

В LDAT заменим параметр `_punkStrategy` на `_lineaDATAddress` - но смысл тот же (адрес токена, чьи проценты идут в buy-and-burn).

## 10. Flywheel: что реально происходит

### 10.1 Swap-side fee path (`_afterSwap` в хуке)

Источник: [`research/tokenworks-hook/ERC20StrategyHook.sol:290-354`](../research/tokenworks-hook/ERC20StrategyHook.sol).

1. **Запрет ExactOutput.** Если `params.amountSpecified > 0` - `revert ExactOutputNotAllowed`. Только ExactInput.
2. **Выбор валюты fee.** `specifiedTokenIs0 = (amountSpecified < 0) == zeroForOne`. По итогу:
   - **Buy (ETH→WBTCSTR)**: fee удерживается **в WBTCSTR (output side)**, потом тут же `_swapToEth(key, feeAmount)` свопает их обратно в ETH через **тот же pool** (`PoolManager.swap` с `zeroForOne=false` и `MAX_PRICE_LIMIT`). Это «двойной свап» - пользователь оплачивает price-impact дважды.
   - **Sell (WBTCSTR→ETH)**: fee **в ETH сразу** - без re-swap.
3. **Динамический fee bps** (`calculateFee`):
   - Sell: всегда **`DEFAULT_FEE = 1000` bps = 10.0%**.
   - Buy: стартовая ставка **`STARTING_BUY_FEE = 9900` bps = 99.0%**, падает на **100 bps в минуту** (`feeReductions = minutesPassed * 100`), пока не достигнет 10%. Время до плато = **(9900−1000)/100 = 89 минут**.
4. **TransferAllowance bookkeeping** через transient slot 0 в proxy.
5. **`manager.take(feeCurrency, hook, feeAmount)`** забирает fee к хуку.
6. **`_processFees(collection, feeAmountInETH)`** распределяет (см. п.8).
7. **`emit Trade(collection, sqrtPriceX96, amount0, amount1)`** через `StateLibrary.getSlot0`.

### 10.2 Treasury-side: bag-buy цикл (`buyTokens` в proxy)

**P2P-оффер. НИКАКОГО on-chain swap'а underlying контракт не делает.** Источник: [`research/tokenworks-sources/ERC20Strategy.sol:151-187`](../research/tokenworks-sources/ERC20Strategy.sol).

```solidity
function buyTokens() external nonReentrant {
    uint256 funds = availableFunds();
    if (funds == 0) revert NoZeroBuys();
    uint256 bagId = (++lastBagId);
    uint256 tokenBalanceBefore = token.balanceOf(address(this));
    SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), bagSize); // забираем wBTC у вызывающего
    if (token.balanceOf(address(this)) != tokenBalanceBefore + bagSize) revert BalanceMismatch();
    currentFees -= funds;
    onSale[bagId] = (funds * priceMultiplier) / 1000;     // листим за funds × 1.2
    lastBuyBlock = block.number;                          // СБРАСЫВАЕТ потолок getMaxPriceForBuy
    SafeTransferLib.forceSafeTransferETH(msg.sender, funds);
    emit ERC20BoughtByProtocol(bagId, funds, listPrice);
}
```

**Цена за bag** = `availableFunds()`, где
```
availableFunds() = min(currentFees, getMaxPriceForBuy())
getMaxPriceForBuy() = (block.number - lastBuyBlock + 1) * buyIncrement
```

`buyIncrement = 0.1 ETH/блок` для WBTCSTR (slot 0). При block-time 12s на mainnet потолок растёт со скоростью **0.5 ETH/мин = 30 ETH/час**.

**Bot-reward тут НЕТ.** Стимул бота - разница между `availableFunds()` и рыночной ценой `bagSize` wBTC.

### 10.3 Treasury-side: bag-sell (`sellTokens` в proxy)

```solidity
function sellTokens(uint256 bagId) external payable nonReentrant {
    uint256 salePrice = onSale[bagId];
    if (salePrice == 0) revert NotForSale();
    if (msg.value != salePrice) revert PriceTooLow();
    delete onSale[bagId];
    token.transfer(msg.sender, bagSize);
    ethToTwap += salePrice;            // ETH в TWAP-buyback bucket (НЕ обратно в currentFees)
    emit ERC20SoldByProtocol(bagId, salePrice, msg.sender);
}
```

P2P-оффер с фиксированной ценой `listPrice = paid × 1.2`. Buyer должен прислать **ровно** `salePrice` ETH (не больше, не меньше - иначе `PriceTooLow`).

ETH с продаж → отдельный bucket `ethToTwap` (важная инвариант: deposited fees → bag-buys, bag-sales → buy-and-burn).

### 10.4 Treasury-side: buy-and-burn (`processTokenTwap` в BaseStrategy)

```solidity
function processTokenTwap() external nonReentrant {
    if (ethToTwap == 0) revert NoETHToTwap();
    if (block.number < lastTwapBlock + twapDelayInBlocks) revert TwapDelayNotMet();
    uint256 burnAmount = ethToTwap < twapIncrement ? ethToTwap : twapIncrement;
    uint256 reward = (burnAmount * 5) / 1000;             // 0.5% caller
    burnAmount -= reward;
    ethToTwap -= burnAmount + reward;
    lastTwapBlock = block.number;
    _buyAndBurnTokens(burnAmount);                         // ETH → WBTCSTR через V4 router → 0xdead
    SafeTransferLib.forceSafeTransferETH(msg.sender, reward);
}
```

Это **единственное** место в системе, где контракт сам делает on-chain swap (`IUniswapV4Router04(router()).swapExactTokensForTokens`). И этот swap покупает **собственный WBTCSTR**, не underlying. Caller получает 0.5% reward в ETH.

## 11. Параметры конфигурации (точные числа, verified)

| Параметр | Значение | Источник |
|---|---|---|
| Total swap fee (sell) | **10.00%** (`DEFAULT_FEE = 1000` bps) | hook constants |
| Total swap fee (buy на launch) | **99.00%** (`STARTING_BUY_FEE = 9900` bps) | hook constants |
| Buy fee decay | **−100 bps/мин** до плато 1000 bps (10%) | `calculateFee` |
| Время выхода на плато (buy) | **89 минут** = (9900−1000)/100 | арифметика |
| Fee split (фактически) | **90% treasury / 10% PNKSTR-burn / 0% feeAddress** | `_processFees` + `feeAddressClaimedByOwner=0` |
| `priceMultiplier` | 1200 (1.2× markup) | proxy slot 4 |
| `bagSize` | 1 250 000 (= 0.0125 wBTC, 8 decimals) | `bagSize()` |
| `buyIncrement` | **0.1 ETH/блок** | proxy slot 0 |
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
| Burned (на 30.04.2026) | ≈ 108M WBTCSTR (~10.8% supply) | UI nftstrategy.fun |
| Treasury (на 30.04.2026) | 0.15 wBTC + 0.167 ETH | UI / slot 5 |
| Realized profit с launch | +1.99 ETH (12 циклов) | UI |
| `feeAddress` (hook default) | `0x23ddfb0c...e481c5a` | hook slot 0 |
| `feeAddressClaimedByOwner[WBTCSTR]` | 0 | hook mapping(slot=2) |
| `deploymentTime[WBTCSTR]` | 1 768 341 623 | hook mapping(slot=1) |
| Owner | `0x019817ad...e8cb` (не renounced) | `owner()` |
| Compiler | Solidity 0.8.30, optimizer 200 runs, **Cancun** | Etherscan |
| Block time mainnet | 12 секунд | константа PoS |

## 12. Custom errors

В hook'е:
```
ExactOutputNotAllowed, HookNotImplemented, InvalidCollection, NotCollectionOwner,
NotNFTStrategy, NotNFTStrategyFactoryOwner, NotPoolManager, Reentrancy
```

В ERC20Strategy proxy:
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

В LDAT оставляем `ExactOutputNotAllowed`, `NotPoolManager`, `Reentrancy`, переименовываем NFT-related в `NotStrategy` / `NotStrategyFactoryOwner`.

## 13. Verified исходники

В [`research/tokenworks-sources/`](../research/tokenworks-sources/) (proxy + BaseStrategy):
```
ERC20Strategy.sol
src_strategies_BaseStrategy.sol
src_Interfaces.sol
lib/solady/* (auth, tokens, utils)
lib/v4-core/* (interfaces, libraries, types)
lib/v4-router/* (router interface)
lib/v4-router/lib/permit2/* (Permit2 interfaces)
```

В [`research/tokenworks-hook/`](../research/tokenworks-hook/) (hook):
```
ERC20StrategyHook.sol
src_Interfaces.sol
lib/v4-core/* (включая StateLibrary, TickMath, Position, FullMath, FixedPoint128)
lib/v4-periphery/* (BaseHook, ImmutableState)
lib/solady/* (ReentrancyGuard, SafeTransferLib)
```

## 14. Verification log (RPC)

Запросы выполнены `2026-05-01` через `https://eth.drpc.org`:

```bash
# 1. Launch block - bisect по eth_getCode(proxy, block) → 24228624 (0x171b310)
# 2. eth_getTransactionByHash(0xd444a9db...) → from=0xf748879edbe..., value=1.0 ETH
# 3. eth_getTransactionReceipt(0xd444a9db...) → 12 logs включая:
#    - log[1]  ERC20.Transfer(from=0, to=factory, 1B WBTCSTR)        - initial mint
#    - log[3]  Permit2.Approval(factory, WBTCSTR, PositionManager)    - для seed
#    - log[4]  PoolManager.Initialize(...) sqrtPriceX96=5.01e32, tick=+175052
#    - log[5]  PositionManager.Transfer(0 → 0xdead, tokenId=132829)   - LP NFT в dead
#    - log[6]  PoolManager.ModifyLiquidity(tl=-887220, tu=+175020, L=1.58e23)
#    - log[8]  ERC20.Transfer(factory → PoolManager, 1B-558 WBTCSTR)  - seed token
# 4. debug_traceTransaction(0xd444a9db...) → 1.0 ETH split: 0.8 → ops, 0.2 → feeAddress
# 5. eth_getStorageAt(proxy, 0..10, latest) → подтверждены все значения slots в п.6
# 6. eth_getStorageAt(hook, keccak256(WBTCSTR ‖ 1)) = 1768341623 (deploymentTime)
# 7. eth_getStorageAt(hook, keccak256(WBTCSTR ‖ 2)) = 0x0 (no custom feeRecipient)
# 8. eth_getStorageAt(hook, 0x0) = 0x23ddfb0c...e481c5a (default feeAddress)
```

Сырые данные - в [`research/raw-rpc-data/wbtcstr-launch-receipt.json`](../research/raw-rpc-data/wbtcstr-launch-receipt.json) и [`research/raw-rpc-data/wbtcstr-launch-calltrace.json`](../research/raw-rpc-data/wbtcstr-launch-calltrace.json).

## 15. Etherscan / Sourcify ссылки

- WBTCSTR proxy: <https://etherscan.io/address/0x7af2a142c3486a9726791098e6415b768513e363#code>
- ERC20Strategy v3 implementation: <https://etherscan.io/address/0xb1a3015b61e4eac9253a674c6942cdc5dd8de510#code>
- ERC20StrategyHook v3: <https://etherscan.io/address/0x9f8f375b2d246da6be816b453f13d43d8240a444#code>
- Factory: <https://etherscan.io/address/0x9f834e16b709c0781537186e7bb09de42a000a0a#code>
- Launch tx: <https://etherscan.io/tx/0xd444a9db591427678ee1ec0a3f88c81ab0ae068aaca9281b563ec7f6da3e94cd>
- LP-NFT (tokenId 132829, sent to 0xdead): <https://etherscan.io/token/0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e?a=132829>
- TokenStrategy UI: <https://www.tokenstrategy.com/strategies/0x7af2a142c3486a9726791098e6415b768513e363>
