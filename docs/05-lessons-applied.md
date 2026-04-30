# 05. Уроки применённые в LINEASTR

Этот документ — прямой свод правил для нашего контракта. Каждое правило — следствие конкретного инцидента из истории TokenStrategy ([`03-incidents-and-fixes.md`](03-incidents-and-fixes.md)) или особенности Linea ([`04-linea-l2-infrastructure.md`](04-linea-l2-infrastructure.md)).

Это **не план разработки**. План разработки утверждаем отдельно — после согласования параметров. Это база решений для плана.

---

## Правило 1. Hook — единственная точка enforcement

**Источник:** Инцидент 5 — PNKSTR без хука; fee обходятся альт-пулами.

**Правило:**
1. `_afterAddLiquidity` callback **revert'ит** если `caller != factory && caller != owner` — нельзя создать «теневой» пул с тем же hook
2. Сам ERC-20 LINEASTR в `transfer()` / `transferFrom()` **revert'ит**, если `to ∉ {PoolManager, UniversalRouter, Permit2, owner, treasury, knownBot}` или если sender не whitelisted-роутер
3. Любой выход из токена возможен только через канонический пул, в котором сидит наш хук
4. Whitelist хранится в storage хука / токена, владелец может только **расширять** (не сужать) до renounce

**Альтернатива (не выбираем):** мягкое объявление «fee только в каноническом пуле» без enforcement — тот же класс PNKSTR-bug.

---

## Правило 2. Pre-renounce окно

**Источник:** Инцидент 1 — wrapper-фикс PNKSTR из-за раннего renounce.

**Правило:**
1. **30–90 дней** post-launch, не renounce ownership
2. В течение этого окна владелец имеет ограниченные emergency powers:
   - `pause()` / `unpause()` хука (только pause swaps; transfers внутри whitelist остаются работать)
   - `setHookAddress(newHook)` — миграция на новый хук (для критических багов)
   - `setFeeAddress(...)` — изменение fee recipient
   - **НЕТ** `mint()`, **НЕТ** `withdraw()`, **НЕТ** прямого доступа к treasury
3. После окна — `renounceOwnership()` (Solady-style, irrevocable)
4. Alarm-event при approach renounce date (~7 дней до)

---

## Правило 3. Bot для buy-target деплоится вместе с токеном

**Источник:** Инцидент 2 — slow-rug $813K из-за отсутствия бота.

**Правило:**
1. Параллельно со смартконтрактом — задеплоен off-chain bot-runner на Linea
2. Бот мониторит `currentFees` через event/`eth_getStorageAt` и вызывает `buyTokens()`, как только `currentFees ≥ bagSizeInETH * (1 + buffer)`
3. **Buffer ~10%** — чтобы покрыть slippage
4. Бот авторизован вызывать `buyTokens()` на любой EOA (он не привилегирован, любой может — но бот гарантирует что мы первые при достижении threshold)
5. **In-contract guard:** если `currentFees > 2 * bagSizeInETH` без вызова `buyTokens()` за N блоков → автоматический cap fee'я (новые swaps не аккумулируют fee пока bag не куплен). Это **on-chain failsafe** на случай если бот уйдёт в даунтайм.

---

## Правило 4. Мягкая fee curve

**Источник:** Инцидент 4 — 95–99% initial fee создаёт slow-rug окно.

**Правило (предварительно, обсудим):**

| Время от launch | Buy fee | Sell fee |
|---|---|---|
| 0–5 минут | 50% | 50% |
| 5–10 минут | 40% | 50% |
| 10–20 минут | 25% | 30% |
| 20–30 минут | 15% | 15% |
| > 30 минут (steady state) | **10%** | **10%** |

- **Anti-snipe:** sniper-снайпер на 0-минутке всё равно потеряет 50% — убийственно. Но окно short → нет slow-rug потенциала.
- **Sell-tax spike после bag-sell:** на 30 минут после `sellTokens()` sell-fee поднимается до 25% (от PNKSTR-style anti-MEV — хорошая идея, копируем).

**Per-block fee cap:**
- Если в одном блоке > 5% supply'а торгуется через хук → fee на следующие 3 блока × 1.5
- Защищает от MEV-bundle / sandwich

---

## Правило 5. Fee distribution жёстко зашит

**Источник:** Pure design choice — это и есть наша главная кастомизация vs wBTCStrategy.

**Правило:**
- **8% → treasury** (накапливается до bag-buy $LINEA)
- **2% → dev (мне)** на адрес из immutable arg (или storage slot, до renounce — менять можно)
- **0% — нет PNKSTR-burn**, нет creator royalty

В коде:
```solidity
function _processFees(uint256 totalFee) internal {
    uint256 treasuryFee = (totalFee * 8000) / 10000;  // 80% от fee = 8% от swap
    uint256 devFee = totalFee - treasuryFee;          // 20% от fee = 2% от swap
    // accumulate treasury, send dev
}
```

Никаких внешних wrapper'ов для расчёта. Никаких конфигурируемых переключателей. Жёстко.

---

## Правило 6. TWAP guard перед buyTokens / sellTokens

**Источник:** wBTCStrategy v3 уже это имеет — берём как-есть.

**Правило:**
1. Перед `buyTokens()` (swap ETH→$LINEA) и `sellTokens()` (получаем ETH из bag-sale) — проверяем TWAP
2. `_getCurrentPrice()` через `StateLibrary.getSlot0` для $LINEA/ETH пула
3. Если current price отклоняется от TWAP > X% (e.g. 5% за 30 секунд) → revert `TwapDelayNotMet` или `PriceTooHigh/Low`
4. Это защищает от MEV-манипуляции цены через flashloan непосредственно перед buyTokens

---

## Правило 7. Underlying validation

**Источник:** Инцидент 3 — SquiggleStrategy валидировал NFT по contract вместо `(contract, projectId)`.

**Правило:**
1. `LINEA_ADDRESS` хранится как **immutable constant** в LineaStrategy (`address constant LINEA = 0x1789e0043623282D5DCc7F213d703C6D8BAfBB04`)
2. Все internal interactions с underlying идут через эту константу
3. `initialize()` проверяет, что factory/owner передал именно эту константу
4. Перед mainnet:
   - Прочитать source `0x1789...bb04` на Lineascan
   - Verify: стандартный ERC-20, no fee-on-transfer, no rebase, no transfer-blacklist для нашего контракта
5. Если когда-то $LINEA сделают upgradeable (Consensys-controlled) и поведение изменится — это OOS для нашего контракта; нашу систему может потребоваться остановить через `pause()` (см. Правило 2)

---

## Правило 8. Audit-ready code (даже без paid аудита)

**Правило:**
1. **Slither full run** перед каждым деплоем (Linea Sepolia + mainnet)
2. **Aderyn full run** перед каждым деплоем
3. **Manual review** by `@patronny` (sequential read через все .sol файлы перед deploy)
4. Solidity 0.8.30, optimizer 200, Cancun (совпадает с wBTCStrategy)
5. **Solady ERC-20** (gas + battle-tested) — не OZ
6. Все custom errors (никаких `require(..., "string")`)
7. ReentrancyGuard на все external state-mutating функции хука и proxy
8. **Forge-coverage > 95%** перед mainnet
9. Fork-tests на Linea state (через `--fork-url linea`)
10. Invariant tests (foundry invariant fuzzing) на главные инварианты:
    - `totalSupply` монотонно убывает (только burn, нет mint после initialize)
    - `treasuryBalance + bagsHeld * bagPrice + currentFees == всё накопленное за жизнь`
    - `transferToken == зачислено` (no fee-on-transfer pollution)

---

## Правило 9. Linea-specific оптимизации

**Источник:** docs.linea.build — calldata = главный cost driver.

**Правило:**
1. **Минимум calldata** в hook callbacks: PoolKey пакаем плотно, хелперы возвращают tight-packed bytes
2. **Storage writes минимизировать:** агрегировать fee в memory, потом одним SSTORE
3. **Use transient storage (TLOAD/TSTORE)** где Uniswap v4 уже это делает (re-entry guards, lock/unlock pattern)
4. **Block.timestamp на L2** работает идентично mainnet — таймеры стандартные
5. **Не полагаться на `block.basefee`** для критической логики — Linea имеет свой gas formula
6. **Tolerance для sequencer pause:** не использовать hard time-locks короче 6 часов (precedent — 2-часовая остановка во время Velocore exploit)

---

## Правило 10. Treasury isolation (для будущего расширения)

LINEASTR — single-token deployment, treasury isolation сейчас не критична. Но если когда-то:
- Делаем sequel-токен (например, `wstETHSTR` тоже на Linea) — общего хука НЕ делаем
- Каждый strategy-токен — свой proxy + свой хук
- Это исключает класс bug «один арбитраж дренит несколько strategies» (Инцидент 2)

---

## Правило 11. Communication / docs

**Источник:** Rhynotic не публиковал post-mortem'ов; держатели всегда были в неведении.

**Правило:**
1. Полная transparency о Linea Stage-0 limitations (instantly upgradable bridge, centralized sequencer, 8–32h withdraw)
2. Public README указывает: «нет аудита», «учтены уроки TokenStrategy (5 публичных инцидентов)»
3. Если когда-то найдётся баг — public post-mortem с tx-хешами, код-фиксами, timeline

---

## Сводный чеклист для будущего плана разработки

### Контракты
- [ ] `LineaStrategy.sol` — main ERC-20 + Yoyo orchestration (forked ERC20Strategy.sol)
- [ ] `BaseStrategy.sol` — abstract parent (forked from TokenWorks)
- [ ] `LineaStrategyHook.sol` — Uniswap v4 hook (forked ERC20StrategyHook.sol, удалён PNKSTR-burn)
- [ ] `LineaStrategyFactory.sol` — single-token factory (упрощён vs IERC20StrategyFactory; нужен для clone-pattern совместимости)
- [ ] `Interfaces.sol` — IValidRouter (без IPunkStrategy)

### Off-chain
- [ ] Bot-runner для `buyTokens()` — node.js / Rust
- [ ] Frontend «Buy Target» button (опционально — Rhynotic жалел что не сделал)
- [ ] Monitoring dashboard (Dune?)

### Параметры (обсудим перед написанием кода)
- [ ] `bagSize` для $LINEA (X $LINEA = Y ETH eq на момент launch)
- [ ] `priceMultiplier` (1.2x как у wBTCStrategy или другой?)
- [ ] `totalSupply` (1B как стандарт TokenStrategy?)
- [ ] Initial fee curve конкретные числа
- [ ] Per-block fee cap thresholds
- [ ] Pre-renounce period длина (30 / 60 / 90 дней)
- [ ] Whitelist initial set
- [ ] Bot threshold buffer (10% нормально)

### Тестирование
- [ ] Unit tests (forge test)
- [ ] Fork tests против Linea Sepolia → mainnet
- [ ] Invariant tests
- [ ] Slither + Aderyn clean run
- [ ] Manual review

### Деплой
- [ ] Verify Uniswap v4 PoolManager на Linea (критическая зависимость)
- [ ] Linea Sepolia testnet deploy + 1 неделя тестов
- [ ] Mainnet deploy
- [ ] Verify на Lineascan
- [ ] Регистрация в linea-token-list

---

## Что НЕ делаем

- ❌ Не renounce сразу
- ❌ Не используем 95% initial fee
- ❌ Не оставляем bot «на потом»
- ❌ Не интегрируемся с PNKSTR
- ❌ Не делаем cross-chain
- ❌ Не делаем launchpad для third-party tokens
- ❌ Не используем upgradeable proxy после renounce — это implicit, потому что после renounce нет owner для upgrade-call'а

---

См. также `00-overview.md` для high-level картины.
