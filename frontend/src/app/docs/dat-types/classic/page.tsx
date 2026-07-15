import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classic DATs",
  description:
    "Classic DATs follow $LDAT economics with one difference: their 10% fee splits 8% into the base asset, 1% into burning the ecosystem token, and 1% to the creator.",
};

export default function ClassicDatsDocPage() {
  return (
    <>
      <h1>Classic DATs</h1>

      <p>
        Classic DATs are DAT tokens with economics similar to{" "}
        <code>$LDAT</code>, but with one small difference.
      </p>

      <p>
        A <strong>10% fee</strong> is taken from every trade:
      </p>

      <ul>
        <li>
          <strong>8%</strong> goes toward buying the base asset that the DAT is
          built on
        </li>
        <li>
          <strong>1%</strong> goes toward buying and burning the network&rsquo;s
          ecosystem token
        </li>
        <li>
          <strong>1%</strong> goes to the creator who launched that DAT token
        </li>
      </ul>

      <p>
        Simply put: a Classic DAT accumulates value in the base asset, supports
        the ecosystem token through buyback &amp; burn, and gives a small
        revenue share to the token creator.
      </p>
    </>
  );
}
