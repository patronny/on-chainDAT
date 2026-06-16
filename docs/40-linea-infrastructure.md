# 40. Linea L2 Infrastructure - Uniswap v4, $LINEA token, ликвидность по DEX

Все факты ниже подтверждены прямым чтением через `https://rpc.linea.build` и публичными API (DefiLlama, GeckoTerminal) на `2026-05-01`.

## 1. Linea - основные параметры

| Параметр | Значение | Источник |
|---|---|---|
| Chain ID | **59 144** | linea.build |
| RPC public endpoint | `https://rpc.linea.build` | Consensys |
| Block explorer | `https://lineascan.build` | |
| Block time (target) | 2 секунды | Consensys |
| **Block time (наблюдаемый, 01.05.2026)** | **~3 секунды** | измерено по 5 последним блокам (latest=30462907, ts diff ~3-4 сек/блок) |
| Native asset | ETH (через L2 bridge) | |
| Latest block (на момент сборки) | 30 462 907 | `eth_blockNumber` |

В контрактах **используем 3 секунды** для расчётов catch-up (conservative). Если Linea вернётся к 2-сек блокам - все формулы остаются валидными, просто catch-up будет быстрее.

## 2. $LINEA token - verified canonical L2

### Контракт

| Поле | Значение |
|---|---|
| Address (proxy) | `0x1789e0043623282D5DCc7F213d703C6D8BAfBB04` |
| Implementation (EIP-1967) | `0xe03F157dE67AC4b2A9a949D64d2A3C64Ffa1BC55` |
| Proxy Admin (EIP-1967) | `0x0ccbf317EDF1F960fE49B659B6d17cBC596DfADa` |
| Verified | YES - `L2LineaToken`, Solidity 0.8.30, optimizer 10M runs |
| Author | Consensys Software Inc. |
| Type | **Canonical Linea L2 token** (TransparentUpgradeableProxy) |
| name / symbol / decimals | "Linea" / "LINEA" / 18 |
| Total supply на Linea (01.05.2026) | **69 958 991 343** (~69.96 млрд) |
| Fee-on-transfer | **Нет** (verified из source) |
| Rebase | **Нет** |
| Blacklist | **Нет** |

⚠️ **Не путать с `0x1789…bb04` mainnet версии** - это L2-нативный контракт на Linea. Используем **именно его** как `underlying`.

### Цена и ликвидность

| Метрика | Значение | Источник |
|---|---|---|
| Spot price | **$0.003642** | DefiLlama Coins |
| ETH price | **$2 317** | DefiLlama (CoinGecko) |
| 1 ETH = | **636 179 LINEA** | math |

## 3. Ликвидность $LINEA по DEX на Linea (TVL ranking)

Источник: GeckoTerminal API на 01.05.2026, 20 пулов с $LINEA. Считаем только LINEA/WETH пулы (релевантные для нашего бота - он покупает $LINEA за ETH).

| DEX | Пара | Fee tier | TVL | 24h Volume | ETH-side ≈ |
|---|---|---|---|---|---|
| **etherex-cl** | LINEA/WETH | **0.3%** | **$152 669** | $24 267 | ~12 ETH |
| etherex-cl | LINEA/WETH | 0.05% | $33 318 | $36 106 | ~7 ETH |
| syncswap-v2-1 | LINEA/WETH | - | $19 436 | $365 | ~4 ETH |
| lynex-linea | LINEA/WETH | 0.329% | $17 512 | $4 832 | ~3.6 ETH |
| etherex-cl | LINEA/WETH | 1% | $3 076 | 0 | < 1 ETH |
| oku-trade-linea | LINEA/WETH | 1% | $703 | $118 | < 1 ETH |
| pancakeswap-v3-linea | LINEA/WETH | 0.25% | $658 | 0 | < 1 ETH |
| iziswap-linea | LINEA/WETH | 1% | $634 | $2 | < 1 ETH |
| pancakeswap-v3-linea | LINEA/WETH | 0.01% | $217 | $3 | - |
| etherex-legacy | LINEA/WETH | - | $173 | $3 | - |

**Суммарная LINEA/WETH ликвидность:** ~$228 000 = **~50 ETH ETH-side**.
**Дневной volume LINEA/WETH:** ~$70 000 = **~30 ETH/день**.

**Топ-2 пула** (`etherex-cl 0.3%` + `0.05%`) держат **>80%** всей LINEA/WETH ликвидности. Бот будет роутиться в первую очередь через них.

LINEA/USDC пулы тоже существуют ($272k etherex-cl 0.01%), но для нашего бота нерелевантны (ему нужно menять ETH, не USDC).

## 4. Uniswap v4 deployments на Linea mainnet (chainId 59144)

**Источник истины**: `Uniswap/sdks` repo, `sdks/sdk-core/src/addresses.ts` lines 463-478 на main branch - это тот же SDK что powering `app.uniswap.org`. Universal Router addresses - `sdks/universal-router-sdk/src/utils/constants.ts` lines 471-485.

**Verification:** каждый адрес проверен `eth_getCode` через `https://rpc.linea.build` - все возвращают non-empty bytecode.

| Контракт | Адрес | Размер байткода |
|---|---|---|
| **PoolManager** | `0x248083fb965359d82b06c1f5322480dcfc1ad857` | ~24 KB |
| **PositionManager** (POSM, NFT-LP) | `0xddcad5775b2816a87495f207731b3571d7ee3c76` | ~24 KB |
| **StateView** (read-only) | `0xe861de206e460a8b936b05ad3816520b58ccdf9b` | ~3.5 KB |
| **Quoter** | `0x2c125569c0bee20a66e33e5491c552b37ebd9934` | ~6 KB |
| **UniversalRouter V2_1_1 (v4-capable)** | `0x8B844f885672f333Bc0042cB669255f93a4C1E6b` | ~25 KB, deployed 2026-03-18 (block 29782392) |
| UniversalRouter V2_0 (v2/v3 only - НЕ для v4) | `0x661e93cca42afacb172121ef892830ca3b70f08d` | ~20 KB |
| **WETH9** | `0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f` | - |
| **Permit2** (universal address) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | - |
| **CREATE2 deployer** | `0x0000000000FFe8B47B3e2130213B802212439497` | 4 211 bytes - есть на Linea ✓ |

⚠️ **Используем UniversalRouter V2_1_1** (`0x8B844f…`) - V2_0 не поддерживает v4, только v2/v3.

### Linea Sepolia testnet (chainId 59141)

❌ **Uniswap v4 на Linea Sepolia НЕ задеплоен** на 2026-05-01.

**Альтернатива для testnet:** Base Sepolia (chainId 84532) - там Uniswap v4 есть, block-time 2 секунды (близко к Linea 3с).

## 5. Pool key для LDAT

```solidity
PoolKey({
    currency0: Currency.wrap(address(0)),                              // native ETH
    currency1: Currency.wrap(LDAT_PROXY_ADDRESS),                  // LDAT
    fee: 0x800000,                                                     // DYNAMIC_FEE_FLAG
    tickSpacing: 60,
    hooks: IHooks(LDAT_HOOK_ADDRESS)
})
```

`address(0) < любой ERC-20 адрес` лексикографически, поэтому в паре ETH+LDAT currency0 = `0x0` строго.

## 6. Hook permissions для LDAT (CREATE2-mined)

Те же 4 permissions как у WBTCSTR v3:
- `beforeInitialize` (bit 13, 0x2000)
- `afterAddLiquidity` (bit 10, 0x400)
- `afterSwap` (bit 6, 0x40)
- `afterSwapReturnDelta` (bit 2, 0x4)

Сумма (младшие 14 бит): `0x2444`.

**Hook address должен иметь** `address & 0x3FFF == 0x2444`. Это делается через CREATE2 mining (Uniswap `HookMiner`):

```solidity
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
(address hookAddr, bytes32 salt) = HookMiner.find(
    CREATE2_DEPLOYER,                   // 0x0000000000FFe8B47B3e2130213B802212439497
    uint160(0x2444),                    // permission bits
    type(LineaDATHook).creationCode,
    abi.encode(POOL_MANAGER, LDAT_PROXY, FACTORY, FEE_ADDRESS)
);
```

Mining обычно занимает 1-10 минут на M1/M2 Macbook.

## 7. Hook gas-budget на Linea

- **Нет hard gas cap** на hook callback в v4-core
- Linea L2 газ ~10× дешевле mainnet (≈ $0.01 за simple swap, ≈ $0.05 за swap с hook)
- Дополнительный двойной свап (для `_afterSwap` на ETH→LDAT покупке) добавит ~150k газа = $0.02. Терпимо.

## 8. Deploy targets

| Этап | Что | Куда | Когда |
|---|---|---|---|
| **Phase 1 (local)** | Anvil fork Linea mainnet | localhost:8545 | до публичного testnet |
| **Phase 2 (public testnet)** | Base Sepolia mainnet (chainId 84532) | base-sepolia | за неделю до Linea mainnet deploy |
| **Phase 3 (production)** | Linea mainnet | rpc.linea.build | финальный launch |

Подробный runbook в [`60-deployment-runbook.md`](60-deployment-runbook.md).

## 9. Cross-chain examples (для inspiration)

- **Clanker** (Base, dynamic-fee хук для launches) - используют `beforeInitialize + afterSwap` flags
- **Aztec** token sale (CCA hook) - кастомные permission-checked swaps

Эти проекты - не TokenWorks, но они показывают, что Uniswap v4 hooks **рабочая инфраструктура** на mainnet и L2 уже сейчас.

## 10. Verification log

```bash
# Linea RPC live
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://rpc.linea.build

# $LINEA total supply
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x1789e0043623282D5DCc7F213d703C6D8BAfBB04","data":"0x18160ddd"},"latest"],"id":1}' \
  https://rpc.linea.build
# → 0x...69958991343207624998012613676

# Uniswap v4 PoolManager на Linea (eth_getCode)
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":[ "0x248083fb965359d82b06c1f5322480dcfc1ad857","latest"],"id":1}' \
  https://rpc.linea.build
# → 0x6080... (~24KB)

# DefiLlama prices
curl -s "https://coins.llama.fi/prices/current/coingecko:ethereum,linea:0x1789e0043623282D5DCc7F213d703C6D8BAfBB04"

# GeckoTerminal LINEA pools
curl -s "https://api.geckoterminal.com/api/v2/networks/linea/tokens/0x1789e0043623282D5DCc7F213d703C6D8BAfBB04/pools"
```
