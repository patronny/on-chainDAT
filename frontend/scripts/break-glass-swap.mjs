/**
 * BREAK-GLASS swap CLI for $LINEADAT - trades directly against the v4 pool when the website is down.
 *
 * $LINEADAT is non-transferable: it can only move through the pool's hook, which grants a transient
 * transfer allowance in afterSwap. This script builds the EXACT same UniversalRouter.execute(V4_SWAP)
 * call the swap card builds (see frontend/src/lib/v4-swap.ts), so it needs no website and no backend.
 *
 * Run from the `frontend/` dir (uses its viem install). No build step.
 *
 *   PRIVATE_KEY=0x...  node scripts/break-glass-swap.mjs buy  0.01     # spend 0.01 ETH  -> LINEADAT
 *   PRIVATE_KEY=0x...  node scripts/break-glass-swap.mjs sell 50000    # sell  50000 LINEADAT -> ETH
 *
 * Optional env:
 *   RPC_URL        Linea RPC (default https://rpc.linea.build; prefer your Infura key)
 *   SLIPPAGE_BPS   slippage floor in bps (default 200 = 2%)
 *   DRY_RUN=1      quote + simulate only, send nothing
 */
import {
  createPublicClient, createWalletClient, http,
  encodeAbiParameters, encodePacked, parseEther, parseUnits,
  formatEther, formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { linea } from "viem/chains";

// ---- Linea mainnet addresses (authoritative; from ForkQuoterSlippage.t.sol / README) ----
const TOKEN   = "0x02F289E429655d0C0D713A7dFD26850A81f7cFC5"; // $LINEADAT strategy proxy = currency1
const HOOK    = "0xA0FAD88E899D7a70179A473140111AB4016F6444";
const UR      = "0x8B844f885672f333Bc0042cB669255f93a4C1E6b"; // Universal Router (v4)
const QUOTER  = "0x2C125569C0BeE20A66E33E5491C552B37EBD9934"; // v4 Quoter
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

const POOL_KEY = {
  currency0: "0x0000000000000000000000000000000000000000", // ETH
  currency1: TOKEN,
  fee: 0x800000, // DYNAMIC_FEE_FLAG
  tickSpacing: 60,
  hooks: HOOK,
};

const V4_SWAP = 0x10, SWAP_EXACT_IN_SINGLE = 0x06, SETTLE_ALL = 0x0c, TAKE_ALL = 0x0f;
const SLIPPAGE_BPS = BigInt(process.env.SLIPPAGE_BPS ?? "200");
const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = Number((1n << 48n) - 1n);

const poolKeyComponents = [
  { name: "currency0", type: "address" }, { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" },
];
const exactInputSingleParam = {
  type: "tuple",
  components: [
    { name: "poolKey", type: "tuple", components: poolKeyComponents },
    { name: "zeroForOne", type: "bool" }, { name: "amountIn", type: "uint128" },
    { name: "amountOutMinimum", type: "uint128" }, { name: "hookData", type: "bytes" },
  ],
};
const currencyAmountParam = [{ name: "currency", type: "address" }, { name: "amount", type: "uint256" }];

// Identical encoding to frontend/src/lib/v4-swap.ts:encodeV4Swap.
function encodeV4Swap(zeroForOne, amountIn, amountOutMinimum) {
  const inputCurrency = zeroForOne ? POOL_KEY.currency0 : POOL_KEY.currency1;
  const outputCurrency = zeroForOne ? POOL_KEY.currency1 : POOL_KEY.currency0;
  const actions = encodePacked(["uint8", "uint8", "uint8"], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);
  const swapParam = encodeAbiParameters([exactInputSingleParam], [{
    poolKey: POOL_KEY, zeroForOne, amountIn, amountOutMinimum, hookData: "0x",
  }]);
  const settleParam = encodeAbiParameters(currencyAmountParam, [inputCurrency, amountIn]);
  const takeParam = encodeAbiParameters(currencyAmountParam, [outputCurrency, amountOutMinimum]);
  const input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, [swapParam, settleParam, takeParam]]);
  return { commands: encodePacked(["uint8"], [V4_SWAP]), inputs: [input] };
}

const urAbi = [{ type: "function", name: "execute", stateMutability: "payable",
  inputs: [{ name: "commands", type: "bytes" }, { name: "inputs", type: "bytes[]" }, { name: "deadline", type: "uint256" }], outputs: [] }];
const quoterAbi = [{ type: "function", name: "quoteExactInputSingle", stateMutability: "view",
  inputs: [{ name: "params", type: "tuple", components: [
    { name: "poolKey", type: "tuple", components: poolKeyComponents },
    { name: "zeroForOne", type: "bool" }, { name: "exactAmount", type: "uint128" }, { name: "hookData", type: "bytes" }] }],
  outputs: [{ name: "amountOut", type: "uint256" }, { name: "gasEstimate", type: "uint256" }] }];
const permit2Abi = [{ type: "function", name: "approve", stateMutability: "nonpayable",
  inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [] }];
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
];

async function main() {
  const [side, amountStr] = process.argv.slice(2);
  if (!["buy", "sell"].includes(side) || !amountStr) {
    console.error("usage: node scripts/break-glass-swap.mjs <buy|sell> <amount>\n  buy <ethAmount> | sell <tokenAmount>");
    process.exit(1);
  }
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("set PRIVATE_KEY env var");
  const dryRun = process.env.DRY_RUN === "1";
  const transport = http(process.env.RPC_URL || "https://rpc.linea.build");
  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const pub = createPublicClient({ chain: linea, transport });
  const wallet = createWalletClient({ account, chain: linea, transport });

  const decimals = await pub.readContract({ address: TOKEN, abi: erc20Abi, functionName: "decimals" });
  const zeroForOne = side === "buy";
  const amountIn = zeroForOne ? parseEther(amountStr) : parseUnits(amountStr, decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

  // 1) Quote (runs the real swap path incl. hook dynamic fee) -> slippage floor.
  const [amountOut] = await pub.readContract({ address: QUOTER, abi: quoterAbi, functionName: "quoteExactInputSingle",
    args: [{ poolKey: POOL_KEY, zeroForOne, exactAmount: amountIn, hookData: "0x" }] });
  const minOut = (amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
  const fmtOut = zeroForOne ? `${formatUnits(amountOut, decimals)} LINEADAT` : `${formatEther(amountOut)} ETH`;
  const fmtMin = zeroForOne ? `${formatUnits(minOut, decimals)} LINEADAT` : `${formatEther(minOut)} ETH`;
  console.log(`${side.toUpperCase()}  in=${amountStr} ${zeroForOne ? "ETH" : "LINEADAT"}  quote=${fmtOut}  min(@${SLIPPAGE_BPS}bps)=${fmtMin}`);

  const { commands, inputs } = encodeV4Swap(zeroForOne, amountIn, minOut);

  // 2) Sell only: approve token->Permit2 (once), then Permit2->UR (per trade). approve() does NOT
  //    trigger the non-transferable hook (no token moves); the move happens inside the swap.
  if (!zeroForOne && !dryRun) {
    const cur = await pub.readContract({ address: TOKEN, abi: erc20Abi, functionName: "allowance", args: [account.address, PERMIT2] });
    if (cur < amountIn) {
      console.log("approve LINEADAT -> Permit2 (max)...");
      const h = await wallet.writeContract({ address: TOKEN, abi: erc20Abi, functionName: "approve", args: [PERMIT2, (1n << 256n) - 1n] });
      await pub.waitForTransactionReceipt({ hash: h });
    }
    console.log("Permit2.approve(LINEADAT, UniversalRouter)...");
    const h2 = await wallet.writeContract({ address: PERMIT2, abi: permit2Abi, functionName: "approve",
      args: [TOKEN, UR, MAX_UINT160, MAX_UINT48] });
    await pub.waitForTransactionReceipt({ hash: h2 });
  }

  // 3) execute (buy carries ETH value; sell carries none).
  const value = zeroForOne ? amountIn : 0n;
  const sim = await pub.simulateContract({ account, address: UR, abi: urAbi, functionName: "execute", args: [commands, inputs, deadline], value });
  if (dryRun) { console.log("DRY_RUN ok - simulation passed, nothing sent."); return; }
  const hash = await wallet.writeContract(sim.request);
  console.log(`sent: https://lineascan.build/tx/${hash}`);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  console.log(`status: ${rcpt.status}  block: ${rcpt.blockNumber}`);
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
