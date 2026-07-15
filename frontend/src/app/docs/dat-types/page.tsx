import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DAT Types",
  description:
    "The DAT models on on-chainDAT: classic DATs, which accumulate the base asset and burn supply, and yield DATs, which distribute revenue to holders.",
};

export default function DatTypesDocPage() {
  return (
    <>
      <h1>DAT Types</h1>

      <p className="docs-lead">
        Every DAT charges a fee on its own trades and routes it back into its own
        economy. What the treasury does with that fee is what separates one type
        from another.
      </p>

      <p>
        A DAT can accumulate the underlying asset in its treasury, buy back and
        burn its own supply, distribute revenue to holders, or combine several of
        these at once. The type is fixed by the token&apos;s contract at launch,
        so it is a property of the DAT rather than a policy anyone can change
        later.
      </p>

      <p>
        <code>$LDAT</code> is a classic DAT. Each type is described below, and
        every launch also gets its own section in these docs with its exact fees
        and mechanics.
      </p>
    </>
  );
}
