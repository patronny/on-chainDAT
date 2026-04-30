# 04. Linea L2 + Uniswap v4 + $LINEA — инфраструктура

Состояние на **2026-05-01**.

## Linea — общие параметры

| Параметр | Значение |
|---|---|
| Тип | zkEVM L2 от Consensys |
| Chain ID | **59144** (mainnet), 59141 (Sepolia testnet) |
| Native gas | **ETH** (не LINEA) |
| Block time | ~2 секунды |
| zkEVM Type | Type-2 (на 2026-05-01), переход на Type-1 в Q1/Q2 2026 (Pectra/Prague) |
| Stage | **Stage-0** на L2BEAT (5/6 Stage-1 требований выполнено) |
| Sequencer | **Централизованный** (один Consensys-operated sequencer) |
| Цензурит | Возможна (нет permissionless force-include на L1) |
| Decentralization roadmap | Multi-prover (TEE + zk diversity) через 2026; full open sequencer «late 2026» |
| Контракты bridge | **Instantly upgradable** (нет exit window) |

### Прецеденты простоя
- **Июнь 2024:** Linea **deliberately halted block production** для ~2 часов во время эксплоита Velocore. Это реальный риск-вектор для time-sensitive хуков.

### Опкоды (важно для хука)

| EIP | Опкод | Поддержка на Linea (2026-05-01) |
|---|---|---|
| EIP-3855 | PUSH0 | ✅ supported |
| EIP-5656 (Cancun) | MCOPY | ✅ supported |
| EIP-1153 (Cancun) | TLOAD/TSTORE (transient storage) | ✅ supported (Uniswap v4 PoolManager использует transient storage extensively!) |
| EIP-6780 (Cancun) | SELFDESTRUCT (новые semantics) | ✅ supported (только transfers balance) |
| EIP-7702 (Prague) | Delegated EOAs | 🟡 phased rollout — verify перед использованием |
| EIP-4844 | Blob transactions | N/A на L2 (L2 использует blobs для постинга на L1) |

**Solidity 0.8.30 + Cancun target — компилируется и работает на Linea** без изменений. Это совпадает с настройками wBTCStrategy.

### Gas pricing (Linea-specific)

EIP-1559 type-2 транзакции стандартные, но priority fee внутри split'нут:
- **FIXED_COST** = 0.03 Gwei (инфраструктура)
- **ADJUSTED_VARIABLE_COST** — per-byte cost compressed L1 blob data, динамический

Variable cost может **удваиваться каждые 22 блока (~44s)** под sustained calldata pressure (built-in DoS damper).

🔴 **Calldata — главный cost driver на Linea, не EVM execution.** Хук должен:
- Пакать PoolKey агрессивно
- Избегать больших dynamic arrays в hook returndata
- Минимизировать `bytes calldata data` в hook callbacks

Правильная команда оценки gas: **`linea_estimateGas`** (Linea-specific RPC), не `eth_estimateGas`.

## Uniswap v4 на Linea

### Статус
- **Запущен 2 апреля 2026** (4 недели назад на 2026-05-01)
- Анонсирован Uniswap Labs: [blog.uniswap.org/uniswap-is-live-on-linea](https://blog.uniswap.org/uniswap-is-live-on-linea)
- Включает v2, v3, v4
- Работает в Uniswap Web App, API, Wallet (iOS/Android rolling out)
- **Hooks support по умолчанию** (если PoolManager задеплоен — хуки работают)

### ⚠️ Адреса PoolManager / PositionManager / Universal Router

**Не верифицированы в публичных доках на 2026-05-01.** Канонический deployments page [developers.uniswap.org/contracts/v4/deployments](https://developers.uniswap.org/contracts/v4/deployments) перечисляет 16 mainnet-сетей (Ethereum, Unichain, OP, Base, Arbitrum, Polygon, Blast, Zora, Worldchain, X Layer, Ink, Soneium, Avalanche, BNB, Celo, Monad), но **Linea пока не в этом списке** несмотря на live-анонс.

**Действие до деплоя:**
1. Открыть `app.uniswap.org` с выбранной Linea, swap-нуть тестовое количество, перехватить контракт-вызов через DevTools/RPC tracing
2. Open issue в [github.com/Uniswap/v4-core](https://github.com/Uniswap/v4-core) с запросом deployment manifest
3. Контактировать Uniswap Labs developer relations

Для сравнения (verified на других сетях, формат адресов будет похож):
- Ethereum PoolManager: `0x000000000004444c5dC75cB358380D2e3dE08A90`
- Base PoolManager: `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- BSC PoolManager: `0x28e2Ea090877bF75740558f6BFB36A5ffeE9e9dF`
- OP Mainnet PoolManager: `0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3`
- Ethereum PositionManager: `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e`
- Ethereum Universal Router (v4): `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af`

### Verified Uniswap v3 контракты на Linea (для справки)
- UniswapV3Factory: `0xc35dadb65012ec5796536bd9864ed8773abc74c4`
- UniswapInterfaceMulticall: `0x93e253D101519578A8DF0BCe2A43D8292BFb3A1F`
- QuoterV2: `0x42bE4D6527829FeFA1493e1fb9F3676d2425C3C1`
- TickLens: `0x3334d83e224aF5ef9C2E7DDA7c7C98Efd9621fA9`
- NFTDescriptor: `0x0CdeE061c75D43c82520eD998C23ac2991c9ac6d`
- UNI token (bridged): `0x636b22bc471c955a8db60f28d4795066a8201fa3`

### Hook deployment mechanics

Стандартный Uniswap v4 паттерн (chain-agnostic, работает на Linea):

1. Хук — обычный смарт-контракт с **address-encoded permission flags** в последних 14 битах
2. Деплой через **CREATE2 с mined salt'ом** (используем `HookMiner.sol` из v4-periphery)
3. Стандартный CREATE2 deployer: `0x4e59b44847b379578588920cA78FbF26c0B4956C`
4. Foundry workflow:
   ```bash
   git clone https://github.com/Uniswap/v4-template
   # описать permissions в getHookPermissions()
   # HookMiner находит salt → vm.broadcast() деплой
   # PoolManager.initialize(PoolKey, sqrtPriceX96)
   ```

### Hook gas-budget
- **Нет hard gas cap** на hook callback в v4-core
- Swap revert'ит если хук OOG
- На Linea calldata size + storage writes — главные cost drivers

### Battle-tested hook precedent на Linea
- **Не найдено** на 2026-05-01 — Uniswap v4 запущен только 4 недели назад
- Cross-chain examples: **Clanker** (Base, dynamic-fee хук для launches), **Aztec** token sale (CCA hook)
- 🟡 **LINEASTR может стать первым публичным v4-hook деплоем на Linea.** Плюс: first-mover. Минус: нет precedent для cross-check корнер-кейсов

### Альтернативы (если v4 заблокирован)

| DEX | Тип | Hook-equivalent? |
|---|---|---|
| **Lynex** | ve(3,3) форк Thena/Velodrome | Нет |
| **SyncSwap** | Multi-chain CL AMM | Нет |
| **Nile / Nile Legacy** | ve(3,3) Linea-native | Нет |
| **PancakeSwap** | v3-style CL | Нет |
| **Echo** | Не достаточно публичных данных | ? |

🟢 **Хук-паттерн (callback внутри singleton AMM) — изобретение Uniswap v4.** Конкуренты на Linea используют legacy AMM math. Если v4 заблокирован — пересматриваем архитектуру (уже не «копия wBTCStrategy»).

## $LINEA — токен

### Канонический адрес
**`0x1789e0043623282D5DCc7F213d703C6D8BAfBB04`** — одинаковый на Ethereum L1 и Linea L2.

Источники:
- [lineascan.build/address/0x1789e0043623282d5dcc7f213d703c6d8bafbb04](https://lineascan.build/address/0x1789e0043623282d5dcc7f213d703c6d8bafbb04)
- [etherscan.io/token/0x1789e0043623282d5dcc7f213d703c6d8bafbb04](https://etherscan.io/token/0x1789e0043623282d5dcc7f213d703c6d8bafbb04)
- [docs.linea.build/network/build/contracts](https://docs.linea.build/network/build/contracts)

⚠️ **Старые спекулятивные адреса** (НЕ канонический LINEA): `0xD30518A0319DD2BF08565f51e39a01cFa5202565`, `0xb96be52942DCBD09Dca8E68aFC628Ce51600aEAa`. Не используем.

### Параметры
- **TGE:** 10 сентября 2025
- **Total supply:** 72,009,990,000 LINEA (~72 миллиарда)
- **Decimals:** 18 (стандарт)
- **Distribution:**
  - 85% community/ecosystem (10% airdrop при TGE + 75% ecosystem fund vesting на 10 лет)
  - 15% Consensys (long-term)
- **Нет private investor allocation** (по дизайну, «Ethereum-2015-style»)

### Native vs L1
- Тот же address на обеих сетях
- **Linea использует ETH как gas-токен**, не LINEA
- LINEA — чисто экономический / governance / burn-актив
- Бридж: канонический token bridge (см. ниже)

### Trading venues
- **CEX:** Bitget, MEXC, KuCoin, OKX, Binance (с TGE)
- **DEX (Linea):** Lynex, SyncSwap, PancakeSwap on Linea
- **DEX (mainnet):** Uniswap v3/v4 пары против ETH/USDC

### Dual-burn механизм $LINEA
Каждая транзакция на Linea (gas платится в ETH):
1. Покрывается infrastructure cost
2. Из остатка:
   - **20% сжигается как ETH** (deposit к ETH burn address на L1 через rollup contract)
   - **80% используется для покупки LINEA на open market и сжигания**

Эффективное соотношение «1:4 ETH-to-LINEA burn». Linea — первый L2 с протокол-уровнем ETH burn.

### LINEA как treasury asset / collateral
- **Не найдено** production-примеров (на 2026-05-01)
- Aave / ZeroLend пулы на Linea принимают ETH, USDC, WBTC, wstETH — **не LINEA**
- Причины: TGE недавний (~7 месяцев назад), 10-летний vesting на 75% supply создаёт inflation pressure
- 🔴 **Для LINEASTR это значит:** мы de facto становимся одним из первых протоколов, аккумулирующих $LINEA в treasury. Treasury-ценность $LINEA на длинной дистанции зависит от dual-burn механики и реального usage Linea L2.

### Verify перед деплоем
- 🔴 Перед деплоем LINEASTR — **прочитать source `0x1789...bb04` на Lineascan**, убедиться что:
  - Стандартный ERC-20 без fee-on-transfer
  - Не rebasing
  - Не blacklist-токен (или blacklist owner — Consensys, не вмешается)
  - `approve` / `transferFrom` стандартные (для swap через Universal Router)

## Tooling и operations

### RPC endpoints
| Provider | Endpoint |
|---|---|
| Public | `https://rpc.linea.build` (rate-limited; ОК для dev) |
| Infura | `https://linea-mainnet.infura.io/v3/{PROJECT_ID}`, WS: `wss://linea-mainnet.infura.io/ws/v3/{PROJECT_ID}` |
| Other | Dwellir, Alchemy, QuickNode, Ankr, Chainstack |

`chainlist.org/chain/59144`, `rpc.info/linea`.

### Block explorer
- **Lineascan** (Etherscan-family): `https://lineascan.build`, API: `https://api.lineascan.build/api`
- **Blockscout** instance for Linea — backup, если нужна Yul source verification (Lineascan не поддерживает Yul-only)

### Foundry / Hardhat

**Foundry config (`foundry.toml`):**
```toml
[profile.default]
solc = "0.8.30"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200

[etherscan]
linea = { key = "${LINEASCAN_API_KEY}", url = "https://api.lineascan.build/api" }

[rpc_endpoints]
linea = "https://linea-mainnet.infura.io/v3/${INFURA_KEY}"
linea_sepolia = "https://linea-sepolia.infura.io/v3/${INFURA_KEY}"
```

Verify command:
```bash
forge verify-contract --etherscan-api-key $LINEASCAN_API_KEY \
  --verifier-url https://api.lineascan.build/api \
  --chain 59144 \
  $CONTRACT_ADDRESS \
  src/LineaStrategy.sol:LineaStrategy
```

**Hardhat:** `@nomicfoundation/hardhat-toolbox` + `etherscan.customChains` с `apiURL: "https://api.lineascan.build/api"`, `browserURL: "https://lineascan.build"`. API key: `https://lineascan.build/myapikey`.

### Bridge контракты Linea

#### L1 (Ethereum mainnet)
- **LineaRollup** (main, embeds L1 message service): `0xd19d4B5d358258f05D7B411E21A1460D11B0876F` (docs.linea.build)
- **L1 Token Bridge:** `0x051F1D88f0aF5763fB888eC4378b4D8B29ea3319`
- **L1 Security Council:** `0x892bb7EeD71efB060ab90140e7825d8127991DD3`
- **Linea Multisig 2** (manages bridge token reserve list): `0xB8F5524D73f549Cf14A0587a3C7810723f9c0051`

#### L2 (Linea mainnet)
- **L2 Message Service:** `0x508Ca82Df566dCD1B0DE8296e70a96332cD644ec`
- **L2 Token Bridge:** `0x353012dc4a9A6cF55c941bADC267f82004A8ceB9`
- **L2 Security Council:** `0xf5cc7604a5ef3565b4D2050D65729A06B68AA0bD`

#### Testnet (Linea Sepolia)
- L1 Message Service: `0xB218f8A4Bc926cF1cA7b3423c154a0D627Bdb7E5`
- L1 Token Bridge: `0x5A0a48389BB0f12E5e017116c1105da97E129142`
- L2 Message Service: `0x971e727e956690b9957be6d51Ec16E73AcAC83A7`
- L2 Token Bridge: `0x93DcAdf238932e6e6a85852caC89cBd71798F463`

### Withdraw timing L2 → L1
- **8–32 часа типично** (зависит от proof batching cadence + L1 gas)
- Process: (1) initiate withdrawal на L2, (2) ждать batch finalization на L1, (3) **manually claim на L1** с Merkle proof (`claimMessageWithProof`)
- **Anti-DDoS fee:** 0.001 ETH применяется только на L2→L1
- Real-world failure mode: в начале 2024 некоторые users репортили 6-day stuck withdrawals в finalization backlog. План UX → 24–48ч safety margin.

### Third-party bridges (быстрее L2→L1)
- **Across Protocol:** SpokePool на Linea `0x7e63a5f1a8f0b4d0934b2f2327daed3f6bb2ee75`. Exit: минуты.
- **LayerZero / Stargate:** Pool Native на Linea `0x81F61381...03506B075`
- **Orbiter, Owlto, Rhino.fi** — также работают

## Чеклист для деплоя на Linea

- [ ] Verify Uniswap v4 PoolManager address на Linea (см. выше — критическая зависимость)
- [ ] Test deploy на Linea Sepolia (chainId 59141)
- [ ] HookMiner с целевыми permissions: `beforeInitialize | afterAddLiquidity | afterSwap | afterSwapReturnDelta`
- [ ] Verify $LINEA source на Lineascan (фee-on-transfer? rebase? blacklist?)
- [ ] Foundry config с `evm_version = "cancun"` и Sol 0.8.30
- [ ] LINEASCAN_API_KEY получен
- [ ] Регистрация LINEASTR в [github.com/Consensys/linea-token-list](https://github.com/Consensys/linea-token-list) для bridge UI compatibility
- [ ] Подсчёт calldata (compressed) — минимизировать байты в hook callbacks
- [ ] Bot-runner для buy-target — задеплоить ON LINEA одновременно с токеном

См. также `05-lessons-applied.md`.
