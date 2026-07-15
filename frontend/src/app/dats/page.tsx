import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DatsExplorer } from "@/components/dats-explorer";

export const metadata: Metadata = {
  title: "DAT Explorer",
  description:
    "Browse every live digital asset treasury (DAT) on Linea L2. Compare treasury size, burn rate and market cap across classic and yield DATs.",
};

/**
 * /dats - index of all known DATs on the current chain, with the filter bar
 * (network / type / scope / sort). The interactive content lives in the
 * DatsExplorer client component.
 */
export default function StrategiesIndexPage() {
  return (
    <>
      <Header />
      {/* The explorer opens straight into its filter bar by design, so the page
          heading is exposed to assistive tech and crawlers without rendering. */}
      <h1 className="sr-only">DAT Explorer - digital asset treasuries on Linea</h1>
      <DatsExplorer />
      <Footer />
    </>
  );
}
