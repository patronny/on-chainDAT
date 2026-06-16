/**
 * LDAT hook ABI - the `Trade` event (read by the trades table) plus `calculateFee` /
 * `deploymentTime` views. Swaps go through the standard Universal Router (see lib/v4-swap.ts);
 * there is no custom swapper ABI anymore.
 */
export const hookAbi = [
  {
    type: "function",
    name: "calculateFee",
    stateMutability: "view",
    inputs: [
      { name: "collection", type: "address" },
      { name: "isBuying", type: "bool" },
    ],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "deploymentTime",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "strategy", type: "address", indexed: true },
      { name: "sqrtPriceX96", type: "uint160", indexed: false },
      { name: "ethAmount", type: "int128", indexed: false },
      { name: "tokenAmount", type: "int128", indexed: false },
    ],
  },
] as const;
