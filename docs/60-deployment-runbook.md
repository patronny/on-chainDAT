# 60. Deployment Runbook - пошаговый план запуска LDAT

Полный план: написание контрактов → Anvil fork → Base Sepolia → Linea mainnet.

## Phase 0 - подготовка (текущий этап, до написания кода)

- [x] Согласована [`50-lineadat-spec.md`](50-lineadat-spec.md) (1 мая 2026)
- [x] Скачаны verified исходники прототипов: WBTCSTR v3, REKTSTR v2
- [ ] **Ты:** генерируешь Owner EOA на Keycard, присылаешь публичный адрес
- [ ] **Ты:** покупаешь `on-chaindat.com` (already secured 2026-05-05) (за неделю до launch)
- [ ] **Я:** генерирую Bot A и Bot B EOA приваты, передаю тебе через secure channel; ты держишь приваты у себя, я использую только для подписи в fly.io secrets

## Phase 1 - контракты (Этап 2)

### 1.1 Setup repo

```bash
mkdir -p contracts/{src,test,script,lib}
cd contracts
forge init --no-commit
```

### 1.2 Зависимости (Foundry)

```bash
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
forge install Uniswap/v4-router
forge install Uniswap/permit2
forge install Vectorized/solady
```

### 1.3 Файлы

Копируем из `research/tokenworks-sources/` и `research/tokenworks-hook/` в `contracts/src/`, применяя patch-list из [`50-lineadat-spec.md`§8](50-lineadat-spec.md):

```
contracts/src/
  LineaDATStrategy.sol      ← from ERC20Strategy.sol v3 + MIT-header
  BaseStrategy.sol          ← from BaseStrategy.sol v3 + MIT-header + setTwapIncrement
  LineaDATHook.sol          ← from ERC20StrategyHook.sol v3 + MIT-header + LDAT-burn rename + edge-case
  LineaDATFactory.sol       ← новый (минимальный, не клонируем TokenWorks factory)
  Interfaces.sol            ← from src_Interfaces.sol с переименованиями
```

### 1.4 Static analysis

```bash
forge build
slither contracts/src/ --filter-paths "lib/" --exclude-informational --exclude-low
aderyn contracts/
```

Цель: 0 high/medium findings.

### 1.5 Foundry tests

```
contracts/test/
  Strategy.t.sol            ← buy/sell/list cycle
  Hook.t.sol                ← swap fee logic, _processFees variants
  SlowRug.t.sol             ← попытка slow-rug, доказываем что availableFunds bound
  Sandwich.t.sol            ← sandwich на processTokenTwap, доказываем что twapDelayInBlocks работает
  Initialize.t.sol          ← полный launch flow с initial pool seed
  Edge.t.sol                ← пустой пул, ноль fees, retry на reverted txs
```

Цель: ≥ 100 тест-кейсов, всё зелёное.

## Phase 2 - Anvil fork (локальный тест)

### 2.1 Fork Linea mainnet

```bash
anvil --fork-url https://rpc.linea.build --port 8545
# в другом терминале:
export RPC=http://localhost:8545
```

### 2.2 Deploy LDAT

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d  # anvil[0]
```

### 2.3 Симулируем 1000 циклов

```bash
forge script contracts/script/SimulateCycles.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --sig "run(uint256)" 1000
```

Скрипт:
1. Делает random swap'ы (50/50 buy/sell в нашем pool) с разными размерами
2. После каждого swap'а - `vm.roll(block.number + 5)` (jump 5 блоков)
3. Эпизодически вызывает `buyTokens()` (от bot-EOA) когда `availableFunds() ≥ marketPrice`
4. Эпизодически вызывает `sellTokens(bagId)` от random buyer
5. Когда `ethToTwap > 0.05 ETH` - вызывает `processTokenTwap()`
6. Проверяет инварианты: `currentFees ≥ 0`, `ethToTwap ≥ 0`, `totalSupply` уменьшается, `treasury LINEA` растёт

### 2.4 Логирование

Все cycles в `out/anvil-simulation.json`. Анализ:
- Avg profit бота за цикл: должен быть **> 0.03 ETH**
- Slow-rug attempts (bot ждёт > 50 блоков и пытается забрать всё): должны fail / yield ограниченную премию
- Burn-rate LDAT: 0.5-2% supply в неделю при $10k/день volume

## Phase 3 - Base Sepolia (публичный testnet, 7 дней)

### 3.1 Deploy (DONE - 2026-05-03)

Live testnet addresses (Base Sepolia, chainId 84532):

| Contract | Address |
|---|---|
| MockTLINEA | `0x88a8D5ED5D1be44098F226EDf11C3160Fd76421F` |
| LineaDATStrategy impl | `0x739f49b48DA56D5C164722ad49A81B527c7b5542` |
| LineaDATFactory | `0xeDCA75CdAbcca93399c22fc1815035C71F5f77A6` |
| LDAT proxy | `0x6ddbC0bF9e8Bb2f8Bd9Dfd27876197340dDc7EB2` |
| LineaDATBot | `0x5CAbfF553d8D7B9564CceE758A22b58c850d23Fc` |
| Deployer / Owner / Keeper EOA | `0xbc6af64859dF1008c8187F94dF89323000dEE668` |
| Deploy block | 41022811 |

⚠️ Underlying на Base Sepolia - нет `$LINEA`. Используется **MockTLINEA** ERC-20 (faucet 100k/час, cap 100M).

### 3.2 Keeper deployment (GitHub Actions, NOT Fly)

Phase 3 использует GitHub Actions cron, а не Fly bots - `automation/keeper/`,
workflow `.github/workflows/keeper.yml`, schedule `*/120 * * * *` (каждые 2ч,
12 запусков/24ч). Фоллбэк-режим: если cron упадёт, owner может вручную дернуть
`executeRound()` через Basescan write-contract UI. Bot A/B redundancy + Discord
alerts - ОТДЕЛЬНАЯ Phase 4 задача (см. §4.3).

### 3.3 Frontend (DONE)

Production: <https://lineadat.vercel.app> (renamed 2026-05-05; old `lineastr.vercel.app` redirects). Custom domain `on-chaindat.com` - см. §3.5. Vercel env вкладки:
- `NEXT_PUBLIC_INDEXER_URL` - optional, default hardcoded к Fly URL ниже
- `NEXT_PUBLIC_RPC_URL` - **НЕ ставить** drpc.org / blastapi.io, `wagmi-client.ts`
  всё равно auto-skip их, но лучше держать слот для CORS-friendly endpoint
- `NEXT_PUBLIC_*_ADDRESS` - адреса из таблицы §3.1

### 3.4 Acceptance criteria для Phase 3

- [x] Frontend live, dashboard рендерит данные с indexer / on-chain
- [x] Indexer GraphQL backfilled до tip (bags=7, swaps=27 на 2026-05-04)
- [x] Owner успешно подписал buy/sell tx через Keycard
- [ ] 7 дней без crashes у keeper
- [ ] ≥ 50 successful buyTokens / sellTokens циклов
- [ ] ≥ 5 processTokenTwap циклов
- [ ] Discord webhook alerts (Phase 3.6 - отложено)
- [ ] Bot B redundancy на Fly (Phase 3.6 - отложено)

## Phase 3.5 - Ponder indexer (production component)

Self-hosted GraphQL indexer на Fly, обслуживает Holdings / Sales / Swaps таблицы
во фронтенде. Удалось отказаться от brute-force `eth_getLogs × 4500-chunk`
на каждого посетителя - теперь индексер один раз читает события и сервит
готовый merged history.

- App: `lineastr-indexer`, region `fra`, persistent volume `lineastr_indexer_data` (1 ГБ)
- Endpoint: `https://lineastr-indexer.fly.dev/graphql`
- Стоимость: ~$2/мес
- Schema: `bag` (bagId pk, paid, listPrice, soldFor?, soldAt?, soldTxHash?, buyer?) + `swap` (id pk = `${blockNumber}-${logIndex}`)
- Backfill от deploy block: ~2 секунды

При смене адресов strategy/hook (Phase 4 mainnet или любой redeploy):

```bash
fly secrets set --app lineastr-indexer \
  STRATEGY_ADDRESS=0x... HOOK_ADDRESS=0x... START_BLOCK=...
fly deploy --app lineastr-indexer
```

Persistent volume (`lineastr_indexer_data`) хранит pglite db. Если сменили
схему / структуру событий / нужен полный reindex - destroy + recreate volume,
backfill всё равно занимает секунды.

⚠️ **Ponder RPC должен быть rate-stable.** Public endpoints (`publicnode`)
silently truncate `eth_getLogs` на multi-thousand-block ranges - индексер
получит частичные данные без error. Используется Tenderly gateway,
`https://base-sepolia.gateway.tenderly.co`. Для mainnet - Alchemy / Infura key.

### 3.5.1 RPC стратегия (важно для всего Phase 3+)

Browser-side `fallback()` chain в `frontend/src/lib/wagmi-client.ts`:
1. `NEXT_PUBLIC_RPC_URL` (если задан И не в `KNOWN_NO_CORS` чёрном списке)
2. `https://sepolia.base.org`
3. `https://base-sepolia-rpc.publicnode.com`
4. `https://base-sepolia.gateway.tenderly.co`

`KNOWN_NO_CORS = /(?:drpc\.org|blastapi\.io)/i` - эти endpoint'ы не возвращают
`Access-Control-Allow-Origin` и блокируют preflight-ы. Если они окажутся в env -
автоматически выкидываются, но всё равно лучше держать в env только
CORS-friendly RPC.

## Phase 4 - Linea mainnet deploy (production)

⚠️ **Эта фаза необратима. Все pre-flight checks ОБЯЗАТЕЛЬНЫ.**

### 4.0 Известные drift-точки (Codex-аудит 2026-05-04)

Прежде чем стартовать Phase 4, в коде надо закрыть пункты:

- [ ] Production deploy script переписан: `Deploy.s.sol` сейчас reverts при HOOK_SALT,
  а ссылки в §4.3 на `DeployImplementations.s.sol` / `DeployFactory.s.sol` /
  `DeployLDAT.s.sol` пока не существуют
- [ ] Hook deploy с корректным immutable `lineaDATAddress` (предсказание адреса
  proxy через CREATE2 + mineHook salt в одном скрипте)
- [ ] `LineaDATStrategy.factoryEscape` и `LineaDATFactory.updateHookAddressUnchecked` -
  testnet escape hatches, удалить или огородить chain-id guard'ом до mainnet
- [ ] `LineaDATBot.sellEnabled = false` по умолчанию для mainnet (testnet оставлен `true`)
- [ ] `LineaDATFactory.buyAndBurnLDAT` сейчас зовёт `swapExactTokensForTokens`,
  но deployed UniversalRouter exposes `execute(...)` - переписать под v4 command flow
  (или unify через PoolManager unlock)
- [ ] Integration tests на real v4 hook fee processing + processTokenTwap +
  factory buy-and-burn (текущий `Stress.t.sol` делает TWAP no-op, `Sandwich.t.sol`
  толерантен к swap-failure)
- [ ] Stage-aware chain/address config во фронтенде (сейчас Base Sepolia hardcoded
  для hook, swapper, PoolManager slot0, Dexscreener slug)
- [ ] Keeper `package-lock.json` закоммичен, deploy через `npm ci`

### 4.1 Pre-flight checks

- [ ] §4.0 drift-точки закрыты
- [ ] Phase 3 acceptance criteria 100%
- [ ] [`50-lineadat-spec.md`](50-lineadat-spec.md) review tобой повторно
- [ ] Slither + Aderyn 0 findings
- [ ] Bot capital 3 ETH собран на твоём кошельке, готов к раздаче на Bot A/B
- [ ] `on-chaindat.com` (already secured 2026-05-05) куплен и DNS указывает на Vercel

### 4.2 Hook mining

```bash
cd contracts/
forge script script/MineHook.s.sol --rpc-url https://rpc.linea.build
# выводит salt + predicted hookAddress
# запоминаем для deploy
```

### 4.3 Deploy sequence

```bash
# 1. Deploy implementation contracts (BaseStrategy logic + Hook + Factory)
forge script script/DeployImplementations.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify \
  --etherscan-api-key $LINEASCAN_API_KEY \
  --private-key $DEPLOYER_PK

# 2. Deploy Factory + Hook (CREATE2 with salt from 4.2)
forge script script/DeployFactory.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify

# 3. Deploy LDAT proxy via Factory
forge script script/DeployLDAT.s.sol \
  --rpc-url https://rpc.linea.build \
  --broadcast \
  --verify
# this script:
#   - calls factory.deployStrategy(LINEA, 150_000e18, hookAddress, "LDAT", "LDAT", 0.02e18, ownerKeycard)
#   - sets feeAddressClaimedByOwner[LDAT_PROXY] = 0x6e0d01089976093680c881CcDcB79e0D046e2433
#   - sets twapIncrement = 0.05e18
#   - sets twapDelayInBlocks = 4
#   - initializes Uniswap v4 pool with calibrated sqrtPriceX96
#   - seeds liquidity (1B LDAT single-sided)
#   - sends LP-NFT to 0xdead

# 4. Bot up
cd ../bot
fly deploy --app lineastr-bot-a
fly deploy --app lineastr-bot-b

# 5. Frontend up
cd ../frontend
vercel --prod
```

### 4.4 Post-launch monitoring (первые 24 часа)

- [ ] Discord webhook live, на каждый cycle / processTokenTwap / alert
- [ ] Etherscan/Lineascan watcher на `LDAT_PROXY` events
- [ ] Каждый час check `currentFees`, `ethToTwap`, `lastBuyBlock` через RPC
- [ ] Bot A/B health через fly.io dashboard
- [ ] Если что-то не так в первые 24 часа - у тебя есть owner privileges, fixes возможны через `updateHookAddress` или UUPS upgrade

### 4.5 Post-launch growth (неделя 1-4)

- День 1-7: collect baseline metrics (volume, cycles, burn-rate, treasury growth)
- День 7: первый retrospective - нужно ли поднять `twapIncrement` (если ETH-side пула > 5 ETH)?
- День 14: проверка bot capital - растёт ли? Если нет - анализ почему
- День 30: если всё стабильно - публичный report на X/Discord, привлечение audit (если ROI оправдан)

## Phase 5 - Расширение (опционально, после Phase 4 success)

После того, как $LDAT работает стабильно ≥ 30 дней:
- Запуск второго токена `$XYZSTR` где underlying = $XYZ (другой токен на Linea), используя ту же factory
- На втором токене fee split = 80% / 10% LDAT-burn / 10% creator (нормальный режим)
- Каждый новый токен → новые покупки $LDAT через `buy-and-burn` block → больше дефляции LDAT
- Это и есть «база для следующих токенов на Linea» из твоего изначального запроса

## Rollback / emergency procedures

### Если найден критичный баг в первые 24 часа

1. Owner вызывает `transferOwnership` на multisig (если уже есть) или paused-pattern (если успели добавить)
2. UUPS upgrade implementation: `proxy.upgradeToAndCall(NEW_IMPL, "")` - заменяем на patched implementation
3. Public statement в Discord/X - что нашли, что фиксим, никаких тихих фиксов

### Если бот A и B одновременно упали

1. Discord alert через 10 минут downtime
2. Ты вручную вызываешь `buyTokens()` через любой кошелёк (Keycard через MetaMask UI на Lineascan) - это аналог frontend-кнопки «Buy Target $LINEA»
3. Я в течение часа поднимаю боты обратно

### Если frontend упал

Vercel free tier обычно 99.9%+ uptime. Если down - у тебя есть:
- Прямой вызов через Lineascan UI (verified contracts → Write Contract → buyTokens / sellTokens / processTokenTwap)
- Backup статический Cloudflare Pages mirror на старом коммите
