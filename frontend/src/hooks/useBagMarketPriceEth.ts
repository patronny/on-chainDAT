"use client";

/**
 * Returns the ETH cost of one full bag of the underlying asset (150k tLINEA on
 * testnet, 150k $LINEA on mainnet) at the most liquid LINEA/ETH market.
 *
 * Phase 3 (Base Sepolia, current): there is no real $LINEA market — tLINEA is
 * a faucet-mintable mock. The keeper itself uses `bot.buyThreshold = 0.02 ETH`
 * as its "I have enough ETH to buy a fresh bag at market" trigger, so we use
 * the same value here. This makes the Progress bar reach 100% exactly when
 * the keeper would fire its next round.
 *
 * Phase 4 (Linea mainnet) TODO: read sqrtPriceX96 of the most liquid
 * LINEA/ETH pool on Linea L2 and multiply by `bagSize`. When that is wired
 * up, the bar still reads "X% Progress to the next bag" but the denominator
 * becomes the live mainnet bag market price.
 */
const PHASE3_BAG_MARKET_PRICE_WEI = 20_000_000_000_000_000n; // 0.02 ETH

export function useBagMarketPriceEth(): bigint {
  return PHASE3_BAG_MARKET_PRICE_WEI;
}
