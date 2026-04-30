# 00. Overview — что строим

## TL;DR

**LINEASTR (LineaStrategy)** — это ERC-20 токен на Linea L2 с встроенным механизмом автоматической покупки и удержания `$LINEA` через trade-fee и Uniswap v4 hook. Архитектура — прямой форк ERC20Strategy v3 от TokenWorks (то же, что и `wBTCStrategy`), с двумя кастомизациями: другая сеть (Linea вместо Ethereum) и другое распределение fee (без PNKSTR-burn, с 2% разработчику).

## Концепция «Yoyo™» в применении к $LINEA

```
┌─────────────────────────────────────────────────────────────┐
│         LINEASTR / WETH pool на Uniswap v4 (Linea)          │
│                                                             │
│   trader → swap → 10% fee забирает hook                     │
│                            │                                │
│       ┌────────────────────┼─────────────────┐              │
│       ▼                    ▼                 ▼              │
│   8% treasury        2% dev (mine)        — (нет PNKSTR)    │
│       │                                                     │
│       ▼                                                     │
│   накапливается ETH                                         │
│       │                                                     │
│       ▼ (когда хватает на bag)                              │
│   buyTokens() — swap ETH→LINEA через Uniswap v4             │
│       │                                                     │
│       ▼                                                     │
│   list(price = paid * 1.2)                                  │
│       │                                                     │
│       ▼ (внешний buyer выкупает bag за ETH)                 │
│   sellTokens() → profit ETH                                 │
│       │                                                     │
│       ▼                                                     │
│   buy-and-burn LINEASTR через Uniswap v4 → 0xdead           │
│       │                                                     │
│       ▼                                                     │
│   supply ↓ → price ↑ → больше торгов → больше fee  ⟲        │
└─────────────────────────────────────────────────────────────┘
```

## Чем отличается от wBTCStrategy

### Сеть
- **wBTCStrategy:** Ethereum mainnet (chainId 1)
- **LINEASTR:** Linea L2 (chainId 59144). Нативный gas-токен — ETH. Linea — Stage-0 zkEVM от Consensys, sequencer централизован, Uniswap v4 запущен 2 апреля 2026.

### Underlying asset (treasury bag)
- **wBTCStrategy:** wBTC (`0x2260fac5...c2c599`), bagSize = 0.0125 wBTC (8 decimals)
- **LINEASTR:** $LINEA (`0x1789e004...bb04`, 18 decimals). bagSize нужно подобрать — параметр обсудим на этапе планирования (зависит от текущей цены $LINEA и желаемой частоты циклов).

### Fee distribution
- **wBTCStrategy:** 10% total → 8% protocol / 1% feeAddress / **1% PNKSTR-burn**
- **LINEASTR:** 10% total → **8% protocol** / **2% dev** / **0% (нет PNKSTR-burn)**
  - 8% — накопление ETH для покупки $LINEA в treasury
  - 2% — разработчику (мне) на адрес, заданный при деплое
  - PNKSTR-burn механизм полностью удаляется из хука — это снижает gas-cost каждого swap и упрощает аудит

### Authorship & ownership
- TokenStrategy на Ethereum — TokenWorks-controlled deployment, owner — `0x019817ad...e8cb` (TokenWorks deployer EOA)
- LINEASTR — single-deployer (мой адрес), без launchpad, без factory-paywall

### Audit posture
Ровно как у TokenStrategy — **без формального paid-аудита**. Но (в отличие от Rhynotic, который фиксил баги через wrapper'ы поверх renounced контрактов) мы:
1. Учтём все 5 публично известных багов TokenWorks **в исходном коде до деплоя**
2. Прогоним Slither + Aderyn + manual review
3. Не будем renounce ownership сразу — оставим 30–90 дней emergency multisig pause для критических хук-функций

## Что мы НЕ делаем

- **Не делаем launchpad** для других токенов. LINEASTR — single-token deployment.
- **Не делаем cross-chain.** Только Linea.
- **Не интегрируемся с PNKSTR / TokenStrategy.** Полностью независимая экосистема.
- **Не платим аудиторам.** Бюджет — нулевой (как и у Rhynotic при запуске PunkStrategy).

## Известные риски (фиксируем сразу)

1. **Точные адреса Uniswap v4 PoolManager на Linea не индексированы публично.** Линковка идёт через `app.uniswap.org` — на момент деплоя верифицируем через RPC eth_call к factory.
2. **Linea Stage-0** — sequencer централизован, withdraw L2→L1 = 8–32ч, контракты bridge instantly upgradable. Это влияет на trust-assumption для держателей.
3. **Uniswap v4 на Linea запущен только 4 недели назад** (на 2026-05-01) — **наш токен может стать первым публичным v4-hook деплоем на Linea**. Плюс — first-mover advantage; минус — нет battle-tested precedent.
4. **$LINEA — высокоинфляционный токен** (10-летний vesting на 75% supply). Treasury из $LINEA будет постепенно девальвироваться по supply, но not по absolute holdings. Нужно учесть в комуникации.

## Что дальше

Этот repo — research-stage. Следующий шаг — обсудить:
- **bagSize** для $LINEA (X $LINEA = Y ETH eq на момент launch)
- **priceMultiplier** — оставлять 1.2x или менять
- **Initial fee curve** — 95% → 10% за 85min vs более мягкую 50% → 10% за 30min
- **Total supply LINEASTR** — оставлять 1B или другое
- **Ownership / multisig** структуру до renounce
- **Бот для buy-target** — сразу с launch (обязательно — урок инцидента 2 от TokenWorks)
- **Тесты на Linea Sepolia** перед mainnet

См. также [`docs/05-lessons-applied.md`](05-lessons-applied.md).
