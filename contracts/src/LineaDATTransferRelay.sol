// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title LineaDATTransferRelay
/// @notice Minimal, stateless, ownerless relay that enables wallet-to-wallet
///         transfers of $LDAT, which is otherwise non-transferable by design.
/// @dev $LDAT is the LineaDATStrategy proxy (a Solady ERC20). Its
///      `_afterTokenTransfer` gate reverts `InvalidTransfer()` on any
///      wallet-to-wallet move unless `isDistributor[from] || isDistributor[to]`.
///      The gate checks the LOGICAL from/to (not msg.sender), so a single
///      `transferFrom(user, recipient)` reverts. This relay must therefore be
///      whitelisted via `LineaDATStrategy.setDistributor(relay, true)` and
///      two-hop the move: `transferFrom(user -> relay)` then
///      `transfer(relay -> recipient)`. Both hops clear the gate solely because
///      the relay is the distributor; the relay's own bytecode is the only thing
///      that gates the move, so it is deliberately kept tiny, immutable, and
///      stateless (holds no balance between calls, has no owner, no upgrade path).
///
///      A mandatory 1% fee is burned to the dead address on every transfer.
///      Burning to DEAD also clears the gate (from == relay == distributor) and
///      accrues to `balanceOf(DEAD)`, which is exactly what every $LDAT burn
///      counter reads (supply API, snapshot, status page, the Telegram monitor),
///      so transfer burns surface in all of them automatically.
///
///      `LDAT` and `POOL_MANAGER` are set once at construction and can never
///      change, so a deployed relay can only ever move $LDAT.
contract LineaDATTransferRelay {
    using SafeTransferLib for address;

    /// @notice The $LDAT token this relay is permanently bound to.
    address public immutable LDAT;
    /// @notice The Uniswap v4 PoolManager. A bare ERC20 transfer of $LDAT here
    ///         would land uncredited (no v4 delta) and be locked forever, so it
    ///         is blocked as a recipient.
    address public immutable POOL_MANAGER;

    /// @notice Dead address; the 1% fee is burned here.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    /// @notice Transfer fee in basis points (100 bps = 1%), burned on every transfer.
    uint256 public constant FEE_BPS = 100;

    /// @notice Emitted on every relayed transfer.
    /// @param from The sender (caller).
    /// @param to The recipient.
    /// @param amount Total $LDAT pulled from the sender (fee inclusive).
    /// @param burned The 1% fee burned to DEAD.
    event Sent(address indexed from, address indexed to, uint256 amount, uint256 burned);

    /// @notice Recipient is the zero address, this relay, or the PoolManager.
    error InvalidRecipient();
    /// @notice Transfer amount is zero.
    error ZeroAmount();
    /// @notice Constructor argument was the zero address.
    error ZeroAddress();

    /// @param ldat The $LDAT strategy proxy address.
    /// @param poolManager The Uniswap v4 PoolManager address.
    constructor(address ldat, address poolManager) {
        if (ldat == address(0) || poolManager == address(0)) revert ZeroAddress();
        LDAT = ldat;
        POOL_MANAGER = poolManager;
    }

    /// @notice Transfer `amount` of $LDAT from the caller to `to`, burning a 1% fee.
    /// @dev The caller must first `approve(relay, amount)` on the $LDAT token.
    ///      The recipient receives `amount - amount / 100`; the fee `amount / 100`
    ///      is burned to DEAD. (Integer rounding: amounts below 100 wei carry a
    ///      zero fee; this is dust, far below any real transfer.)
    /// @param to Recipient. Cannot be the zero address, this relay, or the PoolManager.
    /// @param amount Total amount pulled from the caller (fee inclusive). Must be > 0.
    function send(address to, uint256 amount) external {
        if (to == address(0) || to == address(this) || to == POOL_MANAGER) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();

        uint256 fee = amount / 100; // 1%

        // hop 1: pull the full amount from the caller (allowance-checked by the token).
        LDAT.safeTransferFrom(msg.sender, address(this), amount);
        // burn the fee (relay -> DEAD passes the gate because the relay is a distributor).
        if (fee != 0) LDAT.safeTransfer(DEAD, fee);
        // hop 2: deliver the remainder to the recipient.
        LDAT.safeTransfer(to, amount - fee);

        emit Sent(msg.sender, to, amount, fee);
    }
}
