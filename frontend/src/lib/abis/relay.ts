/**
 * LineaDATTransferRelay - minimal ABI.
 * Deployed + verified on Linea mainnet 0xe6e4bAff1E8b186420733833A043Ae28132195dB.
 * send(to, amount): pulls `amount` $LDAT from the caller (needs approval), burns 1%
 * to the dead address, delivers 99% to `to`.
 */
export const relayAbi = [
  {
    type: "function",
    name: "send",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  { type: "function", name: "FEE_BPS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "LDAT", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "POOL_MANAGER", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "DEAD", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "event",
    name: "Sent",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "burned", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "InvalidRecipient", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
] as const;
