/**
 * Uniswap v4 swap encoding for the Universal Router (V4_SWAP command), plus the Universal Router
 * and Permit2 ABIs the swap card needs.
 *
 * This replaces the custom LineaDATTestSwapper: $LDAT is non-transferable, but a swap through
 * the standard Universal Router works because the hook grants a transient transfer allowance in
 * afterSwap (covers PoolManager<->user moves) - no distributor whitelist required. The exact
 * command/action/param encoding below was validated on a Linea-mainnet fork against the real
 * Universal Router (0x8B844f) for both buy and sell, including the Quoter-derived slippage floor
 * (see contracts/test/ForkQuoterSlippage.t.sol).
 *
 * Buy  (ETH -> LDAT): execute{value}( [V4_SWAP], [encode(actions, params)] ), no approval.
 * Sell (LDAT -> ETH): needs Permit2 (token->Permit2 approve, Permit2->UR allowance), then execute.
 */
import { encodeAbiParameters, encodePacked, type Hex } from "viem";
import { POOL_KEY } from "./wagmi";

// Universal Router command
const V4_SWAP = 0x10;
// v4 Actions
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0c;
const TAKE_ALL = 0x0f;

const poolKeyComponents = [
  { name: "currency0", type: "address" },
  { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" },
  { name: "tickSpacing", type: "int24" },
  { name: "hooks", type: "address" },
] as const;

const exactInputSingleParam = {
  type: "tuple",
  components: [
    { name: "poolKey", type: "tuple", components: poolKeyComponents },
    { name: "zeroForOne", type: "bool" },
    { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" },
    { name: "hookData", type: "bytes" },
  ],
} as const;

const currencyAmountParam = [
  { name: "currency", type: "address" },
  { name: "amount", type: "uint256" },
] as const;

function poolKeyStruct() {
  return {
    currency0: POOL_KEY.currency0,
    currency1: POOL_KEY.currency1,
    fee: POOL_KEY.fee,
    tickSpacing: POOL_KEY.tickSpacing,
    hooks: POOL_KEY.hooks,
  };
}

/**
 * Encode a single-pool exact-input V4_SWAP for the Universal Router.
 * @param zeroForOne true = ETH(0)->LDAT(1) buy; false = LDAT(1)->ETH(0) sell
 * @param amountIn   exact input amount (wei)
 * @param amountOutMinimum slippage floor on the output (wei); revert if not met
 */
export function encodeV4Swap(
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint
): { commands: Hex; inputs: readonly Hex[] } {
  const inputCurrency = zeroForOne ? POOL_KEY.currency0 : POOL_KEY.currency1;
  const outputCurrency = zeroForOne ? POOL_KEY.currency1 : POOL_KEY.currency0;

  const actions = encodePacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
  );

  const swapParam = encodeAbiParameters(
    [exactInputSingleParam],
    [
      {
        poolKey: poolKeyStruct(),
        zeroForOne,
        amountIn,
        amountOutMinimum,
        hookData: "0x",
      },
    ]
  );
  const settleParam = encodeAbiParameters(currencyAmountParam, [inputCurrency, amountIn]);
  const takeParam = encodeAbiParameters(currencyAmountParam, [outputCurrency, amountOutMinimum]);

  const input = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actions, [swapParam, settleParam, takeParam]]
  );

  return {
    commands: encodePacked(["uint8"], [V4_SWAP]),
    inputs: [input],
  };
}

export const universalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

/**
 * Uniswap v4 Quoter. `quoteExactInputSingle` is non-view on-chain (it unlocks the PoolManager and
 * reverts internally to bubble the result) but is meant to be eth_call'd - declared `view` so viem
 * issues a plain call. Returns the exact output for the given input, including the hook's dynamic
 * fee (the quote runs the real swap path), which is exactly what we want for the slippage floor.
 */
export const v4QuoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "view",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "poolKey", type: "tuple", components: poolKeyComponents },
          { name: "zeroForOne", type: "bool" },
          { name: "exactAmount", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

/**
 * Slippage tolerance (basis points) applied to the Quoter's output to derive amountOutMinimum.
 * The Quoter already reflects the live pool + hook fee, so this only buffers price movement between
 * the quote and execution (e.g. the keeper's buy-and-burn landing in between). 200 bps = 2%, a
 * launch-safe default for a thin pool; tune here if reverts/protection need rebalancing.
 */
export const SLIPPAGE_BPS = 200n;

/** Apply SLIPPAGE_BPS downward to a quoted output amount. */
export function applySlippage(amountOut: bigint): bigint {
  return (amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
}

export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT160 = (1n << 160n) - 1n;
// uint48 max as a JS number (viem types uint48 params as `number`); 2^48-1 is within Number.MAX_SAFE_INTEGER.
export const MAX_UINT48 = Number((1n << 48n) - 1n);

export function swapDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min
}
