import { createConfig } from "ponder";
import { strategyAbi } from "./abis/strategy";
import { hookAbi } from "./abis/hook";

// Chain-switchable via env so ONE config serves both the live Base Sepolia testnet
// (lineastr-indexer) and the Linea mainnet rehearsal/launch (lineadat-indexer).
// Defaults = Base Sepolia 84532, so the live testnet indexer is unaffected when no env is set.
//   Testnet (default): no env needed.
//   Linea mainnet:     CHAIN_ID=59144 PONDER_RPC_URL_59144=<infura> STRATEGY_ADDRESS=... HOOK_ADDRESS=... START_BLOCK=...
const CHAIN_ID = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 84532;
const CHAIN_NAME =
  process.env.PONDER_CHAIN_NAME ?? (CHAIN_ID === 59144 ? "linea" : "baseSepolia");

// Defaults reflect the canonical Phase 3.5 LineaDAT atomic-launch deployment
// (Base Sepolia, 2026-05-05). Override on Fly via fly secrets after any redeploy / for mainnet.
const STRATEGY = (process.env.STRATEGY_ADDRESS ??
  "0x615937AE1eB71248DA407F39AcFea9288CF1784F") as `0x${string}`;
const HOOK = (process.env.HOOK_ADDRESS ??
  "0x512dd6871eb3a28aD07885A9B75a2e26eDa2a444") as `0x${string}`;

// Block at or before strategy proxy deployment. Indexer scans from here forward.
// Override via START_BLOCK env on Fly. Default: LineaDAT Phase 3.5 launch block (Base Sepolia).
const START_BLOCK = process.env.START_BLOCK
  ? Number(process.env.START_BLOCK)
  : 41112701;

// RPC config supports a comma-separated fallback list to survive single-provider outages
// (publicnode timed out for ~hours on 2026-05-08, blocking the indexer and the 24h Change widget).
// Env var follows Ponder convention PONDER_RPC_URL_<chainId>. Testnet default keeps the free
// fallback chain; Linea mainnet uses paid Infura set via fly secrets PONDER_RPC_URL_59144.
const RPC_RAW =
  process.env[`PONDER_RPC_URL_${CHAIN_ID}`] ??
  (CHAIN_ID === 84532
    ? "https://base-sepolia.drpc.org,https://sepolia.base.org,https://base-sepolia-rpc.publicnode.com"
    : "https://rpc.linea.build");
const RPC_LIST = RPC_RAW.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RPC = RPC_LIST.length > 1 ? RPC_LIST : RPC_LIST[0];

// Realtime head-poll interval (ms). Ponder's default is 1000ms = one eth_getBlockByNumber
// per second (~86k/day), which alone was ~80% of the daily Infura credit bill. Linea blocks
// are ~2-3s, so polling every 2s roughly halves head-poll volume with no meaningful lag for
// the trades/history table. Override via PONDER_POLLING_INTERVAL_MS (raise it further to save
// more; the chart no longer depends on this indexer - it reads from GeckoTerminal).
const POLLING_INTERVAL_MS = process.env.PONDER_POLLING_INTERVAL_MS
  ? Number(process.env.PONDER_POLLING_INTERVAL_MS)
  : 2000;

export default createConfig({
  chains: {
    [CHAIN_NAME]: {
      id: CHAIN_ID,
      rpc: RPC,
      pollingInterval: POLLING_INTERVAL_MS,
    },
  },
  contracts: {
    LineaDATStrategy: {
      abi: strategyAbi,
      chain: CHAIN_NAME,
      address: STRATEGY,
      startBlock: START_BLOCK,
    },
    LineaDATHook: {
      abi: hookAbi,
      chain: CHAIN_NAME,
      address: HOOK,
      startBlock: START_BLOCK,
    },
  },
  database: {
    kind: "pglite",
    directory: process.env.PONDER_DATABASE_DIRECTORY ?? "./.ponder/pglite",
  },
});
