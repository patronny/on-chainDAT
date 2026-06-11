import { supplyResponse } from "../supply";

export const runtime = "nodejs";

/**
 * Circulating supply as a plain number. Equals total supply by construction:
 * 100% seeded into the pool at launch, LP burned, no team allocation or locks.
 */
export async function GET(req: Request) {
  return supplyResponse(req);
}
