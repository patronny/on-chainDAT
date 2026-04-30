# LINEASTR

**LineaStrategy** — ERC-20 strategy token на Linea L2 с underlying `$LINEA`. Архитектура — форк ERC20Strategy v3 от TokenWorks (тот же шаблон, что у `wBTCStrategy`), с правками из публичных уроков всех 7 поколений TokenStrategy и кастомным распределением fee.

## Ключевое в одну строку

10% trade-fee на каждом swap → **8% в treasury (для покупки и удержания $LINEA)** + **2% разработчику** → автоматический yoyo-цикл buy/relist 1.2x → buy-and-burn LINEASTR. **Без PNKSTR-burn.**

## Чем отличается от wBTCStrategy

| Аспект | wBTCStrategy | LINEASTR |
|---|---|---|
| Сеть | Ethereum mainnet | Linea L2 (chainId 59144) |
| Underlying | wBTC (`0x2260fac5...c2c599`) | $LINEA (`0x1789e004...bb04`) |
| Fee split | 8% treasury / 1% feeAddress / 1% PNKSTR-burn | **8% treasury / 2% dev** |
| PNKSTR-burn | Да | **Нет** |
| Hook permissions | beforeInitialize \| afterAddLiquidity \| afterSwap \| afterSwapReturnDelta | То же (паттерн v3) |
| Аудит | Нет | Нет (slither + aderyn + manual) |

## Статус

🟡 **Этап 0 — research & docs.** Контракты не написаны. План разработки будет согласован в следующем этапе.

## Документы

- [`docs/00-overview.md`](docs/00-overview.md) — что строим, зачем, отличия от прототипа
- [`docs/01-tokenstrategy-history.md`](docs/01-tokenstrategy-history.md) — хронология TokenWorks от PunkStrategy до wBTCStrategy
- [`docs/02-wbtcstrategy-anatomy.md`](docs/02-wbtcstrategy-anatomy.md) — полный разбор контрактов wBTCStrategy
- [`docs/03-incidents-and-fixes.md`](docs/03-incidents-and-fixes.md) — все публичные баги TokenWorks и кривые фиксы
- [`docs/04-linea-l2-infrastructure.md`](docs/04-linea-l2-infrastructure.md) — Linea + Uniswap v4 + $LINEA
- [`docs/05-lessons-applied.md`](docs/05-lessons-applied.md) — какие уроки и как зашиваем в LINEASTR
- [`docs/sources.md`](docs/sources.md) — все ссылки

## Атрибуция

TokenStrategy / PunkStrategy / NFTStrategy / wBTCStrategy сделал **Adam Lizek (`@Rhynotic`)** в составе **TokenWorks**. **Не Adam McBride** — это NFT-археолог, никак не связан с TokenWorks. Эта путаница везде в открытых каналах, фиксируем правильно с первого дня.
