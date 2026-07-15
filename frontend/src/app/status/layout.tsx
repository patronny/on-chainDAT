import type { Metadata } from "next";

// status/page.tsx is a client component, and Next forbids exporting `metadata` from one,
// so the title lives here. noindex: it is a live ops dashboard with no search demand.
// follow stays on so its internal links still pass equity.
export const metadata: Metadata = {
  title: "Live Protocol Status",
  robots: { index: false, follow: true },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
