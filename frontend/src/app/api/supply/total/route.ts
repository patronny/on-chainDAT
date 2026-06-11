import { supplyResponse } from "../supply";

export const runtime = "nodejs";

/** Total supply (minus verifiably burned) as a plain number - see ../supply.ts. */
export async function GET(req: Request) {
  return supplyResponse(req);
}
