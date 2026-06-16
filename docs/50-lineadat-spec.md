# 50. LDAT - Финальная спецификация

Это **залоченная** спека. Все параметры одобрены пользователем (1 мая 2026). Любые изменения - через явный `git rm` + новая ревизия этого документа.

## 1. Идентификатор и базовая семантика

| Поле | Значение |
|---|---|
| **Token name** | `LDAT` |
| **Token symbol** | **`LDAT`** | (deployed symbol is all-caps; `name` stays `LDAT`)
| **Decimals** | 18 |
| **Total supply** | 1 000 000 000 × 10¹⁸ |
| **Underlying** | $LINEA `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04` (canonical L2 token, 18 dec, не fee-on-transfer, не rebase) |
| **Network** | Linea L2 (chainId 59 144) |
| **Версия архитектуры** | ERC20Strategy v3 forked, MIT-attributed |

## 2. Ключевые параметры (final-locked)

| Параметр | Значение | Обоснование |
|---|---|---|
| `bagSize` | **150 000 LINEA** = 150 000 × 10¹⁸ | $546 ≈ 0.236 ETH; 1.97% TVL топ-пула, slippage ~2%, см. §6 |
| `buyIncrement` | **0.005 ETH/блок** = 5 × 10¹⁵ wei (IMMUTABLE, set in initialize) | catch-up bagSize ≈ 47 блоков при Linea ~2-сек блоках; замедлен с 0.02 чтобы растянуть slow-rug ramp |
| `priceMultiplier` | **1200** (= 1.2× markup) | копия v3, бот зарабатывает 20% премию |
| `twapIncrement` | **0.05 ETH** = 5 × 10¹⁶ wei | conservative для тонкого пула, поднимаем `setTwapIncrement` руками когда пул вырастет |
| `twapDelayInBlocks` | **4** (= 12 секунд на Linea) | защита от same-block sandwich MEV; эквивалент mainnet `1×12с` |
| `STARTING_BUY_FEE` | **9 900** bps (99%) | копия v3 |
| `DEFAULT_FEE` | **1 000** bps (10%) - buy after decay AND sell всегда | копия v3 |
| Buy-fee decay rate | **−100 bps/мин** | копия v3, плато за 89 мин |
| Fee split (technical) | **80% / 10% / 10%** = treasury / LDAT-burn / creator | копия v3, см. §3 |
| Fee split (effective for $LDAT self-launch) | **80% / 20%** = treasury / creator | edge-case: LDAT-burn redirected в feeAddress пока collection == LDAT_ADDRESS |

## 3. Fee split - точная логика

Источник для модификации: [`research/tokenworks-hook/ERC20StrategyHook.sol:_processFees`](../research/tokenworks-hook/ERC20StrategyHook.sol).

### Patch v3 → LDAT версия

```solidity
// LDAT-version of _processFees:
function _processFees(address collection, uint256 feeAmount) internal {
    if (feeAmount == 0) return;

    uint256 depositAmount   = (feeAmount * 80) / 100;     // 80% всегда treasury
    uint256 lineaDATAmount  = (feeAmount * 10) / 100;     // 10% LDAT-burn (renamed from PNKSTR)
    uint256 ownerAmount     = feeAmount - depositAmount - lineaDATAmount;  // 10% creator

    // === EDGE CASE: для самого LDAT-токена 10% LDAT-burn redirected в feeAddress ===
    if (collection == LDAT_ADDRESS) {
        // На самом $LDAT жгать самого себя через factory некуда
        // → отправляем в feeAddress (creator), эффективный split 80/20
        SafeTransferLib.forceSafeTransferETH(feeAddress, lineaDATAmount);
    } else {
        // Для будущих strategies на Linea: 10% → factory → swap ETH→LDAT → 0xdead
        SafeTransferLib.forceSafeTransferETH(address(strategyFactory), lineaDATAmount);
    }

    // 10% creator (или плюсуется к treasury если feeAddressClaimedByOwner=0)
    address feeRecipient = feeAddressClaimedByOwner[collection];
    if (feeRecipient == address(0)) {
        depositAmount += ownerAmount;
    } else {
        SafeTransferLib.forceSafeTransferETH(feeRecipient, ownerAmount);
    }

    INFTStrategy(collection).addFees{value: depositAmount}();
}
```

### Что нужно установить при initialize

`feeAddressClaimedByOwner[LDAT_PROXY] = 0x6e0d01089976093680c881CcDcB79e0D046e2433` (наш feeAddress).

⚠️ **Если не установить** - ownerAmount сольётся в treasury (как у WBTCSTR), creator получит 0 от sell-fees. Это **обязательный шаг** в deployment runbook.

### Эффективные схемы

**Для $LDAT (self-launch):**
- 80% treasury (через `addFees`)
- 10% creator (LDAT-burn redirect)
- 10% creator (`feeAddressClaimedByOwner` → feeAddress)
- = **80% treasury / 20% creator**

**Для будущего токена `$XYZSTR` (например $ETHSTR на Linea):**
- 80% treasury (накапливает ETH под выкуп ETH-bag - ну, фигурально, под underlying)
- 10% LDAT-burn (factory → ETH→LDAT swap → dead)
- 10% creator
- = **80% treasury / 10% LDAT-burn / 10% creator**

Это **общий код**, поведение зависит от того, какой токен запущен. Это и есть «база для следующих токенов на Linea».

## 4. Initial pool (single-sided seed)

| Параметр | Значение |
|---|---|
| PoolKey.currency0 | `0x0000000000000000000000000000000000000000` (native ETH) |
| PoolKey.currency1 | `LDAT_PROXY_ADDRESS` (TBD после deploy) |
| PoolKey.fee | `0x800000` (DYNAMIC_FEE_FLAG) |
| PoolKey.tickSpacing | 60 |
| PoolKey.hooks | `LDAT_HOOK_ADDRESS` (TBD после CREATE2 mining) |
| Initial sqrtPriceX96 | калибруется под `1 ETH ≈ 40 000 000 LDAT` (currentTick ≈ +175 052 при 18-decimal обоих сторон) |
| Initial price 1 LDAT | ≈ $0.0001 (при ETH=$2 317) |
| Initial FDV | ≈ $100 000 |
| ModifyLiquidity range | tickLower = −887 220, tickUpper ≈ +175 020 (32 тика ниже initial tick для single-sided lock) |
| Liquidity reserves | 0 ETH + ~1 000 000 000 LDAT (минус ~1k wei на rounding) |
| LP-NFT (PositionManager) | tokenId TBD → minted to `0x000…dEaD` сразу |

**Точный sqrtPriceX96** при ETH ≈ $2 317 на момент launch будет пересчитан скриптом deploy: цель - initial price `1 LDAT = (target_FDV $100k) / 1B / ETH_price = $0.0001 / $2 317 = 4.3 × 10⁻⁸ ETH = 4.3 × 10¹⁰ wei = 1 LDAT / 23 165 248 ETH-units`.

`sqrtPriceX96 = sqrt(token1/token0) × 2⁹⁶`. Если `token1/token0 = 23 165 248` (LDAT per ETH), то `sqrtP = 4 813.03`, `sqrtPriceX96 = 4 813.03 × 2⁹⁶ ≈ 3.81 × 10²⁹`. Сценарий пересчитаем точно в момент deploy под текущий ETH price.

## 5. Bot architecture

### 5.1 Deployment

| Компонент | Технология | Хост |
|---|---|---|
| **Bot A** (primary) | Node.js 22 + TypeScript + viem v2 | fly.io EU region (Frankfurt) |
| **Bot B** (standby) | identical | fly.io US region (Ashburn) |
| **Heartbeat / failover** | fly.io healthcheck → автоматический перезапуск; Discord webhook alert при > 5 минут downtime | |
| **Monitoring** | Discord webhook (real-time logs) + simple dashboard на Vercel (read-only RPC) | |

### 5.2 Working capital

| Бот | ETH на кошельке (старт) |
|---|---|
| **Bot A** | **2 ETH** (≈$4 634) |
| **Bot B** (standby) | **1 ETH** (≈$2 317) |
| **Total upfront** | **3 ETH** ≈ **$6 951** |

При успешном steady-state капитал растёт (каждый цикл +0.04 ETH профита). Если упадёт ниже **0.5 ETH** на боте - Discord alert, ты доливаешь с holdings.

### 5.3 Bot algorithm (псевдокод)

```typescript
async function tick() {
  const fees     = await read('currentFees', LDAT_PROXY);
  const maxBuy   = await read('getMaxPriceForBuy', LDAT_PROXY);
  const avail    = min(fees, maxBuy);

  // Quote $LINEA price через aggregator (Lynex / Etherex / KyberSwap / Odos)
  const linePrice = await bestQuote('LINEA', 'WETH', BAG_SIZE_LINEA);  // ETH per bag
  const breakeven = linePrice + GAS_BUFFER;                             // ~0.005 ETH gas

  // Conservative mode: 10% buffer вместо 5% (риск меньше, циклы реже)
  if (avail >= breakeven * 1.10) {
    // Atomic-ish (multicall если поддерживается, иначе 2 raw txs):
    await buy_LINEA_via_aggregator(BAG_SIZE_LINEA);
    await approve(LINEA, LDAT_PROXY, BAG_SIZE_LINEA);
    await call('buyTokens()', LDAT_PROXY);
    log(`+cycle profit ≈ ${avail - linePrice} ETH`);
  }
}

setInterval(tick, BLOCK_TIME_MS);  // 3000ms
```

### 5.4 Failover logic

- Bot B каждые 60 секунд читает `lastBuyBlock` через RPC. Если за **3 минуты** `lastBuyBlock` не двигался **И** `availableFunds() ≥ marketPrice × 1.10` (= условие срабатывания) - это значит Bot A молчит. Bot B берёт работу.
- При возвращении Bot A: оба видят что `lastBuyBlock` свежий, оба возвращаются к нормальному режиму (B ждёт триггера).

## 6. Frontend

| Параметр | Значение |
|---|---|
| **Стек** | Next.js 15 (App Router) + wagmi v2 + RainbowKit + viem + TailwindCSS |
| **Хостинг** | Vercel (free tier) |
| **Domain** | `on-chaindat.com` (already secured 2026-05-05) (купишь за неделю до launch на GoDaddy) |
| **Структура** | одностраничник: hero (price + supply + burned + treasury holdings) → swap card (ETH↔LDAT через UniversalRouter V2_1_1) → **Actions card** (3 кнопки, см. §6.1) → recent trades feed → footer |
| **Дизайн** | 3 варианта на выбор: (a) Linea-style blue, (b) dark/neon, (c) academic minimalism. Финальный выбор перед mainnet deploy |

### 6.1 Actions card (точная копия паттерна tokenstrategy.com + одна наша добавка)

Три кнопки в один блок:

```
┌─────────────────────────────────────────────────────┐
│ Actions                                              │
├─────────────────────────────────────────────────────┤
│ [1] Sell $LINEA → Strategy                          │
│     Step 1: Approve $LINEA                          │
│     Step 2: Sell 150 000 LINEA, get X.XX ETH        │
│     (показывает premium: «+0.05 ETH vs Etherex»)    │
├─────────────────────────────────────────────────────┤
│ [2] Buy bag at 1.2× from Strategy  ← наша добавка   │
│     Best deal: bag #N, 150 000 LINEA for 0.45 ETH  │
│     (показывает: «save $X vs market price»)         │
│     disabled if no profitable bag available         │
├─────────────────────────────────────────────────────┤
│ [3] Burn LDAT (+0.5% reward)                    │
│     если ethToTwap = 0 → disabled «No ETH to Burn»  │
│     иначе active: «Burn min(ethToTwap, 0.05) ETH»  │
└─────────────────────────────────────────────────────┘
```

**Кнопка 1 - Sell $LINEA → Strategy.** Эквивалент `Approve $WBTC + buyTokens()` у TokenWorks (см. их UI на скрине пользователя). Двухшаговый flow:
- Step 1 (`approve`): `LINEA.approve(LDAT_PROXY, 150_000e18)` - разово.
- Step 2 (`buyTokens`): вызов `LDAT_PROXY.buyTokens()` - контракт вытягивает 150k LINEA, платит `availableFunds()` ETH юзеру.
- UI live-читает: `availableFunds` из proxy, `marketPrice(150 000 LINEA)` через GeckoTerminal API + Etherex/Lynex quote, выводит **premium** = разницу. Если premium ≤ 0 - кнопка показывает «Not profitable yet - wait for fees to accumulate» (не disabled, юзер может всё равно нажать).

**Кнопка 2 - Buy bag at 1.2× from Strategy.** Эквивалент `sellTokens(bagId)` - это **наша добавка** (у TokenWorks этого нет в виде отдельной кнопки, у них сделано через список bag'ов). UI:
- Читает `lastBagId`, потом для каждого `bagId in [1..lastBagId]` вызывает `onSale[bagId]` (read-only).
- Фильтрует non-zero (= active bag'и в листинге).
- Считает «у какого `listPrice / 150 000 LINEA` ниже текущей рыночной цены $LINEA» → выводит топ-1.
- Кнопка вызывает `LDAT_PROXY.sellTokens{value: listPrice}(bagId)` - контракт отдаёт 150k LINEA, юзер платит ровно `listPrice`.
- Если все bag'и невыгодны - кнопка disabled с tooltip «No profitable bag - market price is below Strategy listings».
- Это **frontend-эквивалент `0xca60e8f0`** (sell-side bag-buyer на WBTCSTR, 77% всех `sellTokens()`). Привлекает органических покупателей $LINEA через стратегию.

**Кнопка 3 - Burn LDAT (+0.5% reward).** Точная копия паттерна WBTCSTR. UI:
- Live-читает `ethToTwap` из proxy.
- Disabled если `ethToTwap == 0n` с подписью «No ETH to Burn - wait for next bag-sale».
- Active иначе: «Burn `min(ethToTwap, 0.05) ETH` → buys & burns ≈ X LDAT. Reward: `0.5% × min(ethToTwap, 0.05)` ETH ≈ $0.5».
- Вызывает `LDAT_PROXY.processTokenTwap()`.

### 6.2 Live data feed

Источники для всех чисел в UI:
- On-chain (через wagmi/viem, частота: на каждый block через `watchBlocks`):
  - `currentFees`, `ethToTwap`, `lastBuyBlock`, `lastBagId`, `availableFunds()`, `getMaxPriceForBuy()` - proxy slots
  - `LINEA.balanceOf(LDAT_PROXY)` - treasury inventory
  - `totalSupply()` − `balanceOf(0xdead)` - circulating supply (показатель «сколько уже сожжено»)
  - `onSale[bagId]` для всех active bag'ов
- Off-chain (REST polling каждые 30 секунд):
  - GeckoTerminal `/api/v2/networks/linea/tokens/0x1789e004…bb04/pools` - текущая цена $LINEA для расчёта premium
  - DefiLlama `/coins.llama.fi/prices/current/coingecko:ethereum` - ETH-USD для конвертации

## 7. Owner и admin policy

| Поле | Значение |
|---|---|
| **Owner** | **`0x1470c542D60e83EcCFE005332f5789Bd669D027C`** (Keycard EOA пользователя, EIP-55 verified, fresh nonce=0 на Ethereum + Linea на момент 2026-05-01) |
| **`feeAddress`** | **`0x6e0d01089976093680c881CcDcB79e0D046e2433`** |
| **Renounce** | **«Никогда» с возможностью в любой момент** - на старте non-renounced, при необходимости (например, если найдут критичный баг и мы успешно его пофиксили) renounce делается одной транзакцией `transferOwnership(0xdead)` или `renounceOwnership()` |
| **Admin functions, доступные owner** | `updateHookAddress`, `setDistributor`, `_authorizeUpgrade` (UUPS), `setPriceMultiplier` (через factory), `updateBagSize` (только пока `lastBagId == 0`), `setTwapIncrement` (планируется добавить как `onlyOwner` setter поверх v3) |
| **Pre-launch checklist owner-кошелька** | (1) ≥ 0.05 ETH на Linea для газа deploy + initialize + post-init настроек; (2) ключ хранится только на Keycard, **никогда** не загружается на хост-серверы; (3) для каждой admin-tx - ручная подпись через Keycard ↔ MetaMask flow |

## 8. Что нужно изменить в v3-сурсах для LDAT

Список конкретных правок относительно [`research/tokenworks-sources/`](../research/tokenworks-sources/) и [`research/tokenworks-hook/`](../research/tokenworks-hook/):

### `BaseStrategy.sol`
- [ ] Добавить MIT-header `// Based on TokenWorks ERC20Strategy v3 (MIT). Original: token.works`
- [ ] Сменить `GLOBAL_DISTRIBUTION_HANDLER` (на mainnet hardcoded `0xDf99…9B2D`) - на адрес для Linea **или ноль** (в коде есть fallback `block.chainid == 1 ? CONST : globalDistributor`, для Linea будет использоваться `globalDistributor` storage var, который owner устанавливает через `setGlobalDistributor`)
- [ ] Добавить `setTwapIncrement(uint256)` `onlyOwner` setter (нужен для раскачки twapIncrement когда пул вырастет; в v3 такого нет - нужно добавить аккуратно)
- [ ] **Storage layout не меняем** - все поля в том же порядке для совместимости с indexer'ами

### `ERC20Strategy.sol`
- [ ] Добавить MIT-header
- [ ] `VERSION()` → возвращает 3 (мы форкаем v3, не делаем 4)
- [ ] Логика `buyTokens` / `sellTokens` / `list` / `updateBagSize` - без изменений

### `ERC20StrategyHook.sol`
- [ ] Добавить MIT-header
- [ ] Переименовать `IPunkStrategy punkStrategy` → `address lineaDATAddress`
- [ ] В `_processFees`:
  - переименовать `pnkstrAmount` → `lineaDATAmount`
  - добавить ветку `if (collection == lineaDATAddress) { send to feeAddress } else { send to factory for buy-and-burn }`
- [ ] Переименовать ошибки `NotNFTStrategy` → `NotStrategy`, `NotNFTStrategyFactoryOwner` → `NotStrategyFactoryOwner`
- [ ] Переименовать event `Trade.nftStrategy` → `strategy`

### Factory (новый, наш - TokenWorks factory не используем)
- [ ] Свой минимальный factory, deploy LDAT proxy + hook + initialize pool + seed liquidity + send LP-NFT в dead. Инспирация - TokenWorks Factory `0x9f834e16…000a0a`, но мы не клонируем launchpad-логику (нам не нужен `ownerLaunchStrategy` permissionless flow).
- [ ] Factory держит `LDAT_ADDRESS` immutable - после первого deploy он зафиксирован
- [ ] Factory имеет логику для buy-and-burn LDAT (получает ETH из hook через `forceSafeTransferETH`, свопает ETH→LDAT через UniversalRouter V2_1_1, шлёт на dead) - это используется только на будущих strategies, не на самом LDAT

## 9. Параметры для `initialize()`

```solidity
// Deploy script - псевдокод
LineaDATStrategy proxy = factory.deployStrategy({
    underlying:        0x1789e0043623282D5DCc7F213d703C6D8BAfBB04,  // $LINEA
    bagSize:           150_000 * 1e18,                              // 150 000 LINEA
    hook:              minedHookAddress,                            // CREATE2-mined
    tokenName:         "LDAT",
    tokenSymbol:       "LDAT",
    buyIncrement:      0.005 ether,                                 // 5 × 10¹⁵ wei (immutable)
    owner:             ownerKeycardEOA
});

// После initialize:
hook.adminUpdateFeeAddress(
    address(proxy),
    0x6e0d01089976093680c881CcDcB79e0D046e2433  // feeAddressClaimedByOwner[LDAT] = creator
);

proxy.setPriceMultiplier(1200);   // 1.2× markup (default уже 1200, но фиксируем явно)
// twapIncrement default = 1 ETH в v3, нам нужно 0.05 ETH - добавляем setter:
proxy.setTwapIncrement(0.05 ether);
proxy.setTwapDelayInBlocks(4);    // 12 секунд на Linea
```

## 10. Безопасность - чек-лист до deploy

- [ ] **Slither** на все .sol файлы - 0 high/medium findings
- [ ] **Aderyn** - 0 high findings
- [ ] **Foundry tests** - 100+ scenarios:
  - happy path: buy → sell → buy-and-burn cycle
  - bot front-running: 2 ботов на одном блоке, конкуренция
  - slow-rug attempt: bot ждёт N блоков, проверяем, что `availableFunds` → bound by `currentFees`
  - sandwich attack на `processTokenTwap`
  - re-entrancy через ERC-777 underlying - но `$LINEA` не ERC-777, ок
  - empty pool: вызов `buyTokens` / `sellTokens` / `processTokenTwap` когда баланс 0
- [ ] **Manual review** Adam Lizek's mistakes из [`30-tokenworks-incidents.md`](30-tokenworks-incidents.md):
  - feeAddressClaimedByOwner установлен ✓
  - bot deployed before launch ✓
  - frontend «Buy Target $LINEA» button готова ✓
- [ ] **Anvil fork test** - 1000 циклов в ускоренной симуляции (jump 100 блоков, mine, проверка инвариантов)
- [ ] **Base Sepolia public test** - минимум 7 дней, ты тестируешь UI с реального Keycard

## 11. Live benchmark from prototypes (как калибровать ожидания)

Данные RPC-сканом 2026-05-01 (см. [`research/raw-rpc-data/`](../research/raw-rpc-data/)):

### WBTCSTR (108 дней с launch, наш основной прототип)

| Метрика | WBTCSTR | LDAT target (90 дней) | Обоснование |
|---|---|---|---|
| Cycles `buyTokens` (bag-creates) | 34 | **≥ 45** | наш bot активнее с launch + Linea быстрее (3с vs 12с блоки) |
| Cycles `sellTokens` (bag-sales) | 22 (= 65% от buy) | **≥ 35** (= 78%) | наш UI с кнопкой «Buy bag at 1.2×» делает sell-flow видимым органическим юзерам |
| Active bag inventory (unsold) | 12/34 = 35% | **≤ 22%** | sell-side кнопка должна уменьшить «застой» |
| `processTokenTwap` cycles | 24 | **≥ 30** | reward ($0.5/click на Linea) делает callable рандомными юзерами |
| Realized protocol profit (ListPrice − PaidPrice) | +1.99 ETH | **≥ +1.5 ETH** | bagSize в 2× меньше у нас, поэтому абсолютная сумма ниже, но cycle frequency выше |
| Avg cycles/day | 0.31 | **≥ 0.5** | |
| Avg margin/cycle | +0.090 ETH | **+0.045 ETH** | пропорционально bagSize (0.236 vs 0.45 ETH) |

### Bot leaderboard на WBTCSTR (для сравнения нашего бота)

| Bot | Calls | Доля | Архитектура |
|---|---|---|---|
| `0xaf682de1...11f7d` | 13 (38%) | smart-contract bot, профит выводится сразу (баланс 0 ETH) |
| `0xc31a49d1...1c649` | 3 (9%) | smart-contract bot, держит 19.93 ETH капитала |
| `0x00000f91...0cac` | 3 (9%) | smart-contract bot (vanity) |
| `0xe08d97e1...d015` | 2 (6%) | smart-contract bot |
| 13 разных EOA | 1 каждый (38% в сумме) | random users через UI |

**Вывод:** на WBTCSTR доминирует **smart-contract bot pattern** (62% всех циклов от 4 bot'ов). Наши 2 EOA-бота на старте будут проще, но менее эффективны. План: **в version 2 ботов** перейти на smart-contract pattern (как `0xaf682de1`) - flashbot-like, atomic swap+buyTokens в одной tx.

### Sell-side benchmark

`0xca60e8f0...aa76` купил **17 из 22 bag'ов** (77%) на WBTCSTR за 9.67 ETH. Это **главный sell-side арбитражёр**, который скорее всего использовал список bag'ов через TokenWorks UI. Наша кнопка #2 (`Buy bag at 1.2×`) должна **демократизировать** этот flow для random юзеров.

### Что это значит финансово

При параметрах WBTCSTR-baseline на дистанции 90 дней мы прогнозируем для LDAT (после моих корректировок):

- **Treasury growth:** ≥ 1.5 ETH realized profit + 8 × bagSize ≈ 1.2M LINEA в inventory ⇒ **~$2 800 USD в treasury**
- **Burn cumulative:** ≥ 30 × 0.04 ETH × 2.5M LDAT/ETH ≈ **3M LDAT сожжено** = 0.3% supply
- **Bot ROI (наш):** +1.5 ETH / 3 ETH capital = **+50%** за 90 дней - это **достаточно** чтобы покрыть hosting + газ и ещё иметь margin

⚠️ **Предупреждение:** эти цифры основаны на **WBTCSTR baseline**, который сам по себе - относительно мёртвый рынок (0.31 цикла/день). Если LDAT получит **больше** интереса (волна meme-buyers, листинг на CEX, etc.) - числа вырастут на ×3-10. Если **меньше** (как REKTSTR, 3 цикла за 5 месяцев) - flywheel будет почти стоять.
