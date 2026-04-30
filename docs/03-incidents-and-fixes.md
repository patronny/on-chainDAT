# 03. Инциденты TokenWorks и кривые фиксы

Полный реестр публично известных багов, эксплоитов и архитектурных дизайн-flaw'ов в экосистеме TokenStrategy. Все эти случаи будут учтены **в исходном коде LINEASTR до деплоя**, а не как wrapper-ы поверх (как у TokenWorks).

## Дисклеймер по охвату

Что **не найдено** в публичных источниках (важно зафиксировать — это не значит, что багов нет, это значит, что они не публичны):
- Reentrancy в `beforeSwap` / `afterSwap` хуке TokenStrategy — публичный disclosure не найден
- Неверный `sqrtPriceX96` в hook — не найдено
- Drain treasury через подменённый pool — не найдено
- Proxy / upgradeability vulns — нерелевантно (контракты renounced на legacy-deployment'ах)
- Fee-on-transfer interaction bugs — не найдено
- DOS vectors — не найдено
- Реакции samczsun / pashov / spreekaway / DeFiHackLabs — не найдено
- Rekt.news статья — не публиковали (импакт ниже их $1M+ порога)
- Тех-postmortem от Rhynotic в Medium / Mirror / HackMD — не найдено

`0xleastwood` упомянут как «аудитор» после паузы 28.09.2025 («no critical findings, but minor fixes and improvements were applied») — но **публичный отчёт не существует**, только косвенное упоминание в Twitter-индексе.

## Инцидент 1 — PNKSTR ETH-drain bug + wrapper-фикс

| Поле | Значение |
|---|---|
| **Дата** | примерно 6–9 сентября 2025 (после launch 6 сент) |
| **Токен** | $PNKSTR |
| **Класс бага** | Auth check / withdraw helper |
| **Импакт** | $0 (whitehat-disclosure, не эксплуатировано) |
| **Tx атаки** | нет |

### Суть

Community-аудитор `@0xQuit` (Yuga Labs VP of Blockchain) обнаружил баг, через который теоретически можно было дренить ETH, накопленный в контракте PunkStrategy. **Точные техдетали публично не раскрывались** — нет постмортема. Учитывая архитектуру (8% trade fee → внутренний баланс → автоматическая покупка floor Punk через CryptoPunks marketplace), наиболее вероятные классы бага:
- неверный auth check на внутреннем `buyPunk()` / `withdraw` хелпере
- неправильная проверка cost при вызове CryptoPunks `buyPunk(uint)` — позволяла бы передать минимальную цену, забрав излишек ETH
- проблема с `transferEther` / fallback — рефанд шёл вызывающему, а не контракту-владельцу

### Фикс (классический «костыль поверх контракта»)

> «A patch was developed quickly through a wrapper smart contract, thus avoiding the headaches of a token migration» (Bankless)

- **Базовый ERC-20 не менялся** (он renounced — ничего нельзя поменять)
- Сверху задеплоили wrapper-контракт, который теперь служит точкой входа для всей логики «buy floor Punk → relist → buy-and-burn»
- Старый контракт остался в торговле как сам ERC-20, но критичные функции в нём фактически больше не используются
- Это и объясняет публично подтверждённую ремарку из docs.tokenstrategy.com: **«Trades are NOT enforced through the hook»** — для PNKSTR нет custom Uniswap v4 hook на уровне контракта, в отличие от всех новых strategies

### Урок для LINEASTR

🔴 **НЕ renounce ownership сразу.** Минимум 30–90 дней — чтобы можно было патчить implementation (если архитектура proxy) или хук без миграции токена. Потом — да, можно renounce.

🔴 **Hook должен быть сменяемым через owner-only setter** в течение pre-renounce окна.

🔴 **Все ETH-движения внутри контракта проходят через инвариант-чекер** (баланс до vs после, no-leftover-allowed).

## Инцидент 2 — Slow-rug на 181.706 ETH ($813K)

| Поле | Значение |
|---|---|
| **Дата** | 20 сентября 2025, ~3 часа после launch |
| **Токен** | $APESTR, $PUDGYSTR, $MOONSTR/$BIRBSTR, $MEEBSTR, $DICKSTR (5 токенов одновременно) |
| **Класс бага** | Дизайн-flaw + ops-omission |
| **Импакт** | **181.706 ETH ≈ $813,400** ушло из protocol treasury 5 strategies в одного актора |
| **Tx атаки** | адрес арбитражёра: `0xa3d297423b17a3894dddd582dc41ff20e237ab75` (история 20.09.2025) |

### Суть

**Архитектура anti-snipe:** buy fee стартует с **95%** и убывает на 1%/мин до 10% resting. На пиковом интересе пул накопил больше ETH, чем нужно для floor NFT соответствующих коллекций.

**Архитектурное отличие от PNKSTR:** у CryptoPunks есть on-chain marketplace (`buyPunk`), а у других коллекций — нет. Поэтому покупка NFT не происходила автоматически из контракта, а должна была триггериться внешне (бот, вызов trigger-функции).

**Команда не задеплоила бот** под эти 5 токенов.

В итоге внешний арбитражёр за 3 часа купил у разных коллекций 10 BAYC, 7 Moonbirds, 5 Pudgy Penguins, 4 Meebits и продал их в стратегии (использовав raised fee floor strategy buying), извлёк дельту между real floor и накопленным пулом стратегии — нетто **181.706 ETH ≈ $813,400** прибыли.

### Фикс (тоже снаружи — без правки контракта)

- Tweet Rhynotic ([x.com/Rhynotic/status/1969098120219775306](https://x.com/Rhynotic/status/1969098120219775306)): «We're fixing the frontend, but there's no exploit. The fees pooled up fast, and bots took the arb. Sadly the frontend "Buy Target NFT" button would have helped prevent this... Back to fixing»
- **0xQuit** лично написал и задеплоил приватный bot для запуска `buyTarget` сразу при достижении floor: «Yuga Labs' blockchain department VP @0xQuit also stated that he personally deployed a bot to address this issue»
- В контракт ничего не пушили — снова костыль снаружи: фронтенд + бот

### Уроки для LINEASTR

🔴 **Bot для buy-target — обязательно с launch.** Не оставлять fees накапливаться сверх floor underlying. Для $LINEA это: как только `currentFees ≥ bagSizeInETH * (1 + buffer)`, бот вызывает `buyTokens()`. Бот деплоится **вместе** с токеном, а не «потом».

🔴 **Initial fee curve мягче.** Не 95% → 10% за 85min, а **50% → 10% за 30min** (или другой компромисс). Высокий fee создаёт slow-rug окно. Конкретные числа подберём на этапе планирования.

🔴 **Per-tx ceiling на fee accumulation.** Если один swap аккумулирует > X% от bagSize стоимости — сразу триггерить buyTokens (даже если автобот спит).

🟡 **Treasury isolation не нужна** в нашем случае (single-token deployment), но если когда-то расширим — учесть.

## Инцидент 3 — SquiggleStrategy NFT-swap exploit ⚠️

| Поле | Значение |
|---|---|
| **Дата** | 28 сентября 2025 |
| **Токен** | SquiggleStrategy |
| **Класс бага** | **Implementation bug** — неверная валидация поступающего NFT |
| **Импакт** | Утечка ценных Chromie Squiggles из treasury (десятки ETH eq); replaced на дешёвые "Day One AB: Genesis", "Construction Token" |
| **Tx атаки** | в текстовых источниках hash не указан |

### Суть

Атакующий нашёл, что контракт SquiggleStrategy позволял **swap NFT внутри стратегии** — отдать стратегии низкоценный NFT, забрать высокоценный Chromie Squiggle, удерживаемый стратегией.

**Корень бага:** Chromie Squiggles, Day One AB и Construction Token шарят **один и тот же ERC-721 контракт** Art Blocks Curated (`0x059EDD72Cd353dF5106D2B9cC5ab83a52287aC3a`). У Art Blocks все Curated проекты — токены одного ERC-721, отличаются только диапазоном `tokenId` (`projectId * 1_000_000 + mintNumber`).

Стратегия валидировала «принимаемый NFT» **по адресу контракта, а не по `(contract, projectId)` паре**. Атакующий слал в стратегию ID из коллекций «Day One AB» / «Construction Token» (другой projectId, но тот же contract), стратегия принимала их как «valid Squiggle» и отдавала настоящий Squiggle взамен.

### Фикс

- Через X: «We are actively investigating an exploit on the SquiggleStrategy contract. All other strategies remain unaffected»
- Пауза остальных NFTStrategy токенов на «аудит» (косвенно `0xleastwood`, без публичного отчёта)
- В контракт-фикс не пошли (SquiggleStrategy renounced); strategy фактически списан как dead
- Остальные strategies перезапущены после паузы; **сам SquiggleStrategy и его NFT никто не «починил»** — fix через «никогда больше не запускать стратегию на Art Blocks Curated»

### Уроки для LINEASTR

🟢 **Для LINEASTR этот баг неприменим напрямую** — underlying у нас ERC-20 (`$LINEA`), там нет projectId-внутри-contract проблемы.

🔴 **Но принцип шире:** валидация underlying должна быть строгой. Проверяем `address(underlying) == LINEA_ADDRESS` immutable-константой при initialize и при каждой fee-обработке. Никаких runtime-meaningful сравнений символов / имён.

🔴 **Если underlying — fee-on-transfer токен, rebase-токен или blacklist-токен**, наш код должен detection'ить это и отказывать. $LINEA на момент исследования — стандартный non-rebasing ERC-20 без fee-on-transfer (нужно verify ещё раз перед mainnet deploy через source code review `0x1789…bb04` на Lineascan).

🔴 **Slither + Aderyn + manual review** — критичная финальная очередь. Эта класс бага ловится Slither за минуту.

## Инцидент 4 — High initial fee window (95–99%): структурная уязвимость

| Поле | Значение |
|---|---|
| **Дата** | хроническое (с 20.09.2025 и далее на каждом launch NFTStrategy / TokenStrategy) |
| **Токены** | все strategies, использующие decay-fee schedule |
| **Класс бага** | Дизайн-flaw |
| **Импакт** | См. Инцидент 2 (повторяется при каждом launch с активным интересом без бота) |

### Суть

Согласно `docs.tokenstrategy.com`: «Buy tax starts at 99% and decreases 1% per minute to prevent sniping». Источники сообщают разные числа — 95% (первый батч NFTStrategy), затем 99% (TokenStrategy permissionless). Декей -1%/мин до 10%.

Это **не привычный anti-snipe**: за 89 минут fee → 10%, и весь этот период любая покупка платит огромный fee, который мгновенно идёт в treasury. Это и привело к Инциденту 2 — высокий fee на peak interest за 30 минут забил treasury выше floor → треггер арбитражёра.

### Фикс
Не правился в смартконтракте — фронтенд + bot (см. Инцидент 2).

### Урок для LINEASTR

🔴 **Fee curve начинаем с разумного значения.** Конкретно — рассмотрим **50% → 10% за 30 минут** или **30% → 10% за 15 минут**. Это убивает sniper-snipe (sniper всё равно потеряет 30–50% на первом блоке), но не создаёт slow-rug окно.

🔴 **Per-block fee cap.** Дополнительно — если в одном блоке > X% volume идёт через хук, поднимаем fee на следующие N блоков. (Защита от MEV-bundle.)

## Инцидент 5 — PNKSTR без хука: fees enforced ONLY off-contract

| Поле | Значение |
|---|---|
| **Дата** | хроническое (с 6.09.2025) |
| **Токен** | $PNKSTR |
| **Класс бага** | Архитектурный (legacy после wrapper-фикса инцидента 1) |
| **Импакт** | Несжитая в цифрах потеря fee revenue, размывает flywheel PNKSTR |

### Суть

В docs прямо сказано: для всех strategies «fees are enforced on the contract-level using custom Uniswap v4 hooks», **кроме PunkStrategy** — «Trades are NOT enforced through the hook».

Это значит:
- 10% fee на PNKSTR обходится тривиально через любой alternative pool / direct ERC-20 transfer / агрегатор, не маршрутизированный через сам wrapper-фронтенд
- GeckoTerminal/DEX Screener показывают **несколько v4 пулов с разными fee tier**: 1% pool (`0x02895b…`), 0.92% pool (`0xb32470…`), и основной (`0xbdb0f9…`). Если торговля через альтернативные пулы / агрегаторы — fee logic стратегии частично выпадает
- Buy-and-burn PNKSTR от 1% других strategies → ОК (там хук). Но 10% trade fee на самом PNKSTR — обходим в принципе

### Фикс
Не делался; PNKSTR renounced, миграция отвергнута в пользу wrapper'а. Этот «костыль» остаётся **постоянным**.

### Урок для LINEASTR

🔴 **Хук — единственная точка enforcement.** Любой пул, не зарегистрированный с нашим хуком, должен быть не-функциональным:
- `_afterAddLiquidity` revert'ит если caller не factory/owner — нельзя создать «теневой» пул с тем же hook
- Сам токен LINEASTR в `transfer()` / `transferFrom()` reverts'ит если destination не whitelist (PoolManager + Universal Router + Permit2 + бот) — это закрывает «прямой ERC-20 transfer без fee»

🟡 **Альтернативно** (мягкий путь): не запрещаем альт-пулы, но владелец токена объявляет, что **fee взимается только в каноническом пуле**, и комуницирует это. Минусы: реальный enforcement отсутствует — тот же класс PNKSTR-bug. Не рекомендуется.

🟢 **Optimal:** transfer-allowlist. В LINEASTR разрешён `transfer` только между whitelist-адресами (PoolManager singleton, Universal Router, Permit2, owner, treasury). Любой другой transfer revert'ит. Это полностью enforce'ит fee через хук — выйти из токена можно только через канонический пул, в котором сидит хук.

## Сводная таблица инцидентов

| Дата | Токен | Суть | Импакт | Фикс TokenWorks | Урок для LINEASTR |
|---|---|---|---|---|---|
| ~6–9.09.2025 | PNKSTR | Whitehat-disclosure: возможный ETH drain в core | $0 (не эксплоит) | Wrapper-контракт; основной ERC-20 renounced | Не renounce сразу; pre-renounce окно 30–90 дней |
| 20.09.2025 | $APESTR/$PUDGYSTR/$MOONSTR/$MEEBSTR/$DICKSTR | Slow-rug: high initial fee + нет buy-bota | $813K в одного арбитражёра | Frontend + private bot (0xQuit) | Бот деплоим вместе с токеном; мягкая fee curve |
| 28.09.2025 | SquiggleStrategy | Validation NFT по contract вместо `(contract, projectId)` | Утечка Chromie Squiggles | Strategy «списан»; пауза остальных NFTStrategy | ERC-20 → неприменимо; но Slither + Aderyn обязательно |
| Хроническое | все | 95–99% initial fee + 1%/min decay | См. Инцидент 2 | Bot + frontend | Fee curve мягче (50%→10% за 30 мин) |
| Хроническое | PNKSTR | Trades НЕ через хук — fee обходится альт-пулами | Размытие flywheel | Не правился (renounced) | Transfer-allowlist enforce'ит фикс в коде |

## Вывод

5 публичных инцидентов, все «фиксились снаружи»:
- 3 через wrapper / новый internal-bot
- 2 списаны как «design flaw, не баг»
- 0 — фикс в исходном коде, потому что исходные контракты renounced

Это означает, что у TokenWorks технический долг растёт экспоненциально (каждый новый wrapper нужно учитывать в дальнейшей разработке), а LINEASTR — будем делать иначе:

1. **Pre-renounce окно** для emergency hot-fix
2. **Transfer-allowlist** в самом ERC-20
3. **Bot встроен в release**
4. **Fee curve мягче** + per-tx / per-block cap
5. **Slither / Aderyn / manual** перед деплоем

Все эти решения — в `05-lessons-applied.md` с конкретными значениями параметров.
