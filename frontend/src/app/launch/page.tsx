import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * /launch — placeholder for future strategies launchpad.
 * In Phase 3 (testnet) only LineaDAT exists. Phase 4+ may enable launching new LineaDAT-family strategies.
 */
export default function LaunchPage() {
  return (
    <>
      <Header />
      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)]">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">Launch a new strategy</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Launch is currently disabled. The first strategy (LineaDAT) is live and is the only deployment in Phase 3.
          New strategies will be enabled after the LineaDAT mainnet launch on Linea (Phase 4).
        </p>

        <Card className="p-6 sm:p-10 max-w-2xl">
          <h2 className="text-xl font-display font-semibold mb-3">Coming in Phase 4</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>· Custom underlying token (any ERC-20 on Linea)</li>
            <li>· Custom bag size and buyIncrement</li>
            <li>· Custom name + symbol for the strategy token</li>
            <li>· Auto-deployed Uniswap v4 pool with seeded LP</li>
          </ul>
          <Button asChild className="mt-6">
            <Link href="/">Back to home</Link>
          </Button>
        </Card>
      </main>
      <Footer />
    </>
  );
}
