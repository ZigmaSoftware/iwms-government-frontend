import type { ReactNode } from "react";
import { AlertCircle, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartAccent } from "./chartTheme";
import { Card, Donut, EmptyNote, KpiTile, RankBars, Segmented, Spinner } from "./DashboardKit";
import { fmtInt, fmtNum, fmtWeight, weightParts } from "./format";

/* ─────────────────────────────────────────────────────────────────────
   Monthly / Daily comparison layout shared by the State and District
   leader dashboards: filters + KPIs on top, then three side-by-side panels
   (map · analytics · tables) that fill the viewport and scroll on their own.

   The state portal compares districts, the district portal compares local
   bodies — both are fed through this neutral shape. `view` is what the KPIs,
   charts and detailed rows describe (the picked row's scoped response, or
   everything); `comparison` always lists every row so another can be picked.
   ──────────────────────────────────────────────────────────────────── */

export type CmpRow = { id: string; name: string; weight: number; trips: number; points: number; avg: number };
export type CmpDetail = { key: string; period: string; id: string; name: string; wasteType: string; weight: number; trips: number };
export type CmpView = {
  kpis: { weight: number; trips: number; points: number; avg: number; groups: number; wasteTypes: number };
  trend: Array<{ label: string; weight: number }>;
  breakdown: Array<{ name: string; weight: number }>;
  detail: CmpDetail[];
  /** total detailed rows before the server's cap, when capped */
  detailTotal?: number;
};
export type CmpTable = "comparison" | "rows";

const AXIS = { fontSize: 10, fill: "#8f8d86" };

function Skeleton() {
  return <Spinner />;
}

type TipRow = { value?: number | string };
function BarTip({ active, payload, label }: { active?: boolean; payload?: TipRow[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-gray-600">Collected: <b className="tabular-nums text-gray-900">{fmtWeight(Number(payload[0].value ?? 0))}</b></p>
    </div>
  );
}

export default function ComparisonView({
  granularity, filters, error, entity, view, viewLoading, comparison, comparisonLoading,
  picked, onPick, sort, map, wasteColors, trendNote, table, onTableChange, nameCell,
}: {
  granularity: "month" | "day";
  filters: ReactNode;
  error?: string;
  /** what one comparison row is: "District" / "Local body" */
  entity: { one: string; many: string };
  view: CmpView | null;
  viewLoading: boolean;
  comparison: CmpRow[];
  comparisonLoading: boolean;
  picked: { id: string; name: string } | null;
  onPick: (id: string | null) => void;
  sort: "weight" | "trips";
  map: ReactNode;
  wasteColors: Record<string, string>;
  trendNote: string;
  table: CmpTable;
  onTableChange: (t: CmpTable) => void;
  /** optional richer name cell (e.g. a local body's type) */
  nameCell?: (id: string, name: string) => ReactNode;
}) {
  const accent = useChartAccent();
  const monthly = granularity === "month";
  const k = view?.kpis;
  const where = picked ? ` · ${picked.name}` : "";
  const breakdownTotal = (view?.breakdown ?? []).reduce((a, w) => a + w.weight, 0);
  const pick = (id: string) => { onPick(id); onTableChange("rows"); };
  const name = (id: string, n: string) => (nameCell ? nameCell(id, n) : n);
  const th = "px-3 py-2 font-semibold";
  const td = "px-3 py-2";

  return (
    <div className="flex flex-col gap-3 lg:h-full">
      {/* filters */}
      <div className="flex shrink-0 flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        {filters}
        {picked && (
          <button
            onClick={() => onPick(null)}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            title={`Show every ${entity.one.toLowerCase()} again`}
          >
            {picked.name} <X size={12} />
          </button>
        )}
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile loading={viewLoading && !k} label="Total weight" value={k ? weightParts(k.weight).value : "—"} unit={k ? weightParts(k.weight).unit : undefined} />
        <KpiTile loading={viewLoading && !k} label="Total trips" value={k ? fmtInt(k.trips) : "—"} />
        <KpiTile loading={viewLoading && !k} label="Points covered" value={k ? fmtInt(k.points) : "—"} />
        <KpiTile loading={viewLoading && !k} label="Avg / trip" value={k ? fmtNum(k.avg) : "—"} unit="kg" />
        <KpiTile
          loading={viewLoading && !k && !picked}
          label={picked ? entity.one : entity.many}
          value={picked ? <span className="block truncate text-[20px]" title={picked.name}>{picked.name}</span> : k ? fmtInt(k.groups) : "—"}
          sub={picked ? "selected" : "with collections"}
        />
        <KpiTile loading={viewLoading && !k} label="Waste types" value={k ? fmtInt(k.wasteTypes) : "—"} />
      </div>

      {/* map · analytics · tables */}
      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.2fr)]">
        {/* 1 — map */}
        <div className="relative h-[460px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-[380px]">{map}</div>

        {/* 2 — analytics */}
        <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
          <Card
            title={`${monthly ? "Monthly trend" : "Day-wise trend"}${where}`}
            right={<span className="text-[11px] text-gray-500">{trendNote}</span>}
            className="shrink-0"
            bodyClassName="h-[230px]"
          >
            {viewLoading ? (
              <Skeleton />
            ) : !view?.trend.length ? (
              <EmptyNote />
            ) : (
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                <BarChart data={view.trend} barCategoryGap="28%" margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#ebeae4" />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: string) => (monthly ? v : v.slice(8))} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${v}`)} />
                  <Tooltip content={<BarTip />} cursor={{ fill: "#f5f3ff" }} />
                  <Bar dataKey="weight" name="Collected" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={monthly ? 40 : 18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card title={`Waste type composition${where}`} className="shrink-0">
            {viewLoading ? (
              <Skeleton />
            ) : (
              <Donut
                data={(view?.breakdown ?? []).map((w) => ({ name: w.name, value: w.weight, color: wasteColors[w.name] ?? "#8f8d86" }))}
                center={weightParts(breakdownTotal).value}
                centerLabel={weightParts(breakdownTotal).unit}
                format={fmtWeight}
              />
            )}
          </Card>
          <Card title={`Top ${entity.many.toLowerCase()} · ${sort}`} className="shrink-0">
            <RankBars
              rows={[...comparison]
                .sort((x, y) => (sort === "trips" ? y.trips - x.trips : y.weight - x.weight))
                .slice(0, 5)
                .map((r) => ({ id: r.id, name: r.name, value: sort === "trips" ? r.trips : r.weight }))}
              format={sort === "trips" ? fmtInt : fmtWeight}
              onRowClick={pick}
              loading={comparisonLoading}
            />
          </Card>
        </div>

        {/* 3 — tables */}
        <div className="flex h-[520px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-auto">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <Segmented
              value={table}
              onChange={onTableChange}
              options={[
                { value: "comparison", label: `${entity.one} comparison` },
                { value: "rows", label: "Detailed rows" },
              ]}
            />
            <span className="text-right text-[11px] text-gray-500">
              {table === "comparison"
                ? `${fmtInt(comparison.length)} ${entity.many.toLowerCase()}`
                : `${fmtInt(view?.detail.length ?? 0)}${view?.detailTotal && view.detailTotal > view.detail.length ? ` of ${fmtInt(view.detailTotal)}` : ""} rows${where}`}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {table === "comparison" ? (
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className={th}>{entity.one}</th>
                    <th className={`${th} text-right`}>Weight</th>
                    <th className={`${th} text-right`}>Trips</th>
                    <th className={`${th} text-right`}>Points</th>
                    <th className={`${th} text-right`}>Avg / trip</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonLoading ? (
                    <tr><td colSpan={5}><Skeleton /></td></tr>
                  ) : comparison.length === 0 ? (
                    <tr><td colSpan={5}><EmptyNote /></td></tr>
                  ) : (
                    comparison.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => pick(r.id)}
                        className={`cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/50 ${r.id === picked?.id ? "bg-violet-50" : ""}`}
                        title={`Show this ${entity.one.toLowerCase()}'s figures and highlight it on the map`}
                      >
                        <td className={`${td} font-medium text-gray-900`}>{name(r.id, r.name)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtWeight(r.weight)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtInt(r.trips)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtInt(r.points)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtNum(r.avg)} kg</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className={th}>{monthly ? "Month" : "Date"}</th>
                    <th className={th}>{entity.one}</th>
                    <th className={th}>Waste type</th>
                    <th className={`${th} text-right`}>Weight</th>
                    <th className={`${th} text-right`}>Trips</th>
                  </tr>
                </thead>
                <tbody>
                  {viewLoading ? (
                    <tr><td colSpan={5}><Skeleton /></td></tr>
                  ) : !view?.detail.length ? (
                    <tr><td colSpan={5}><EmptyNote /></td></tr>
                  ) : (
                    view.detail.map((r) => (
                      <tr key={r.key} className="border-b border-slate-50 last:border-0 hover:bg-violet-50/40">
                        <td className={`${td} tabular-nums text-gray-600`}>{r.period}</td>
                        <td className={`${td} font-medium text-gray-900`}>{name(r.id, r.name)}</td>
                        <td className={td}>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: wasteColors[r.wasteType] ?? "#8f8d86" }} />
                            {r.wasteType}
                          </span>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{fmtWeight(r.weight)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtInt(r.trips)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
