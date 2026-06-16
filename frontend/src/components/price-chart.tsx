"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useSwaps } from "@/hooks/useIndexer";
import { useStrategyStats } from "@/hooks/useStrategyStats";
import { useEthPrice } from "@/hooks/useEthPrice";
import { ldatPriceInEth } from "@/lib/utils";
import { priceSanityBand, inPriceBand, robustPriceRange } from "@/lib/chart-scale";

/**
 * DexScreener-style price chart fed by the Ponder indexer's `swap` rows (one
 * point per pool Trade) plus a live final point from the current pool
 * sqrtPriceX96, rendered with TradingView's lightweight-charts.
 *
 * Dexscreener / GeckoTerminal do not index Uniswap v4 pools on Linea (the v4
 * singleton PoolManager has no per-pair contract for them to crawl), so an embed
 * renders "pair not found" forever. We aggregate our own indexed history into
 * OHLC + volume buckets client-side instead.
 *
 * Layout mirrors dexscreener: pair/interval/source header + price & change line,
 * thin price line, volume histogram underneath, interval (step) row on top,
 * lookback (distance) row on the bottom, Price/MCap + USD/WETH + log toggles.
 */

type Pt = { t: number; priceEth: number; volEth: number };
type Bucket = { time: UTCTimestamp; open: number; high: number; low: number; close: number; vol: number };

const HEIGHT = 340;
const LINE = "rgb(45, 212, 218)"; // cyan price line
const UP = "rgba(74, 222, 128, 0.55)";
const DOWN = "rgba(248, 113, 113, 0.55)";
const UP_SOLID = "rgb(74, 222, 128)";
const DOWN_SOLID = "rgb(248, 113, 113)";

// Candle step (granularity). seconds per bucket.
const INTERVALS = [
  { label: "1s", secs: 1 },
  { label: "1m", secs: 60 },
  { label: "5m", secs: 300 },
  { label: "15m", secs: 900 },
  { label: "1h", secs: 3_600 },
  { label: "4h", secs: 14_400 },
  { label: "1D", secs: 86_400 },
  { label: "1W", secs: 604_800 },
  { label: "1M", secs: 2_592_000 },
] as const;
const DEFAULT_INTERVAL = 6; // "1D"

// Lookback window (distance shown). seconds back from the latest point.
const RANGES = [
  { label: "1d", secs: 86_400 },
  { label: "3d", secs: 3 * 86_400 },
  { label: "1w", secs: 7 * 86_400 },
  { label: "1m", secs: 30 * 86_400 },
  { label: "6m", secs: 182 * 86_400 },
  { label: "1y", secs: 365 * 86_400 },
] as const;
const DEFAULT_RANGE = 3; // "1m"

type Denom = "USD" | "WETH";
type Metric = "Price" | "MCap";
type ChartType = "line" | "candle";

/** Compact large numbers (market cap / volume) into K/M/B/T. */
function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(4);
  return v.toPrecision(3);
}

/** Axis / crosshair / price-line label formatter. USD keeps the compact "$" prefix;
 *  WETH renders a bare number (the "ETH" unit is shown in the header + volume instead,
 *  so the dense axis ticks stay short - "Ξ" read as unfamiliar, and "... ETH" on every
 *  gridline is noisy, especially in Price mode where values look like 0.00004969).
 *  Never uses scientific notation (dexscreener-style fixed decimals). */
function makeFormatter(denom: Denom, metric: Metric) {
  const usd = denom === "USD";
  return (v: number) => {
    if (!isFinite(v)) return "";
    const a = Math.abs(v);
    let body: string;
    if (metric === "MCap") body = compact(v);
    else if (a >= 0.01 || a === 0) body = v.toFixed(usd ? 2 : 6);
    else {
      // Sub-cent: fixed decimals sized to ~4 significant figures, no exponent.
      const decimals = Math.min(18, Math.max(6, Math.ceil(-Math.log10(a)) + 3));
      body = v.toFixed(decimals);
    }
    return usd ? "$" + body : body;
  };
}

export function PriceChart() {
  const { data: swaps, loading, usable } = useSwaps(500);
  const stats = useStrategyStats();
  const ethUsd = useEthPrice();

  const [intervalIdx, setIntervalIdx] = useState<number>(DEFAULT_INTERVAL);
  const [rangeIdx, setRangeIdx] = useState<number>(DEFAULT_RANGE);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [metric, setMetric] = useState<Metric>("Price");
  const [denom, setDenom] = useState<Denom>("USD");
  const [logScale, setLogScale] = useState(false);
  const [utc, setUtc] = useState("");
  const userPickedInterval = useRef(false);

  // Live UTC clock (client-only to avoid SSR hydration mismatch).
  useEffect(() => {
    const tick = () => setUtc(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const symbol = stats.data?.symbol || "LDAT";
  const liveSqrt = stats.data?.sqrtPriceX96;
  // Circulating supply (totalSupply minus the dead-address burn balance), float.
  const circ = stats.data
    ? Math.max(0, Number(stats.data.totalSupply - stats.data.burned) / 1e18)
    : 0;

  // ETH-denominated price + per-swap ETH volume, ascending by time, plus a live tail.
  // `swapCount` = points that came from real indexed swaps (the synthetic live tail
  // does NOT count) - drives the "No trades yet" empty state so a lone live point
  // never renders as a dead-looking flat line.
  const { points, swapCount } = useMemo<{ points: Pt[]; swapCount: number }>(() => {
    const livePrice = liveSqrt && liveSqrt > 0n ? ldatPriceInEth(liveSqrt) : 0;
    const raw: Pt[] = [];
    if (swaps) {
      const asc = [...swaps].sort((a, b) => a.timestamp - b.timestamp);
      for (const s of asc) {
        const priceEth = ldatPriceInEth(BigInt(s.sqrtPriceX96));
        const volEth = Number(s.ethAmount) / 1e18;
        if (priceEth > 0) raw.push({ t: s.timestamp, priceEth, volEth: isFinite(volEth) ? volEth : 0 });
      }
    }
    // Drop corrupt multi-order-of-magnitude price spikes (a bad sqrtPriceX96 from
    // an at-init / low-liquidity / stale read) before they reach the axis - one
    // such tick would otherwise blow the y-axis open and flatten the real line.
    // Anchored on the live pool price (ground truth) when available.
    const band = priceSanityBand(raw.map((p) => p.priceEth), livePrice || undefined);
    const pts = raw.filter((p) => inPriceBand(p.priceEth, band));
    const swapCount = pts.length;
    if (livePrice > 0) {
      const nowT = Math.floor(Date.now() / 1000);
      if (pts.length === 0 || nowT - pts[pts.length - 1].t > 2) {
        pts.push({ t: nowT, priceEth: livePrice, volEth: 0 });
      }
    }
    return { points: pts, swapCount };
  }, [swaps, liveSqrt]);

  // Auto-pick a sensible default candle interval from the data span (finest step
  // that keeps the full history under ~60 buckets), until the user picks one.
  useEffect(() => {
    if (userPickedInterval.current || points.length < 2) return;
    const span = points[points.length - 1].t - points[0].t;
    const fit = INTERVALS.findIndex((iv) => span / iv.secs <= 60);
    const target = fit === -1 ? INTERVALS.length - 1 : fit;
    if (target !== intervalIdx) setIntervalIdx(target);
  }, [points, intervalIdx]);

  // Filter to the lookback window, then aggregate into OHLC + volume buckets.
  const buckets = useMemo<Bucket[]>(() => {
    if (points.length === 0) return [];
    const cutoff = points[points.length - 1].t - RANGES[rangeIdx].secs;
    const step = INTERVALS[intervalIdx].secs;
    const priceMult = (denom === "USD" ? ethUsd : 1) * (metric === "MCap" ? circ : 1);
    const volMult = denom === "USD" ? ethUsd : 1;
    const map = new Map<number, Bucket>();
    for (const p of points) {
      if (p.t < cutoff) continue;
      const price = p.priceEth * priceMult;
      if (!(price > 0)) continue;
      const b = Math.floor(p.t / step) * step;
      const c = map.get(b);
      if (!c) map.set(b, { time: b as UTCTimestamp, open: price, high: price, low: price, close: price, vol: p.volEth * volMult });
      else {
        c.high = Math.max(c.high, price);
        c.low = Math.min(c.low, price);
        c.close = price;
        c.vol += p.volEth * volMult;
      }
    }
    return [...map.values()].sort((a, b) => (a.time as number) - (b.time as number));
  }, [points, rangeIdx, intervalIdx, denom, metric, ethUsd, circ]);

  const lineData = useMemo(() => buckets.map((b) => ({ time: b.time, value: b.close })), [buckets]);
  const candleData = useMemo(
    () => buckets.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })),
    [buckets]
  );
  const volData = useMemo(
    () => buckets.map((b) => ({ time: b.time, value: b.vol, color: b.close >= b.open ? UP : DOWN })),
    [buckets]
  );

  const fmt = useMemo(() => makeFormatter(denom, metric), [denom, metric]);
  // Header/volume unit. USD carries "$" inside fmt; WETH appends an explicit " ETH".
  const unit = denom === "USD" ? "" : " ETH";

  // Header price + change vs the first visible bucket.
  const current = buckets.length ? buckets[buckets.length - 1].close : 0;
  const baseline = buckets.length ? buckets[0].open : 0;
  const change = current - baseline;
  const pct = baseline > 0 ? (change / baseline) * 100 : 0;
  const up = change >= 0;
  const changeColor = up ? UP_SOLID : DOWN_SOLID;
  const totalVol = buckets.reduce((s, b) => s + b.vol, 0);

  const hasData = swapCount > 0 && buckets.length > 0;
  const rangeEmpty = usable && !loading && swapCount > 0 && buckets.length === 0;

  // --- lightweight-charts lifecycle ---
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  // Latest plotted values, read by the series autoscaleInfoProvider (set in the
  // data effect below, before setData, so the robust range reflects current data).
  const lineValsRef = useRef<number[]>([]);
  const candleValsRef = useRef<number[]>([]);

  // Create the chart + series once on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(199, 196, 219, 0.75)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.1, bottom: 0.26 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    // Robust y-axis: frame on a percentile band with a non-negative floor so a
    // single corrupt tick can't invert or blow out the scale. Returning null
    // (no data) lets the library's default autoscale take over.
    const toAutoscale = (vals: number[]) => {
      const r = robustPriceRange(vals);
      return r ? { priceRange: { minValue: r.minValue, maxValue: r.maxValue } } : null;
    };

    const line = chart.addSeries(LineSeries, {
      color: LINE,
      lineWidth: 2,
      priceLineColor: LINE,
      crosshairMarkerBorderColor: LINE,
      crosshairMarkerBackgroundColor: LINE,
      autoscaleInfoProvider: () => toAutoscale(lineValsRef.current),
    });
    lineRef.current = line;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP_SOLID,
      downColor: DOWN_SOLID,
      borderUpColor: UP_SOLID,
      borderDownColor: DOWN_SOLID,
      wickUpColor: UP_SOLID,
      wickDownColor: DOWN_SOLID,
      visible: false, // line is the default view; toggled on demand
      autoscaleInfoProvider: () => toAutoscale(candleValsRef.current),
    });
    candleRef.current = candle;

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volRef.current = vol;

    return () => {
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  // Keep axis formatter, time granularity, and scale mode in sync with toggles.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      localization: { priceFormatter: fmt },
      timeScale: { timeVisible: true, secondsVisible: INTERVALS[intervalIdx].secs < 60 },
    });
    chart.priceScale("right").applyOptions({ mode: logScale ? 1 : 0 });
  }, [fmt, intervalIdx, logScale]);

  // Show the line or candle series per the active toggle (volume always on).
  useEffect(() => {
    lineRef.current?.applyOptions({ visible: chartType === "line" });
    candleRef.current?.applyOptions({ visible: chartType === "candle" });
  }, [chartType]);

  // Push data to the series whenever it changes. This must NOT touch the time
  // scale: setData preserves the current view, so live polls (every 12s) refresh
  // the line in place without moving the viewport.
  useEffect(() => {
    if (!lineRef.current || !candleRef.current || !volRef.current) return;
    // With no real swap history yet (only the synthetic live tail), draw nothing
    // and let the "No trades yet" overlay show - a single point renders as a
    // dead-looking flat line. The header still surfaces the live price.
    const ld = swapCount > 0 ? lineData : [];
    const cd = swapCount > 0 ? candleData : [];
    const vd = swapCount > 0 ? volData : [];
    // Refresh the values the autoscale providers read BEFORE setData triggers a
    // rescale, so the robust range matches the data being drawn this frame.
    lineValsRef.current = ld.map((d) => d.value);
    candleValsRef.current = cd.flatMap((d) => [d.low, d.high, d.open, d.close]);
    lineRef.current.setData(ld);
    candleRef.current.setData(cd);
    volRef.current.setData(vd);
  }, [lineData, candleData, volData, swapCount]);

  // Fit the data to the full chart width, but only when the x-domain actually
  // changes (user picks an interval/range) or when data first arrives - never on
  // a routine data poll.
  //
  // The previous version refit on EVERY poll AND read `ts.options().barSpacing`
  // immediately after `fitContent()`. lightweight-charts updates bar spacing on a
  // later frame, so the read lagged one cycle and toggled a clamp on/off each 12s
  // poll - the chart flickered between the full-width and a compact right-anchored
  // layout. Fitting only on real x-domain changes keeps it static; `setData` in
  // the data effect above preserves this view across live polls.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !hasData) return;
    chart.timeScale().fitContent();
    // intervalIdx/rangeIdx are refit triggers (not read here); never refit on a poll.
  }, [intervalIdx, rangeIdx, hasData]);

  const btn = (active: boolean) =>
    `px-2 py-1 text-[11px] font-mono rounded transition-colors ${
      active ? "neon-pink" : "text-muted-foreground hover:text-foreground"
    }`;
  const seg = (active: boolean) =>
    active ? "neon-pink" : "text-muted-foreground hover:text-foreground";

  return (
    <div className="px-4 sm:px-5 py-3">
      {/* Toolbar: interval (step) + denom/metric/log */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <div className="flex items-center gap-0.5 overflow-x-auto max-w-full">
          {INTERVALS.map((iv, i) => (
            <button
              key={iv.label}
              type="button"
              onClick={() => {
                userPickedInterval.current = true;
                setIntervalIdx(i);
              }}
              aria-pressed={i === intervalIdx}
              className={btn(i === intervalIdx)}
            >
              {iv.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 sm:ml-auto font-mono text-[11px]">
          <span className="flex items-center gap-0.5" role="group" aria-label="Chart type">
            <button
              type="button"
              onClick={() => setChartType("line")}
              aria-pressed={chartType === "line"}
              aria-label="Line chart"
              title="Line"
              className={btn(chartType === "line")}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 11.5l3.5-4 3 2.5 6.5-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setChartType("candle")}
              aria-pressed={chartType === "candle"}
              aria-label="Candlestick chart"
              title="Candles"
              className={btn(chartType === "candle")}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <line x1="4.5" y1="1.5" x2="4.5" y2="14.5" />
                <rect x="2.5" y="4.5" width="4" height="6.5" rx="0.5" />
                <line x1="11.5" y1="3" x2="11.5" y2="13" />
                <rect x="9.5" y="5.5" width="4" height="5" rx="0.5" />
              </svg>
            </button>
          </span>
          <span className="whitespace-nowrap">
            <button type="button" onClick={() => setMetric("Price")} aria-pressed={metric === "Price"} className={seg(metric === "Price")}>Price</button>
            <span className="text-muted-foreground mx-1">/</span>
            <button type="button" onClick={() => setMetric("MCap")} aria-pressed={metric === "MCap"} className={seg(metric === "MCap")}>MCap</button>
          </span>
          <span className="whitespace-nowrap">
            <button type="button" onClick={() => setDenom("USD")} aria-pressed={denom === "USD"} className={seg(denom === "USD")}>USD</button>
            <span className="text-muted-foreground mx-1">/</span>
            <button type="button" onClick={() => setDenom("WETH")} aria-pressed={denom === "WETH"} className={seg(denom === "WETH")}>WETH</button>
          </span>
        </div>
      </div>

      {/* DexScreener-style header: pair · interval · source + price & change */}
      <div className="mb-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: UP_SOLID, boxShadow: `0 0 6px ${UP_SOLID}` }} />
          <span className="font-mono">
            {symbol} / ETH <span className="opacity-60">·</span> {INTERVALS[intervalIdx].label} <span className="opacity-60">·</span> on-chainDAT
          </span>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-xl font-semibold tabular" style={{ color: changeColor }}>
            {current > 0 ? fmt(current) + unit : "-"}
          </span>
          {hasData && buckets.length > 1 && (
            <span className="text-xs font-mono" style={{ color: changeColor }}>
              {up ? "+" : "-"}{fmt(Math.abs(change))}{unit} ({up ? "+" : ""}{pct.toFixed(2)}%)
            </span>
          )}
          {hasData && totalVol > 0 && (
            <span className="text-[11px] font-mono text-muted-foreground ml-auto">
              Vol {denom === "USD" ? "$" + compact(totalVol) : compact(totalVol) + " ETH"}
            </span>
          )}
        </div>
      </div>

      {/* Chart canvas + overlays */}
      <div className="relative w-full" style={{ height: HEIGHT }}>
        <div ref={containerRef} className="absolute inset-0" />

        {!usable && !loading && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground text-center px-4 pointer-events-none">
            Live chart unavailable - indexer offline. Trades still settle on-chain.
          </div>
        )}
        {usable && loading && swapCount === 0 && (
          <div className="absolute inset-0 rounded-md bg-muted animate-pulse" />
        )}
        {usable && !loading && swapCount === 0 && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground text-center px-4 pointer-events-none">
            No trades yet. The chart populates after the first swap against the pool.
          </div>
        )}
        {rangeEmpty && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground text-center px-4 pointer-events-none">
            No trades in the last {RANGES[rangeIdx].label}.
          </div>
        )}
      </div>

      {/* Bottom bar: lookback (distance) on the left, clock + scale toggles right */}
      <div className="flex items-center justify-between gap-2 mt-2 border-t border-border pt-2">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeIdx(i)}
              aria-pressed={i === rangeIdx}
              className={btn(i === rangeIdx)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          <span className="hidden sm:inline tabular">{utc} (UTC)</span>
          <button type="button" onClick={() => setLogScale((v) => !v)} aria-pressed={logScale} className={seg(logScale)}>log</button>
          <button type="button" onClick={() => chartRef.current?.timeScale().fitContent()} className="text-muted-foreground hover:text-foreground">auto</button>
        </div>
      </div>
    </div>
  );
}
