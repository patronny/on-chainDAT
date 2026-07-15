import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yield DATs (coming soon)",
  description:
    "Yield DATs will route trading fees to holders as revenue instead of burning supply. No yield DAT has launched yet.",
  // noindex until a yield DAT actually exists: the model is not specified yet, so
  // there is nothing here worth putting in front of a searcher.
  robots: { index: false, follow: true },
};

export default function YieldDatsDocPage() {
  return (
    <>
      <h1>Yield DATs (coming soon)</h1>

      <p className="docs-lead">
        No yield DAT has launched yet. This page is a placeholder for the model,
        not a description of something live.
      </p>

      <p>
        A DAT can use its accumulated fees in several ways. A{" "}
        <a href="/docs/dat-types/classic">classic DAT</a> accumulates the
        underlying asset in its treasury and buys back and burns its own supply.
        A yield DAT would instead distribute that revenue to holders of the DAT
        token.
      </p>

      <p>
        The exact mechanics - what is distributed, on what schedule, and on what
        terms - are not fixed yet. When a yield DAT launches, this page will
        carry its full economics, and the token will get its own section in these
        docs like every other launch.
      </p>
    </>
  );
}
