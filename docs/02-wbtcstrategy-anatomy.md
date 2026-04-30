# 02. Анатомия wBTCStrategy

Полный разбор контрактов wBTCStrategy на Ethereum mainnet, задеплоенных 14 января 2026 в block 24234790. Это наш прямой прототип — LINEASTR будет повторять архитектуру VERSION 3 с двумя кастомизациями (см. `00-overview.md`).

## 1. Адреса контрактов

| Роль | Адрес | Verified |
|---|---|---|
| **WBTCSTR ERC-20 token (proxy)** | `0x7af2a142c3486a9726791098e6415b768513e363` | ✅ Solady LibClone ERC1967 |
| **ERC20Strategy implementation** | `0xb1a3015b61e4eac9253a674c6942cdc5dd8de510` | ✅ `ERC20Strategy.sol`, Sol 0.8.30, Cancun |
| **Uniswap v4 Hook (`ERC20StrategyHook`)** | `0x9f8f375b2d246da6be816b453f13d43d8240a444` | ✅ `ERC20StrategyHook.sol`, Sol 0.8.30 |
| **TokenStrategy Factory** | `0x9f834e16b709c0781537186e7bb09de42a000a0a` | ✅ `IERC20StrategyFactory` |
| **Uniswap v4 PoolManager** | `0x000000000004444c5dc75cb358380d2e3de08a90` | ✅ Uniswap canonical |
| **Uniswap v4 Universal Router (V4Router04)** | `0x00000000000044a361ae3cac094c9d1b14eece97` | ✅ Uniswap canonical |
| **Underlying bag asset (canonical wBTC)** | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` | ✅ BitGo wBTC |
| **PNKSTR burn target** | `0xc50673edb3a7b94e8cad8a7d4e0cd68864e33edf` | ✅ |
| **Owner / TokenWorks deployer EOA** | `0x019817ad02a31b990433542097be29d97613e8cb` | EOA |
| **WBTCSTR fee recipient** | `0x23ddfb0cc40682ad90bd4269a602141b7e481c5a` | EOA |
| **Burn address** | `0x000000000000000000000000000000000000dEaD` | — |

## 2. PoolKey wBTCStrategy/ETH в Uniswap v4

```
currency0    = 0x0000000000000000000000000000000000000000  (native ETH)
currency1    = 0x7af2a142c3486a9726791098e6415b768513e363  (WBTCSTR)
fee          = 0x800000  (DYNAMIC_FEE_FLAG — fee рассчитывается хуком)
tickSpacing  = 60  (стандартный для dynamic fee, выводится из BaseStrategy.loadLiquidity)
hooks        = 0x9f8f375b2d246da6be816b453f13d43d8240a444
```

`poolId = keccak256(abi.encode(poolKey))`.

## 3. Pattern: ERC1967 + Solady LibClone + immutable args

WBTCSTR — **minimal proxy clone** (Solady `LibClone` с ERC1967 storage slot). Bytecode proxy (121 байт):

```
363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3
9f834e16b709c0781537186e7bb09de42a000a0a   <- factory  (immutable arg #1)
00000000000044a361ae3cac094c9d1b14eece97   <- universalRouter (immutable arg #2)
000000000004444c5dc75cb358380d2e3de08a90   <- poolManager (immutable arg #3)
```

ERC1967 implementation slot (`0x360894...382bbc`) указывает на `0xb1a3015b...8de510`. На странице токена видно «Implementation: 0xB1a3015b...5dD8de510 Upgraded Active» + событие "Upgraded" в block 24234790.

## 4. Storage layout (proxy slots)

| Slot | Hex value | Decoded | Значение |
|---|---|---|---|
| 0 | `0x016345785d8a0000` | `0.1 ETH` | вероятно `currentBuyTarget` или начальный bot reward bucket |
| 1 | `wBTCStrategy` (24 chars + length) | "wBTCStrategy" | `name` (Solady ERC20 layout) |
| 2 | `WBTCSTR` (7 chars + length 14) | "WBTCSTR" | `symbol` |
| 3 | `0x9f8f375b...0a444` | hook addr | **HOOK address** (hard-wired в storage) |
| 4 | `0x4b0` | 1200 | `priceMultiplier` = 1.2x markup (basis points / 1000) |
| 5 | `0x0252456169a7bc14` | ≈ 0.167 ETH | `currentFees` (накопленные fees в ETH) |
| 7 | `0x0de0b6b3a7640000` | 1e18 | константа |
| 8 | `1` | — | bagsBoughtCount или active flag |
| 9 | `0x0173eecc` | 24,374,476 | возможный block-related cooldown |
| 10 | `0x017c9613` | 24,995,347 | то же, обновляется |

**Важно:** slot 3 содержит hook address — он не immutable, а в обычном storage. Это значит, что owner мог бы поменять его через специальный setter — но в outline такого setter нет, что косвенно подтверждает immutability через absence.

## 5. Активированные Uniswap v4 hook flags

`getHookPermissions()` возвращает 14×bool структуру `Hooks.Permissions`:

| Hook | Активирован |
|---|---|
| `beforeInitialize` | ✅ true |
| `afterInitialize` | false |
| `beforeAddLiquidity` | false |
| `afterAddLiquidity` | ✅ true |
| `beforeRemoveLiquidity` | false |
| `afterRemoveLiquidity` | false |
| `beforeSwap` | false |
| `afterSwap` | ✅ true |
| `beforeDonate` | false |
| `afterDonate` | false |
| `beforeSwapReturnDelta` | false |
| `afterSwapReturnDelta` | ✅ true |
| `afterAddLiquidityReturnDelta` | false |
| `afterRemoveLiquidityReturnDelta` | false |

Адрес хука `0x9f8f375b...0a444` имеет младшие 14 бит `0x0444` = `0x400 | 0x40 | 0x4` (`afterAddLiquidity | afterSwap | afterSwapReturnDelta`). Бит `beforeInitialize` (0x2000) кодируется выше. Это валидный CREATE2-mined хук-адрес для Uniswap v4 permission system.

**Это ключевое отличие от PunkStrategy v1**, где использовался `beforeSwap` для перехвата fee. ERC20StrategyHook v3 переехал на `afterSwap + afterSwapReturnDelta`:
- gas-эффективнее (нет двойной обработки swap path)
- decoupling от input swap params
- хук возвращает дельту через bookkeeping, а не манипулирует swap input
- исключает класс MEV-атак на input-side

## 6. Tokenomics

| Параметр | Значение | Источник |
|---|---|---|
| `name` | "wBTCStrategy" | `name()` eth_call |
| `symbol` | "WBTCSTR" | `symbol()` |
| `decimals` | 18 | `decimals()` |
| `totalSupply` | **1,000,000,000 × 10^18** (1 миллиард) | `totalSupply()` = `0x033b2e3c9fd0803ce8000000` |
| Burned (на 30.04.2026) | **108,029,706 WBTCSTR** (≈ **10.80%**) | UI nftstrategy.fun |
| Holders | 112 | Etherscan |
| Total transfers | 907 | Etherscan |
| `VERSION()` | 3 | eth_call |

**Mint mechanic:** один разовый mint в `initialize()` через factory. Весь supply сразу seedится в Uniswap v4 пул через `loadLiquidity()` в `BaseStrategy`. Дальнейших mints нет.

**Burn mechanic:** токены отправляются на `0x000...dEaD` через хук в `_processFees` после конвертации части fee в WBTCSTR.

## 7. Flywheel: что происходит при swap'е

### Покупка (ETH → WBTCSTR через Uniswap v4)
1. Пользователь свопает ETH на WBTCSTR через v4 Universal Router (`0x00000000...eece97`)
2. PoolManager выполняет swap с `dynamic fee` flag, потом дёргает `afterSwap` хука
3. Hook `_afterSwap` забирает 10% от размера сделки в native currency через `afterSwapReturnDelta`
4. Hook `_processFees` распределяет fee по правилам (см. п. 9)

### Продажа (WBTCSTR → ETH)
1. Тот же путь, hook забирает 10% fee
2. Если fee пришли в WBTCSTR, hook через `_swapToEth` конвертирует часть в ETH (для поступления в treasury)

### Bag-buy / sell цикл
1. Когда `currentFees` (slot 5) накопил достаточно ETH для покупки bag (`0.0125 wBTC`, по текущей цене ~ 0.42–0.48 ETH), кто угодно может вызвать `buyTokens()` на proxy WBTCSTR
2. Контракт через V4 Universal Router свопает ETH→wBTC, получает 0.0125 wBTC
3. `list()` выставляет 0.0125 wBTC на продажу за `paid * priceMultiplier / 1000` = `paid × 1.2` (т.е. 20% markup)
4. Когда внешний buyer выкупает bag (передавая ETH), `sellTokens()` фиксирует профит
5. Профит = `ListPrice − PaidPrice` → используется для **buy-and-burn WBTCSTR** через Uniswap v4 (sell ETH→WBTCSTR + transfer to dead)

**Bot reward** за вызов `buyTokens()/sellTokens()`: по аналогии с PunkStrategy ≈ 0.01 ETH; точный размер хранится в иммутабельном arg или slot 0.

## 8. Распределение fee (10% total)

| Доля | Куда | Адрес |
|---|---|---|
| **8%** | `currentFees` proxy (накапливается до триггера bag-buy) | внутри proxy |
| **1%** | `feeAddress` хука для WBTCSTR | `0x23ddfb0c...e481c5a` (EOA) |
| **1%** | **buy-and-burn PNKSTR** | swap ETH→PNKSTR в `0xc50673ed...3edf` через Uniswap v4 → `0xdead` |

PNKSTR-burn механизм: hook через `_swapToEth` сначала конвертирует fee в ETH, потом через V4 Universal Router исполняет ETH → PNKSTR swap, и переводит результат на `0x000...dEaD`. PNKSTR address хранится в Factory как `PNKSTR_ADDRESS()` (подтверждено: вызов factory вернул `0xc50673ed...3edf`).

В **LINEASTR этот блок удаляется целиком** — fee split становится 8% protocol / 2% dev (см. `05-lessons-applied.md`).

## 9. Конструктор хука

```solidity
constructor(
    IPoolManager _poolManager,
    IPunkStrategy _punkStrategy,
    IERC20StrategyFactory _erc20StrategyFactory,
    address _feeAddress
)
```

В LINEASTR удалится параметр `_punkStrategy` — нет PNKSTR-зависимости.

## 10. Ключевые внутренние функции хука

(из outline на Etherscan)

| Функция | Назначение |
|---|---|
| `_beforeInitialize` | Валидация PoolKey, регистрация strategy ↔ poolId |
| `_afterAddLiquidity` | **Гарантирует, что ликвидность добавляется только через factory/strategy путь** (anti-rug — нельзя создать «теневой» пул с тем же hook) |
| `_afterSwap` | Главная логика: рассчитывает fee, вызывает `_processFees` |
| `_processFees` | Распределяет fee по адресам |
| `calculateFee` | Динамический buy fee (decay over time от launch) |
| `_swapToEth` | Конвертирует strategy-token из fee обратно в ETH через V4 router |
| `_getCurrentPrice` | TWAP-like чтение текущей цены через `StateLibrary` (`sqrtPriceX96`) |
| `updateFeeAddress`, `updateFeeAddressForCollection`, `adminUpdateFeeAddress` | Admin-side смена feeAddress |

## 11. Custom errors хука

```
ExactOutputNotAllowed       // запрет ExactOutput swaps (защита от расчёта fee)
HookNotImplemented
InvalidCollection
NotCollectionOwner
NotNFTStrategy
NotNFTStrategyFactoryOwner
NotPoolManager              // только PoolManager может звать hook callback
Reentrancy                  // ReentrancyGuard
```

В LINEASTR оставляем `ExactOutputNotAllowed`, `NotPoolManager`, `Reentrancy`, переименовываем NFT-related в `NotStrategy` / `NotStrategyFactoryOwner`.

## 12. Custom errors на ERC20Strategy proxy

```
AllowanceOverflow, AllowanceUnderflow, AlreadyInitialized,
BalanceMismatch, InputsError, InsufficientAllowance, InsufficientBalance,
InvalidInitialization, InvalidMultiplier, InvalidPermit, InvalidTransfer,
NewOwnerIsZeroAddress, NoETHToTwap, NoHandoverRequest, NoZeroBuys,
NotEnoughEth, NotFactory, NotForSale, NotInitializing, OnlyHook,
Permit2AllowanceIsFixedAtInfinity, PermitExpired, PriceTooHigh, PriceTooLow,
Reentrancy, TokensAlreadyPurchased, TotalSupplyOverflow, TwapDelayNotMet,
Unauthorized, UnauthorizedCallContext, UpgradeFailed
```

**Важные инварианты:**
- `TwapDelayNotMet` — guard от MEV-манипуляций ценой перед bag-buy
- `PriceTooHigh` / `PriceTooLow` — bounds на acceptable buy price
- `OnlyHook` — защита `_processFees` callback
- `NotFactory` — initialize только из factory
- `Permit2AllowanceIsFixedAtInfinity` — Solady-style permit2 интеграция

## 13. Events

```solidity
event HookFee(bytes32 indexed id, address indexed sender, uint128 feeAmount0, uint128 feeAmount1);
event Trade(address indexed nftStrategy, uint160 sqrtPriceX96, int128 ethAmount, int128 tokenAmount);
```

В LINEASTR переименовываем `nftStrategy` → `strategy`.

## 14. Параметры конфигурации (точные числа)

| Параметр | Значение | Источник |
|---|---|---|
| Total swap fee | **10%** | docs.tokenstrategy.com + UI |
| Fee split | 8% / 1% / 1% | docs + Bankless |
| Launch fee decay | 95% → 10% за 85 минут (1%/min) | NFTStrategy article |
| `priceMultiplier` | **1200** (= 1.2x) | proxy slot 4 |
| `bagSize` | **1,250,000** (= 0.0125 wBTC, 8 decimals) | `bagSize()` eth_call |
| Total supply | **1,000,000,000 × 10^18** | `totalSupply()` |
| `decimals` | 18 | |
| Burned (30.04.2026) | 108,029,706 WBTCSTR (~10.8%) | UI |
| Holdings (treasury) | 0.15 wBTC + 0.167 ETH | UI |
| Realized profit с launch | **+1.99 ETH** (12 завершённых циклов buy/sell) | UI |
| Bag-buy progress | 39.7% к следующему циклу | UI |
| `feeAddress` | `0x23ddfb0c...e481c5a` | hook `feeAddress()` |
| Owner | `0x019817ad...e8cb` | `owner()` |
| Compiler | Solidity 0.8.30+commit.73712a01, optimizer 200 runs, **Cancun** | Etherscan |
| LP fee in poolKey | `DYNAMIC_FEE_FLAG` (0x800000) | hook design |
| Tick spacing | 60 (стандартный для dynamic) | inferred |

## 15. Файлы verified-bundle (ERC20Strategy)

```
src/strategies/ERC20Strategy.sol        — main contract
src/strategies/BaseStrategy.sol         — abstract parent
src/Interfaces.sol                       — IPunkStrategy, IValidRouter, IERC20StrategyFactory
lib/solady/tokens/ERC20.sol             — Solady ERC20 (gas-efficient)
lib/solady/utils/SafeTransferLib.sol
lib/solady/utils/ReentrancyGuard.sol
lib/solady/utils/Initializable.sol
lib/solady/utils/UUPSUpgradeable.sol
lib/solady/auth/Ownable.sol
lib/solady/utils/LibClone.sol           — ERC1967 cloning с immutable args
lib/v4-core/...                          — Uniswap v4 core (interfaces, types, libraries)
lib/v4-periphery/...                     — Universal Router interface
lib/permit2/...                          — Permit2 interfaces
settings.json                            — foundry remappings
```

## 16. Файлы verified-bundle (ERC20StrategyHook)

Дополнительно к выше:
```
src/ERC20StrategyHook.sol               — main hook
lib/v4-periphery/src/utils/BaseHook.sol
lib/v4-periphery/src/utils/ImmutableState.sol
lib/v4-core/src/libraries/StateLibrary.sol
lib/v4-core/src/libraries/TickMath.sol
lib/v4-core/src/libraries/BitMath.sol
lib/v4-core/src/libraries/Position.sol
lib/v4-core/src/libraries/FullMath.sol
lib/v4-core/src/libraries/FixedPoint128.sol
lib/v4-core/src/libraries/LiquidityMath.sol
lib/v4-core/test/utils/CurrencySettler.sol
```

## 17. Что отсутствует в open-source

**ВАЖНО:** TokenWorks GitHub (`https://github.com/token-works`) НЕ публикует исходники ERC20Strategy / ERC20StrategyHook open-source. Полный source доступен только через Etherscan (verified standard JSON input). Это значит:
- Мы можем **прочитать** весь код с Etherscan
- **Нет лицензии** на использование как-есть (нужно либо ровно копировать с MIT-headers, либо переписывать клонируя архитектуру)
- Headers явно SPDX-License-Identifier: MIT — **формально код MIT**, можно использовать с атрибуцией

Сторонний community-разбор PunkStrategy v1: [github.com/bindoon/PunkStrategy](https://github.com/bindoon/PunkStrategy) (содержит большой PRD-документ с описанием механики).

## 18. Заметки по аудиту

- Etherscan: **«No Contract Security Audit Submitted»** (буквальная пометка)
- TokenWorks публично заявляли что **аудитов не делали**
- Косвенное упоминание `0xleastwood` после паузы 28.09.2025 (предположительно «no critical findings, minor fixes applied») — публичный отчёт **не найден**
- Custom errors `OnlyHook`, `NotFactory`, `TwapDelayNotMet`, `PriceTooHigh/Low` показывают, что TokenWorks учитывал MEV/manipulation, но без независимой проверки риски остаются.

## 19. Итоговое сравнение wBTCStrategy ↔ PunkStrategy v1

| Аспект | PunkStrategy v1 | wBTCStrategy (ERC20Strategy v3) |
|---|---|---|
| Главный контракт | `PunkStrategy` (monolith) | `ERC20Strategy` (proxy clone) |
| Hook contract | `PunkStrategyHook` (`0xfaaad5b7...e844`) | `ERC20StrategyHook` (`0x9f8f375b...0a444`) |
| VERSION() | 1 (implied) | **3** |
| Hook permissions | `beforeInitialize, afterInitialize, beforeAddLiquidity, beforeRemoveLiquidity, beforeSwap, afterSwap` | `beforeInitialize, afterAddLiquidity, afterSwap, afterSwapReturnDelta` |
| Fee collection | `beforeSwap` модифицирует input | `afterSwap + afterSwapReturnDelta` (новее, чище) |
| Underlying | ERC-721 (CryptoPunks) | ERC-20 (canonical wBTC) |
| Bag size | 1 NFT, dynamic по floor | Fixed `bagSize = 0.0125 wBTC` |
| Price multiplier | 2000 bps (2.0x) | **1200 bps (1.2x)** |
| Acquisition logic | `buyPunkAndRelist()` через CryptoPunks marketplace | `buyTokens()` swap ETH→wBTC через v4 + `list()` |
| Sale logic | Внешний buyer вызывает CryptoPunks buy | `sellTokens()` callback от buyer |
| Total fee | 1% в v1 (по PRD bindoon) | **10%** |
| Fee split | 80/20 (protocol/team) | 80/10/10 (8% protocol + 1% feeAddress + 1% PNKSTR-burn) |
| Cooldown | 48h после sale | dynamic decay buy fee from launch |
| PNKSTR burn integration | нет (PNKSTR — себе burner) | **есть** (через `IPunkStrategy` интерфейс) |
| Deployment pattern | Single deploy | Factory + ERC1967 clone |
| Compiler | 0.8.26 | 0.8.30 |
| Anti-rug | manual | `OnlyHook`, `NotFactory` modifiers + immutable args в clone |
| TWAP | minimal | `_getCurrentPrice` + `TwapDelayNotMet` error guard |

## 20. Etherscan ссылки

- WBTCSTR proxy: <https://etherscan.io/address/0x7af2a142c3486a9726791098e6415b768513e363#code>
- ERC20Strategy implementation: <https://etherscan.io/address/0xb1a3015b61e4eac9253a674c6942cdc5dd8de510#code>
- ERC20StrategyHook: <https://etherscan.io/address/0x9f8f375b2d246da6be816b453f13d43d8240a444#code>
- Factory: <https://etherscan.io/address/0x9f834e16b709c0781537186e7bb09de42a000a0a#code>
- nftstrategy.fun page: <https://www.nftstrategy.fun/strategies/0x7af2a142c3486a9726791098e6415b768513e363>

См. также `sources.md`.
