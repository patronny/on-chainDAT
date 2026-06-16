# 30. Инциденты TokenWorks и кривые фиксы

Полный реестр публично известных багов, эксплоитов и архитектурных дизайн-flaw'ов в экосистеме TokenStrategy. Все эти случаи учитываем **в исходном коде LDAT до деплоя**, а не как wrapper-ы поверх (как у TokenWorks).

## Дисклеймер по охвату

Что **не найдено** в публичных источниках (важно зафиксировать - это не значит, что багов нет, это значит, что они не публичны):
- Reentrancy в `beforeSwap` / `afterSwap` хуке TokenStrategy - публичный disclosure не найден
- Неверный `sqrtPriceX96` в hook - не найдено
- Drain treasury через подменённый pool - не найдено
- Proxy / upgradeability vulns - нерелевантно (контракты renounced на legacy-deployment'ах)
- Fee-on-transfer interaction bugs - не найдено
- DOS vectors - не найдено
- Реакции samczsun / pashov / spreekaway / DeFiHackLabs - не найдено
- Rekt.news статья - не публиковали (импакт ниже их $1M+ порога)
- Тех-postmortem от Rhynotic в Medium / Mirror / HackMD - не найдено

`0xleastwood` упомянут как «аудитор» после паузы 28.09.2025 («no critical findings, but minor fixes and improvements were applied») - но **публичный отчёт не существует**, только косвенное упоминание в Twitter-индексе.

## Инцидент 1 - PNKSTR ETH-drain bug + wrapper-фикс

| Поле | Значение |
|---|---|
| **Дата** | примерно 6-9 сентября 2025 (после launch 6 сент) |
| **Токен** | $PNKSTR |
| **Класс бага** | Auth check / withdraw helper |
| **Импакт** | $0 (whitehat-disclosure, не эксплуатировано) |

### Суть

Community-аудитор `@0xQuit` (Yuga Labs VP of Blockchain) обнаружил баг, через который теоретически можно было дренить ETH, накопленный в контракте PunkStrategy. Точные техдетали публично не раскрывались. Учитывая архитектуру (8% trade fee → внутренний баланс → автоматическая покупка floor Punk через CryptoPunks marketplace), наиболее вероятные классы бага:
- неверный auth check на внутреннем `buyPunk()` / `withdraw` хелпере
- неправильная проверка cost при вызове CryptoPunks `buyPunk(uint)` - позволяла бы передать минимальную цену, забрав излишек ETH
- проблема с `transferEther` / fallback - рефанд шёл вызывающему, а не контракту-владельцу

### Фикс (классический «костыль поверх контракта»)

> «A patch was developed quickly through a wrapper smart contract, thus avoiding the headaches of a token migration» (Bankless)

- **Базовый ERC-20 не менялся** (он renounced - ничего нельзя поменять)
- Сверху задеплоили wrapper-контракт, который теперь служит точкой входа для всей логики
- Старый контракт остался в торговле как сам ERC-20, но критичные функции в нём фактически больше не используются
- Это и объясняет ремарку из docs.tokenstrategy.com: **«Trades are NOT enforced through the hook»** для PNKSTR

### Урок для LDAT

🔴 **НЕ renounce ownership сразу.** Стартуем с non-renounced (ты выбрал этот вариант), сохраняем возможность патчить implementation через UUPS upgrade.

🔴 **Hook должен быть сменяемым через owner-only setter** (это уже есть в v3 как `updateHookAddress`).

🔴 **Все ETH-движения внутри контракта проходят через инвариант-чекер** (баланс до vs после, no-leftover-allowed).

## Инцидент 2 - Slow-rug на 181.706 ETH ($813K) ⚠️ САМЫЙ ВАЖНЫЙ

| Поле | Значение |
|---|---|
| **Дата** | 20 сентября 2025, ~3 часа после launch |
| **Токен** | $APESTR, $PUDGYSTR, $MOONSTR/$BIRBSTR, $MEEBSTR, $DICKSTR (5 токенов одновременно) |
| **Класс бага** | Дизайн-flaw + ops-omission |
| **Импакт** | **181.706 ETH ≈ $813,400** ушло из protocol treasury 5 strategies в одного актора |
| **Адрес арбитражёра** | `0xa3d297423b17a3894dddd582dc41ff20e237ab75` |

### Суть

**Архитектура anti-snipe:** buy fee стартует с **95%** и убывает на 1%/мин до 10% resting. На пиковом интересе пул накопил больше ETH, чем нужно для floor NFT соответствующих коллекций.

**Архитектурное отличие от PNKSTR:** у CryptoPunks есть on-chain marketplace (`buyPunk`), а у других коллекций - нет. Поэтому покупка NFT не происходила автоматически из контракта, а должна была триггериться внешне (бот, вызов trigger-функции).

**Команда не задеплоила бот** под эти 5 токенов.

В итоге внешний арбитражёр за 3 часа купил 10 BAYC, 7 Moonbirds, 5 Pudgy Penguins, 4 Meebits и продал их в стратегии (использовав raised fee floor strategy buying), извлёк дельту между real floor и накопленным пулом стратегии - нетто **181.706 ETH ≈ $813,400** прибыли.

### Фикс (тоже снаружи)

- Tweet Rhynotic: «We're fixing the frontend, but there's no exploit. The fees pooled up fast, and bots took the arb. Sadly the frontend "Buy Target NFT" button would have helped prevent this... Back to fixing»
- **0xQuit** лично написал и задеплоил приватный bot для запуска `buyTarget` сразу при достижении floor
- В контракт ничего не пушили - снова костыль снаружи: фронтенд + бот

### Математика slow-rug - почему именно `buyIncrement` критичен

Источник: [`BaseStrategy.getMaxPriceForBuy`, `availableFunds`](../research/tokenworks-sources/src_strategies_BaseStrategy.sol).

```
getMaxPriceForBuy() = (block.number - lastBuyBlock + 1) * buyIncrement
availableFunds()    = min(currentFees, getMaxPriceForBuy())
```

Бот хочет получить **максимальный `availableFunds`** при условии, что `availableFunds > marketPrice(bagSize)`. Профит за один вызов:

```
profit = availableFunds - marketPrice(bagSize) - gas
```

После вызова `lastBuyBlock = block.number` - потолок сбрасывается. Бот получает прибыль **только когда успевает дождаться роста потолка выше рынка**, и эта прибыль ограничена `min(currentFees, getMaxPriceForBuy)`.

**Сравнение режимов:**

| Параметр | NFTStrategy gen-2 (slow-rug 20.09.2025) | WBTCSTR gen-3 | LDAT (наши параметры) |
|---|---|---|---|
| `buyIncrement` | низкий (~0.001-0.01 ETH/блок) | **0.1 ETH/блок** | **0.02 ETH/блок** |
| Block time | 12 секунд (mainnet) | 12 секунд | **3 секунды (Linea)** |
| `bagSize` стоимость | ~5 ETH (флор пунка) | 0.54 ETH | **0.236 ETH** |
| Catch-up time потолка до bagSize | часы → дни | 5.4 блока ≈ 65 сек | **12 блоков ≈ 36 сек** |
| Окно накопления премии | большое | минимальное | **минимальное** |
| Single-bot risk | **критический** | низкий | **низкий** |

**Цифры атаки 20.09.2025:** 181.706 ETH ушло одному арбитражёру за ~3 часа на 5 токенах одновременно ⇒ ~12.1 ETH/час/токен. При предполагаемом `buyIncrement ≈ 0.005 ETH` потолок за час набирал ~1.5 ETH - но `currentFees` копился ещё быстрее (high initial fee curve = 99→10% сжимало сотни ETH в treasury за минуты). Это и был пробой.

**WBTCSTR-фикс** - подняли `buyIncrement` до 0.1 ETH/блок. На рынке 0.0125 wBTC = 0.3 ETH ⇒ потолок догоняет рынок за 3 блока ≈ 36 секунд.

**LDAT подход:** `buyIncrement = 0.02 ETH/блок` × Linea 3-сек блоки = **6.67 ETH/мин потенциального роста потолка**. На bagSize 0.236 ETH catch-up = **12 блоков ≈ 36 сек** (тот же эквивалент, что и WBTCSTR на mainnet).

### Уроки для LDAT

🔴 **Bot для buy-target - обязательно с launch.** 2 бота (active + standby), capital 3 ETH суммарно (см. [`50-lineadat-spec.md`](50-lineadat-spec.md)).

🔴 **Buy fee curve копируем v3 точно (99% → 10% за 89 минут).** Ты выбрал этот вариант для траста копии. Это держим под защитой высокого `buyIncrement` + бота.

🔴 **Per-tx ceiling уже встроен в v3** через `getMaxPriceForBuy` (формула: `(blocks+1) × buyIncrement`).

## Инцидент 3 - SquiggleStrategy NFT-swap exploit ⚠️

| Поле | Значение |
|---|---|
| **Дата** | 28 сентября 2025 |
| **Токен** | SquiggleStrategy |
| **Класс бага** | **Implementation bug** - неверная валидация поступающего NFT |
| **Импакт** | Утечка ценных Chromie Squiggles из treasury (десятки ETH eq); replaced на дешёвые "Day One AB: Genesis", "Construction Token" |

### Суть

Атакующий нашёл, что контракт SquiggleStrategy позволял **swap NFT внутри стратегии** - отдать стратегии низкоценный NFT, забрать высокоценный Chromie Squiggle, удерживаемый стратегией.

**Корень бага:** Chromie Squiggles, Day One AB и Construction Token шарят **один и тот же ERC-721 контракт** Art Blocks Curated (`0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a`). У Art Blocks все Curated проекты - токены одного ERC-721, отличаются только диапазоном `tokenId` (`projectId * 1_000_000 + mintNumber`).

Стратегия валидировала «принимаемый NFT» **по адресу контракта, а не по `(contract, projectId)` паре**. Атакующий слал в стратегию ID из коллекций «Day One AB» / «Construction Token» (другой projectId, но тот же contract), стратегия принимала их как «valid Squiggle» и отдавала настоящий Squiggle взамен.

### Фикс

- Через X: «We are actively investigating an exploit on the SquiggleStrategy contract. All other strategies remain unaffected»
- Пауза остальных NFTStrategy токенов на «аудит»
- В контракт-фикс не пошли (SquiggleStrategy renounced); strategy фактически списан как dead

### Уроки для LDAT

🟢 **Для LDAT этот баг неприменим напрямую** - underlying у нас ERC-20 (`$LINEA`), там нет projectId-внутри-contract проблемы.

🔴 **Но принцип шире:** валидация underlying должна быть строгой. Проверяем `address(underlying) == LINEA_ADDRESS` immutable-константой при initialize и при каждой fee-обработке.

🔴 **Если underlying - fee-on-transfer токен, rebase-токен или blacklist-токен**, наш код должен detection'ить это и отказывать. $LINEA - стандартный non-rebasing ERC-20 без fee-on-transfer (verified из source `L2LineaToken` на Lineascan).

🔴 **Slither + Aderyn + manual review** - критичная финальная очередь. Этот класс бага ловится Slither за минуту.

## Инцидент 4 - High initial fee window (95-99%): структурная уязвимость

| Поле | Значение |
|---|---|
| **Дата** | хроническое (с 20.09.2025 и далее на каждом launch) |
| **Токены** | все strategies, использующие decay-fee schedule |
| **Класс бага** | Дизайн-flaw |
| **Импакт** | См. Инцидент 2 |

### Суть

Согласно `docs.tokenstrategy.com`: «Buy tax starts at 99% and decreases 1% per minute to prevent sniping». Источники сообщают разные числа - 95% (первый батч NFTStrategy), затем 99% (TokenStrategy permissionless). Декей -1%/мин до 10%.

Это **не привычный anti-snipe**: за 89 минут fee → 10%, и весь этот период любая покупка платит огромный fee, который мгновенно идёт в treasury. Это и привело к Инциденту 2.

### Урок для LDAT

🟡 **Ты выбрал копию 99% → 10% за 89 минут** для траста. Это допустимо при условиях:
- `buyIncrement = 0.02 ETH/блок` высокий ⇒ потолок быстро догоняет
- Свой bot активен с launch (2 бота, 3 ETH капитала)
- Frontend-кнопка «Buy Target $LINEA» доступна с момента deploy

Если эти 3 условия выполнены - slow-rug математически почти невозможен. Если хоть одно отвалится - повторим инцидент 20.09.2025.

## Инцидент 5 - PNKSTR без хука: fees enforced ONLY off-contract

| Поле | Значение |
|---|---|
| **Класс** | Архитектура pre-v2 |
| **Импакт** | Trade на любом не-Uniswap DEX обходит fee целиком |

### Суть

PNKSTR деплоился до того, как TokenWorks ввели Uniswap v4 hook. Trade fee enforcement был полностью off-contract: docs.tokenstrategy.com открыто пишет «Trades are NOT enforced through the hook». На практике любой DEX, отличный от их Uniswap pool, не платит fee - это значит arbitrage-маршруты обходят treasury.

### Фикс

С v2 (REKTSTR) и v3 (WBTCSTR) - все trade fees enforced через Uniswap v4 hook. Любой swap в их pool платит fee (через `_afterSwap`).

### Урок для LDAT

🟢 **Уже встроено в v3 ⇒ копируем как есть.** Hook permissions = `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta`.

⚠️ **Но это работает только в нашем pool.** Если кто-то создаст shadow-pool LDAT/USDC на каком-то DEX - там fee не работает. Мы не можем этого предотвратить (open ERC-20), но можем не давать ликвидность таким shadow pools.

## Сводная таблица

| Инцидент | Дата | Токен | Класс | Импакт | Реальный фикс | Что делаем в LDAT |
|---|---|---|---|---|---|---|
| 1 | 6-9 сент 2025 | PNKSTR | auth check / withdraw | $0 (whitehat) | Wrapper контракт поверх | Non-renounced owner + UUPS proxy → можем патчить |
| 2 | 20 сент 2025 | 5 NFTStrategy | slow-rug дизайн | **$813K** в одного | Frontend + private bot | 2 наших бота с launch + высокий `buyIncrement` 0.02 ETH/блок |
| 3 | 28 сент 2025 | SquiggleStrategy | NFT validation | десятки ETH | Strategy брошен | N/A для ERC-20; valid `address(underlying)` immutable |
| 4 | хронический | все NFTStrategy | high initial fee | См. инцидент 2 | Bot + frontend | Копия 99→10% защищена ботом + `buyIncrement` |
| 5 | архитектура | PNKSTR | fees off-contract | obfuscated | Введение hook в v2/v3 | Hook with `afterSwap` (как v3) |
