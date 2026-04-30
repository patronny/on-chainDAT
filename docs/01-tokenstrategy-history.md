# 01. История TokenStrategy / TokenWorks

## Атрибуция (важно)

**TokenStrategy / PunkStrategy / NFTStrategy / wBTCStrategy сделал:**
- **Adam Lizek** aka **`@Rhynotic`** ([x.com/Rhynotic](https://x.com/Rhynotic), [Farcaster](https://warpcast.com/rhynotic))
- Команда **TokenWorks** (`@token_works`, [token.works](https://token.works), GitHub `TOKEN-WORKS`)
- Юр.лицо: **Token Workshop, Inc.**

**Это НЕ Adam McBride** ([@adamamcbride](https://x.com/adamamcbride)) — он NFT-археолог, автор книги «NFT APE», ведущий «Rug Radio». В TokenStrategy не участвует. Эта путаница встречается часто из-за совпадения имени.

### Команда TokenWorks
- **Adam Lizek (Rhynotic)** — лид, founder. Бэкграунд: создатель Vulcan Bot (Discord-верификация для NFT-проектов с 2021, использовали XCOPY, Alpha Centauri Kid, Luis Ponce). Vulcan куплен Premint в 2022. Параллельно работает в Premint у CEO Brendan Mulligan (`@mulligan`).
- **`@surfcoderepeat`** — раньше работал над Lotus on Arbitrum и FrenPet on Base.
- 3 других человека публично не идентифицированы.
- Промоутеры: Beeple продвигал предыдущий проект TokenWorks $O («black hole coin» на Shape network).

## Концепция «Yoyo™» / TokenStrategy

> **Trade → tax → buy underlying → relist 1.2x → sell → buy-and-burn token → reduced supply → price up → больше торгов → tax**

Замкнутый автомат, работающий на самой DEX-торговле токеном. Не зависит от user growth/usage. Это превращает спекуляцию в перманентный источник топлива для accumulator.

Чем отличается от соседних паттернов:
- **OHM-форки (Olympus):** платили APY стейкерам через bond-продажи. У TokenStrategy treasury не платит стейкерам, а покупает underlying.
- **Strategy (бывший MicroStrategy):** Saylor покупает BTC через выпуск акций/долга. У TokenStrategy treasury пополняется через **10% trade tax**, не через capital-raise.
- **Классический flywheel:** «use → demand → price → revenue». У TokenStrategy замкнутый автомат на самой торговле.

## Хронология запусков (полная)

### Пред-история
- **`$O` («black hole coin») на Shape** (~ конец 2024 / начало 2025) — предшественник от TokenWorks. Механика: «по мере роста маркеткапа круг растёт, при падении сжимается». Beeple продвигал.

### 6 сентября 2025 — PunkStrategy ($PNKSTR) — флагман
- Контракт: `0xc50673EDb3A7b94E8CAD8a7d4E0cD68864E33eDF` (Ethereum)
- Вторичный/wrapper адрес: `0x06255bD1f48046c68FB8AB7216A3f5D37f992Bfe`
- Treasury asset: **CryptoPunks** (флор тогда 30–50 ETH)
- Total supply: 1,000,000,000 PNKSTR
- Fee: **10% total** → 80% protocol (8% от трейда) / 10% team / 10% supporters (расходится между источниками; punkstrategy.fun сейчас пишет «80% protocol / 20% team»)
- Anti-MEV: sell tax спайкается до **90%** после Punk-sale, постепенно снижается
- **Trades НЕ enforce'd через Uniswap v4 hook** — это будет иметь последствия (см. [`03-incidents-and-fixes.md`](03-incidents-and-fixes.md))
- Yoyo-цикл: 8% → ETH treasury → купить cheapest Punk → relist at 1.2x → sale → buy-and-burn PNKSTR

**Достижения:**
- 8 сент 2025: первый Punk куплен (Punk #1628 за ~49 ETH)
- 13 сент 2025: второй Punk
- К началу октября: **12 buy-sell циклов**, ~**2.8% supply сожжено**, **~700 ETH накоплено в fees**
- 5 окт 2025: ATH **$0.317–$0.383**, mcap **$152M**, экосистема пересекла **$200M mcap**
- 1 мая 2026 (сейчас): ~$0.02, mcap ~$20M (drawdown ~93%)

### 18–20 сентября 2025 — NFTStrategy Wave 1 (5 токенов)

| Ticker | Treasury asset |
|---|---|
| $APESTR | Bored Ape Yacht Club |
| $PUDGYSTR | Pudgy Penguins |
| $BIRBSTR / $MOONSTR | Moonbirds |
| $MEEBSTR | Meebits |
| $DICKSTR | CryptoDickButts |

**Изменения механики vs PNKSTR:**
- Те же 10% trade tax, но split поменялся:
  - **8%** → buy/relist NFT collection
  - **1%** → **royalty создателю NFT-коллекции** (новое)
  - **1%** → **buy-and-burn PNKSTR** (новое — все NFTStrategy токены аккумулируют PNKSTR как мета-актив экосистемы)
- Anti-bot: fees начинаются **с 95%** в первые минуты после launch и затухают **1%/мин до 10%**
- Launch parameters: каждый токен запущен на $50k market cap с full liquidity seeded
- 30 сент 2025: все NFTStrategy токены залистились на OpenSea (первый случай ERC-20 на OpenSea)
- **20 сент 2025 — slow-rug на 181.706 ETH ($813K)** через арбитраж (адрес `0xa3d297423b17a3894dddd582dc41ff20e237ab75`) — см. инцидент 2 в [`03-incidents-and-fixes.md`](03-incidents-and-fixes.md)

### 26+ сентября 2025 — NFTStrategy Wave 2 («один в день»)
Целевые коллекции: **Chromie Squiggles** (SquiggleStrategy), **CrypToadz** ($TOADSTR), **Goblintown**, **Checks** (Jack Butcher), **Max Pain** (XCOPY → PainStrategy), **Good Vibes Club** ($VIBESTR), **Milady**, **Chimpers** ($CHMPSTR).

**28 сентября 2025 — SquiggleStrategy NFT-swap exploit** — критический баг, см. инцидент 3.

### Октябрь 2025 — REKTSTR / RektStrategy
- Первая **ERC-20 strategy** (не NFT)
- Treasury asset: $REKT (монета Rektguy NFT-сообщества)
- Контракт REKTSTR: не индексирован в публичных источниках (нужен прямой запрос Etherscan/CoinGecko)
- Листинг на MEXC

### 7 ноября 2025 — NAKASTR / NakaStrategy
- Первая **ERC-1155 strategy**
- Первая **cross-chain** (Bitcoin Counterparty → Eth через Emblem Vault)
- Treasury asset: Nakamoto Card (Rare Pepe Series 1, Card 1; total supply 300, ~88 vaulted)

### Декабрь 2025 — TokenStrategy Launchpad
- **Permissionless platform** для деплоя стратегий
- Поддерживает ERC-721, ERC-1155, ERC-20
- Введены **«Recursive Strategies»** — стратегии, покупающие и сжигающие свой собственный токен (саморекурсия)
- Сайт: tokenstrategy.app, tokenstrategy.com

### 14 января 2026 — wBTCStrategy ($WBTCSTR) ⭐ наш прототип
- Контракт (proxy): `0x7af2a142c3486a9726791098e6415b768513e363`
- Implementation: `0xb1a3015b61e4eac9253a674c6942cdc5dd8de510`
- Hook: `0x9f8f375b2d246da6be816b453f13d43d8240a444`
- Factory: `0x9f834e16b709c0781537186e7bb09de42a000a0a`
- Underlying: wBTC (`0x2260fac5...c2c599`)
- VERSION = **3** (третье поколение хука)
- Полный разбор — см. [`02-wbtcstrategy-anatomy.md`](02-wbtcstrategy-anatomy.md)

**Изменения механики:**
- Переход на `afterSwap + afterSwapReturnDelta` (вместо `beforeSwap` в v1)
- `bagSize = 0.0125 wBTC` (фиксированный)
- `priceMultiplier = 1.2x` (снижено с 2x в v1)
- Solidity 0.8.30, ERC1967 proxy + Solady LibClone + immutable args

### Январь 2026 — апдейт launchpad
Можно деплоить ERC-20 стратегии **даже когда деплоер не контролирует контракт целевого токена** — это и есть путь wBTCStrategy (деплоер не контролирует канонический wBTC).

### Анонсирован, январь 2026 — AB500STR / IndexStrategy #1
- Treasury asset: **Art Blocks 500** (вся коллекция из 500 generative-art releases)
- **Ротация по всем коллекциям последовательно**, начиная с Chromie Squiggles
- 3-дневное окно покупки на каждую
- Royalty (1%) распределяется поровну между **300+ художниками**
- Buy-and-burn 1% PNKSTR сохранён
- Live-статус неподтверждён на момент исследования

## Смежные проекты (не TokenWorks, но близкие)

### `punk.auction` / $PAST
- **НЕ TokenWorks**. Конкурент / комплементарный проект.
- Сайт: [punk.auction](https://punk.auction)
- Использует **bonding curve** (а не AMM-pool как PNKSTR), Dutch auction для Punks
- Прямой burn $PAST после успешного аукциона

### Milady Rescue (by ross / zAMM)
Не TokenWorks. Коллективная игра на NFTX Milady vault.

### TokenStrategy by Gami
- **Не TokenWorks-овский**, отдельный продукт от Gami (Nouns DAO / Gnars DAO / Tings DAO founder)
- ERC-6551 NFT collections как «fixed basket of tokens»
- Slated для International Meme Fund платформы

### MacroStrategy (funghibull + Rhynotic как co-founder)
- DeFi + NFT, raised от @Collab_Currency
- 27 сент 2025 launch
- Rhynotic параллельно остаётся ключом TokenWorks

## Эволюция fee/механики между поколениями

| Поколение | Hook | Fee enforcement | Fee split | Bot для buy-target | Underlying validation |
|---|---|---|---|---|---|
| **PNKSTR (1-е, 6.09.2025)** | Нет | Soft (через wrapper, можно обойти) | 80/10/10 (или 80/20) | Нативный CryptoPunks API | N/A (1 коллекция) |
| **NFTStrategy v1 (20.09.2025)** | Есть v4 hook | Hook (10% on-chain) | 8/1/1 + PNKSTR-burn | **НЕТ → slow-rug $813K** | По contract address (баг — см. SquiggleStrategy) |
| **NFTStrategy v2 (после 28.09 паузы)** | Hook | Hook | 8/1/1 + PNKSTR-burn | Есть (после прецедента 0xQuit) | По `(contract, projectId)` (предположительно) |
| **REKTSTR (окт 2025)** | Hook | Hook | Не публиковано | Есть | ERC-20 — тривиально |
| **NAKASTR (7.11.2025)** | Hook | Hook | Не публиковано | Есть | ERC-1155 — нужна валидация tokenId |
| **wBTCStrategy / ERC20Strategy v3 (14.01.2026)** | Hook v3 (`afterSwap + afterSwapReturnDelta`) | Hook | 8/1/1 + PNKSTR-burn | Есть (доказано из 12 завершённых циклов на momentнеи 30.04.2026) | ERC-20 wBTC — тривиально |

**Что Rhynotic явно публично сказал про lessons learned:**
- 1 твит: «We're fixing the frontend, but there's no exploit. The fees pooled up fast, and bots took the arb. Sadly the frontend "Buy Target NFT" button would have helped prevent this... Back to fixing» ([x.com/Rhynotic/status/1969098120219775306](https://x.com/Rhynotic/status/1969098120219775306))
- Никаких medium-постов / formal post-mortem

## Источники

См. [`sources.md`](sources.md), секция «История».
