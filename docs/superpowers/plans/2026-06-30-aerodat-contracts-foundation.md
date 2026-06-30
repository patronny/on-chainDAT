# AERODAT Contracts Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the on-chain foundation for AERODAT: refactor the LineaDAT contract family into a generic multi-chain `DAT*` family, migrate the pool/fee currency from native ETH to the AERO ERC20, and add a new `VeAeroDATStrategy` treasury engine that buys/relists/votes veAERO veNFTs and buy-and-burns AERODAT.

**Architecture:** Fork the live LDAT suite in place. Extract the shared logic into `AbstractDATStrategy` (storage-layout-compatible with the live LDAT proxy), keep the existing bag/TWAP engine as `BagDATStrategy` (rename only), and add a sibling `VeAeroDATStrategy`. A new `DATHookAero` variant accepts AERO as `currency0` and routes all fees as ERC20 AERO instead of native ETH. The veAERO desk follows the approved design spec: buy below intrinsic (`cost <= I*(1-d_min)`), relist below intrinsic inside an on-chain corridor, vote with an on-chain transparency event, and on sale recycle the principal while burning the margin plus all voting yield (variant B). Keeper triggers, contract executes within guardrails; owner holds custody/upgrade behind a timelock.

**Tech Stack:** Solidity ^0.8.26, Foundry (forge), Solady (ERC20/UUPS/SafeTransferLib/LibClone), Uniswap v4 (PoolManager, hooks, UniversalRouter v4 router), Aerodrome VotingEscrow/Voter/RewardsDistributor, Vexy marketplace. Mocks mirror the existing `MockPoolManager`/`MockUniversalRouter`/`MockLINEA` pattern.

## Global Constraints

- All repo content strictly English: code, comments, string literals, identifiers, docs. (`feedback_repo_english_only`)
- No em-dash or en-dash anywhere; plain hyphen only. (`feedback_no_em_dash`)
- `MAX_SUPPLY = 1_000_000_000 * 1e18`, minted once to the factory at init. Constant, do not change.
- `AbstractDATStrategy` storage layout MUST stay byte-compatible with the live LDAT UUPS proxy `0x02F289E429655d0C0D713A7dFD26850A81f7cFC5` (chain 59144). New strategy state is appended only, never inserted before `__gap`; the `__gap` size shrinks by exactly the number of new slots used.
- Owner of every deployed proxy = the cold Keycard `0x1470c542D60e83EcCFE005332f5789Bd669D027C`. Deployer/keeper = the hot EOA `0xc31E...e87b`. The assistant cannot sign owner/Keycard transactions; ceremony steps are owner-run (Plan 2).
- Main-DAT fee model unchanged from LDAT: 10% dynamic swap fee, split 80% treasury / 10% burn-share / 10% creator; on the main DAT both the burn-share and creator-share go to the creator = 2% of trades. For AERODAT all of this is denominated in AERO.
- Verified Base (8453) addresses (spec section 7): veAERO/VotingEscrow `0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4`; Voter `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`; RewardsDistributor `0x227f65131A261548b057215bB1D5Ab2997964C7d`; AERO `0x940181a94A35A4569E4529A3CDfB74e38FD98631`; Vexy `0x6b478209974BD27e6cf661FEf86C68072b0d6738`.
- veAERO mechanics: a vote blocks only `withdraw`/`merge`, NOT transfer; `locked.amount` = intrinsic value `I` (AERO); vote window `[epochStart+1h, epochStart+WEEK-1h]`, weekly epochs Thu 00:00 UTC; the last hour reverts `NotWhitelistedNFT`.
- Markup rule (spec 5.3): buy only if `cost <= I*(1-d_min)`, `d_min` default 25%; relist `price` inside `cost*(1+min_margin) <= price <= I*(1-s_floor)`, target `I*(1-s_target)`, `s_target` default 10%; `min_margin` must exceed the 1% Vexy fee so net margin stays positive.
- Recycle policy = variant B (spec 5.2 step 5): on sale, principal (recorded `cost`) recycles into treasury AERO; margin (`netProceeds - cost`) + all swapped voting yield -> buy-and-burn AERODAT.
- Do NOT modify or commit the untracked LDAT-rebrand work (`contracts/test/Rename.t.sol`, `contracts/test/ForkRenameUpgrade.t.sol`) or any unrelated worktree changes. Surgical edits only.
- This is Plan 1 of 3. Plan 2 = Base deploy config + hook mining + verification + Keycard ceremony. Plan 3 = off-chain stack (keeper, Ponder indexer, monitor, frontend). Both depend on the deployed addresses and ABIs this plan produces.

---

## File Structure

**Renamed (mechanical, Task 1):**
- `contracts/src/BaseStrategy.sol` -> `AbstractDATStrategy.sol` (the shared base)
- `contracts/src/LineaDATStrategy.sol` -> `BagDATStrategy.sol`
- `contracts/src/LineaDATHook.sol` -> `DATHook.sol`
- `contracts/src/LineaDATFactory.sol` -> `DATFactory.sol`
- `contracts/src/LineaDATSeeder.sol` -> `DATSeeder.sol`
- `contracts/src/LineaDATBot.sol` -> `DATBot.sol`
- `contracts/src/LineaDATTransferRelay.sol` -> `DATTransferRelay.sol`
- `contracts/src/Interfaces.sol` (keep name; rename the interfaces inside)

**Created (new for AERODAT):**
- `contracts/src/DATHookAero.sol` - hook variant: `currency0 == AERO`, ERC20 fee path
- `contracts/src/VeAeroDATStrategy.sol` - the veAERO desk strategy
- `contracts/src/interfaces/IAerodrome.sol` - `IVotingEscrow`, `IVoter`, `IRewardsDistributor`, `IVexy` (minimal, only the methods used)
- `contracts/test/mocks/MockAERO.sol` - 18-decimal ERC20 (Solady) with `mint`
- `contracts/test/mocks/MockVotingEscrow.sol` - veNFT with `createLock`/`locked`/`transferFrom`/`safeTransferFrom`/`isApprovedOrOwner`
- `contracts/test/mocks/MockVoter.sol` - `vote`/`reset`/`claimBribes`/`claimFees` + epoch-window revert
- `contracts/test/mocks/MockVexy.sol` - `createListing`/`buyListing`/`cancelListing`, approval-based, 1% fee
- `contracts/test/BaseAero.t.sol` - `BaseAeroTest` harness wiring `MockAERO` + the veAERO mocks + `DATHookAero` + `VeAeroDATStrategy`
- `contracts/test/VeAeroBuyGuard.t.sol`, `VeAeroRelist.t.sol`, `VeAeroVote.t.sol`, `VeAeroClaimBurn.t.sol`, `VeAeroAntiRug.t.sol`, `VeAeroTimelock.t.sol`
- `contracts/test/ForkVeAero.t.sol` - fork e2e against live Aerodrome + Vexy on Base
- `contracts/test/StorageCompat.t.sol` - fork-upgrade-and-compare for the live LDAT proxy

**Preserved untouched:** `contracts/test/Rename.t.sol`, `contracts/test/ForkRenameUpgrade.t.sol`, and every script under `contracts/script/` (scripts are Plan 2).

---

## Task 1: Rename the LineaDAT* family to DAT* (mechanical, suite stays green)

This is a pure rename: file names + Solidity identifiers (contract names, interface names, import paths, the `lineaDAT*` field/function names inside the hook/factory). No behavior changes. The existing test suite must stay green throughout, proving the rename is behavior-preserving.

**Files:**
- Rename: the seven `src/LineaDAT*.sol` files and update every `import`/identifier across `src/`, `test/`, `script/`.
- Modify: all test files that reference the old names (do NOT touch `Rename.t.sol`/`ForkRenameUpgrade.t.sol` content beyond the type name they import, and only if they import a renamed type).

**Interfaces:**
- Produces: `AbstractDATStrategy`, `BagDATStrategy`, `DATHook`, `DATFactory`, `DATSeeder`, `DATBot`, `DATTransferRelay` as the new canonical type names. Internal hook field `lineaDATAddress` -> `mainDATAddress`; `buyAndBurnLineaDAT` -> `buyAndBurnMainDAT`; `lineaDATFactory` -> `datFactory`; events `LineaDATAddressSet`/`LineaDATBoughtAndBurned` -> `MainDATAddressSet`/`MainDATBoughtAndBurned`.

- [ ] **Step 1: Capture the green baseline**

Run: `cd contracts && forge build && forge test`
Expected: PASS (record the test count, e.g. "N passed"). This is the invariant Task 1 must preserve.

- [ ] **Step 2: Rename files and the contract/interface identifiers**

Rename each file and its primary type. Example for the base:

```bash
cd contracts
git mv src/BaseStrategy.sol src/AbstractDATStrategy.sol
git mv src/LineaDATStrategy.sol src/BagDATStrategy.sol
git mv src/LineaDATHook.sol src/DATHook.sol
git mv src/LineaDATFactory.sol src/DATFactory.sol
git mv src/LineaDATSeeder.sol src/DATSeeder.sol
git mv src/LineaDATBot.sol src/DATBot.sol
git mv src/LineaDATTransferRelay.sol src/DATTransferRelay.sol
```

Then inside the files rename the types: `contract BaseStrategy` -> `contract AbstractDATStrategy`, `contract LineaDATStrategy is BaseStrategy` -> `contract BagDATStrategy is AbstractDATStrategy`, `contract LineaDATHook` -> `contract DATHook`, etc. Rename the hook-internal identifiers listed in Interfaces above. Update the `__BaseStrategy_init` initializer name -> `__AbstractDATStrategy_init` (and every call site).

- [ ] **Step 3: Fix every import and reference**

Update `import` paths and type references across `src/`, `test/`, `script/`. Find all stragglers:

```bash
cd contracts && grep -rn "LineaDAT\|BaseStrategy\|__BaseStrategy_init" src test script || echo "clean"
```
Expected after fixes: only legitimate residual user-facing strings remain (the token display name "LineaDAT"/"LINEADAT" used as constructor/test arguments is data, not an identifier - leave those literal strings alone). No unresolved type identifiers.

- [ ] **Step 4: Rebuild and run the full suite**

Run: `cd contracts && forge build && forge test`
Expected: PASS with the SAME test count as Step 1. Any delta means the rename changed behavior - fix before proceeding.

- [ ] **Step 5: Commit**

```bash
cd /Users/berlenkayauheni/Desktop/LineaDAT
git add contracts/src contracts/test contracts/script
git commit -m "refactor(contracts): rename LineaDAT* family to generic DAT* (no behavior change)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Storage-layout compatibility test (live LDAT proxy upgrades cleanly to the refactored impl)

The rename must not have shifted any storage slot of the live LDAT proxy. Prove it the same way `ForkRenameUpgrade.t.sol` proves the rebrand: fork Linea, upgrade the live proxy to a freshly compiled `BagDATStrategy` impl, and assert every readable state value is byte-identical.

**Files:**
- Create: `contracts/test/StorageCompat.t.sol`

**Interfaces:**
- Consumes: `BagDATStrategy` (renamed in Task 1), the live proxy address `0x02F289E429655d0C0D713A7dFD26850A81f7cFC5`.
- Produces: nothing for later tasks; this is a guard test.

- [ ] **Step 1: Write the failing fork test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BagDATStrategy} from "../src/BagDATStrategy.sol";

/// @notice Proves the DAT* rename did not move any storage slot of the live
///         LDAT proxy: upgrade to the refactored impl and compare all state.
contract StorageCompatTest is Test {
    address constant PROXY = 0x02F289E429655d0C0D713A7dFD26850A81f7cFC5;

    function test_liveProxyUpgradesToRefactoredImplWithIdenticalState() public {
        vm.createSelectFork("https://rpc.linea.build");
        BagDATStrategy s = BagDATStrategy(payable(PROXY));

        // snapshot
        string memory nameBefore = s.name();
        string memory symBefore = s.symbol();
        uint256 supplyBefore = s.totalSupply();
        uint256 bagBefore = s.bagSize();
        uint256 incBefore = s.buyIncrement();
        uint256 feesBefore = s.currentFees();
        uint256 ethTwapBefore = s.ethToTwap();
        address ownerBefore = s.owner();
        uint256 proxyEthBefore = PROXY.balance;

        // upgrade to a freshly compiled refactored impl
        BagDATStrategy newImpl = new BagDATStrategy();
        vm.prank(ownerBefore);
        s.upgradeToAndCall(address(newImpl), "");

        // every value identical
        assertEq(s.name(), nameBefore, "name");
        assertEq(s.symbol(), symBefore, "symbol");
        assertEq(s.totalSupply(), supplyBefore, "supply");
        assertEq(s.bagSize(), bagBefore, "bagSize");
        assertEq(s.buyIncrement(), incBefore, "buyIncrement");
        assertEq(s.currentFees(), feesBefore, "currentFees");
        assertEq(s.ethToTwap(), ethTwapBefore, "ethToTwap");
        assertEq(s.owner(), ownerBefore, "owner");
        assertEq(PROXY.balance, proxyEthBefore, "proxy eth");
    }
}
```

- [ ] **Step 2: Run it to verify it passes (the rename is correct)**

Run: `cd contracts && forge test --match-contract StorageCompat --fork-url https://rpc.linea.build -vv`
Expected: PASS. If it reverts on `upgradeToAndCall` or an assert fails, the rename shifted a slot or changed the `_authorizeUpgrade` gate - go back to Task 1 and fix.

Note: this test reads getters that exist on the current live impl. If a getter name changed in the rename, use the live name for the snapshot read and the new name only after upgrade is not valid (getters are interface, not storage) - keep getter names identical across the rename (the rename targets contract/type names, not the public getter ABI).

- [ ] **Step 3: Commit**

```bash
cd /Users/berlenkayauheni/Desktop/LineaDAT
git add contracts/test/StorageCompat.t.sol
git commit -m "test(contracts): storage-compat fork test - live LDAT proxy upgrades to refactored DAT* impl

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Mock AERO + DATHookAero accepts an AERO-quoted pool

Create the AERO mock and a hook variant whose `_beforeInitialize` requires `currency0 == AERO` instead of native ETH. Behavior otherwise mirrors `DATHook` for this task; the fee-path ERC20 migration is Task 4.

**Files:**
- Create: `contracts/test/mocks/MockAERO.sol`
- Create: `contracts/src/DATHookAero.sol` (copy of `DATHook` with the currency check changed; immutable `AERO` address added to the constructor)
- Create: `contracts/test/HookAeroInit.t.sol`

**Interfaces:**
- Consumes: `DATHook` (Task 1) as the structural template; the AERO address is a constructor immutable.
- Produces: `DATHookAero(IPoolManager manager, address mainDAT, IDATFactory factory, address feeAddress, address aero)`; `DATHookAero.AERO()` view returning the immutable.

- [ ] **Step 1: Write MockAERO**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "solady/tokens/ERC20.sol";

contract MockAERO is ERC20 {
    function name() public pure override returns (string memory) { return "Aerodrome"; }
    function symbol() public pure override returns (string memory) { return "AERO"; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
```

- [ ] **Step 2: Write the failing init test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Currency} from "v4-core/types/Currency.sol";
// ... import DATHookAero, MockAERO, MockPoolManager, PoolKey ...

contract HookAeroInitTest is Test {
    function test_beforeInitialize_revertsWhenCurrency0NotAero() public {
        // Build a PoolKey with currency0 == address(0) (native ETH) and expect revert.
        // Build a PoolKey with currency0 == AERO and expect success.
    }
}
```
Write both cases concretely against a deployed `DATHookAero` (use `vm.etch`/mining-free direct deploy in the unit test; real hook-address mining is Plan 2). Assert the ETH-currency0 pool reverts with `"Only AERO/token pools are supported"` and the AERO-currency0 pool passes `_beforeInitialize`.

- [ ] **Step 3: Run to verify it fails**

Run: `cd contracts && forge test --match-contract HookAeroInit -vv`
Expected: FAIL (DATHookAero does not exist yet).

- [ ] **Step 4: Implement DATHookAero `_beforeInitialize`**

Copy `DATHook.sol` to `DATHookAero.sol`. Add `address public immutable AERO;` set in the constructor. Replace the currency check:

```solidity
// was: require(key.currency0.isAddressZero(), "Only ETH/token pools are supported");
require(Currency.unwrap(key.currency0) == AERO, "Only AERO/token pools are supported");
```
Leave the rest of the hook as-is for now (Task 4 migrates the fee path). It will not compile-clean against ETH assumptions yet only if the fee path references native value in a way the constructor change breaks - if so, stub minimally to keep this task's test compiling, and complete in Task 4.

- [ ] **Step 5: Run to verify it passes**

Run: `cd contracts && forge test --match-contract HookAeroInit -vv`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/berlenkayauheni/Desktop/LineaDAT
git add contracts/src/DATHookAero.sol contracts/test/mocks/MockAERO.sol contracts/test/HookAeroInit.t.sol
git commit -m "feat(aerodat): DATHookAero requires AERO as currency0 + MockAERO

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Migrate the fee path from native ETH to ERC20 AERO

Rework the `DATHookAero` fee distribution and the strategy `addFees` entrypoint so the 80/10/10 split moves AERO via `SafeTransferLib.safeTransfer`/`safeTransferFrom` instead of `forceSafeTransferETH`/`{value:}`. Because the pool is AERO-quoted, the swap fee is always taken in AERO (currency0) for both buy and sell directions, so the old token-fee-to-ETH swap step (`_swapToEth`) is removed.

**Files:**
- Modify: `contracts/src/DATHookAero.sol` (`_processFees`, `_afterSwap` fee-take, remove `_swapToEth`, remove `receive()`)
- Modify: `contracts/src/VeAeroDATStrategy.sol` does not exist yet; for this task add the AERO `addFees(uint256)` to a minimal `AbstractDATStrategy` hook surface OR introduce it on the new strategy in Task 7. To keep Task 4 self-contained, add an overridable `addFeesAero(uint256 amount)` to `AbstractDATStrategy` and have `DATHookAero` call it. The legacy native `addFees()` stays for `BagDATStrategy`.
- Create: `contracts/test/HookAeroFees.t.sol`

**Interfaces:**
- Consumes: `MockAERO` (Task 3), `DATHookAero` (Task 3).
- Produces: `AbstractDATStrategy.addFeesAero(uint256 amount)` (pulls AERO from the hook via `safeTransferFrom`, updates `currentFees`); `DATHookAero._processFees` paying AERO. The main-DAT redirect (burn-share -> creator) and the `feeAddressClaimedByOwner` payout both move AERO.

- [ ] **Step 1: Write the failing fee-split test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
// imports: DATHookAero, MockAERO, a minimal strategy + factory test doubles

contract HookAeroFeesTest is Test {
    // Given a fee of 1000 AERO on the main DAT (collection == mainDAT):
    //   treasury (addFeesAero) gets 80% = 800
    //   creator (feeAddress) gets burn-share 10% + creator-share 10% = 200
    // Assert MockAERO balances move exactly, and currentFees increases by 800.
    function test_mainDatFeeSplit_inAero() public {
        // arrange: mint 1000 AERO to the hook, set collection = mainDAT, feeAddress claimed = creator
        // act: call the internal _processFees via a thin test wrapper or _afterSwap path
        // assert: aero.balanceOf(creator) == 200; strategy.currentFees() == 800; hook AERO == 0
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd contracts && forge test --match-contract HookAeroFees -vv`
Expected: FAIL.

- [ ] **Step 3: Implement the ERC20 AERO fee path**

In `DATHookAero._processFees`, replace native transfers (quote the existing `forceSafeTransferETH(...)` calls and the `addFees{value:}` call) with AERO ERC20:

```solidity
function _processFees(address collection, uint256 feeAmount) internal {
    if (feeAmount == 0) return;
    uint256 depositAmount = (feeAmount * 80) / 100;
    uint256 mainBurnShare = (feeAmount * 10) / 100;
    uint256 ownerAmount = feeAmount - depositAmount - mainBurnShare;

    // main-DAT self-launch: burn-share redirects to creator (feeAddress)
    if (collection == mainDATAddress) {
        SafeTransferLib.safeTransfer(AERO, feeAddress, mainBurnShare);
    } else {
        SafeTransferLib.safeTransfer(AERO, address(datFactory), mainBurnShare);
    }

    address feeRecipient = feeAddressClaimedByOwner[collection];
    if (feeRecipient == address(0)) {
        depositAmount += ownerAmount;
    } else {
        SafeTransferLib.safeTransfer(AERO, feeRecipient, ownerAmount);
    }

    // approve + push AERO into the strategy treasury
    SafeTransferLib.safeApprove(AERO, collection, depositAmount);
    IDATStrategy(collection).addFeesAero(depositAmount);
}
```

In `_afterSwap`: take the fee in `AERO` (currency0) on both directions and drop the `!ethFee` swap branch; delete `_swapToEth` and `receive() external payable {}`. In `AbstractDATStrategy` add:

```solidity
function addFeesAero(uint256 amount) external virtual {
    if (msg.sender != hookAddress) revert OnlyHook();
    SafeTransferLib.safeTransferFrom(aeroToken(), msg.sender, address(this), amount);
    // mirror the native addFees backset logic on currentFees
    if (amount > buyIncrement) {
        uint256 currentMaxBuy = getMaxPriceForBuy();
        if (currentFees + amount < currentMaxBuy) {
            lastBuyBlock = block.number - (currentFees / buyIncrement);
        }
    }
    currentFees += amount;
}
```
where `aeroToken()` is an overridable returning the AERO address (set at init on the AERO strategy; `BagDATStrategy` does not use this path).

- [ ] **Step 4: Run to verify it passes**

Run: `cd contracts && forge test --match-contract HookAeroFees -vv`
Expected: PASS (balances move exactly, `currentFees == 800`).

- [ ] **Step 5: Run the full suite (no regressions to the ETH path)**

Run: `cd contracts && forge test`
Expected: PASS - the native `BagDATStrategy`/`DATHook` ETH path is untouched.

- [ ] **Step 6: Commit**

```bash
cd /Users/berlenkayauheni/Desktop/LineaDAT
git add contracts/src/DATHookAero.sol contracts/src/AbstractDATStrategy.sol contracts/test/HookAeroFees.t.sol
git commit -m "feat(aerodat): ERC20 AERO fee path (80/10/10 split, no native ETH)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Aerodrome + Vexy interfaces and mocks

Define minimal interfaces for the four external contracts (only the methods the desk calls) and faithful mocks for unit testing. The mocks encode the behaviors that matter: `locked.amount` as intrinsic value, the vote epoch-window revert, Vexy's approval-based 1% fee settlement in AERO, and that a vote does not block transfer.

**Files:**
- Create: `contracts/src/interfaces/IAerodrome.sol`
- Create: `contracts/test/mocks/MockVotingEscrow.sol`, `MockVoter.sol`, `MockVexy.sol`, `MockRewardsDistributor.sol`

**Interfaces:**
- Produces (used by Tasks 7-11 and the fork test):
```solidity
interface IVotingEscrow {
    struct LockedBalance { int128 amount; uint256 end; bool isPermanent; }
    function locked(uint256 tokenId) external view returns (LockedBalance memory);
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool);
}
interface IVoter {
    function vote(uint256 tokenId, address[] calldata pools, uint256[] calldata weights) external;
    function reset(uint256 tokenId) external;
    function claimBribes(address[] calldata bribes, address[][] calldata tokens, uint256 tokenId) external;
    function claimFees(address[] calldata fees, address[][] calldata tokens, uint256 tokenId) external;
}
interface IRewardsDistributor { function claim(uint256 tokenId) external returns (uint256); }
interface IVexy {
    function createListing(uint256 tokenId, address payToken, uint256 price, uint256 expiry) external returns (uint256 listingId);
    function buyListing(uint256 listingId) external;
    function cancelListing(uint256 listingId) external;
    function listings(uint256 listingId) external view returns (address seller, uint256 tokenId, address payToken, uint256 price, uint256 expiry);
}
```
- The exact production ABIs are pinned in Task 12's fork test against live Base; if a signature differs there, update this interface and re-run unit tests.

- [ ] **Step 1: Write the interfaces file** (`IAerodrome.sol`) with the block above, English NatSpc.

- [ ] **Step 2: Write MockVotingEscrow**

A minimal ERC721-ish veNFT: `createLock(uint256 amount, ...) returns (tokenId)` that pulls AERO and records `locked[tokenId].amount = int128(amount)`; `ownerOf`/`transferFrom`/`safeTransferFrom`/`isApprovedOrOwner`; a `voted[tokenId]` flag set by the mock Voter that blocks `withdraw`/`merge` (not present here) but explicitly does NOT block `transferFrom` (assert this in Task 9).

- [ ] **Step 3: Write MockVoter**

`vote` records allocations and sets `escrow.setVoted(tokenId,true)`; reverts `NotWhitelistedNFT` when `block.timestamp > epochStart + WEEK - 1 hours` (compute epoch from a settable `WEEK`/`epochStart`); `claimBribes`/`claimFees` transfer pre-seeded reward tokens to `msg.sender`.

- [ ] **Step 4: Write MockVexy**

`createListing` requires the lister is owner/approved and records the listing (NFT stays with the seller - approval based); `buyListing` pulls `price` AERO from the buyer, sends `price * 99 / 100` to the seller (1% fee retained by the mock), and `transferFrom`s the veNFT to the buyer; `cancelListing` clears it.

- [ ] **Step 5: Write MockRewardsDistributor**

`claim(tokenId)` returns a settable rebase amount and calls `escrow.increaseAmount(tokenId, rebase)` (auto-compound into the lock), pulling pre-seeded AERO.

- [ ] **Step 6: Build**

Run: `cd contracts && forge build`
Expected: compiles. No test yet (mocks are exercised by Tasks 7-11).

- [ ] **Step 7: Commit**

```bash
cd /Users/berlenkayauheni/Desktop/LineaDAT
git add contracts/src/interfaces/IAerodrome.sol contracts/test/mocks/Mock*.sol
git commit -m "feat(aerodat): Aerodrome + Vexy interfaces and faithful unit mocks

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: VeAeroDATStrategy skeleton + BaseAeroTest harness + initialize

Create the new strategy extending `AbstractDATStrategy`, with its appended state (book of owned veNFTs + recorded cost, AERO/escrow/voter/vexy/distributor addresses, `d_min`/`s_target`/`s_floor`/`min_margin`/per-epoch budget/maxPrice, keeper, timelock), `onERC721Received`, and the test harness.

**Files:**
- Create: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/BaseAero.t.sol`
- Create: `contracts/test/VeAeroInit.t.sol`

**Interfaces:**
- Consumes: `AbstractDATStrategy` (Task 1, `addFeesAero` from Task 4), `IAerodrome` + mocks (Task 5), `MockAERO` (Task 3).
- Produces:
```solidity
function initialize(
    address aero, address escrow, address voter, address rewardsDistributor, address vexy,
    address hook, string memory name_, string memory symbol_, uint256 buyIncrement_, address owner_
) external initializer;
function setKeeper(address) external onlyOwner;          // immediate
function setDiscountParams(uint256 dMin, uint256 sTarget, uint256 sFloor, uint256 minMargin) external; // timelocked (Task 11)
function setEpochBudget(uint256 maxAeroPerEpoch, uint256 maxPrice) external; // timelocked
// book
function ownedCount() external view returns (uint256);
function costOf(uint256 tokenId) external view returns (uint256);
function aeroToken() public view override returns (address);
```
Appended storage (after the inherited `__gap`, shrink `AbstractDATStrategy.__gap` is NOT done; instead `VeAeroDATStrategy` declares its own state and its own `__gap` - the inherited base layout is frozen):
```solidity
address public aero;
address public escrow;
address public voter;
address public rewardsDistributor;
address public vexy;
address public keeper;
uint256 public dMin;        // 1e18 = 100%, default 0.25e18
uint256 public sTarget;     // default 0.10e18
uint256 public sFloor;      // relist hard ceiling discount, default 0.05e18
uint256 public minMargin;   // > Vexy 1%, default 0.02e18
uint256 public maxAeroPerEpoch;
uint256 public maxPrice;
uint256 public spentThisEpoch;
uint256 public currentEpoch;
uint256[] internal _book;                 // owned tokenIds
mapping(uint256 => uint256) public costOf; // tokenId -> recorded AERO cost (0 = not owned)
uint256[40] private __gap;
```

- [ ] **Step 1: Write the failing init test** (`VeAeroInit.t.sol`): deploy `VeAeroDATStrategy` impl, clone via a test factory (or direct `initialize` on a proxy), assert `aeroToken()==AERO`, `dMin()==0.25e18`, `sTarget()==0.10e18`, `keeper()==0` until set, `owner()==owner`, `totalSupply()==MAX_SUPPLY`, `balanceOf(factory)==MAX_SUPPLY`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd contracts && forge test --match-contract VeAeroInit -vv`
Expected: FAIL.

- [ ] **Step 3: Implement the skeleton + initialize**

Implement `initialize` (calls `__AbstractDATStrategy_init`, sets the addresses, sets default discount params), `aeroToken()` override returning `aero`, `onERC721Received` returning the selector, and the view getters. Set defaults `dMin=0.25e18`, `sTarget=0.10e18`, `sFloor=0.05e18`, `minMargin=0.02e18`.

- [ ] **Step 4: Write BaseAeroTest harness** (`BaseAero.t.sol`): mirror `Base.t.sol` but deploy `MockAERO`, the veAERO mocks, `DATHookAero` (or the test contract acting as hook), a test factory, and a `VeAeroDATStrategy` proxy. Helpers: `_seedTreasuryAero(uint256)`, `_listOnVexy(uint256 tokenId, uint256 price)`, `_mintVeNft(uint256 lockedAmount) returns (tokenId)`, `_prankKeeper`.

- [ ] **Step 5: Run to verify init passes**

Run: `cd contracts && forge test --match-contract VeAeroInit -vv`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/berlenkayauheni/Desktop/LineaDAT
git add contracts/src/VeAeroDATStrategy.sol contracts/test/BaseAero.t.sol contracts/test/VeAeroInit.t.sol
git commit -m "feat(aerodat): VeAeroDATStrategy skeleton + initialize + BaseAero test harness

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Buy guard - purchase only below intrinsic, within budget (self-dealing defense)

`buyVeNFT(listingId)` (keeper-only) reads the listing price and the veNFT intrinsic `I = locked.amount`, enforces `cost <= I*(1-dMin)` and the per-epoch budget + `maxPrice`, calls `Vexy.buyListing`, and records `costOf[tokenId] = cost`, pushes to `_book`. This is the primary anti-theft control: no oracle, both sides in AERO.

**Files:**
- Modify: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/VeAeroBuyGuard.t.sol`

**Interfaces:**
- Consumes: `IVexy.listings`/`buyListing`, `IVotingEscrow.locked`, the skeleton state (Task 6).
- Produces: `function buyVeNFT(uint256 listingId) external onlyKeeper;` records `costOf[tokenId]`, increments `spentThisEpoch`, emits `VeNftBought(tokenId, cost, intrinsic)`.

- [ ] **Step 1: Write the failing tests**

```solidity
// in VeAeroBuyGuard.t.sol (extends BaseAeroTest)
function test_buy_succeedsAtDeepDiscount() public {
    uint256 id = _mintVeNft(1000e18);            // I = 1000
    _listOnVexy(id, 700e18);                       // 30% discount, >= dMin 25%
    _seedTreasuryAero(700e18);
    _prankKeeper(); strategy.buyVeNFT(listingId);
    assertEq(strategy.costOf(id), 700e18);
    assertEq(strategy.ownedCount(), 1);
    assertEq(IVotingEscrow(escrow).ownerOf(id), address(strategy));
}
function test_buy_revertsWhenDiscountTooShallow() public {
    uint256 id = _mintVeNft(1000e18);
    _listOnVexy(id, 800e18);                        // only 20% < dMin 25%
    _seedTreasuryAero(800e18);
    _prankKeeper(); vm.expectRevert(DiscountTooShallow.selector);
    strategy.buyVeNFT(listingId);
}
function test_buy_revertsOverEpochBudget() public { /* set maxAeroPerEpoch=500e18; buy 700 reverts BudgetExceeded */ }
function test_buy_revertsAboveMaxPrice() public { /* set maxPrice=600e18; price 700 reverts MaxPriceExceeded */ }
function test_buy_revertsForNonKeeper() public { /* alice -> NotKeeper */ }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd contracts && forge test --match-contract VeAeroBuyGuard -vv`
Expected: FAIL (`buyVeNFT` undefined).

- [ ] **Step 3: Implement `buyVeNFT`**

```solidity
modifier onlyKeeper() { if (msg.sender != keeper) revert NotKeeper(); _; }

function buyVeNFT(uint256 listingId) external onlyKeeper nonReentrant {
    (, uint256 tokenId, address payToken, uint256 price,) = IVexy(vexy).listings(listingId);
    require(payToken == aero, "pay AERO");
    int128 amt = IVotingEscrow(escrow).locked(tokenId).amount;
    require(amt > 0, "no lock");
    uint256 intrinsic = uint256(int256(amt));
    // cost <= I * (1 - dMin)
    if (price > intrinsic * (1e18 - dMin) / 1e18) revert DiscountTooShallow();
    if (price > maxPrice) revert MaxPriceExceeded();
    _rollEpoch();
    if (spentThisEpoch + price > maxAeroPerEpoch) revert BudgetExceeded();
    spentThisEpoch += price;

    SafeTransferLib.safeApprove(aero, vexy, price);
    IVexy(vexy).buyListing(listingId);            // pulls AERO, sends veNFT here
    require(IVotingEscrow(escrow).ownerOf(tokenId) == address(this), "not received");
    costOf[tokenId] = price;
    _book.push(tokenId);
    emit VeNftBought(tokenId, price, intrinsic);
}
```
`_rollEpoch()` resets `spentThisEpoch` when `currentEpoch` advances (epoch = `block.timestamp / 1 weeks`).

- [ ] **Step 4: Run to verify they pass**

Run: `cd contracts && forge test --match-contract VeAeroBuyGuard -vv`
Expected: PASS (all five).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/VeAeroDATStrategy.sol contracts/test/VeAeroBuyGuard.t.sol
git commit -m "feat(aerodat): buyVeNFT guard - cost<=I*(1-dMin) + budget/maxPrice (anti self-dealing)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Relist inside the on-chain corridor

`relistVeNFT(tokenId, price)` (keeper-only) enforces `cost*(1+minMargin) <= price <= I*(1-sFloor)` and lists on Vexy in AERO. The keeper picks the real price inside the corridor (target `I*(1-sTarget)`); if the corridor is empty (shallow buy discount), relist reverts and the desk just keeps voting.

**Files:**
- Modify: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/VeAeroRelist.t.sol`

**Interfaces:**
- Consumes: `IVexy.createListing`, `costOf`, `IVotingEscrow.locked`.
- Produces: `function relistVeNFT(uint256 tokenId, uint256 price, uint256 expiry) external onlyKeeper returns (uint256 listingId);` emits `VeNftRelisted(tokenId, price, listingId)`.

- [ ] **Step 1: Write the failing tests**

```solidity
function test_relist_atTargetSucceeds() public {
    // own id with I=1000, cost=700; target = 1000*0.90 = 900; corridor [700*1.02=714 .. 1000*0.95=950]
    // relist at 900 -> ok
}
function test_relist_revertsBelowMargin() public { /* price 710 < 714 -> MarginTooLow */ }
function test_relist_revertsAboveFloorCeiling() public { /* price 960 > 950 -> AboveFloor */ }
function test_relist_revertsEmptyCorridor() public {
    // cost=800 (shallow 20% disc bypassed via owner pre-seed for test), I=1000:
    // lower 800*1.02=816 > upper 1000*0.95=950? no; choose cost=940 -> 940*1.02=958.8 > 950 -> empty -> revert
}
function test_relist_revertsForNonKeeper() public {}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd contracts && forge test --match-contract VeAeroRelist -vv`
Expected: FAIL.

- [ ] **Step 3: Implement `relistVeNFT`**

```solidity
function relistVeNFT(uint256 tokenId, uint256 price, uint256 expiry)
    external onlyKeeper nonReentrant returns (uint256 listingId)
{
    uint256 cost = costOf[tokenId];
    require(cost != 0, "not owned");
    uint256 intrinsic = uint256(int256(IVotingEscrow(escrow).locked(tokenId).amount));
    uint256 lower = cost * (1e18 + minMargin) / 1e18;
    uint256 upper = intrinsic * (1e18 - sFloor) / 1e18;
    require(lower <= upper, "empty corridor");
    if (price < lower) revert MarginTooLow();
    if (price > upper) revert AboveFloor();
    IVotingEscrow(escrow).isApprovedOrOwner(address(this), tokenId); // sanity
    // approval-based: approve Vexy to move this veNFT on sale
    IERC721(escrow).approve(vexy, tokenId);
    listingId = IVexy(vexy).createListing(tokenId, aero, price, expiry);
    emit VeNftRelisted(tokenId, price, listingId);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd contracts && forge test --match-contract VeAeroRelist -vv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/VeAeroDATStrategy.sol contracts/test/VeAeroRelist.t.sol
git commit -m "feat(aerodat): relistVeNFT corridor cost*(1+minMargin)<=price<=I*(1-sFloor)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Vote with an on-chain transparency event + window guard + confirm transfer not blocked

`voteVeNFT(tokenId, pools, weights)` (keeper-only) calls `Voter.vote` inside `[epochStart+1h, epochStart+WEEK-1h]` and emits the full `(pools, weights)` breakdown on-chain. A test proves a voted, listed veNFT can still be sold (`transferFrom` succeeds) - the property the whole model rests on.

**Files:**
- Modify: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/VeAeroVote.t.sol`

**Interfaces:**
- Consumes: `IVoter.vote`, the mock epoch window.
- Produces: `function voteVeNFT(uint256 tokenId, address[] calldata pools, uint256[] calldata weights) external onlyKeeper;` emits `Voted(tokenId, pools, weights, epoch)`.

- [ ] **Step 1: Write the failing tests**

```solidity
function test_vote_emitsBreakdownAndRecords() public { /* expectEmit Voted(...); call; mock records allocations */ }
function test_vote_revertsInLastHour() public { /* warp to epochStart+WEEK-30min -> NotWhitelistedNFT */ }
function test_votedNft_isStillTransferable() public {
    // own + vote id, then list + buyer buys -> ownerOf == buyer (vote did NOT lock transfer)
}
function test_vote_revertsForNonKeeper() public {}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd contracts && forge test --match-contract VeAeroVote -vv`
Expected: FAIL.

- [ ] **Step 3: Implement `voteVeNFT`** - validate `pools.length == weights.length`, call `IVoter(voter).vote(tokenId, pools, weights)` (the Voter mock enforces the window), emit `Voted`. Do not add our own window check; rely on the Voter revert (matches production) but document it.

- [ ] **Step 4: Run to verify they pass**

Run: `cd contracts && forge test --match-contract VeAeroVote -vv`
Expected: PASS - including `test_votedNft_isStillTransferable`.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/VeAeroDATStrategy.sol contracts/test/VeAeroVote.t.sol
git commit -m "feat(aerodat): voteVeNFT with on-chain vote-transparency event; prove voted veNFT stays transferable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Claim + swap-to-AERO + variant-B split (principal recycles, margin + yield burn)

Two flows: (a) `harvest(tokenId, ...)` claims bribes/fees + rebase, swaps reward tokens to AERO (`minOut`), and routes 100% of swapped yield to buy-and-burn; (b) `onSaleSettled(tokenId)` (called after a Vexy sale removes the veNFT from the book) splits the realized AERO: `cost` stays as treasury `currentFees` (recycle), `margin = netProceeds - cost` goes to buy-and-burn. Buy-and-burn swaps AERO -> AERODAT -> DEAD via the v4 router (the AERO analog of `BagDATStrategy.unlockCallback`).

**Files:**
- Modify: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/VeAeroClaimBurn.t.sol`

**Interfaces:**
- Consumes: `IVoter.claimBribes`/`claimFees`, `IRewardsDistributor.claim`, the v4 router via `router()` (immutable arg), `MockAERO`.
- Produces:
```solidity
function harvest(uint256 tokenId, address[] calldata bribes, address[][] calldata bribeTokens,
                 address[] calldata fees, address[][] calldata feeTokens,
                 SwapRoute[] calldata routes, uint256 minAeroOut) external onlyKeeper;
function settleSale(uint256 tokenId) external onlyKeeper; // detects the veNFT left the book; recycle cost, burn margin
function _buyAndBurnAerodat(uint256 aeroIn) internal; // AERO -> AERODAT -> DEAD
event Harvested(uint256 tokenId, uint256 aeroToBurn);
event SaleSettled(uint256 tokenId, uint256 recycledPrincipal, uint256 burnedMargin);
```

- [ ] **Step 1: Write the failing tests**

```solidity
function test_settleSale_recyclesPrincipalBurnsMargin() public {
    // own id cost=700; list 900; buyer buys -> contract holds 891 AERO (1% Vexy fee)
    // settleSale: currentFees += 700 (recycle); burn 191 -> AERODAT to DEAD
    // assert: aerodat.balanceOf(DEAD) increased; strategy.currentFees() += 700; book removed id; costOf[id]==0
}
function test_settleSale_zeroMarginWhenNetEqualsCost() public { /* net==cost -> burn 0, recycle all */ }
function test_harvest_swapsYieldAndBurnsAll() public {
    // seed bribe token X to mock voter; claim -> swap X->AERO (minOut) -> 100% buy&burn
    // assert aerodat.balanceOf(DEAD) increased by the burned amount; currentFees unchanged (yield does not recycle)
}
function test_harvest_respectsMinOut() public { /* route returns < minAeroOut -> revert SlippageTooHigh */ }
function test_settleSale_revertsIfStillOwned() public { /* veNFT still in book -> revert */ }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd contracts && forge test --match-contract VeAeroClaimBurn -vv`
Expected: FAIL.

- [ ] **Step 3: Implement harvest, settleSale, and `_buyAndBurnAerodat`**

`settleSale`: require `IVotingEscrow(escrow).ownerOf(tokenId) != address(this)` (it sold), require `costOf[tokenId] != 0`. Compute `received` = the AERO delta credited from the sale (track via a `pendingSaleProceeds[tokenId]` set in an `onVexySale` hook, or measure `aero.balanceOf(this)` against a checkpoint). `principal = min(cost, received)`, `margin = received - principal`. `currentFees += principal`; if `margin > 0` `_buyAndBurnAerodat(margin)`. Remove `tokenId` from `_book`, zero `costOf`. Emit `SaleSettled`.

`harvest`: call `claimBribes`/`claimFees`/distributor `claim`; for each `SwapRoute` swap reward token -> AERO; require total `>= minAeroOut`; `_buyAndBurnAerodat(totalAeroFromYield)`. Yield never touches `currentFees`.

`_buyAndBurnAerodat(aeroIn)`: mirror `BagDATStrategy.unlockCallback` but with `currency0 = AERO`, `currency1 = AERODAT (address(this))`, `zeroForOne = true` (AERO in, AERODAT out), output taken to `DEAD_ADDRESS`. Emit `BoughtAndBurned`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd contracts && forge test --match-contract VeAeroClaimBurn -vv`
Expected: PASS (all five).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/VeAeroDATStrategy.sol contracts/test/VeAeroClaimBurn.t.sol
git commit -m "feat(aerodat): variant-B split - recycle principal, burn margin + 100% yield to AERODAT/DEAD

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Anti-rug limits + role split + emergency rescue

Lock down the trust model (spec section 6): keeper can only buy/relist/vote/harvest/settle within guards; owner holds upgrade/params/rescue. Buy-and-burn and `settleSale`/`harvest` claim paths cannot be paused in a way that strands value (no pause on the burn or on reading proceeds). `rescue` cannot move core assets (owned veNFTs, the AERODAT supply held for burn accounting) and is owner-only.

**Files:**
- Modify: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/VeAeroAntiRug.t.sol`

**Interfaces:**
- Produces: `function rescue(address token, uint256 amount, address to) external onlyOwner;` reverts for `token == aero`-while-it-would-strip-treasury beyond a non-core balance? No: simplest safe rule - `rescue` may sweep stray non-core tokens (random airdrops, stuck reward dust) but reverts when `token == address(this)` (AERODAT) or when called to move a veNFT the book still owns. Keeper cannot call `rescue`, cannot `transferFrom` a veNFT to an arbitrary address (only Vexy via `relistVeNFT`/sale), cannot change owner/keeper/params.

- [ ] **Step 1: Write the failing tests**

```solidity
function test_keeper_cannotRescue() public { /* keeper -> NotOwner */ }
function test_keeper_cannotTransferVeNftOut() public { /* no public path lets keeper move a veNFT to alice */ }
function test_rescue_revertsOnAerodat() public { /* owner rescue(address(this),...) -> revert CoreAsset */ }
function test_rescue_revertsOnOwnedVeNft() public { /* cannot rescue a veNFT still in book */ }
function test_rescue_sweepsStrayToken() public { /* random ERC20 airdrop -> owner sweeps to treasury, ok */ }
function test_mint_onlyAtInit() public { /* no external mint path exists; total supply constant after init */ }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd contracts && forge test --match-contract VeAeroAntiRug -vv`
Expected: FAIL.

- [ ] **Step 3: Implement `rescue` + assert the role boundaries** - add `rescue` with the `CoreAsset` and owned-veNFT guards; confirm there is NO function that lets the keeper move a veNFT except through `relistVeNFT` (Vexy approval) and the resulting Vexy sale. Confirm no mint path beyond `initialize`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd contracts && forge test --match-contract VeAeroAntiRug -vv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/VeAeroDATStrategy.sol contracts/test/VeAeroAntiRug.t.sol
git commit -m "feat(aerodat): anti-rug limits - keeper cannot rescue/exfiltrate, rescue blocks core assets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Timelock on sensitive owner setters

Sensitive owner actions (changing `dMin`/`sTarget`/`sFloor`/`minMargin`, `keeper`, `maxAeroPerEpoch`/`maxPrice`, and the swapper/route allowlist if added) execute behind a timelock: a two-step `queue` then `execute` after `TIMELOCK_DELAY`. Upgrade (`_authorizeUpgrade`) stays owner-only and MAY also be queued; spec leaves immediate-upgrade acceptable pre-Phase-G, so keep upgrade immediate but timelock the parameter setters.

**Files:**
- Modify: `contracts/src/VeAeroDATStrategy.sol`
- Create: `contracts/test/VeAeroTimelock.t.sol`

**Interfaces:**
- Produces:
```solidity
uint256 public constant TIMELOCK_DELAY = 2 days;
function queueParamChange(bytes32 id, bytes calldata data) external onlyOwner;
function executeParamChange(bytes32 id, bytes calldata data) external onlyOwner; // after delay
function setDiscountParams(...) external onlyTimelock;
function setEpochBudget(...) external onlyTimelock;
function setKeeper(address) external onlyTimelock;
event ParamChangeQueued(bytes32 id, uint256 eta);
```

- [ ] **Step 1: Write the failing tests**

```solidity
function test_setDiscountParams_revertsWithoutQueue() public { /* direct call -> NotTimelock */ }
function test_paramChange_revertsBeforeDelay() public { /* queue, warp < delay, execute -> TooEarly */ }
function test_paramChange_executesAfterDelay() public { /* queue, warp >= delay, execute -> dMin updated */ }
function test_queue_revertsForNonOwner() public {}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd contracts && forge test --match-contract VeAeroTimelock -vv`
Expected: FAIL.

- [ ] **Step 3: Implement the queue/execute timelock** routing the three setters through `onlyTimelock` (only callable from `executeParamChange` after the ETA). Store `eta[id] = block.timestamp + TIMELOCK_DELAY` on queue; `executeParamChange` checks `block.timestamp >= eta[id]` and dispatches by decoding `data`.

- [ ] **Step 4: Run to verify they pass**

Run: `cd contracts && forge test --match-contract VeAeroTimelock -vv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/VeAeroDATStrategy.sol contracts/test/VeAeroTimelock.t.sol
git commit -m "feat(aerodat): timelock on discount/budget/keeper setters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Fork e2e against live Aerodrome + Vexy (pin real ABIs) + empirical vote-then-transfer

Run the full desk cycle against live Base contracts to pin the real ABIs (the spec marks these "still to verify"). This is the gate that confirms the mocks matched reality. It also runs the empirical proof the spec requires before any capital: vote a veNFT and `transferFrom` it in the same epoch on the live `VotingEscrow`.

**Files:**
- Create: `contracts/test/ForkVeAero.t.sol`

**Interfaces:**
- Consumes: the live Base addresses (Global Constraints), `VeAeroDATStrategy`, `IAerodrome`.

- [ ] **Step 1: Write the fork tests**

```solidity
// fork Base: vm.createSelectFork(BASE_RPC)
function test_live_voteThenTransferSameEpoch() public {
    // impersonate a real veAERO holder (find one via Voter/escrow events or a known large locker),
    // vote(tokenId, pools, weights) in-window, then transferFrom(holder, alice, tokenId) -> succeeds.
    // This is the model-critical empirical check: a vote must NOT block transfer.
}
function test_live_vexyListAndBuyShape() public {
    // read an existing AERO-settled Vexy listing; assert listings(id) decodes to the IVexy shape;
    // if signatures differ, this test fails loudly -> update IAerodrome + re-run unit suite.
}
function test_live_fullCycleOnFork() public {
    // seed strategy with AERO (vm.deal/deal AERO via the token's storage or a whale impersonation),
    // buyVeNFT against a real listing (or a freshly created one), relist, vote, simulate a buyer,
    // settleSale -> recycle principal + burn margin; assert AERODAT at DEAD increased.
}
```

- [ ] **Step 2: Run the fork suite**

Run: `cd contracts && forge test --match-contract ForkVeAero --fork-url https://mainnet.base.org -vv`
Expected: PASS. If `test_live_vexyListAndBuyShape` or a decode fails, the production ABI differs from `IAerodrome` - fix the interface, re-run the unit suite (Tasks 7-11), then re-run this.

- [ ] **Step 3: Run the entire test suite once more**

Run: `cd contracts && forge test`
Expected: PASS (unit suite), and the fork suite passes with `--fork-url`. Record the final count.

- [ ] **Step 4: Commit**

```bash
git add contracts/test/ForkVeAero.t.sol contracts/src/interfaces/IAerodrome.sol
git commit -m "test(aerodat): fork e2e vs live Aerodrome+Vexy; pin ABIs; empirical vote-then-transfer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

Run this checklist against the spec (`docs/superpowers/specs/2026-06-25-aerodat-launch-design.md`) with fresh eyes after implementation:

**1. Spec coverage:**
- Section 3 (token side copied): Tasks 1-2 (rename + storage compat keep the Solady ERC20 / UUPS / non-transferable gate / 1e9 supply intact).
- Section 3 NEW (pool + fees in AERO): Tasks 3-4 (currency check + ERC20 fee path) and Task 10 (`_buyAndBurnAerodat` in AERO).
- Section 4 (DAT* refactor + layout compat): Tasks 1-2.
- Section 5 (treasury engine 5.1-5.4): Task 6 (state/book), 7 (buy guard 5.3), 8 (relist corridor 5.3), 9 (vote window + event), 10 (claim + variant-B split 5.2/5.4 + rebase note).
- Section 6 (trust/security, anti-rug, self-dealing bond): Task 7 (bond), 9 (vote event), 11 (anti-rug + roles), 12 (timelock); empirical vote-then-transfer: Task 13.
- Section 7 (verified addresses): Global Constraints + Task 5 interfaces + Task 13 pins them.
- Audit (section 6, confirmed): external, scheduled in Plan 2 phase 5 - noted, not a code task here.
- Deferred (side->main tribute; last-hour whitelist): correctly out of scope.

**2. Placeholder scan:** no "TBD"/"TODO"/"implement later"; each code step shows real Solidity or a precise test contract. The only deliberate deferral is the exact external ABI, which Task 13 pins against live Base by design (TDD: mocks first, fork-verify last) - not a placeholder.

**3. Type consistency:** `addFeesAero(uint256)`, `aeroToken()`, `buyVeNFT(uint256)`, `relistVeNFT(uint256,uint256,uint256)`, `voteVeNFT(uint256,address[],uint256[])`, `harvest(...)`, `settleSale(uint256)`, `_buyAndBurnAerodat(uint256)`, `costOf`/`_book`, `dMin`/`sTarget`/`sFloor`/`minMargin`, `onlyKeeper`/`onlyTimelock` are used identically across tasks. Errors: `DiscountTooShallow`, `MaxPriceExceeded`, `BudgetExceeded`, `NotKeeper`, `MarginTooLow`, `AboveFloor`, `CoreAsset`, `NotOwner`, `NotTimelock`, `TooEarly`, `SlippageTooHigh`.

**Open numeric params deferred to deploy-time (Plan 2 Keycard ceremony), not blocking this plan:** seed AERO size, `buyIncrement` (AERO, ~2s Base blocks), final `dMin`/`sTarget`/`sFloor`/`minMargin`/`maxAeroPerEpoch`/`maxPrice`, `scheduledLaunchTime`, and the named audit vendor.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-aerodat-contracts-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach? (Note: Tasks 2, 13 require network fork access to Linea/Base RPCs; Task 13 also needs a funded-whale impersonation strategy. The external audit and the Keycard ceremony are Plan 2, owner-run.)
