import { useMemo } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Activity, Download, Eye, Fuel, Gauge, MapPin, Navigation, RotateCcw, Route, Truck,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DISTRICTS } from "@/data/tnDistricts";
import {
  BarTip, CARD, fmt, FilterSelect, KpiCard, MapLegend, Panel, PieTip, stepScale, TNChoropleth, useDistrictSelect,
} from "./dashboardKit";

/* derive a per-district fleet snapshot from the shared sample data */
const FLEET = DISTRICTS.map((d) => {
  const vehicles = d.vehicles;
  const active = d.activeVehicles;
  const idle = Math.max(0, vehicles - active);
  const maintenance = Math.round(idle * 0.4);
  const offline = idle - maintenance;
  const trips = Math.round(active * 4.2);
  const distance = Math.round(trips * 22);
  const utilization = vehicles ? Math.round((active / vehicles) * 100) : 0;
  return { id: d.id, name: d.name, vehicles, active, idle, maintenance, offline, trips, distance, utilization };
}).sort((a, b) => b.vehicles - a.vehicles);

const utilColor = stepScale([
  { min: 0, color: "#fde68a" },
  { min: 78, color: "#bfdbfe" },
  { min: 88, color: "#a7f3d0" },
]);
const utilPin = (u: number) => (u >= 88 ? "#10b981" : u >= 78 ? "#3b82f6" : "#f59e0b");

export default function StateFleetDashboard() {
  const { selectedId, setSelectedId, currentId, setHoveredId } = useDistrictSelect();

  const rows = useMemo(() => (selectedId ? FLEET.filter((f) => f.id === selectedId) : FLEET), [selectedId]);
  const active = selectedId !== null;

  const totals = useMemo(() => {
    const sum = (f: (r: (typeof FLEET)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
    const vehicles = sum((r) => r.vehicles);
    const act = sum((r) => r.active);
    return {
      vehicles, active: act, idle: sum((r) => r.idle), maintenance: sum((r) => r.maintenance),
      offline: sum((r) => r.offline), trips: sum((r) => r.trips), distance: sum((r) => r.distance),
      utilization: vehicles ? Math.round((act / vehicles) * 100) : 0,
    };
  }, [rows]);

  const statusData = [
    { name: "Active / On-route", value: totals.active, color: "#16a34a" },
    { name: "Idle / Parked", value: totals.offline, color: "#f59e0b" },
    { name: "Under Maintenance", value: totals.maintenance, color: "#94a3b8" },
  ];
  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);
  const barData = rows.slice(0, 12).map((r) => ({ d: r.name.slice(0, 4), vehicles: r.vehicles, active: r.active }));
  const utilLeaders = [...FLEET].sort((a, b) => b.utilization - a.utilization).slice(0, 6);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      District: r.name, Vehicles: r.vehicles, Active: r.active, Idle: r.idle,
      "Under Maintenance": r.maintenance, "Utilization %": r.utilization, "Trips Today": r.trips, "Distance (km)": r.distance,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fleet Track");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), "tamil-nadu-fleet.xlsx");
  };

  const KPIS = [
    { label: "TOTAL VEHICLES", desc: "Registered fleet across selected area.", value: fmt(totals.vehicles), unit: "", trend: 4.1, Icon: Truck, color: "#2563eb", soft: "#eff6ff" },
    { label: "ACTIVE NOW", desc: "On-route with live GPS, moving.", value: fmt(totals.active), unit: "", trend: 5.6, Icon: Navigation, color: "#16a34a", soft: "#f0fdf4" },
    { label: "IDLE / OFFLINE", desc: "Parked, ignition-off or no signal.", value: fmt(totals.offline), unit: "", trend: -2.3, badUp: true, Icon: Activity, color: "#f59e0b", soft: "#fffbeb" },
    { label: "TRIPS TODAY", desc: "Completed collection routes today.", value: fmt(totals.trips), unit: "", trend: 6.2, Icon: Route, color: "#7c3aed", soft: "#f5f3ff" },
    { label: "DISTANCE TODAY", desc: "Total kilometres run by the fleet.", value: fmt(totals.distance), unit: "km", trend: 3.8, Icon: Fuel, color: "#0d9488", soft: "#f0fdfa" },
  ];

  return (
    <>
      {/* filter bar */}
      <div className={`flex flex-wrap items-center gap-2 ${CARD} p-3`}>
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 pr-1">
          <Truck className="h-3.5 w-3.5 text-slate-400" /> Fleet Filters
        </span>
        <FilterSelect icon={MapPin} value={selectedId ?? "all"} active={active} onChange={(v) => setSelectedId(v === "all" ? null : v)}>
          <option value="all">All Districts</option>
          {FLEET.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
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

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {KPIS.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* charts + map + table */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel title="Fleet Status" right={<span className="text-[10px] text-slate-400">Live</span>}>
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
                <span className="text-lg font-bold text-blue-600 tabular-nums">{totals.utilization}%</span>
                <span className="text-[9px] text-slate-400">Utilization</span>
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

          <Panel title="District-wise Fleet vs Active" right={<span className="text-[10px] text-slate-400">Vehicles</span>}>
            <ResponsiveContainer width="100%" height={252}>
              <BarChart data={barData} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<BarTip />} cursor={{ fill: "#f8fafc" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar dataKey="vehicles" name="Vehicles" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="active" name="Active" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Top Utilization" right={<Gauge className="h-3.5 w-3.5 text-slate-300" />}>
            <div className="space-y-2.5 mt-1">
              {utilLeaders.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-slate-600 font-medium">{r.name}</span>
                    <span className="font-bold tabular-nums" style={{ color: utilPin(r.utilization) }}>{r.utilization}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.utilization}%`, background: utilPin(r.utilization) }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* map */}
        <div className={`lg:col-span-1 lg:row-span-2 ${CARD} p-4 flex flex-col`}>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Fleet Utilization Map</h3>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">Vehicle utilization by district</p>
          <MapLegend items={[["High ≥88%", "#10b981"], ["Medium 78–88%", "#3b82f6"], ["Low <78%", "#f59e0b"]]} />
          <div className="relative flex-1 min-h-[340px] flex items-center justify-center py-1">
            <TNChoropleth
              colorOf={(id) => { const f = FLEET.find((x) => x.id === id); return f ? utilColor(f.utilization) : "#eef2f7"; }}
              titleOf={(id) => { const f = FLEET.find((x) => x.id === id); return f ? `${f.name} — ${f.utilization}% util · ${f.active}/${f.vehicles} active` : id; }}
              selectedId={currentId}
              onSelect={(id) => setSelectedId((p) => (p === id ? null : id))}
              onHover={setHoveredId}
            />
          </div>
        </div>

        {/* table */}
        <div className={`lg:col-span-3 ${CARD} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">District-wise Fleet Overview</h3>
          </div>
          <div className="overflow-auto max-h-[440px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-200">
                  {["District", "Vehicles", "Active", "Idle", "Maintenance", "Utilization %", "Trips", "Distance (km)", "Action"].map((h, i) => (
                    <th key={h} className={`sticky top-0 z-10 bg-slate-800 px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap ${i === 0 ? "text-left" : i === 8 ? "text-center" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const on = selectedId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-blue-50/40" style={{ background: on ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa" }} onClick={() => setSelectedId(on ? null : r.id)}>
                      <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{r.name}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.vehicles)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 tabular-nums">{fmt(r.active)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{fmt(r.offline)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{fmt(r.maintenance)}</td>
                      <td className="px-3 py-2.5 text-right"><span className="font-semibold tabular-nums" style={{ color: utilPin(r.utilization) }}>{r.utilization}%</span></td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.trips)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.distance)}</td>
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
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.vehicles)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.active)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.offline)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.maintenance)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{totals.utilization}%</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.trips)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.distance)}</td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Fleet figures are derived from the shared district sample data (vehicles / active vehicles); trips, distance and maintenance splits are illustrative and will switch to the live GPS/VTS feed once connected.
      </p>
    </>
  );
}
