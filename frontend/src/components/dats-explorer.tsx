"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink } from "lucide-react";
import { ADDR, UNDERLYING_SYMBOL, addressUrl } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useHoldingsTotals } from "./holdings-table";
import { usePoolEthSide } from "./pool-liquidity-card";
import { LdatIcon } from "./icons/token-icons";
import { TypeBadge, ScopeBadge } from "./dat-badges";

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
   * pool's base asset (ETH for LDAT). Placeholder zeros until DAT #2 exists
   * and these get wired to live indexer/snapshot data - with a single DAT every
   * order is identical anyway.
   */
  metrics: Record<SortKey, number>;
};

const NETWORK_LABELS: Record<Exclude<Network, "all">, string> = {
  linea: "Linea",
  base: "Base",
  hyperevm: "HyperEVM",
};

const DATS: DatEntry[] = [
  {
    address: ADDR.strategy,
    name: "LDAT",
    symbol: "LDAT",
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

/** Explorer-link + copy buttons next to the contract address - same idiom as the DAT page header. */
function ContractActions({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - silently no-op */
    }
  }
  const btnCls =
    "inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-secondary/15 text-muted-foreground hover:text-foreground hover:border-secondary/60 focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={addressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className={btnCls}
        aria-label="Open contract on block explorer"
        title="Open on explorer"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      <button
        type="button"
        onClick={copyAddress}
        className={btnCls}
        aria-label="Copy contract address"
        title={copied ? "Copied" : "Copy contract"}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

/**
 * /dats content: full-bleed filter bar (network / type / scope / sort) right
 * under the site header, then the borderless DAT table. Filters work today;
 * sorting becomes meaningful once a second DAT ships (see DatEntry.metrics).
 */
export function DatsExplorer() {
  const router = useRouter();
  const [network, setNetwork] = useState<Network>("all");
  const [type, setType] = useState<DatType>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortKey>("fdv");

  // Live USD metrics for the LDAT row (the only live DAT today).
  // Treasury $ mirrors the Fundings card title: ETH fee pot + held bags at
  // their per-bag 1.2x LIST price (what the DAT will actually collect), NOT
  // the live market quote. LP $ = the pool's ETH side x ETH/USD - the same
  // "real money" figure as the DAT page's Real liquidity.
  const { data: stats } = useStrategyStats();
  const { totalListed } = useHoldingsTotals();
  const ethUsd = useEthPrice();
  const poolEth = usePoolEthSide();
  const treasuryUsd =
    ethUsd > 0
      ? ((Number(stats?.currentFees ?? 0n) + Number(totalListed)) / 1e18) * ethUsd
      : 0;
  const lpUsd = poolEth * ethUsd;
  const fmtUsd = (v: number) =>
    v > 0 ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "-";

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
            label="Role"
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
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Chain</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Base asset</th>
                    <th className="text-right py-3 px-4 font-medium uppercase tracking-wider">Bag size</th>
                    <th className="text-right py-3 px-4 font-medium uppercase tracking-wider">Treasury($)</th>
                    <th className="text-right py-3 px-4 font-medium uppercase tracking-wider">LP size($)</th>
                    <th className="text-left py-3 px-4 font-medium uppercase tracking-wider">Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((s) => (
                    <tr
                      key={s.address}
                      onClick={() => router.push(`/dats/${s.address}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/dats/${s.address}`);
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${s.name} DAT page`}
                      className="cursor-pointer transition-colors hover:bg-secondary/25 focus-visible:bg-secondary/25 focus-visible:outline-none"
                    >
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <LdatIcon className="w-9 h-9 flex-shrink-0" />
                          <span className="font-display font-bold text-base">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4"><TypeBadge type={s.type} /></td>
                      <td className="py-4 px-4"><ScopeBadge scope={s.scope} /></td>
                      <td className="py-4 px-4">{NETWORK_LABELS[s.network]}</td>
                      <td className="py-4 px-4 font-mono">${s.underlying}</td>
                      <td className="py-4 px-4 text-right font-mono tabular">{s.bagSize}</td>
                      <td className="py-4 px-4 text-right font-mono tabular">
                        {s.address === ADDR.strategy ? fmtUsd(treasuryUsd) : "-"}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular">
                        {s.address === ADDR.strategy ? fmtUsd(lpUsd) : "-"}
                      </td>
                      <td className="py-4 px-4">
                        {/* stopPropagation: copying the address / opening the explorer
                            must not also trigger the row's navigation */}
                        <span
                          className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <span title={s.address}>{shortAddress(s.address)}</span>
                          <ContractActions address={s.address} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: borderless stacked rows */}
            <ul className="md:hidden divide-y divide-border">
              {visible.map((s) => (
                <li
                  key={s.address}
                  onClick={() => router.push(`/dats/${s.address}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/dats/${s.address}`);
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open ${s.name} DAT page`}
                  className="py-4 space-y-2 cursor-pointer transition-colors hover:bg-secondary/25 active:bg-secondary/25 focus-visible:bg-secondary/25 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <LdatIcon className="w-9 h-9 flex-shrink-0" />
                    <span className="font-display font-bold text-base">{s.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <TypeBadge type={s.type} />
                      <ScopeBadge scope={s.scope} />
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {NETWORK_LABELS[s.network]} · {s.bagSize}{" "}
                    <span className="font-mono">${s.underlying}</span> per bag
                  </div>
                  {s.address === ADDR.strategy ? (
                    <div className="text-sm text-muted-foreground">
                      Treasury <span className="font-mono">{fmtUsd(treasuryUsd)}</span> · LP{" "}
                      <span className="font-mono">{fmtUsd(lpUsd)}</span>
                    </div>
                  ) : null}
                  {/* stopPropagation: copy / explorer taps must not navigate the row */}
                  <div
                    className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span title={s.address}>{shortAddress(s.address, 8)}</span>
                    <ContractActions address={s.address} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
