import type { Metadata } from "next";

export const metadata: Metadata = {
  // absolute: docs/layout's "%s - LDAT Docs" template applies to child segments, not
  // to this page, so without it /docs shipped the bare dictionary word "Overview".
  title: { absolute: "Documentation - LDAT" },
  description:
    "Start here: what a digital asset treasury (DAT) is, how the LDAT protocol accumulates and resells $LINEA, and how the burn cycle works on Linea L2.",
};

export default function DocsOverviewPage() {
  return (
    <>
      <h1>Overview</h1>

      <p>DAT stands for Digital Asset Treasury.</p>

      <p>
        In simple terms, a DAT is a token launched through{" "}
        <strong>on-chainDAT.com</strong> on top of an already existing token.
      </p>

      <p>
        For example, if there is a token called <code>$XXX</code>, a new token
        called <code>$XXXDAT</code> can be launched on top of it. This DAT token
        collects a tax from <code>$XXXDAT</code> buys and sells, then uses the
        accumulated funds to support its own strategy and the underlying asset,{" "}
        <code>$XXX</code>.
      </p>

      <p>
        <strong>on-chainDAT.com</strong> is an experimental DeFi protocol for
        launching autonomous on-chain treasury tokens.
      </p>

      <p>Each DAT can use the accumulated funds through one of several models:</p>

      <ul>
        <li>
          buying back and burning <code>$XXXDAT</code>
        </li>
        <li>
          distributing revenue to <code>$XXXDAT</code> holders
        </li>
        <li>
          accumulating the underlying asset, <code>$XXX</code>, in the treasury
        </li>
        <li>
          using a hybrid model where several mechanisms work at the same time
        </li>
      </ul>

      <p>
        The core idea is simple: trading activity in <code>$XXXDAT</code>{" "}
        generates fees, and those fees are routed back into the ecosystem of
        that specific DAT and its underlying token.
      </p>

      <p>
        All DAT tokens launched through <strong>on-chainDAT.com</strong> operate
        autonomously on-chain. They do not rely on oracles, centralized market
        makers, or manual trade management.
      </p>

      <p>
        Once launched, a DAT can continue to exist and operate for as long as
        the blockchain it is deployed on remains functional.
      </p>
    </>
  );
}
