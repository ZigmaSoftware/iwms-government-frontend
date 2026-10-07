import { useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtNum, shortDay } from "./format";
import { compactNumber } from "@/utils/compactNumber";
import { useChartAccent } from "./chartTheme";

/* ─────────────────────────────────────────────────────────────────────
   Building blocks for the State / District leader dashboards: compact
   cards, KPI tiles, segmented tabs, a labelled donut and trend charts.
   Chart marks follow the dataviz spec — 2px lines, recessive grid/axes,
   a 2px surface gap between donut slices, hover tooltips, and a legend
   with values for every multi-series chart (identity is never colour-only).
   ──────────────────────────────────────────────────────────────────── */

const AXIS = { fontSize: 10, fill: "#8f8d86" };
const GRID = "#ebeae4";

export function Card({
  title, right, children, className = "", bodyClassName = "",
}: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 px-4 pt-3">
          {title && <h3 className="text-[13px] font-bold text-gray-900">{title}</h3>}
          {right}
        </header>
      )}
      {/* grow (basis auto), not flex-1: an explicit body height must win so
          ResponsiveContainer charts get a real size to measure */}
      <div className={`min-h-0 grow px-4 pb-3 pt-2 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** spinning ring — the loading state for charts, tables and panels */
export function Spinner({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  const accent = useChartAccent();
  return (
    <div role="status" className={`flex h-full min-h-[120px] flex-col items-center justify-center gap-2.5 ${className}`}>
      <span
        className="h-9 w-9 animate-spin rounded-full border-[3px]"
        style={{ borderColor: `${accent}26`, borderTopColor: accent }}
      />
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
    </div>
  );
}

/** pulsing placeholder bar (KPI values, list rows) */
export function Shimmer({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

export function KpiTile({
  label, value, unit, sub, subTone = "muted", accent, dark = false, loading = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  subTone?: "muted" | "good" | "bad" | "warn";
  /** colour of the 3px top rule (category cards) */
  accent?: string;
  dark?: boolean;
  /** show pulsing placeholders instead of the value / sub line */
  loading?: boolean;
}) {
  const tone = { muted: dark ? "text-slate-400" : "text-gray-500", good: "text-emerald-600", bad: "text-rose-600", warn: "text-amber-600" }[subTone];
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-xl border px-4 py-3 shadow-sm ${dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}
    >
      {accent && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />}
      <p className={`truncate text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-300" : "text-gray-500"}`}>{label}</p>
      {loading ? (
        <>
          <Shimmer className={`mt-1.5 h-6 w-24 ${dark ? "bg-slate-700" : ""}`} />
          {sub != null && <Shimmer className={`mt-2 h-3 w-28 ${dark ? "bg-slate-700" : ""}`} />}
        </>
      ) : (
        <>
          <p className="mt-1 flex items-baseline gap-1">
            <span className={`text-[26px] font-bold leading-none tabular-nums tracking-tight ${dark ? "text-white" : "text-gray-900"}`}>{value}</span>
            {unit && <span className={`text-xs font-semibold ${dark ? "text-slate-400" : "text-gray-500"}`}>{unit}</span>}
          </p>
          {sub != null && <p className={`mt-1.5 truncate text-[11px] ${tone}`}>{sub}</p>}
        </>
      )}
    </div>
  );
}

export function Change({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-gray-400">no prior data</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(pct).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, size = "sm",
}: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md font-semibold transition-colors ${size === "md" ? "px-3.5 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]"} ${
            value === o.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyNote({ children = "No data for this period." }: { children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 text-xs text-gray-400">
      <Inbox className="h-6 w-6 text-slate-300" />
      {children}
    </div>
  );
}

export type DonutSlice = { name: string; value: number; color: string };

/** donut + a value legend beside it (the legend carries identity and the
 *  exact numbers, so low-contrast slice colours never stand alone).
 *  Hovering a slice — or its legend item — shows that slice in the donut's
 *  centre and fades the rest; there is no floating tooltip to cover the
 *  ring or the centre figure. The legend flows into as many columns as the
 *  card's width allows. */
export function Donut({
  data, center, centerLabel, format = (v: number) => fmtNum(v, 0), share = true,
}: { data: DonutSlice[]; center: ReactNode; centerLabel?: string; format?: (v: number) => string; share?: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <EmptyNote />;
  const slices = data.filter((d) => d.value > 0);
  const active = hovered ? data.find((d) => d.name === hovered) : undefined;
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[124px] w-[124px] shrink-0">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={42}
              outerRadius={60}
              paddingAngle={1.5}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setHovered(slices[i]?.name ?? null)}
              onMouseLeave={() => setHovered(null)}
            >
              {slices.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.color}
                  fillOpacity={hovered && hovered !== d.name ? 0.25 : 1}
                  style={{ outline: "none", cursor: "pointer", transition: "fill-opacity .15s ease" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          {active ? (
            <>
              <span className={`whitespace-nowrap font-bold leading-none tabular-nums text-gray-900 ${format(active.value).length > 7 ? "text-[12px]" : "text-[15px]"}`}>
                {format(active.value)}
              </span>
              <span className="mt-1 line-clamp-2 text-[9px] font-medium leading-tight text-gray-600">{active.name}</span>
              {share && <span className="text-[9px] tabular-nums text-gray-500">{pct(active.value)}</span>}
            </>
          ) : (
            <>
              <span className="text-xl font-bold leading-none tabular-nums text-gray-900">{center}</span>
              {centerLabel && <span className="mt-0.5 text-[9px] text-gray-500">{centerLabel}</span>}
            </>
          )}
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-x-4 gap-y-2 text-[11px]">
        {data.map((d) => (
          <li
            key={d.name}
            onMouseEnter={() => setHovered(d.name)}
            onMouseLeave={() => setHovered(null)}
            className={`flex min-w-0 cursor-default items-start gap-1.5 rounded-md transition-opacity ${hovered && hovered !== d.name ? "opacity-40" : ""}`}
          >
            <span className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-gray-700" title={d.name}>{d.name}</span>
              <span className="font-semibold tabular-nums text-gray-900">{format(d.value)}</span>
              {share && <span className="ml-1 tabular-nums text-gray-500">· {pct(d.value)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TipRow = { name?: string | number; value?: number | string; color?: string; stroke?: string; payload?: { fill?: string } };

function ChartTip({
  active, payload, label, format,
}: { active?: boolean; payload?: TipRow[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg">
      {label && <p className="mb-0.5 font-semibold text-gray-800">{/^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDay(label) : label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-gray-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.stroke ?? p.color ?? p.payload?.fill }} />
          {p.name}: <b className="tabular-nums text-gray-900">{format(Number(p.value ?? 0))}</b>
        </p>
      ))}
    </div>
  );
}

/** single-series area (the card title names the series — no legend box) */
export function AreaTrend({
  data, name, format,
}: { data: Array<{ date: string; value: number }>; name: string; format: (v: number) => string }) {
  const accent = useChartAccent();
  if (!data.some((d) => d.value > 0)) return <EmptyNote>No collections in the last 7 days.</EmptyNote>;
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
      <AreaChart data={data} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="lk-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={34} tickFormatter={compactNumber} />
        <Tooltip content={<ChartTip format={format} />} cursor={{ stroke: "#cbd5e1" }} />
        <Area type="monotone" dataKey="value" name={name} stroke={accent} strokeWidth={2} fill="url(#lk-area)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** one 2px line per series on a shared axis, legend with each series' total */
export function MultiLineTrend({
  data, series, format,
}: { data: Array<Record<string, number | string>>; series: Array<{ key: string; color: string }>; format: (v: number) => string }) {
  const totals = Object.fromEntries(series.map((s) => [s.key, data.reduce((a, d) => a + Number(d[s.key] ?? 0), 0)]));
  if (!Object.values(totals).some((v) => v > 0)) return <EmptyNote>No collections in the last 7 days.</EmptyNote>;
  return (
    <div className="flex h-full flex-col">
      <ul className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded" style={{ background: s.color }} />
            {s.key} <b className="tabular-nums text-gray-900">{format(totals[s.key])}</b>
          </li>
        ))}
      </ul>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
          <LineChart data={data} margin={{ top: 6, right: 14, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={34} tickFormatter={compactNumber} />
            <Tooltip content={<ChartTip format={format} />} cursor={{ stroke: "#cbd5e1" }} />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.key} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** ranked horizontal bars (top-N list) */
export function RankBars({
  rows, format, onRowClick, loading = false,
}: { rows: Array<{ id: string; name: string; value: number }>; format: (v: number) => string; onRowClick?: (id: string) => void; loading?: boolean }) {
  const accent = useChartAccent();
  if (loading)
    return (
      <ol className="space-y-3" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i}>
            <span className="flex justify-between gap-2"><Shimmer className="h-3 w-32" /><Shimmer className="h-3 w-12" /></span>
            <Shimmer className="mt-1.5 h-1.5 w-full rounded-full" />
          </li>
        ))}
      </ol>
    );
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <EmptyNote />;
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.id}>
          <button onClick={() => onRowClick?.(r.id)} className="group w-full text-left" title={`Show ${r.name} on the map`}>
            <span className="flex items-baseline justify-between gap-2 text-xs">
              <span className={`truncate ${r.value > 0 ? "text-gray-800" : "text-gray-400"} group-hover:underline`}>
                {i + 1}. {r.name}
              </span>
              <span className={`shrink-0 tabular-nums ${r.value > 0 ? "font-bold text-gray-900" : "text-gray-400"}`}>{format(r.value)}</span>
            </span>
            <span className="mt-1 block h-1.5 rounded-full bg-slate-100">
              <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: accent }} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
