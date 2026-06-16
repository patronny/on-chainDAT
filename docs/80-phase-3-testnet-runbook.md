# Phase 3 - Base Sepolia Testnet Deployment Runbook

**Дата:** 2026-05-01
**Статус:** Готов к деплою (deploy script успешно протестирован на Anvil fork Base Sepolia)
**Network:** Base Sepolia (chainId 84532)
**Deploy script:** [`contracts/script/DeployBaseSepolia.s.sol`](../contracts/script/DeployBaseSepolia.s.sol)

---

## Что делает Phase 3

Phase 3 - это live валидация LDAT + бота на публичном тестнете (Base Sepolia, ~7 дней). Цель:

1. Подтвердить, что LineaDATStrategy корректно работает в реальной L2-среде (block timing, gas, sequencer ordering)
2. Подтвердить, что LineaDATBot успешно крутит buyTokens / sellTokens циклы под live keeper trigger'ом (cron-job.org / GitHub Actions)
3. Frontend (Next.js + RainbowKit + wagmi) работает с реальным RPC и смарт-контрактами
4. Собрать метрики 7-дневного непрерывного прогона: число успешных раундов, средний `paid` per buy, gas стоимость, времена-до-продажи

---

## Scope decisions (зафиксированы для Phase 3)

**Деплоится:**
- ✅ `MockTLINEA` - testnet stub для $LINEA (faucet-enabled ERC20)
- ✅ `LineaDATStrategy` impl + proxy через `LineaDATFactory`
- ✅ `LineaDATBot` (multicall keeper-bot)
- ✅ Owner/keeper/feeAddress настраиваются через env vars

**НЕ деплоится в Phase 3 (отложено до Phase 4 mainnet):**
- ❌ CREATE2-mined hook (`LineaDATHook`) - вместо него используется deployer EOA как hookAddress
- ❌ Uniswap v4 pool init (требует hook с правильными permission flags)
- ❌ LP-NFT seed (требует pool)
- ❌ `processTokenTwap` execution (требует pool для swap'ов - bot's `_tryTwap` поймает revert через try/catch и продолжит)

**Почему такой scope?** Phase 3 main goal - bot validation under live network conditions. P2P `buyTokens` / `sellTokens` не зависят от Uniswap pool - они работают через `currentFees` и `onSale` state. Достаточно, чтобы deployer EOA мог сидить fees через `strategy.addFees{value:X}()` (он же hookAddress). Phase 4 mainnet добавит full hook + pool init.

---

## Pre-flight checklist

- [ ] Deployer EOA создан, имеет ≥0.5 ETH на Base Sepolia
  - Faucet: https://www.alchemy.com/faucets/base-sepolia (или Coinbase, или QuickNode)
- [ ] RPC endpoint выбран:
  - **Default:** `https://base-sepolia.drpc.org` (no API key, ~50 RPS)
  - **Alternative 1:** `https://base-sepolia-rpc.publicnode.com` (no key, ~30 RPS)
  - **Alternative 2:** `https://sepolia.base.org` (default, ~25 RPS, иногда rate-limit'ы)
  - **Premium:** `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` (с Alchemy free tier, ~25 RPS, 30M CU/мес)
- [ ] Все env vars готовы:
  ```bash
  export BASE_SEPOLIA_RPC=https://base-sepolia.drpc.org
  export PRIVATE_KEY=0x...                       # deployer (also acts as hook)
  export OWNER_EOA=0x1470c542...                 # owner of strategy + bot + tLINEA (Keycard)
  export KEEPER_EOA=0x...                        # keeper EOA (can be same as deployer)
  export FEE_ADDRESS=0x6e0d0108...               # protocol fee recipient
  ```

---

## Deploy sequence

### Step 1 - Запустить deploy script

```bash
cd contracts/

forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --private-key $PRIVATE_KEY \
  -vvvv
```

**Ожидаемый output:** addresses всех 5 контрактов (MockTLINEA, impl, factory, proxy, bot) + summary с next-steps.

**Estimated gas:** ~8.4M total = ~0.0001 ETH at typical Base Sepolia gas prices (~0.011 gwei). Деплой стоит копейки.

### Step 2 - Сохранить адреса

После успешного деплоя forge сохранит broadcast в `contracts/broadcast/DeployBaseSepolia.s.sol/84532/run-latest.json`. Извлеки 5 адресов:

```bash
jq -r '.transactions[] | select(.contractAddress != null) | "\(.contractName): \(.contractAddress)"' \
  contracts/broadcast/DeployBaseSepolia.s.sol/84532/run-latest.json
```

Также скопируй адреса в `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://base-sepolia.drpc.org
NEXT_PUBLIC_TLINEA_ADDRESS=0x...
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_STRATEGY_ADDRESS=0x...
NEXT_PUBLIC_BOT_ADDRESS=0x...
```

### Step 3 - Отправить ETH на бота для sellTokens

Бот тратит ETH на `sellTokens` (платит listPrice бэкам). Owner отправляет 5 ETH на адрес бота:

```bash
cast send $BOT --value 5ether --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

### Step 4 - Verify на Basescan (Base Sepolia explorer)

```bash
forge verify-contract \
  --rpc-url $BASE_SEPOLIA_RPC \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY \
  $STRATEGY_IMPL_ADDR \
  src/LineaDATStrategy.sol:LineaDATStrategy
```

(Опционально, но желательно для прозрачности frontend.)

### Step 5 - Настроить keeper cron

Вариант A - **GitHub Actions** (рекомендован):

Создать `.github/workflows/keeper.yml`:

```yaml
name: LDAT Keeper
on:
  schedule:
    - cron: '*/10 * * * *'  # каждые 10 минут
  workflow_dispatch:
jobs:
  run-round:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: |
          cd contracts
          forge script script/RunBotRound.s.sol:RunBotRound \
            --rpc-url ${{ secrets.BASE_SEPOLIA_RPC }} \
            --broadcast \
            --private-key ${{ secrets.KEEPER_PK }}
        env:
          BOT: ${{ secrets.BOT_ADDRESS }}
          ROUND_ID: ${{ github.run_number }}
```

Secrets needed: `BASE_SEPOLIA_RPC`, `KEEPER_PK`, `BOT_ADDRESS`.

Вариант B - **cron-job.org**:

cron-job.org делает HTTP requests, не tx, поэтому надо поднять простой relay-сервер (например, Vercel serverless function), который при HTTP-запросе вызывает `bot.executeRound()`. Усложнение - лучше использовать вариант A.

### Step 6 - Периодически сидить fees

Чтобы бот имел работу (`availableFunds > 0`), кто-то должен пополнять `currentFees`. На testnet это делает deployer EOA через helper-скрипт:

```bash
STRATEGY=0x... SEED_AMOUNT=0.05ether \
  forge script script/SeedFees.s.sol:SeedFees \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast --private-key $PRIVATE_KEY
```

Запускать каждые 1-2 часа (можно тоже через GitHub Actions cron).

---

## Acceptance criteria для Phase 3

- [ ] Deploy script успешно выполнен на Base Sepolia
- [ ] Бот делает ≥ 50 успешных `buyTokens` за 7 дней непрерывной работы
- [ ] Frontend подключается к Base Sepolia, показывает strategy state, позволяет user'ам swap (через faucet → buy bag → sell bag flow)
- [ ] Keeper cron работает без сбоев 7 дней (≤ 5 пропущенных раундов из ~1000)
- [ ] Все 3 design variants frontend полностью responsive на iPhone SE / iPhone 14 Pro / iPad / desktop
- [ ] Lighthouse mobile score ≥ 85
- [ ] Метрики Phase 3 задокументированы в `docs/80-phase-3-results.md` после observation period

---

## Что дальше: Phase 4

После успешного Phase 3 → Phase 4 (Linea mainnet production):
1. CREATE2 hook mining + full hook deploy через `Deploy.s.sol`
2. Uniswap v4 pool initialization с calibrated `sqrtPriceX96`
3. LP-NFT seed с single-sided liquidity (1B LDAT, [-887220, +175020])
4. Transfer LP-NFT → `0x000…dEaD`
5. Lineascan verification всех контрактов
6. Покупка домена `on-chaindat.com` (already secured 2026-05-05), deploy frontend на Vercel
7. Production keeper migration (если testnet keeper стабилен - оставить ту же архитектуру)
