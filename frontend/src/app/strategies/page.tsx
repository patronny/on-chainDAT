import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ADDR } from "@/lib/wagmi";

/**
 * /strategies — index of all known LINEASTR strategies on the current chain.
 *
 * Phase 3 has only 1 strategy (LineaDAT itself). Phase 4 may add more strategies for the
 * LineaDAT-family if the launchpad pattern is enabled.
 */
export default function StrategiesIndexPage() {
  const strategies = [
    {
      address: ADDR.strategy,
      name: "LineaDAT",
      symbol: "LINEADAT",
      underlying: "tLINEA",
      bagSize: "150 000",
    },
  ];

  return (
    <>
      <Header />
      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)]">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">Strategies</h1>
        <p className="text-muted-foreground mb-8">All LineaDAT-family strategies live on this chain.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {strategies.map((s) => (
            <Card key={s.address} className="p-6 sm:p-8">
              <h3 className="text-2xl font-display font-bold">
                {s.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Backed by {s.underlying} · {s.bagSize} per bag</p>
              <p className="text-xs font-mono text-muted-foreground mt-3 break-all">{s.address}</p>
              <Button asChild className="mt-4 w-full">
                <Link href={`/strategies/${s.address}` as never}>View strategy</Link>
              </Button>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
