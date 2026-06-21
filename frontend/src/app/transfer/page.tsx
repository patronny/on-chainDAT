import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { TransferCard } from "@/components/transfer-card";

export const metadata: Metadata = {
  title: "Transfer - LDAT",
  description:
    "Send $LDAT wallet-to-wallet through the official relay contract. A 1% fee is burned on every transfer; the recipient receives 99%.",
};

export default function TransferPage() {
  return (
    <>
      <Header />
      <main className="container py-12 sm:py-20 min-h-[calc(100vh-3.5rem)] flex items-start sm:items-center justify-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-5">
            <h1
              className="text-2xl sm:text-3xl font-display font-bold mb-2 text-foreground"
              style={{ textShadow: "0 0 14px hsl(var(--primary) / 0.45)" }}
            >
              Transfer $LDAT
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              $LDAT is non-transferable except through this official relay. 1% is burned on each
              transfer; the recipient gets 99%.
            </p>
          </div>
          <Card className="w-full overflow-hidden">
            <TransferCard />
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
