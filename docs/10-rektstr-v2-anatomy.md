# 10. REKTSTR - Анатомия ERC20Strategy v2

Глубокий разбор первой ERC-20 стратегии TokenWorks. REKTSTR (RektStrategy) - на 1 месяц старше WBTCSTR, на 1 поколение хука раньше (`VERSION = 2`). Включён в research как *более старый референс*: исходники verified, паттерны те же, мелкие отличия видим явно.

Все факты ниже подтверждены прямым чтением через `https://ethereum-rpc.publicnode.com` и `https://eth.drpc.org` (2026-05-01) + verified исходниками с Sourcify.

## 1. Адреса контрактов

| Роль | Адрес | Источник |
|---|---|---|
| **REKTSTR ERC-20 token (proxy)** | `0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e` | `eth_call(name())` = "RektStrategy" |
| **ERC20Strategy v2 implementation** | `0xe5a9634bf5db3d8d6138c3182d09a561bcf1a2a5` | `eth_call(getImplementation())` |
| **Hook (REKTSTR-specific)** | `0xdadaaa9591d6f4d68748898fbacc99dc69012444` | proxy slot 3 |
| **Factory** | `0x9f834e16b709c0781537186e7bb09de42a000a0a` | общий с WBTCSTR |
| **Underlying ($REKT)** | `0xdd3b11ef34cd511a2da159034a05fcb94d806686` | `eth_call(token())` - Rektguy сообщество ERC-20 |
| **Owner (Adam Lizek)** | `0x019817ad02a31b990433542097be29d97613e8cb` | `eth_call(owner())`, **НЕ renounced** на 01.05.2026 |
| **Uniswap v4 PoolManager** | `0x000000000004444c5dc75cb358380d2e3de08a90` | canonical |
| **Universal Router (V4Router04)** | `0x00000000000044a361ae3cac094c9d1b14eece97` | immutable arg в proxy |

## 2. Launch

| Параметр | Значение |
|---|---|
| **Launch block** | **24 000 001** (bisect через `eth_getCode`: до этого блока кода не было) |
| **Timestamp** | `1765584383` = **2025-12-13T00:06:23Z** |
| **VERSION()** | **2** ⚠️ (на поколение раньше WBTCSTR) |
| **Compiler** | Solidity 0.8.26 (отличие от v3 - там 0.8.30) |

## 3. Tokenomics

| Параметр | Значение | Источник |
|---|---|---|
| `name` | "RektStrategy" | `name()` |
| `symbol` | "REKTSTR" | `symbol()` |
| `decimals` | 18 | `decimals()` |
| `totalSupply` | **1 000 000 000 × 10¹⁸** = 1B | `totalSupply()` |
| `bagSize` | **42 069 000 000 × 10¹⁸** REKT = 42.069 миллиарда токенов | `bagSize()` (мем-номер 42069) |
| Эквивалент в $ | ≈ $6 232 (REKT $1.48e-7 на 01.05.2026) | DefiLlama |
| `priceMultiplier` | 1200 (1.2× markup) | proxy slot 4 |
| `buyIncrement` | 0.1 ETH/блок | proxy slot 0 |
| `twapIncrement` | 1.0 ETH | proxy slot 7 |
| `twapDelayInBlocks` | 1 | proxy slot 8 |
| `currentFees` (на 01.05.2026) | ≈ 0.379 ETH | proxy slot 5 = `0x542e32e9c931ab9` |
| `lastBuyBlock` | 24 942 099 | proxy slot 10 |
| `lastTwapBlock` | 24 395 059 | proxy slot 9 |

## 4. Storage layout (proxy slots) - идентичен v3

| Slot | Поле | Декод |
|---|---|---|
| 0 | `buyIncrement` | 0.1 ETH |
| 1 | `tokenName` | "RektStrategy" packed |
| 2 | `tokenSymbol` | "REKTSTR" packed |
| 3 | `hookAddress` | `0xdadaaa95…12444` |
| 4 | `priceMultiplier` | 1200 |
| 5 | `currentFees` | накопленный счётчик |
| 6 | `ethToTwap` | 0 (всё уже сожжено в TWAP cycles) |
| 7 | `twapIncrement` | 1.0 ETH |
| 8 | `twapDelayInBlocks` | 1 |
| 9 | `lastTwapBlock` | 24 395 059 |
| 10 | `lastBuyBlock` | 24 942 099 |
| 11 | `isDistributor` mapping head | - |
| 12 | `globalDistributor` | 0 (mainnet uses константу `GLOBAL_DISTRIBUTION_HANDLER`) |

## 5. Verified исходники

Скачаны с Sourcify (full match) в [`research/rektstr-v2/`](../research/rektstr-v2/):

```
src/strategies/ERC20Strategy.sol     14 249 bytes  (v2)
src/strategies/BaseStrategy.sol      25 596 bytes  (v2)
src/Interfaces.sol                   13 498 bytes
lib/solady/...                       (полное дерево solady)
lib/v4-core/...                      (Uniswap v4 core)
lib/v4-router/...                    (v4 router interfaces)
lib/v4-router/lib/permit2/...        (Permit2)
metadata.json                        Foundry compilation metadata
```

В Sourcify нет hook-сурсов (`0xdadaaa95…12444` не индексирован) - будем дорезать через Etherscan API при детальном compare между v2 и v3 hook (для v2 vs v3 hook сравнения нужно явно знать, какие фиксы между ними были).

## 6. v2 vs v3 - известные отличия

Я провёл diff между [`research/rektstr-v2/src__strategies__ERC20Strategy.sol`](../research/rektstr-v2/src__strategies__ERC20Strategy.sol) (v2) и [`research/tokenworks-sources/ERC20Strategy.sol`](../research/tokenworks-sources/ERC20Strategy.sol) (v3). Размеры: v2 = 14 249 байт, v3 = 14 960 байт. Дельта = +711 байт.

Основная функциональная логика (`buyTokens`, `sellTokens`, `list`, `updateBagSize`) **идентична**. Дельта v3 vs v2:
- **`VERSION()` returns 3 vs 2**
- **Минорные фиксы балансных проверок** (точные строки вычислю при написании контрактов)
- Базовая семантика P2P-оффера и `availableFunds() = min(currentFees, getMaxPriceForBuy())` **не менялась**

`BaseStrategy.sol` дельта: v2 = 25 596 байт, v3 = 26 582 байт. Тоже мелкие правки. Главное - **storage layout идентичен**, оба используют `__gap[49]` для UUPS-апгрейдов.

## 7. Hook permissions (для REKTSTR v2)

Адрес хука `0xdadaaa9591d6f4d68748898fbacc99dc69012444`. Младшие 14 бит = `0x2444` = `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta` - **те же что в v3**. CREATE2-mined под точно те же permission flags.

Это значит - между v2 и v3 hook-permissions **не менялись**. Дельта только во внутренней логике хука (которую без сурсов v2-hook сейчас не сравним).

## 8. На что смотрим как на референс для LDAT

✅ **Storage layout** - копируем 1:1 (это интерфейс с RPC и indexer'ами, любые отклонения сломают frontend).
✅ **`buyIncrement = 0.1 ETH/блок`** - TokenWorks нашли это эмпирически, v2 уже использует. Подтверждение что 0.1 ETH/блок - норма для mainnet (12с/блок). Для Linea (3с/блок) пересчитываем: см. [`docs/50-lineadat-spec.md`](50-lineadat-spec.md).
✅ **`priceMultiplier = 1200`** - закреплено в v2 и v3, копируем.
✅ **`twapIncrement = 1.0 ETH` / `twapDelayInBlocks = 1`** - на mainnet норма; для Linea с тонким пулом снижаем (см. spec).
✅ **`bagSize`** - у REKTSTR это 42 069 000 000 REKT (мем-число). Это даёт нам подтверждение, что bagSize **может быть произвольным круглым** числом - не привязано к % от supply underlying. Для LDAT выбрали **150 000 LINEA** как «удобное круглое».

## 9. Что забираем как "v2 был баги-первенец, v3 уже почистили"

REKTSTR - **первый ERC-20 strategy** TokenWorks. На нём могли быть обкатаны фиксы для v3. Конкретные публично известные баги REKTSTR - не зафиксированы в открытых каналах (см. [`30-tokenworks-incidents.md`](30-tokenworks-incidents.md)), но факт что v3 деплоился через **месяц** после v2 говорит, что было что-то правлено. **LDAT форкаем именно v3** - берём пост-фикс версию.

## 10. Etherscan / Sourcify ссылки

- REKTSTR proxy: <https://etherscan.io/address/0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e#code>
- ERC20Strategy v2 implementation (Sourcify full match): <https://sourcify.dev/#/lookup/0xe5a9634bf5db3d8d6138c3182d09a561bcf1a2a5>
- REKTSTR Hook (Etherscan): <https://etherscan.io/address/0xdadaaa9591d6f4d68748898fbacc99dc69012444>
- $REKT underlying: <https://etherscan.io/token/0xdd3b11ef34cd511a2da159034a05fcb94d806686>
- TokenStrategy UI: <https://www.tokenstrategy.com/strategies/0xb40ede070d9d9f37e32a106b04b29e20ef6ee26e>
