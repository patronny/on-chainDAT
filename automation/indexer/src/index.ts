import { ponder } from "ponder:registry";
import { bag, swap } from "ponder:schema";

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

/**
 * Bot purchases a 150k tLINEA bag and lists it for resale at 1.2× markup.
 * Insert a new row keyed by bagId. soldAt stays null until a buyer redeems.
 */
ponder.on("LineaDATStrategy:ERC20BoughtByProtocol", async ({ event, context }) => {
  await context.db
    .insert(bag)
    .values({
      bagId: event.args.bagId,
      blockNumber: event.block.number,
      timestamp: Number(event.block.timestamp),
      txHash: event.transaction.hash,
      paid: event.args.purchasePrice,
      listPrice: event.args.listPrice,
      soldFor: null,
      soldAt: null,
      soldTxHash: null,
      buyer: null,
    })
    .onConflictDoNothing();
});

/**
 * Buyer redeems a listed bag. Patch the matching row with sale fields.
 * `update` requires the row to exist (set above by the buy handler); if the
 * indexer somehow processes Sold before Bought, fall back to insert with
 * partial data so we don't drop the sale.
 */
ponder.on("LineaDATStrategy:ERC20SoldByProtocol", async ({ event, context }) => {
  const existing = await context.db.find(bag, { bagId: event.args.bagId });
  if (existing) {
    await context.db
      .update(bag, { bagId: event.args.bagId })
      .set({
        soldFor: event.args.price,
        soldAt: Number(event.block.timestamp),
        soldTxHash: event.transaction.hash,
        buyer: event.args.buyer,
      });
  } else {
    await context.db.insert(bag).values({
      bagId: event.args.bagId,
      blockNumber: event.block.number,
      timestamp: Number(event.block.timestamp),
      txHash: event.transaction.hash,
      paid: 0n,
      listPrice: event.args.price,
      soldFor: event.args.price,
      soldAt: Number(event.block.timestamp),
      soldTxHash: event.transaction.hash,
      buyer: event.args.buyer,
    });
  }
});

/**
 * Hook emits Trade(strategy, sqrtPriceX96, delta.amount0(), delta.amount1())
 * where delta is the BalanceDelta from the swapper's perspective in v4:
 *   - amount0 (ETH) negative  → swapper paid ETH → BUY LDAT
 *   - amount0 (ETH) positive  → swapper received ETH → SELL LDAT
 */
ponder.on("LineaDATHook:Trade", async ({ event, context }) => {
  const eth = event.args.ethAmount as bigint;
  const tok = event.args.tokenAmount as bigint;
  await context.db
    .insert(swap)
    .values({
      id: `${event.block.number}-${event.log.logIndex}`,
      blockNumber: event.block.number,
      timestamp: Number(event.block.timestamp),
      txHash: event.transaction.hash,
      trader: event.transaction.from,
      side: eth < 0n ? "buy" : "sell",
      ethAmount: abs(eth),
      tokenAmount: abs(tok),
      sqrtPriceX96: event.args.sqrtPriceX96 as bigint,
    })
    .onConflictDoNothing();
});
