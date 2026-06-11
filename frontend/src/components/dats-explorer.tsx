"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { ADDR, UNDERLYING_SYMBOL } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";
import { LineaDatSquareIcon } from "./icons/token-icons";

type Network = "all" | "linea" | "base" | "hyperevm";
type DatType = "all" | "classic" | "yield";
type Scope = "all" | "main" | "side";
type SortKey = "fdv" | "vol24h" | "burn" | "treasury" | "lp";

type DatEntry = {
  address: string;
  name: string;
  symbol: string;
  underlying: string;
  bagSize: string;
  network: Exclude<Network, "all">;
  type: Exclude<DatType, "all">;
  scope: Exclude<Scope, "all">;
  /**
   * Sort metrics, descending: fdv/vol24h/burn/treasury in USD terms, lp in the
   * pool's base asset (ETH for LINEADAT). Placeholder zeros until DAT #2 exists
   * and these get wired to live indexer/snapshot data - with a single DAT every
   * order is identical anyway.
   */
  metrics: Record<SortKey, number>;
};

const DATS: DatEntry[] = [
  {
    address: ADDR.strategy,
    name: "LineaDAT",
    symbol: "LINEADAT",
    underlying: UNDERLYING_SYMBOL,
    bagSize: "150 000",
    network: "linea",
    type: "classic",
    scope: "main",
    metrics: { fdv: 0, vol24h: 0, burn: 0, treasury: 0, lp: 0 },
  },
];

const SELECT_CLS =
  "bg-secondary text-secondary-foreground font-bold border border-border rounded px-2 py-1 font-mono hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary";

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={SELECT_CLS}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Type pill with a hover tooltip explaining the DAT mechanic. */
function TypeBadge({ type }: { type: Exclude<DatType, "all"> }) {
  const classic = type === "classic";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase cursor-help ${
        classic ? "bg-cyan-500/15 text-cyan-400" : "bg-amber-500/15 text-amber-400"
      }`}
      title={
        classic
          ? "Classic DAT: the treasury buys bags of the underlying and relists them at a 1.2x markup; the profit buys back and burns the token."
          : "Yield DAT: the treasury never sells - it earns yield on its holdings and once a week uses the income to buy back and burn its token."
      }
    >
      {classic ? "Classic" : "Yield"}
    </span>
  );
}

/** Scope pill: flagship (main) vs side DATs that feed the $LINEADAT burn. */
function ScopeBadge({ scope }: { scope: Exclude<Scope, "all"> }) {
  const main = scope === "main";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase cursor-help ${
        main ? "bg-pink-500/15 text-pink-400" : "bg-purple-500/15 text-purple-400"
      }`}
      title={
        main
          ? "Main DAT: the flagship of the platform - side DATs buy back and burn its token."
          : "Side DAT: pays 1% of its entire trading volume to buy back and burn $LINEADAT on every trade."
      }
    >
      {main ? "Main" : "Side"}
    </span>
  );
}

/**
 * /dats content: full-bleed filter bar (network / type / scope / sort) right
 * under the site header, then the borderless DAT table. Filters work today;
 * sorting becomes meaningful once a second DAT ships (see DatEntry.metrics).
 */
export function DatsExplorer() {
  const [network, setNetwork] = useState<Network>("all");
  const [type, setType] = useState<DatType>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortKey>("fdv");

  const visible = DATS.filter(
    (d) =>
      (network === "all" || d.network === network) &&
      (type === "all" || d.type === type) &&
      (scope === "all" || d.scope === scope),
  ).sort((a, b) => b.metrics[sort] - a.metrics[sort]);

  return (
    <>
      <div className="border-b border-border bg-card/30">
        <div className="container py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <FilterSelect<Network>
            label="Network"
            value={network}
            onChange={setNetwork}
            options={[
              ["all", "All"],
              ["linea", "Linea"],
              ["base", "Base (coming soon)"],
              ["hyperevm", "HyperEVM (coming soon)"],
            ]}
          />
          <FilterSelect<DatType>
            label="Type"
            value={type}
            onChange={setType}
            options={[
              ["all", "All"],
              ["classic", "Classic DATs"],
              ["yield", "Yield DATs"],
            ]}
          />
          <FilterSelect<Scope>
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[
              ["all", "All"],
              ["main", "Only main DATs"],
              ["side", "Only side DATs"],
            ]}
          />
          <FilterSelect<SortKey>
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              ["fdv", "FDV"],
              ["vol24h", "Volume 24h"],
              ["burn", "Burn"],
              ["treasury", "Treasury"],
              ["lp", "LP size"],
            ]}
          />
        </div>
      </div>

      <main className="container py-10 sm:py-16 min-h-[calc(100vh-3.5rem)]">
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">DATs</h1>
        <p className="text-muted-foreground mb-8">
          Every DAT besides the flagship $LINEADAT automatically pays 1% of its entire trading
          volume to buy back and burn $LINEADAT, on every single trade.
        </p>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-md">
            {network === "base"
              ? "Base DATs are coming soon."
              : network === "hyperevm"
                ? "HyperEVM DATs are coming soon."
                : "No DATs match these filters."}
          </p>
        ) : (
          <>
            {/* Desktop / tablet: borderless table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-3 pr-4 font-medium uppercase tracking-wider">DAT</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Type</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Scope</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Backed by</th>
                    <th className="text-right py-3 px-4 font-medium uppercase tracking-wider">Bag size</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Contract</th>
                    <th className="text-right py-3 pl-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((s) => (
                    <tr key={s.address}>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <LineaDatSquareIcon className="w-9 h-9 flex-shrink-0" />
                          <span className="font-display font-bold text-base">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4"><TypeBadge type={s.type} /></td>
                      <td className="py-4 px-4"><ScopeBadge scope={s.scope} /></td>
                      <td className="py-4 px-4 font-mono">{s.underlying}</td>
                      <td className="py-4 px-4 text-right font-mono tabular">{s.bagSize}</td>
                      <td className="py-4 px-4 font-mono text-xs text-muted-foreground" title={s.address}>
                        {shortAddress(s.address)}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <Button asChild size="sm">
                          <Link href={`/dats/${s.address}` as never}>View DAT</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: borderless stacked rows */}
            <ul className="md:hidden divide-y divide-border">
              {visible.map((s) => (
                <li key={s.address} className="py-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <LineaDatSquareIcon className="w-9 h-9 flex-shrink-0" />
                    <span className="font-display font-bold text-base">{s.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <TypeBadge type={s.type} />
                      <ScopeBadge scope={s.scope} />
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Backed by {s.underlying} · {s.bagSize} per bag
                  </div>
                  <div className="text-xs font-mono text-muted-foreground break-all">{s.address}</div>
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/dats/${s.address}` as never}>View DAT</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
