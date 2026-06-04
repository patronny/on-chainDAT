import { onchainTable, index } from "ponder";

/**
 * Bag - one row per ERC20BoughtByProtocol event. Represents a 150k tLINEA bag the
 * bot purchased and listed at 1.2× markup. soldFor / soldAt populate later when
 * the bag is redeemed via ERC20SoldByProtocol.
 */
export const bag = onchainTable(
  "bag",
  (t) => ({
    bagId: t.bigint().primaryKey(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
    paid: t.bigint().notNull(),       // ETH the bot paid
    listPrice: t.bigint().notNull(),  // ETH list price (paid × 1.2)
    soldFor: t.bigint(),              // ETH actually received on redemption
    soldAt: t.integer(),              // unix seconds - null while still listed
    soldTxHash: t.hex(),
    buyer: t.hex(),
  }),
  (table) => ({
    blockIdx: index().on(table.blockNumber),
    soldAtIdx: index().on(table.soldAt),
  })
);

/**
 * Swap - one row per Trade event from the LineaDAT hook. Captures ALL swaps on
 * the hooked v4 pool: user-driven buys/sells AND the keeper's processTokenTwap
 * buy-and-burn (the burn swaps ETH->LINEADAT on the SAME hooked pool, so it also
 * fires afterSwap -> Trade, and is recorded here as a buy by the keeper EOA).
 * This is intentional: a TWAP burn is real on-chain volume and is shown on the
 * chart regardless of who triggered it, so these rows are NOT filtered out.
 */
export const swap = onchainTable(
  "swap",
  (t) => ({
    id: t.text().primaryKey(),         // `${blockNumber}-${logIndex}`
    blockNumber: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
    trader: t.hex().notNull(),         // tx.from at the time of the swap
    side: t.text().notNull(),          // "buy" | "sell"
    ethAmount: t.bigint().notNull(),   // absolute value, wei
    tokenAmount: t.bigint().notNull(), // absolute value, wei (LineaDAT has 18 decimals)
    sqrtPriceX96: t.bigint().notNull(),
  }),
  (table) => ({
    blockIdx: index().on(table.blockNumber),
    timeIdx: index().on(table.timestamp),
    sideIdx: index().on(table.side),
  })
);
