# 00. Overview LDAT

## Pitch

**$LDAT** - ERC-20 strategy token на **Linea L2**, который автоматически конвертирует **10% trade-fees** на свой Uniswap v4 пул в **$LINEA**, накапливает их в treasury через P2P-выкупы, и сжигает свой supply через **buy-and-burn** на накопленных продажах. Это «MicroStrategy для $LINEA», но treasury пополняется не через capital-raise, а через DEX-торговлю самим токеном.

Архитектурно - **точная копия `wBTCStrategy` v3** от TokenWorks (Adam Lizek / Rhynotic), переcalibrated под Linea L2 и заменой PNKSTR-burn'а на LDAT-burn (с edge-case для self-launch). MIT-форк с атрибуцией.

## Что это даёт

- **Держателям $LDAT** - токен с дефляционным supply (постоянный buy-and-burn) и обеспечением в виде $LINEA в treasury. Цена WBTCSTR относительно wBTC растёт быстрее, чем wBTC - мы воспроизводим этот механизм для пары LDAT/LINEA.
- **Держателям $LINEA** - постоянный покупатель $LINEA с растущим объёмом (`bagSize = 150 000 LINEA` на каждый цикл). Контракт **никогда не продаёт** $LINEA в обратную сторону.
- **Linea-экосистеме** - флайвилл, который заводит на L2 новый объём ETH-торговли (volume → fees → underlying-buy → ETH lock в pool).
- **Создателю** - 20% от trade-fees через `feeAddress` (закодировано через redirect 10% LDAT-burn в feeAddress пока `collection == LDAT_ADDRESS`).

## Locked параметры (final)

| Параметр | Значение | Комментарий |
|---|---|---|
| **Сеть** | Linea L2 (chainId 59144) | block-time ≈3 сек |
| **Underlying** | $LINEA `0x1789e004…bb04` | canonical L2 token |
| **Token name / symbol** | `LDAT` / **`LDAT`** | |
| **Total supply** | 1 000 000 000 × 10¹⁸ | разовый mint в `initialize`, далее только burn |
| **Decimals** | 18 | ERC-20 standard |
| **Initial pool** | single-sided: 0 ETH + 1B LDAT | LP-NFT в `0xdead` сразу |
| **Initial FDV** | ≈ $100 000 | sqrtPriceX96 калибруется под `1 ETH ≈ 40M LDAT` (как WBTCSTR) |
| **`bagSize`** | **150 000 LINEA** ≈ $546 ≈ 0.236 ETH | см. обоснование в `50-lineadat-spec.md` |
| **`buyIncrement`** | **0.02 ETH/блок** | catch-up time ≈ 12 блоков ≈ 36 секунд при bagSize 0.236 ETH |
| **`priceMultiplier`** | **1200** (1.2× markup) | как у обоих прототипов |
| **`twapIncrement`** | **0.05 ETH** | раскачаем руками через `setTwapIncrement` когда пул вырастет |
| **`twapDelayInBlocks`** | **4** | 12 секунд = эквивалент mainnet (защита от same-block sandwich MEV) |
| **Buy-fee curve** | 99% → 10% за 89 минут (−100 bps/мин) | как у WBTCSTR (копируем без изменений для траста) |
| **Sell-fee** | 10% константа | как у WBTCSTR |
| **Fee split** | 80% treasury / 10% LDAT-burn / 10% creator | технически: 80/10/10 как v3, но 10% LDAT-burn redirected в feeAddress пока `collection == LDAT_ADDRESS` ⇒ эффективно **80% treasury / 20% creator** на самом $LDAT; для будущих strategies на Linea - 80/10/10 normal split |
| **`feeAddress`** | `0x6e0d01089976093680c881CcDcB79e0D046e2433` | твой адрес для приёма creator-доли |
| **Owner** | **`0x1470c542D60e83EcCFE005332f5789Bd669D027C`** (Keycard EOA, EIP-55 verified, fresh nonce=0 на обеих сетях) | renounce «никогда» с возможностью в любой момент |
| **Pool currency0 / currency1** | `0x0` (native ETH) / LDAT | как у WBTCSTR; pool key проверяет `currency0.isAddressZero()` |
| **Pool fee flag** | `0x800000` (DYNAMIC_FEE_FLAG) | hook рассчитывает fee динамически |
| **Tick spacing** | 60 | стандартный для dynamic fee |
| **Hook permissions** | `beforeInitialize \| afterAddLiquidity \| afterSwap \| afterSwapReturnDelta` | как у v3 |
| **Bot working capital** | **3 ETH суммарно** (2 на A + 1 на B) | conservative mode: `availableFunds() ≥ marketPrice × 1.10` |
| **Bot hosting** | fly.io (multi-region: A в EU, B в US) | ~$10/мес |
| **Frontend стек** | Next.js 15 + wagmi v2 + RainbowKit + viem + Tailwind | хост Vercel |
| **Domain** | `on-chaindat.com` (already secured 2026-05-05) (купишь перед launch) | |
| **Дизайн** | 3 варианта на выбор → выбор перед merge | копия структуры tokenstrategy.com, другая палитра |
| **Тестнет** | Phase 1: Anvil fork Linea mainnet, Phase 2: Base Sepolia public | финальный deploy на Linea mainnet |
| **MIT атрибуция** | header «based on TokenWorks ERC20Strategy v3 (MIT)» в каждом .sol файле | |

## Что прямо сейчас не залочено

- ~~**Owner адрес**~~ ✅ залочено: `0x1470c542D60e83EcCFE005332f5789Bd669D027C`
- **Бот-EOA #1, #2** - генерим свежие приваты при настройке fly.io
- **Когда покупаем `on-chaindat.com` (already secured 2026-05-05)** - за 1 неделю до launch
- **Дизайн (3 варианта)** - будут после написания контрактов, перед публичным testnet

## Roadmap (после lock параметров)

1. **Этап 2 - контракты:** форк ERC20Strategy v3, патч `_processFees` (PNKSTR → LDAT-burn + edge-case redirect), параметры под Linea, MIT-header
2. **Этап 3 - Anvil fork:** локально гоняем 100+ циклов, Foundry tests, slither + aderyn
3. **Этап 4 - Base Sepolia:** публичный testnet, ты тестируешь UI с Keycard, я ловлю баги бота
4. **Этап 5 - Frontend:** копия tokenstrategy.com structure, 3 варианта дизайна на выбор
5. **Этап 6 - Mainnet deploy:** деплой контрактов на Linea, seed 1B LDAT в pool, LP-NFT в dead, бот включается в момент `deploymentTime` ts
6. **Этап 7 - Live monitoring:** dashboard в Discord webhook (циклы, P&L бота, treasury growth)

## Сравнение прототипов рядом

| | REKTSTR (v2) | WBTCSTR (v3) | LDAT (forked v3) |
|---|---|---|---|
| Версия | 2 | 3 | 3 (форк) |
| Network | Ethereum mainnet | Ethereum mainnet | **Linea L2** |
| Underlying | REKT (мем-токен) | wBTC (BitGo) | **$LINEA (Consensys)** |
| Launch | 2025-12-13 00:06 UTC | 2026-01-13 22:00 UTC | TBD (Этап 6) |
| bagSize $-eq | $6 232 | $1 250 | **$546** |
| Owner status сейчас | НЕ renounced | НЕ renounced | non-renounced from launch |
| Аудит | нет | нет | нет (slither + aderyn + manual) |

## Атрибуция

LDAT - MIT-форк ERC20Strategy v3 от **TokenWorks** (`@token_works` / [token.works](https://token.works)). Лид: **Adam Lizek** (`@Rhynotic`). Юр.лицо: **Token Workshop, Inc.** Все TokenWorks-исходники verified на Etherscan / Sourcify под MIT.
