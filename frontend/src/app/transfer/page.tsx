import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Transfer - LDAT",
  description:
    "Coming Soon: relay-contract tool to send LDAT between wallets in protocol v2.",
};

export default function TransferPage() {
  return (
    <>
      <Header />
      <main className="container py-16 sm:py-24 min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <Card className="w-full max-w-md p-8 sm:p-10 text-center">
          <h1
            className="text-3xl sm:text-4xl font-display font-bold mb-3 text-foreground"
            style={{ textShadow: "0 0 14px hsl(var(--primary) / 0.45)" }}
          >
            Coming Soon
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Wallet-to-wallet DAT transfer via a relay contract - landing in protocol v2.
          </p>
        </Card>
      </main>
      <Footer />
    </>
  );
}
