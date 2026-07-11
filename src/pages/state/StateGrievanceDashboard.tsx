import { useMemo } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  AlertTriangle, CheckCircle2, Clock, Download, Eye, Inbox, MapPin, Percent, RotateCcw, Timer,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DISTRICTS } from "@/data/tnDistricts";
import {
  BarTip, CARD, fmt, FilterSelect, KpiCard, MapLegend, Panel, PieTip, stepScale, TNChoropleth, useDistrictSelect,
} from "./dashboardKit";

/* per-district grievance snapshot derived from shared sample data */
const GRV = DISTRICTS.map((d) => {
  const received = d.grievances;
  const resolved = d.resolved;
  const pending = Math.max(0, received - resolved);
  const overdue = Math.round(pending * 0.35);
  const open = pending - overdue;
  const rate = received ? Math.round((resolved / received) * 100) : 0;
  const avgDays = Math.max(1, Math.round((100 - d.perf) / 8));
  return { id: d.id, name: d.name, received, resolved, pending, overdue, open, rate, avgDays };
}).sort((a, b) => b.received - a.received);

/* category mix (illustrative proportions, scaled to volume) */
const CAT_MIX: Array<{ name: string; p: number; color: string }> = [
  { name: "Missed Collection", p: 0.34, color: "#2563eb" },
  { name: "Bin Overflow", p: 0.24, color: "#16a34a" },
  { name: "Public Dumping", p: 0.16, color: "#ea580c" },
  { name: "Drain / Desilting", p: 0.14, color: "#7c3aed" },
  { name: "Dead Animal Removal", p: 0.07, color: "#0d9488" },
  { name: "Others", p: 0.05, color: "#94a3b8" },
];

const rateColor = stepScale([
  { min: 0, color: "#fde68a" },
  { min: 78, color: "#bfdbfe" },
  { min: 88, color: "#a7f3d0" },
]);
const ratePin = (r: number) => (r >= 88 ? "#10b981" : r >= 78 ? "#3b82f6" : "#f59e0b");

export default function StateGrievanceDashboard() {
  const { selectedId, setSelectedId, currentId, setHoveredId } = useDistrictSelect();

  const rows = useMemo(() => (selectedId ? GRV.filter((g) => g.id === selectedId) : GRV), [selectedId]);
  const active = selectedId !== null;

  const totals = useMemo(() => {
    const sum = (f: (r: (typeof GRV)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
    const received = sum((r) => r.received);
    const resolved = sum((r) => r.resolved);
    const avgDays = rows.length ? rows.reduce((s, r) => s + r.avgDays, 0) / rows.length : 0;
    return {
      received, resolved, pending: sum((r) => r.pending), overdue: sum((r) => r.overdue), open: sum((r) => r.open),
      rate: received ? Math.round((resolved / received) * 100) : 0, avgDays,
    };
  }, [rows]);

  const statusData = [
    { name: "Resolved", value: totals.resolved, color: "#16a34a" },
    { name: "Open", value: totals.open, color: "#f59e0b" },
    { name: "Overdue", value: totals.overdue, color: "#dc2626" },
  ];
  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);
  const catData = CAT_MIX.map((c) => ({ name: c.name, value: Math.round(totals.received * c.p), color: c.color }));
  const barData = rows.slice(0, 12).map((r) => ({ d: r.name.slice(0, 4), received: r.received, resolved: r.resolved }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      District: r.name, Received: r.received, Resolved: r.resolved, Pending: r.pending,
      Overdue: r.overdue, "Resolution %": r.rate, "Avg Resolution (days)": r.avgDays,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Grievances");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), "tamil-nadu-grievances.xlsx");
  };

  const KPIS = [
    { label: "TOTAL GRIEVANCES", desc: "Complaints logged in the period.", value: fmt(totals.received), unit: "", trend: 3.2, badUp: true, Icon: Inbox, color: "#2563eb", soft: "#eff6ff" },
    { label: "RESOLVED", desc: "Closed within/after SLA window.", value: fmt(totals.resolved), unit: "", trend: 7.4, Icon: CheckCircle2, color: "#16a34a", soft: "#f0fdf4" },
    { label: "PENDING", desc: "Open complaints awaiting action.", value: fmt(totals.pending), unit: "", trend: -4.1, badUp: true, Icon: Clock, color: "#f59e0b", soft: "#fffbeb" },
    { label: "RESOLUTION RATE", desc: "Share of grievances resolved.", value: `${totals.rate}`, unit: "%", trend: 2.6, Icon: Percent, color: "#0d9488", soft: "#f0fdfa" },
    { label: "AVG RESOLUTION", desc: "Mean days to close a grievance.", value: totals.avgDays.toFixed(1), unit: "days", trend: -6.3, Icon: Timer, color: "#7c3aed", soft: "#f5f3ff" },
  ];

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${CARD} p-3`}>
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 pr-1">
          <AlertTriangle className="h-3.5 w-3.5 text-slate-400" /> Grievance Filters
        </span>
        <FilterSelect icon={MapPin} value={selectedId ?? "all"} active={active} onChange={(v) => setSelectedId(v === "all" ? null : v)}>
          <option value="all">All Districts</option>
          {GRV.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </FilterSelect>
        {active && (
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 bg-white hover:bg-slate-50 hover:text-rose-500 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
        <button onClick={exportExcel} className="ml-auto flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow transition-colors">
          <Download className="h-3.5 w-3.5" /> Export
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {KPIS.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel title="Grievance Status" right={<span className="text-[10px] text-slate-400">Share</span>}>
            <div className="relative w-full h-36">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58} paddingAngle={2} cornerRadius={3} strokeWidth={0}>
                    {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-emerald-600 tabular-nums">{totals.rate}%</span>
                <span className="text-[9px] text-slate-400">Resolved</span>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-slate-600 flex-1">{s.name}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{fmt(s.value)}</span>
                  <span className="text-slate-400 tabular-nums w-11 text-right">{statusTotal ? ((s.value / statusTotal) * 100).toFixed(1) : "0.0"}%</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="District-wise Received vs Resolved" right={<span className="text-[10px] text-slate-400">Count</span>}>
            <ResponsiveContainer width="100%" height={252}>
              <BarChart data={barData} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<BarTip />} cursor={{ fill: "#f8fafc" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar dataKey="received" name="Received" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="resolved" name="Resolved" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Grievances by Category" right={<span className="text-[10px] text-slate-400">Mix</span>}>
            <div className="relative w-full h-36">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58} paddingAngle={2} cornerRadius={3} strokeWidth={0}>
                    {catData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt(totals.received)}</span>
                <span className="text-[9px] text-slate-400">Total</span>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {catData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-slate-600 flex-1 truncate">{d.name}</span>
                  <span className="text-slate-400 tabular-nums">{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* map */}
        <div className={`lg:col-span-1 lg:row-span-2 ${CARD} p-4 flex flex-col`}>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Resolution Rate Map</h3>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">Grievance resolution rate by district</p>
          <MapLegend items={[["Strong ≥88%", "#10b981"], ["Fair 78–88%", "#3b82f6"], ["Needs focus <78%", "#f59e0b"]]} />
          <div className="relative flex-1 min-h-[340px] flex items-center justify-center py-1">
            <TNChoropleth
              colorOf={(id) => { const g = GRV.find((x) => x.id === id); return g ? rateColor(g.rate) : "#eef2f7"; }}
              titleOf={(id) => { const g = GRV.find((x) => x.id === id); return g ? `${g.name} — ${g.rate}% resolved · ${g.pending} pending` : id; }}
              selectedId={currentId}
              onSelect={(id) => setSelectedId((p) => (p === id ? null : id))}
              onHover={setHoveredId}
            />
          </div>
        </div>

        {/* table */}
        <div className={`lg:col-span-3 ${CARD} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">District-wise Grievance Overview</h3>
          </div>
          <div className="overflow-auto max-h-[440px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-200">
                  {["District", "Received", "Resolved", "Pending", "Overdue", "Resolution %", "Avg Days", "Action"].map((h, i) => (
                    <th key={h} className={`sticky top-0 z-10 bg-slate-800 px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap ${i === 0 ? "text-left" : i === 7 ? "text-center" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const on = selectedId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-blue-50/40" style={{ background: on ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa" }} onClick={() => setSelectedId(on ? null : r.id)}>
                      <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{r.name}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.received)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 tabular-nums">{fmt(r.resolved)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.pending)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-500 tabular-nums">{fmt(r.overdue)}</td>
                      <td className="px-3 py-2.5 text-right"><span className="font-semibold tabular-nums" style={{ color: ratePin(r.rate) }}>{r.rate}%</span></td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{r.avgDays}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedId(on ? null : r.id); }} className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${on ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:bg-slate-100 hover:text-blue-600"}`} title="Show on map">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-blue-200 font-bold text-slate-700 [&>td]:sticky [&>td]:bottom-0 [&>td]:z-10 [&>td]:bg-blue-50">
                  <td className="px-3 py-3">{active ? "Selected" : "Total"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.received)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.resolved)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.pending)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.overdue)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.rate}%</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.avgDays.toFixed(1)}</td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Grievance figures are derived from the shared district sample data (grievances / resolved); category mix, overdue split and resolution times are illustrative and will switch to the live grievance-redressal feed once connected.
      </p>
    </>
  );
}
