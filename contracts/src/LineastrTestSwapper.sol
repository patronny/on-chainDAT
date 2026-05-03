// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @notice Phase 3.5 testnet smoke-test swapper. Performs an exact-input swap directly via PoolManager.unlock.
/// @dev NOT for production. UniversalRouter is the proper path for users; this is a minimal testing shim.
interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}

interface ITokenLike {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface ITokenLikeWithApprove {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract LineastrTestSwapper is IUnlockCallback {
    IPoolManager public immutable poolManager;

    error NotPoolManager();

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    struct SwapData {
        PoolKey key;
        address recipient;
        bool zeroForOne;
        int256 amountSpecified; // negative = exactInput
    }

    /// @notice Swap exact ETH (currency0=NATIVE) into the pool, send currency1 to recipient.
    function buyExactInput(PoolKey calldata key, address recipient) external payable {
        require(msg.value > 0, "Need ETH");
        SwapData memory data = SwapData({
            key: key,
            recipient: recipient,
            zeroForOne: true,
            amountSpecified: -int256(msg.value)
        });
        poolManager.unlock(abi.encode(data));
    }

    /// @notice Swap exact LINEASTR (currency1) for ETH (currency0). Caller must `approve` first.
    /// @dev Pulls `amountIn` from msg.sender via transferFrom; ETH sent to recipient via PoolManager.take.
    function sellExactInput(PoolKey calldata key, uint256 amountIn, address recipient) external {
        require(amountIn > 0, "Zero amount");
        // Pull tokens from caller (caller must approve us first)
        ITokenLikeWithApprove(Currency.unwrap(key.currency1)).transferFrom(msg.sender, address(this), amountIn);

        SwapData memory data = SwapData({
            key: key,
            recipient: recipient,
            zeroForOne: false,
            amountSpecified: -int256(amountIn)
        });
        poolManager.unlock(abi.encode(data));
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        SwapData memory data = abi.decode(raw, (SwapData));

        SwapParams memory params = SwapParams({
            zeroForOne: data.zeroForOne,
            amountSpecified: data.amountSpecified,
            sqrtPriceLimitX96: data.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });

        BalanceDelta delta = poolManager.swap(data.key, params, "");

        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        // Settle: pay what we owe (negative amounts)
        if (amount0 < 0) {
            uint256 owed0 = uint256(uint128(-amount0));
            if (Currency.unwrap(data.key.currency0) == address(0)) {
                poolManager.settle{value: owed0}();
            } else {
                poolManager.sync(data.key.currency0);
                ITokenLike(Currency.unwrap(data.key.currency0)).transfer(address(poolManager), owed0);
                poolManager.settle();
            }
        }
        if (amount1 < 0) {
            uint256 owed1 = uint256(uint128(-amount1));
            poolManager.sync(data.key.currency1);
            ITokenLike(Currency.unwrap(data.key.currency1)).transfer(address(poolManager), owed1);
            poolManager.settle();
        }

        // Take what's owed to us (positive amounts)
        if (amount0 > 0) {
            poolManager.take(data.key.currency0, data.recipient, uint256(uint128(amount0)));
        }
        if (amount1 > 0) {
            poolManager.take(data.key.currency1, data.recipient, uint256(uint128(amount1)));
        }

        return "";
    }

    receive() external payable {}
}
