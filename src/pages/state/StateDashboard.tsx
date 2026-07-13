import { useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Building, Building2, Calendar, Download, Eye,
  Filter, Gauge, Home, Info, Landmark, Layers, MapPin, Recycle, RotateCcw, Trash2, Truck, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { DISTRICTS } from "@/data/tnDistricts";
import { tnDistricts, TN_VIEWBOX } from "@/data/tamilnadu-map";
import { localBodiesByDistrict } from "@/data/localBodies";
import DistrictLocalBodiesDrawer from "./DistrictLocalBodiesDrawer";
import StateFleetDashboard from "./StateFleetDashboard";
import StateGrievanceDashboard from "./StateGrievanceDashboard";
import ZigmaLogo from "../../images/logo.png";

type DashView = "overview" | "fleet" | "grievance";
const VIEW_TABS: Array<{ key: DashView; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: "overview", label: "Waste Overview", Icon: Recycle },
  { key: "fleet", label: "Fleet Track", Icon: Truck },
  { key: "grievance", label: "Grievances", Icon: AlertTriangle },
];

/* ─────────────────────────────────────────────────────────────────────
   State (Tamil Nadu) Dashboard — state-wide waste-management overview.

   This is a design/preview page: Tamil Nadu has no state-level aggregation
   API in this system yet, so the KPI, category, chart and table figures
   below are illustrative sample data. The Tamil Nadu district map renders
   the geographically-accurate district geometry from @/data/tamilnadu-map,
   joined by id to the per-district sample figures in @/data/tnDistricts,
   and supports district-wise selection (click a district on the map or a
   row in the table — the two stay in sync). Swap the sample constants for
   live API data once a state endpoint exists.
   ──────────────────────────────────────────────────────────────────── */

const fmt = (v: number) => v.toLocaleString("en-IN");

type Tone = { color: string; soft: string };

const KPIS: Array<{ label: string; desc: string; value: string; unit: string; trend: number; badUp?: boolean; Icon: React.ComponentType<{ className?: string }> } & Tone> = [
  { label: "COLLECTED", desc: "Tonnes of waste lifted, district-wise.", value: "6,73,420", unit: "T", trend: 7.8, Icon: Truck, color: "#2563eb", soft: "#eff6ff" },
  { label: "PROCESSED", desc: "Wet, dry and recyclables routed to processing.", value: "5,24,860", unit: "T", trend: 6.6, Icon: Recycle, color: "#16a34a", soft: "#f0fdf4" },
  { label: "DISPOSED", desc: "Residual fraction at landfill — weighbridge reconciled.", value: "1,48,560", unit: "T", trend: 3.4, badUp: true, Icon: Trash2, color: "#ea580c", soft: "#fff7ed" },
  { label: "FIELD EMPLOYEES", desc: "Crew on-duty live, QR-attendance, absentees flagged.", value: "23,842", unit: "", trend: 5.2, Icon: Users, color: "#7c3aed", soft: "#f5f3ff" },
];

const CATS: Array<{ name: string; count: string; unitLabel: string; mid: string; midLabel: string; Icon: React.ComponentType<{ className?: string }> } & Tone> = [
  { name: "Corporation", count: "21", unitLabel: "Corporations", mid: "1,221", midLabel: "Wards", Icon: Landmark, color: "#2563eb", soft: "#eff6ff" },
  { name: "Municipality", count: "138", unitLabel: "Municipalities", mid: "4,812", midLabel: "Wards", Icon: Building2, color: "#16a34a", soft: "#f0fdf4" },
  { name: "Town Panchayat", count: "528", unitLabel: "Town Panchayats", mid: "2,734", midLabel: "Wards", Icon: Building, color: "#ea580c", soft: "#fff7ed" },
  { name: "Panchayat Union (Blocks)", count: "386", unitLabel: "Blocks", mid: "–", midLabel: "Units", Icon: Users, color: "#7c3aed", soft: "#f5f3ff" },
  { name: "Village Panchayat", count: "12,525", unitLabel: "Village Panchayats", mid: "–", midLabel: "Villages", Icon: Home, color: "#0d9488", soft: "#f0fdfa" },
];

const WASTE_DIST = [
  { name: "Wet Waste", value: 325480, color: "#16a34a" },
  { name: "Dry Waste", value: 167310, color: "#f59e0b" },
  { name: "Recyclables", value: 105380, color: "#2563eb" },
  { name: "Domestic Hazardous", value: 28960, color: "#b91c1c" },
  { name: "Sanitary / Others", value: 46890, color: "#0d9488" },
];
const WASTE_TOTAL = "6,73,420";

const ATTEND = [
  { name: "Present", value: 22210, color: "#16a34a" },
  { name: "Absent", value: 1432, color: "#ea580c" },
  { name: "On Leave", value: 200, color: "#94a3b8" },
];

const BAR_DISTRICTS = [
  { d: "Che", collected: 102650, processed: 86420 },
  { d: "Coi", collected: 81230, processed: 65120 },
  { d: "Mad", collected: 69560, processed: 55820 },
  { d: "Sal", collected: 58470, processed: 45230 },
  { d: "Tric", collected: 51360, processed: 40120 },
  { d: "Tvl", collected: 46780, processed: 36210 },
  { d: "Ero", collected: 41250, processed: 32110 },
  { d: "Vlr", collected: 38960, processed: 29410 },
  { d: "Cud", collected: 33480, processed: 25210 },
  { d: "Dgl", collected: 31270, processed: 23480 },
  { d: "Tho", collected: 28500, processed: 21400 },
  { d: "Ngr", collected: 24800, processed: 18900 },
  { d: "Pdk", collected: 22300, processed: 17100 },
];

type TableRow = {
  id: string; name: string; corp: string; muni: string; town: string; block: string;
  village: string; wards: number; collected: number; processed: number; disposed: number;
  employees: number; attendance: number;
};
const TABLE_ROWS: TableRow[] = [
  { id: "chennai", name: "Chennai", corp: "1", muni: "–", town: "–", block: "–", village: "–", wards: 200, collected: 102650, processed: 86420, disposed: 12180, employees: 3842, attendance: 94.6 },
  { id: "coimbatore", name: "Coimbatore", corp: "1", muni: "–", town: "–", block: "–", village: "–", wards: 100, collected: 81230, processed: 65120, disposed: 10420, employees: 2942, attendance: 93.1 },
  { id: "madurai", name: "Madurai", corp: "1", muni: "–", town: "–", block: "–", village: "–", wards: 100, collected: 69560, processed: 55820, disposed: 9180, employees: 2540, attendance: 92.0 },
  { id: "salem", name: "Salem", corp: "–", muni: "2", town: "3", block: "5", village: "182", wards: 248, collected: 58470, processed: 45230, disposed: 6920, employees: 2215, attendance: 92.4 },
  { id: "tiruchirappalli", name: "Tiruchirappalli", corp: "–", muni: "2", town: "4", block: "7", village: "247", wards: 312, collected: 51360, processed: 40120, disposed: 6210, employees: 1986, attendance: 93.7 },
  { id: "tirunelveli", name: "Tirunelveli", corp: "–", muni: "2", town: "5", block: "6", village: "312", wards: 298, collected: 46780, processed: 36210, disposed: 5780, employees: 1812, attendance: 92.6 },
  { id: "erode", name: "Erode", corp: "–", muni: "1", town: "4", block: "6", village: "261", wards: 190, collected: 41250, processed: 32110, disposed: 5200, employees: 1654, attendance: 91.3 },
  { id: "vellore", name: "Vellore", corp: "–", muni: "2", town: "3", block: "6", village: "274", wards: 210, collected: 38960, processed: 29410, disposed: 5010, employees: 1543, attendance: 93.0 },
  { id: "cuddalore", name: "Cuddalore", corp: "–", muni: "1", town: "3", block: "6", village: "286", wards: 186, collected: 33480, processed: 25210, disposed: 4280, employees: 1368, attendance: 91.7 },
  { id: "dindigul", name: "Dindigul", corp: "–", muni: "1", town: "3", block: "6", village: "255", wards: 164, collected: 31270, processed: 23480, disposed: 3950, employees: 1287, attendance: 92.8 },
];
const TABLE_TOTAL = { corp: "21", muni: "138", town: "528", block: "386", village: "12,525", wards: "12,648", collected: "6,73,420", processed: "5,24,860", disposed: "1,48,560", employees: "23,842", attendance: "93.2" };

type TipEntry = { name?: string; value?: number; color?: string; fill?: string };

const PINNED = TABLE_ROWS.map((r) => r.id);

/* The accurate district geometry (src/data/tamilnadu-map) uses a few id
   spellings that differ from the sample-data ids in src/data/tnDistricts.
   These maps bridge the two so the map paths join to the dashboard data. */
const DATA_ID_TO_MAP_ID: Record<string, string> = {
  thoothukudi: "thoothukkudi",
  villupuram: "viluppuram",
  tirupattur: "tirupathur",
};
const MAP_ID_TO_DATA_ID: Record<string, string> = Object.fromEntries(
  Object.entries(DATA_ID_TO_MAP_ID).map(([dataId, mapId]) => [mapId, dataId]),
);
const districtById = new Map(DISTRICTS.map((d) => [d.id, d]));
const shapeByMapId = new Map(tnDistricts.map((s) => [s.id, s]));

/* performance → colour tier (shared by pins, legend and district tint) */
const tierColor = (p: number) => (p >= 85 ? "#10b981" : p >= 75 ? "#3b82f6" : "#f59e0b");
const tierSoft = (p: number) => (p >= 85 ? "#a7f3d0" : p >= 75 ? "#bfdbfe" : "#fde68a");
const perfTier = (p: number): "excellent" | "good" | "focus" =>
  p >= 85 ? "excellent" : p >= 75 ? "good" : "focus";

/* ── filter option catalogues ──
   local bodies split into Rural vs Urban, each with its own sub-types */
type LbCategory = "rural" | "urban";
const LB_CATEGORY_OPTIONS: Array<{ value: LbCategory; label: string }> = [
  { value: "rural", label: "Rural Local Body" },
  { value: "urban", label: "Urban Local Body" },
];
const LB_SUBTYPES: Record<LbCategory, Array<{ value: keyof TableRow; label: string }>> = {
  rural: [
    { value: "block", label: "Panchayat Union" },
    { value: "village", label: "Village Panchayat" },
  ],
  urban: [
    { value: "corp", label: "Corporation" },
    { value: "muni", label: "Municipality" },
    { value: "town", label: "Town Panchayat" },
  ],
};
const TIER_OPTIONS = [
  { value: "excellent", label: "Excellent (≥85%)" },
  { value: "good", label: "Good (75–85%)" },
  { value: "focus", label: "Needs focus (<75%)" },
] as const;

/* category-card name → the local-body count field it represents */
const CAT_KEY: Record<string, "corp" | "muni" | "town" | "block" | "village"> = {
  Corporation: "corp",
  Municipality: "muni",
  "Town Panchayat": "town",
  "Panchayat Union (Blocks)": "block",
  "Village Panchayat": "village",
};

/** parse a display cell ("1", "12,525", "–") to a number */
const toNum = (v: string | number) =>
  typeof v === "number" ? v : Number(v.replace(/[^0-9.]/g, "")) || 0;

/* compact labelled <select> used in the filter bar */
const FilterSelect: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ icon: Icon, value, onChange, active, children }) => (
  <div
    className={`flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-2 text-xs shadow-sm transition-colors focus-within:ring-2 focus-within:ring-blue-100 ${
      active ? "border border-blue-300 text-blue-700" : "border border-slate-200 text-slate-600"
    }`}
  >
    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-blue-500" : "text-slate-400"}`} />
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer bg-transparent pr-1 font-medium outline-none"
    >
      {children}
    </select>
  </div>
);

/* ── presentational helpers (module scope — never recreated per render) ── */
const TrendPill = ({ v, bad }: { v: number; bad?: boolean }) => {
  const up = v >= 0;
  const good = bad ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${good ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}{v}% <span className="text-slate-400 font-normal">vs last month</span>
    </span>
  );
};

const Panel = ({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-4 ${className ?? ""}`}>
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const PieTip = ({ active, payload, unit = "" }: { active?: boolean; payload?: TipEntry[]; unit?: string }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-xl">
      <p className="font-semibold">{p.name}</p>
      <p className="text-slate-300 tabular-nums">{fmt(p.value ?? 0)}{unit}</p>
    </div>
  );
};

const BarTip = ({ active, payload, label }: { active?: boolean; payload?: TipEntry[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-[11px] shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-slate-200">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          {p.name}: <span className="font-semibold text-white tabular-nums">{fmt(p.value ?? 0)} T</span>
        </p>
      ))}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════ */
export default function StateDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [activeView, setActiveView] = useState<DashView>("overview");
  const [overviewTab, setOverviewTab] = useState<"summary" | "map">("summary");
  const [dateFrom, setDateFrom] = useState("2025-06-01");
  const [dateTo, setDateTo] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [lbCategory, setLbCategory] = useState<LbCategory | "all">("all");
  const [lbType, setLbType] = useState<string>("all"); // sub-type within the category
  const [tier, setTier] = useState<string>("all");
  const [lbDrawerId, setLbDrawerId] = useState<string | null>(null);

  /* current district = selected (sticky) or hovered (preview) */
  const currentId = selectedId ?? hoveredId;
  const currentDistrict = useMemo(() => DISTRICTS.find((d) => d.id === currentId) ?? null, [currentId]);

  /* animated location markers for the districts shown in the table —
     positioned via the accurate map centroids (cx/cy) */
  const markers = useMemo(
    () =>
      DISTRICTS.filter((d) => PINNED.includes(d.id))
        .map((d, index) => {
          const shape = shapeByMapId.get(DATA_ID_TO_MAP_ID[d.id] ?? d.id);
          return shape
            ? { id: d.id, name: d.name, perf: d.perf, cx: shape.cx, cy: shape.cy, index }
            : null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null),
    [],
  );
  /* when idle, auto-cycle the highlighted pin; when a district is active the
     pin keys off currentId directly, so no extra state sync is needed */
  useEffect(() => {
    if (currentId) return;
    const t = setInterval(() => setHighlightIdx((p) => (p + 1) % markers.length), 2500);
    return () => clearInterval(t);
  }, [currentId, markers.length]);

  const wasteTotalNum = useMemo(() => WASTE_DIST.reduce((s, d) => s + d.value, 0), []);
  const attendTotal = useMemo(() => ATTEND.reduce((s, a) => s + a.value, 0), []);

  /* ── apply District / Local-body / Performance filters to the table ── */
  const filtersActive = selectedId !== null || lbCategory !== "all" || tier !== "all";

  const filteredRows = useMemo(
    () =>
      TABLE_ROWS.filter((r) => {
        if (selectedId && r.id !== selectedId) return false;
        if (tier !== "all" && perfTier(districtById.get(r.id)?.perf ?? 0) !== tier) return false;
        if (lbCategory !== "all") {
          // which local-body fields must the district have to qualify
          const fields =
            lbType !== "all"
              ? [lbType as keyof TableRow]
              : LB_SUBTYPES[lbCategory].map((s) => s.value);
          if (!fields.some((f) => toNum(r[f]) > 0)) return false;
        }
        return true;
      }),
    [selectedId, tier, lbCategory, lbType],
  );

  const filteredIds = useMemo(() => new Set(filteredRows.map((r) => r.id)), [filteredRows]);

  /* footer: static state-wide totals when unfiltered, else a live subtotal */
  const footerTotals = useMemo(() => {
    if (!filtersActive) return TABLE_TOTAL;
    const sum = (f: keyof TableRow) => filteredRows.reduce((s, r) => s + toNum(r[f]), 0);
    const att = filteredRows.length
      ? filteredRows.reduce((s, r) => s + r.attendance, 0) / filteredRows.length
      : 0;
    return {
      corp: fmt(sum("corp")), muni: fmt(sum("muni")), town: fmt(sum("town")),
      block: fmt(sum("block")), village: fmt(sum("village")), wards: fmt(sum("wards")),
      collected: fmt(sum("collected")), processed: fmt(sum("processed")),
      disposed: fmt(sum("disposed")), employees: fmt(sum("employees")),
      attendance: att.toFixed(1),
    };
  }, [filtersActive, filteredRows]);

  /* ── recompute every card / chart from the filtered rows ──
     (only used while a filter is active; otherwise the static state-wide
     sample constants are shown so the headline totals stay intact) */
  const agg = useMemo(() => {
    const rows = filteredRows;
    const sumN = (f: keyof TableRow) => rows.reduce((s, r) => s + toNum(r[f]), 0);
    const collected = sumN("collected");
    const processed = sumN("processed");
    const disposed = sumN("disposed");
    const employees = sumN("employees");
    const present = rows.reduce((s, r) => s + Math.round(r.employees * (r.attendance / 100)), 0);
    const nonPresent = Math.max(0, employees - present);
    const onLeave = Math.round(nonPresent * 0.12); // state leave:absent ≈ 12:88
    const absent = nonPresent - onLeave;
    const avgAtt = employees ? (present / employees) * 100 : 0;
    const scale = wasteTotalNum ? collected / wasteTotalNum : 0;
    return {
      collected, processed, disposed, employees, avgAtt,
      waste: WASTE_DIST.map((w) => ({ ...w, value: Math.round(w.value * scale) })),
      bars: rows.map((r) => ({ d: r.name.slice(0, 4), collected: r.collected, processed: r.processed })),
      attend: [
        { name: "Present", value: present, color: "#16a34a" },
        { name: "Absent", value: absent, color: "#ea580c" },
        { name: "On Leave", value: onLeave, color: "#94a3b8" },
      ],
      cats: {
        corp: sumN("corp"), muni: sumN("muni"), town: sumN("town"),
        block: sumN("block"), village: sumN("village"),
      } as Record<string, number>,
    };
  }, [filteredRows, wasteTotalNum]);

  /* view data — filtered aggregate when a filter is on, else static sample */
  const kpiOverride: Record<string, string> = {
    COLLECTED: fmt(agg.collected), PROCESSED: fmt(agg.processed),
    DISPOSED: fmt(agg.disposed), "FIELD EMPLOYEES": fmt(agg.employees),
  };
  const wasteData = filtersActive ? agg.waste : WASTE_DIST;
  const wasteTotalView = filtersActive ? agg.collected : wasteTotalNum;
  const barData = filtersActive ? agg.bars : BAR_DISTRICTS;
  const attendData = filtersActive ? agg.attend : ATTEND;
  const attendTotalView = filtersActive ? agg.attend.reduce((s, a) => s + a.value, 0) : attendTotal;
  const avgAttView = filtersActive ? agg.avgAtt : 93.2;

  const clearFilters = () => {
    setDateFrom("2025-06-01"); setDateTo(today);
    setSelectedId(null); setLbCategory("all"); setLbType("all"); setTier("all");
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(TABLE_ROWS.map((r) => ({
      District: r.name, Corporation: r.corp, Municipality: r.muni, "Town Panchayat": r.town,
      "Panchayat Union (Blocks)": r.block, "Village Panchayat": r.village, Wards: r.wards,
      "Collected (T)": r.collected, "Processed (T)": r.processed, "Disposed (T)": r.disposed,
      "Field Employees": r.employees, "Attendance %": r.attendance,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tamil Nadu Overview");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), "tamil-nadu-overview.xlsx");
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 text-slate-800">
      <main className="p-5 sm:p-6 space-y-4 max-w-[1400px] mx-auto">

        {/* ── Title bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center shadow-sm">
              <img src={ZigmaLogo} className="h-8 w-8 object-contain" alt="Zigma" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Tamil Nadu Dashboard</h1>
              <p className="text-sm text-slate-400 mt-1">
                {activeView === "overview" ? "State Wise Waste Management Overview" : activeView === "fleet" ? "Statewide Fleet Tracking & Utilization" : "Statewide Grievance Redressal Monitor"}
              </p>
            </div>
          </div>
          {activeView === "overview" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="outline-none bg-transparent" />
                <span className="text-slate-300">–</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="outline-none bg-transparent" />
              </div>
              <button onClick={clearFilters} className="border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 shadow-sm transition-colors">Clear</button>
              <button onClick={exportExcel} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2.5 text-xs font-semibold shadow-lg shadow-slate-900/10 transition-all hover:-translate-y-0.5">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          )}
        </div>

        {/* ── View tabs ── */}
        <div className="flex flex-wrap gap-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-1.5">
          {VIEW_TABS.map((t) => {
            const on = activeView === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveView(t.key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${on ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
              >
                <t.Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {activeView === "fleet" && <StateFleetDashboard />}
        {activeView === "grievance" && <StateGrievanceDashboard />}

        {activeView === "overview" && (<>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-3">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 pr-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" /> Filters
          </span>

          <FilterSelect icon={MapPin} value={selectedId ?? "all"} active={selectedId !== null} onChange={(v) => setSelectedId(v === "all" ? null : v)}>
            <option value="all">All Districts</option>
            {TABLE_ROWS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </FilterSelect>

          {/* Local Bodies → Rural/Urban */}
          <FilterSelect
            icon={Layers}
            value={lbCategory}
            active={lbCategory !== "all"}
            onChange={(v) => { setLbCategory(v as LbCategory | "all"); setLbType("all"); }}
          >
            <option value="all">All Local Bodies</option>
            {LB_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </FilterSelect>

          {/* dependent sub-type dropdown (only when a category is chosen) */}
          {lbCategory !== "all" && (
            <FilterSelect icon={Building2} value={lbType} active={lbType !== "all"} onChange={setLbType}>
              <option value="all">All {lbCategory === "rural" ? "Rural" : "Urban"} Types</option>
              {LB_SUBTYPES[lbCategory].map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </FilterSelect>
          )}

          <FilterSelect icon={Gauge} value={tier} active={tier !== "all"} onChange={setTier}>
            <option value="all">All Performance</option>
            {TIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </FilterSelect>

          {filtersActive && (
            <button
              onClick={() => { setSelectedId(null); setLbCategory("all"); setLbType("all"); setTier("all"); }}
              className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 bg-white hover:bg-slate-50 hover:text-rose-500 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">
            Showing <span className="font-bold text-slate-700 tabular-nums">{filteredRows.length}</span> of {TABLE_ROWS.length} districts
          </span>
        </div>

        {/* ── Overview sub-tabs ── */}
        <div className="flex flex-wrap gap-1.5">
          {([["summary", "Summary", Gauge], ["map", "Districts & Map", MapPin]] as const).map(([key, label, Icon]) => {
            const on = overviewTab === key;
            return (
              <button
                key={key}
                onClick={() => setOverviewTab(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold border transition-colors ${on ? "bg-slate-900 text-white border-slate-900 shadow" : "bg-white text-slate-500 border-slate-200 hover:text-slate-700"}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            );
          })}
        </div>

        {overviewTab === "summary" && (<>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {KPIS.map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: k.color }}>{k.label}</p>
                <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: k.soft, color: k.color }}><k.Icon className="h-4 w-4" /></span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug min-h-[28px]">{k.desc}</p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{filtersActive ? kpiOverride[k.label] ?? k.value : k.value}</span>
                {k.unit && <span className="text-xs font-semibold text-slate-400">{k.unit}</span>}
              </p>
              <div className="mt-1.5"><TrendPill v={k.trend} bad={k.badUp} /></div>
            </div>
          ))}

          {/* Overall total */}
          <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{filtersActive ? "Filtered Total" : "Overall Tamil Nadu Total"}</p>
                <p className="text-[11px] text-slate-400">{filtersActive ? `${filteredRows.length} district${filteredRows.length === 1 ? "" : "s"} selected.` : "All categories combined."}</p>
              </div>
              <span className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Landmark className="h-4 w-4" /></span>
            </div>
            <div className="space-y-1">
              {(filtersActive
                ? [["Collected (T)", fmt(agg.collected)], ["Processed (T)", fmt(agg.processed)], ["Disposed (T)", fmt(agg.disposed)], ["Field Employees", fmt(agg.employees)]]
                : [["Collected (T)", "6,73,420"], ["Processed (T)", "5,24,860"], ["Disposed (T)", "1,48,560"], ["Field Employees", "23,842"]]
              ).map(([l, v]) => (
                <div key={l} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{l}</span>
                  <span className="font-bold text-slate-800 tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Category row — divided into Rural & Urban local bodies ── */}
        <div className="space-y-3">
          {LB_CATEGORY_OPTIONS.map((grp) => {
            const groupKeys = LB_SUBTYPES[grp.value].map((s) => s.value);
            const groupCats = CATS.filter((c) => groupKeys.includes(CAT_KEY[c.name]));
            const groupActive = lbCategory === grp.value;
            return (
              <div key={grp.value}>
                <div className="flex items-center gap-1.5 mb-2">
                  {grp.value === "rural" ? <Layers className="h-3.5 w-3.5 text-slate-400" /> : <Building2 className="h-3.5 w-3.5 text-slate-400" />}
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{grp.label} Bodies</p>
                  {groupActive && <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5">filtered</span>}
                </div>
                <div className={`grid grid-cols-2 gap-3 ${grp.value === "urban" ? "md:grid-cols-3 lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-2"}`}>
                  {groupCats.map((c) => {
                    const key = CAT_KEY[c.name];
                    const highlight = groupActive && (lbType === key || lbType === "all");
                    const count = filtersActive ? fmt(agg.cats[key] ?? 0) : c.count;
                    const mid = filtersActive ? "–" : c.mid;
                    return (
                      <div
                        key={c.name}
                        className={`relative bg-white rounded-2xl border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-4 overflow-hidden transition-shadow ${
                          highlight ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200/80"
                        }`}
                      >
                        <span className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
                        <div className="flex items-center gap-2 mt-1 mb-3">
                          <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.soft, color: c.color }}><c.Icon className="h-4 w-4" /></span>
                          <span className="text-xs font-semibold" style={{ color: c.color }}>{c.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-center">
                          <div>
                            <p className="text-lg font-bold text-slate-800 tabular-nums leading-none">{count}</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">{c.unitLabel}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-800 tabular-nums leading-none">{mid}</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">{c.midLabel}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Panel title="Category-wise Waste Distribution" right={<span className="text-[10px] text-slate-400">Collected</span>}>
              <div className="relative w-full h-36">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={wasteData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={58} paddingAngle={2} cornerRadius={3} strokeWidth={0}>
                      {wasteData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<PieTip unit=" T" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{filtersActive ? fmt(wasteTotalView) : WASTE_TOTAL} T</span>
                  <span className="text-[9px] text-slate-400">Total Collected</span>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {wasteData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-600 flex-1 truncate">{d.name}</span>
                    <span className="text-slate-400 tabular-nums">{fmt(d.value)} T ({wasteTotalView ? ((d.value / wasteTotalView) * 100).toFixed(1) : "0.0"}%)</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="District-wise Collection vs Processing" right={<span className="text-[10px] text-slate-400">Tonnes</span>}>
              <ResponsiveContainer width="100%" height={252}>
                <BarChart data={barData} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                  <Tooltip content={<BarTip />} cursor={{ fill: "#f8fafc" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Bar dataKey="collected" name="Collected (T)" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="processed" name="Processed (T)" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Field Employees – Attendance">
              <div className="relative w-full h-36">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={attendData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={58} paddingAngle={2} cornerRadius={3} strokeWidth={0}>
                      {attendData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-emerald-600 tabular-nums">{avgAttView.toFixed(1)}%</span>
                  <span className="text-[9px] text-slate-400">Avg. Attendance</span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {attendData.map((a) => (
                  <div key={a.name} className="flex items-center gap-2 text-[11px]">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: a.color }} />
                    <span className="text-slate-600 flex-1">{a.name}</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{fmt(a.value)}</span>
                    <span className="text-slate-400 tabular-nums w-11 text-right">{attendTotalView ? ((a.value / attendTotalView) * 100).toFixed(1) : "0.0"}%</span>
                  </div>
                ))}
              </div>
            </Panel>
        </div>
        </>)}

        {/* ── Districts & Map tab ── */}
        {overviewTab === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Tamil Nadu map ── */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-4 flex flex-col">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Tamil Nadu Map</h3>
              <Info className="h-3.5 w-3.5 text-slate-300" />
            </div>
            <p className="text-[10px] text-slate-400 mb-2">District Performance — hover or tap a pin</p>

            {/* pin-status legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-[10px] text-slate-500">
              {[["Excellent ≥85%", "#10b981"], ["Good 75–85%", "#3b82f6"], ["Needs focus <75%", "#f59e0b"]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
              ))}
            </div>

            <div className="relative flex-1 min-h-[340px] flex items-center justify-center py-1">
              <svg viewBox={TN_VIEWBOX} className="h-full w-auto max-w-full max-h-[560px]" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHoveredId(null)}>
                <defs>
                  <style>{`
                    @keyframes tn-pulse { 0%,100% { transform: scale(1); opacity: .45 } 50% { transform: scale(1.9); opacity: .08 } }
                    @keyframes tn-ping  { 0% { transform: scale(1); opacity: .6 } 75%,100% { transform: scale(2.6); opacity: 0 } }
                    .tn-pulse { animation: tn-pulse 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
                    .tn-ping  { animation: tn-ping 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
                    .tn-district { transition: fill .15s ease, opacity .15s ease; }
                  `}</style>
                  <filter id="tn-pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.35" />
                  </filter>
                  <filter id="tn-map-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1e293b" floodOpacity="0.16" />
                  </filter>
                </defs>

                {/* district shapes — accurate geometry, tinted by performance */}
                <g filter="url(#tn-map-shadow)">
                  {tnDistricts.map((shape) => {
                    const dataId = MAP_ID_TO_DATA_ID[shape.id] ?? shape.id;
                    const data = districtById.get(dataId);
                    const on = currentId === dataId;
                    const dimmed = filtersActive
                      ? !filteredIds.has(dataId)
                      : Boolean(selectedId && selectedId !== dataId);
                    const fill = on
                      ? data
                        ? tierColor(data.perf)
                        : "#3b82f6"
                      : data
                        ? tierSoft(data.perf)
                        : "#eef2f7";
                    return (
                      <path
                        key={shape.id}
                        d={shape.d}
                        className="tn-district"
                        fill={fill}
                        stroke={on ? "#0f172a" : "#ffffff"}
                        strokeWidth={on ? 2.6 : 1.4}
                        strokeLinejoin="round"
                        opacity={dimmed ? 0.35 : 1}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredId(dataId)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => setSelectedId((p) => (p === dataId ? null : dataId))}
                      >
                        <title>{shape.name}{data ? ` — ${data.perf}%` : ""}</title>
                      </path>
                    );
                  })}
                </g>

                {/* animated location pins on districts shown in the table */}
                {markers.map((m) => {
                  const muted = filtersActive && !filteredIds.has(m.id);
                  const active = !muted && (currentId === m.id || (!currentId && m.index === highlightIdx));
                  const col = tierColor(m.perf);
                  return (
                    <g
                      key={`pin-${m.id}`}
                      style={{ cursor: "pointer" }}
                      opacity={muted ? 0.2 : 1}
                      onMouseEnter={() => setHoveredId(m.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setSelectedId((p) => (p === m.id ? null : m.id))}
                    >
                      {!muted && <circle cx={m.cx} cy={m.cy} r={13} fill={col} opacity={0.28} className="tn-pulse" style={{ animationDelay: `${m.index * 0.12}s` }} />}
                      {active && <circle cx={m.cx} cy={m.cy} r={13} fill="none" stroke={col} strokeWidth={2.4} className="tn-ping" />}
                      <g transform={`translate(${m.cx - (active ? 11 : 9)}, ${m.cy - (active ? 32 : 26)}) scale(${active ? 2.2 : 1.8})`} filter="url(#tn-pin-shadow)">
                        <path
                          d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5zm0 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                          fill={col}
                          stroke="white"
                          strokeWidth={0.8}
                          opacity={active ? 1 : 0.9}
                        />
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* detail card */}
            {currentDistrict ? (
              <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <span className="w-1 h-4 rounded-full bg-blue-500" /> {currentDistrict.name}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${currentDistrict.perf >= 85 ? "bg-emerald-100 text-emerald-700" : currentDistrict.perf >= 75 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {currentDistrict.perf}%
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {[
                    { l: "Collected", v: `${currentDistrict.collected} MT` },
                    { l: "Segregation", v: `${currentDistrict.segregationRate}%` },
                    { l: "Vehicles", v: `${currentDistrict.activeVehicles}/${currentDistrict.vehicles}` },
                    { l: "Local bodies", v: `${currentDistrict.localBodies}` },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-white border border-slate-100 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-400">{s.l}</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{s.v}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setLbDrawerId(currentDistrict.id)}
                  className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-xs font-semibold transition-colors"
                >
                  <Layers className="h-3.5 w-3.5" /> View Local Bodies
                  {localBodiesByDistrict[currentDistrict.id] && (
                    <span className="ml-1 rounded-full bg-white/15 px-1.5 text-[10px]">breakdown</span>
                  )}
                </button>
                {selectedId && (
                  <p className="mt-2 text-[10px] text-slate-400">Selection pinned · click again to clear</p>
                )}
              </div>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400"><MapPin className="h-3 w-3" /> Hover a pin to preview · click to pin · Districts with data coverage</p>
            )}
          </div>

          {/* ── District-wise Waste Management Overview ── */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">District-wise Waste Management Overview</h3>
            </div>
            <div className="overflow-auto max-h-[440px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-200">
                    {["District", "Corp.", "Muni.", "Town P.", "Union (Blocks)", "Village P.", "Wards", "Collected (T)", "Processed (T)", "Disposed (T)", "Field Emp.", "Attendance %", "Action"].map((h, i) => (
                      <th key={h} className={`sticky top-0 z-10 bg-slate-800 px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap ${i === 0 ? "text-left" : i === 12 ? "text-center" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-3 py-10 text-center text-slate-400">
                        <Filter className="mx-auto mb-2 h-6 w-6 opacity-40" />
                        No districts match the selected filters.
                      </td>
                    </tr>
                  )}
                  {filteredRows.map((r, i) => {
                    const on = selectedId === r.id;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-blue-50/40"
                        style={{ background: on ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa" }}
                        onClick={() => setSelectedId(on ? null : r.id)}
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.corp}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.muni}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.town}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.block}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{r.village}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.wards)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800 tabular-nums">{fmt(r.collected)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.processed)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.disposed)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{fmt(r.employees)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 tabular-nums">{r.attendance}%</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedId(on ? null : r.id); }}
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${on ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:bg-slate-100 hover:text-blue-600"}`}
                              title="Show on map"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setLbDrawerId(r.id); }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-violet-600 transition-colors"
                              title="View local bodies"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-blue-200 font-bold text-slate-700 [&>td]:sticky [&>td]:bottom-0 [&>td]:z-10 [&>td]:bg-blue-50">
                    <td className="px-3 py-3">{filtersActive ? "Filtered Total" : "Total"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.corp}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.muni}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.town}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.block}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.village}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.wards}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.collected}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.processed}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.disposed}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{footerTotals.employees}</td>
                    <td className="px-3 py-3 text-right text-emerald-600 tabular-nums">{footerTotals.attendance}%</td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed">
          State-level KPI, category, chart and table figures are illustrative sample data for design preview — they will switch to live data once a Tamil Nadu state-aggregation API is available. The district map geography is accurate and supports click selection (map ↔ table stay in sync).
        </p>
        </>)}
      </main>

      <DistrictLocalBodiesDrawer
        districtId={lbDrawerId}
        districtName={DISTRICTS.find((d) => d.id === lbDrawerId)?.name ?? null}
        waste={(() => {
          const row = TABLE_ROWS.find((r) => r.id === lbDrawerId);
          return row ? { collected: row.collected, processed: row.processed, disposed: row.disposed } : null;
        })()}
        onClose={() => setLbDrawerId(null)}
      />
    </div>
  );
}
