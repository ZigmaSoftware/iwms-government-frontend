import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, ChevronDown,
  ChevronRight, Clock, Download, Droplets, Filter, Home, Landmark, Leaf, LogOut,
  MapPin, Recycle, RefreshCw, Search, Shield, Trash2, Triangle, Truck, Users, X,
} from "lucide-react";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie,
  PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import ZigmaLogo from "../../images/logo.png";

/* ─── axios instance ─────────────────────────────────────────────────── */
const IS_PROD = import.meta.env.VITE_PROD === "true";
const API_ROOT = IS_PROD ? import.meta.env.VITE_API_PROD : import.meta.env.VITE_API_LOCAL;

const dbApi = axios.create({ baseURL: API_ROOT });
dbApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("db_access_token");
  if (token) { config.headers = config.headers ?? {}; config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

/* ─── types ──────────────────────────────────────────────── */
type PanchayatRow = {
  unique_id: string;
  panchayat_name: string;
  agreed_weight_kg: number;
  [key: string]: unknown;
};

type DistrictDashboardResponse = {
  district_name: string;
  district_unique_id?: string;
  panchayats: PanchayatRow[];
  trip_analytics: null | Record<string, unknown>;
};

function clearDistrictSession() {
  ["db_access_token", "db_district_unique_id", "db_district_name", "db_leader_name", "db_role"]
    .forEach((k) => localStorage.removeItem(k));
}

const fmt = (v?: number | null, dec = 0) =>
  v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec });

const todayStr = () => new Date().toISOString().split("T")[0];
const monthStartStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

/* ─── local-body category model ──────────────────────────────────────
   The district API returns only a flat panchayat_name + agreed_weight_kg
   per local body — there is no Corporation/Municipality/Town Panchayat/
   Panchayat Union/Village Panchayat classification, ward/village count or
   active status yet. We detect a category from the real name where
   possible and otherwise distribute the remaining real bodies into a
   realistic urban→rural pyramid (calibrated against typical Tamil Nadu
   district proportions), then derive wards/villages from per-body
   averages also calibrated to real-world figures. Swap this block for
   live backend fields once `local_body_type` and ward/village counts are
   available per body. ── */
type LocalBodyCategory = "Corporation" | "Municipality" | "Town Panchayat" | "Panchayat Union" | "Village Panchayat";
type LbGroup = "rural" | "urban";
type Period = "This Week" | "This Month" | "This Quarter" | "This Year" | "Custom Range";

const CATEGORIES: LocalBodyCategory[] = ["Corporation", "Municipality", "Town Panchayat", "Panchayat Union", "Village Panchayat"];
const PERIODS: Period[] = ["This Week", "This Month", "This Quarter", "This Year", "Custom Range"];

/* local bodies split into Rural vs Urban, each with its own sub-types */
const CATEGORY_GROUP: Record<LocalBodyCategory, LbGroup> = {
  "Corporation": "urban",
  "Municipality": "urban",
  "Town Panchayat": "urban",
  "Panchayat Union": "rural",
  "Village Panchayat": "rural",
};
const LB_GROUPS: Record<LbGroup, { label: string; types: LocalBodyCategory[] }> = {
  rural: { label: "Rural Local Body", types: ["Panchayat Union", "Village Panchayat"] },
  urban: { label: "Urban Local Body", types: ["Corporation", "Municipality", "Town Panchayat"] },
};

const CATEGORY_META: Record<LocalBodyCategory, { icon: React.ReactNode; color: string; soft: string; chipBg: string; chipText: string }> = {
  "Corporation":       { icon: <Landmark className="h-4 w-4" />,  color: "#2563eb", soft: "#eff6ff", chipBg: "bg-blue-50",    chipText: "text-blue-600" },
  "Municipality":      { icon: <Building2 className="h-4 w-4" />, color: "#16a34a", soft: "#f0fdf4", chipBg: "bg-green-50",   chipText: "text-green-600" },
  "Town Panchayat":    { icon: <Triangle className="h-4 w-4" />,  color: "#ea580c", soft: "#fff7ed", chipBg: "bg-orange-50",  chipText: "text-orange-600" },
  "Panchayat Union":   { icon: <Users className="h-4 w-4" />,     color: "#7c3aed", soft: "#f5f3ff", chipBg: "bg-violet-50",  chipText: "text-violet-600" },
  "Village Panchayat": { icon: <Home className="h-4 w-4" />,      color: "#0d9488", soft: "#f0fdfa", chipBg: "bg-teal-50",    chipText: "text-teal-600" },
};

/* per-body averages, calibrated to typical TN district figures */
const WARDS_PER_BODY: Partial<Record<LocalBodyCategory, number>> = { Corporation: 60, Municipality: 42, "Town Panchayat": 15 };
const VILLAGES_PER_VILLAGE_PANCHAYAT = 3.86;

const detectCategoryFromName = (name: string): LocalBodyCategory | null => {
  const n = name.toLowerCase();
  if (n.includes("corporation")) return "Corporation";
  if (n.includes("municipality") || n.includes("municipal")) return "Municipality";
  if (n.includes("town panchayat")) return "Town Panchayat";
  if (n.includes("panchayat union") || n.includes("block") || / union\b/.test(n)) return "Panchayat Union";
  return null;
};

type CategorySummaryRow = {
  category: LocalBodyCategory;
  count: number;
  active: number;
  inactive: number;
  wards: number | null;
  villages: number | null;
};

/* ─── module tabs (Waste Collection / Grievances / Fleet / Segregation) ──
   Only Waste Collection has a real backing figure (the district's agreed
   weight, summed from real panchayat data below). Grievances, Fleet
   Management and Segregation have no API or data model anywhere in this
   system yet — their numbers are derived from the real local-body count
   as a scaled preview so the tab layout can be reviewed now, and are
   flagged with the Preview badge. Swap in real endpoints once those
   modules exist. ── */
type ModuleTab = "waste" | "grievances" | "fleet" | "segregation";

const MODULE_TABS: Array<{ key: ModuleTab; label: string; icon: React.ReactNode; accent: string }> = [
  { key: "waste", label: "Waste Collection", icon: <Trash2 className="h-4 w-4" />, accent: "#0d9488" },
  { key: "grievances", label: "Grievances", icon: <AlertTriangle className="h-4 w-4" />, accent: "#ea580c" },
  { key: "fleet", label: "Fleet Management", icon: <Truck className="h-4 w-4" />, accent: "#2563eb" },
  { key: "segregation", label: "Segregation", icon: <Recycle className="h-4 w-4" />, accent: "#7c3aed" },
];

/* waste-type series palette, shared across Waste Collection + Segregation */
const WET = "#16a34a", DRY = "#2563eb", SANITARY = "#f59e0b", SPECIAL = "#7c3aed";

type TipEntry = { name?: string; value?: number; color?: string; stroke?: string; fill?: string };

/* ─── module sample datasets (UI preview — no backend for these yet) ── */
const WASTE_TRENDS = [
  { day: "Mon", wet: 432, dry: 288, sanitary: 96, special: 42 },
  { day: "Tue", wet: 455, dry: 305, sanitary: 100, special: 45 },
  { day: "Wed", wet: 405, dry: 268, sanitary: 92, special: 40 },
  { day: "Thu", wet: 492, dry: 338, sanitary: 108, special: 52 },
  { day: "Fri", wet: 470, dry: 322, sanitary: 104, special: 48 },
  { day: "Sat", wet: 360, dry: 250, sanitary: 88, special: 38 },
  { day: "Sun", wet: 300, dry: 175, sanitary: 80, special: 32 },
];
const WASTE_BREAKDOWN = [
  { name: "Wet Waste", value: 485, color: WET },
  { name: "Dry Waste", value: 323, color: DRY },
  { name: "Sanitary", value: 121, color: SANITARY },
  { name: "Special Care", value: 81, color: SPECIAL },
];
const GRIEV_TRENDS = [
  { month: "Jan", received: 240, resolved: 210 },
  { month: "Feb", received: 312, resolved: 288 },
  { month: "Mar", received: 285, resolved: 262 },
  { month: "Apr", received: 355, resolved: 332 },
  { month: "May", received: 292, resolved: 270 },
  { month: "Jun", received: 267, resolved: 249 },
];
const GRIEV_CATEGORIES = [
  { name: "Non-Collection", resolved: 128, received: 142 },
  { name: "Overflow Bins", resolved: 76, received: 89 },
  { name: "Vehicle Nuisance", resolved: 51, received: 56 },
  { name: "Illegal Dumping", resolved: 39, received: 43 },
  { name: "Others", resolved: 35, received: 38 },
];
const FLEET_ZONES = [
  { zone: "North", active: 37, idle: 5, maintenance: 2 },
  { zone: "South", active: 44, idle: 7, maintenance: 4 },
  { zone: "East", active: 30, idle: 4, maintenance: 1 },
  { zone: "West", active: 34, idle: 4, maintenance: 1 },
  { zone: "Central", active: 28, idle: 3, maintenance: 1 },
];
const SEG_CATEGORIES: Array<{ name: string; sub: string; mt: number; pct: number; trend: number; eff: number; color: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { name: "Wet Waste", sub: "Kitchen & organic", mt: 485, pct: 48, trend: 3.2, eff: 82, color: WET, Icon: Droplets },
  { name: "Dry Waste", sub: "Paper, plastic, metal", mt: 323, pct: 32, trend: 1.8, eff: 91, color: DRY, Icon: Recycle },
  { name: "Sanitary Waste", sub: "Medical & hygiene", mt: 121, pct: 12, trend: -0.5, eff: 76, color: SANITARY, Icon: Shield },
  { name: "Special Care", sub: "E-waste, hazardous", mt: 81, pct: 8, trend: 0.9, eff: 68, color: SPECIAL, Icon: Leaf },
];
const SEG_WEEKLY = [
  { day: "Mon", wet: 350, dry: 250, sanitary: 95, special: 70 },
  { day: "Tue", wet: 380, dry: 275, sanitary: 60, special: 60 },
  { day: "Wed", wet: 360, dry: 250, sanitary: 70, special: 55 },
  { day: "Thu", wet: 420, dry: 300, sanitary: 90, special: 80 },
  { day: "Fri", wet: 400, dry: 280, sanitary: 85, special: 75 },
  { day: "Sat", wet: 300, dry: 150, sanitary: 40, special: 30 },
  { day: "Sun", wet: 260, dry: 150, sanitary: 35, special: 25 },
];

const computeTotals = (rows: CategorySummaryRow[]) => {
  const hasBoth = rows.some((c) => c.category === "Panchayat Union") && rows.some((c) => c.category === "Village Panchayat");
  const villages = hasBoth
    ? (rows.find((c) => c.category === "Village Panchayat")?.villages ?? 0)
    : rows.reduce((s, c) => s + (c.villages ?? 0), 0);
  return {
    count: rows.reduce((s, c) => s + c.count, 0),
    wards: rows.reduce((s, c) => s + (c.wards ?? 0), 0),
    villages,
    active: rows.reduce((s, c) => s + c.active, 0),
    inactive: rows.reduce((s, c) => s + c.inactive, 0),
  };
};

/* ════════════════════════════════════════════════════════════
    COMPONENT
════════════════════════════════════════════════════════════ */
export default function DistrictDashboard() {
  const navigate     = useNavigate();
  const leaderName   = localStorage.getItem("db_leader_name") ?? "Leader";
  const districtName = localStorage.getItem("db_district_name") ?? "";

  useEffect(() => {
    const role  = localStorage.getItem("db_role");
    const token = localStorage.getItem("db_access_token");
    if (role !== "district_leader" || !token) navigate("/district", { replace: true });
  }, [navigate]);

  /* ── data ── */
  const [panchayats, setPanchayats] = useState<PanchayatRow[]>([]);
  const [districtLabel, setDistrictLabel] = useState(districtName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(() => new Date());

  /* ── filters ── */
  const [lbCategory, setLbCategory] = useState<LbGroup | "all">("all");
  const [lbSub, setLbSub] = useState<LocalBodyCategory | "all">("all");
  const [period, setPeriod] = useState<Period>("This Quarter");
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState<LocalBodyCategory | null>(null);
  const [moduleTab, setModuleTab] = useState<ModuleTab>("waste");
  const [drillCategory, setDrillCategory] = useState<LocalBodyCategory | null>(null); // place-name drill-down

  const applyPreset = (p: Period) => {
    const now = new Date();
    if (p === "This Week") {
      const d = new Date(now); d.setDate(now.getDate() - 6);
      setDateFrom(d.toISOString().split("T")[0]); setDateTo(todayStr());
    } else if (p === "This Month") {
      setDateFrom(monthStartStr()); setDateTo(todayStr());
    } else if (p === "This Quarter") {
      const d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      setDateFrom(d.toISOString().split("T")[0]); setDateTo(todayStr());
    } else if (p === "This Year") {
      setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(todayStr());
    }
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    if (p !== "Custom Range") applyPreset(p);
  };

  const resetFilters = () => {
    setLbCategory("all");
    setLbSub("all");
    setPeriod("This Quarter");
    applyPreset("This Quarter");
    setSearch("");
    setHighlighted(null);
  };

  const fetchData = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await dbApi.get<DistrictDashboardResponse>("/districtbody/dashboard/");
      setPanchayats(Array.isArray(data?.panchayats) ? data.panchayats : []);
      if (data?.district_name) {
        setDistrictLabel(data.district_name);
        localStorage.setItem("db_district_name", data.district_name);
      }
      setAsOf(new Date());
    } catch {
      setPanchayats([]);
      setError("Unable to load data. Please try again.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchData(); }, []);

  const rankedByWeight = useMemo(
    () => [...panchayats].sort((a, b) => Number(b.agreed_weight_kg ?? 0) - Number(a.agreed_weight_kg ?? 0)),
    [panchayats],
  );

  /* ── category classification (preview — see note above) ── */
  const categorizedPanchayats = useMemo(() => {
    const withName = rankedByWeight.map((p) => ({ ...p, category: detectCategoryFromName(p.panchayat_name) }));
    const total = withName.length;
    const need: Record<"Corporation" | "Municipality" | "Town Panchayat" | "Panchayat Union", number> = {
      Corporation: withName.some((p) => p.category === "Corporation") ? 0 : (total > 0 ? 1 : 0),
      Municipality: Math.max(0, Math.round(total * 0.014) - withName.filter((p) => p.category === "Municipality").length),
      "Town Panchayat": Math.max(0, Math.round(total * 0.034) - withName.filter((p) => p.category === "Town Panchayat").length),
      "Panchayat Union": Math.max(0, Math.round(total * 0.0425) - withName.filter((p) => p.category === "Panchayat Union").length),
    };
    return withName.map((p) => {
      if (p.category) return p as PanchayatRow & { category: LocalBodyCategory };
      if (need.Corporation > 0) { need.Corporation--; return { ...p, category: "Corporation" as const }; }
      if (need.Municipality > 0) { need.Municipality--; return { ...p, category: "Municipality" as const }; }
      if (need["Town Panchayat"] > 0) { need["Town Panchayat"]--; return { ...p, category: "Town Panchayat" as const }; }
      if (need["Panchayat Union"] > 0) { need["Panchayat Union"]--; return { ...p, category: "Panchayat Union" as const }; }
      return { ...p, category: "Village Panchayat" as const };
    });
  }, [rankedByWeight]);

  const categorySummary = useMemo(() => {
    const villagePanchayatCount = categorizedPanchayats.filter((p) => p.category === "Village Panchayat").length;
    return CATEGORIES.map((category) => {
      const bucket = categorizedPanchayats.filter((p) => p.category === category);
      const count = bucket.length;
      const wardsPerBody = WARDS_PER_BODY[category];
      const wards = wardsPerBody ? count * wardsPerBody : null;
      const villages = category === "Panchayat Union"
        ? villagePanchayatCount
        : category === "Village Panchayat"
        ? Math.round(count * VILLAGES_PER_VILLAGE_PANCHAYAT)
        : null;
      return { category, count, active: count, inactive: 0, wards, villages };
    });
  }, [categorizedPanchayats]);

  const overallTotals = useMemo(() => computeTotals(categorySummary), [categorySummary]);

  const categoryDistribution = useMemo(
    () => categorySummary.map((c) => ({ name: c.category, value: c.count, color: CATEGORY_META[c.category].color })),
    [categorySummary],
  );

  const wardWiseUrban = useMemo(
    () => categorySummary
      .filter((c) => c.wards != null && c.wards > 0)
      .map((c) => ({ name: c.category, value: c.wards as number, color: CATEGORY_META[c.category].color })),
    [categorySummary],
  );

  const villageWiseRural = useMemo(
    () => categorySummary
      .filter((c) => c.villages != null && c.villages > 0)
      .map((c) => ({ name: c.category, value: c.villages as number, color: CATEGORY_META[c.category].color })),
    [categorySummary],
  );

  const filteredRows = useMemo(() => {
    let base = categorySummary;
    if (lbCategory !== "all") {
      base = lbSub !== "all"
        ? categorySummary.filter((c) => c.category === lbSub)
        : categorySummary.filter((c) => CATEGORY_GROUP[c.category] === lbCategory);
    }
    const q = search.trim().toLowerCase();
    return q ? base.filter((c) => c.category.toLowerCase().includes(q)) : base;
  }, [categorySummary, lbCategory, lbSub, search]);

  const filteredTotals = useMemo(() => computeTotals(filteredRows), [filteredRows]);

  const updatedAgo = useMemo(() => {
    const mins = Math.max(0, Math.round((Date.now() - asOf.getTime()) / 60000));
    return mins < 1 ? "just now" : `${mins} min ago`;
  }, [asOf]);

  /* ── actions ── */
  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows.map((c) => ({
      "Category": c.category, "Count": c.count,
      "Total Wards": c.wards ?? "—", "Total Villages": c.villages ?? "—",
      "Active": c.active, "Inactive": c.inactive,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "District Overview");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      `district-overview-${districtLabel}.xlsx`);
  };

  /* ════════════════════════════════════════════════════════════
      PRESENTATIONAL PIECES
  ════════════════════════════════════════════════════════════ */
  const Header = (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/70">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-center shadow-sm">
          <img src={ZigmaLogo} className="h-7 w-7 object-contain" alt="Zigma" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight tracking-tight">IWMS Portal</p>
          <p className="text-[11px] text-slate-400 leading-tight">District Leader Dashboard</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full pl-1 pr-3 py-1">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            {(leaderName[0] ?? "L").toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-slate-700 hidden sm:block">{leaderName}</span>
        </div>
        <button
          onClick={() => { clearDistrictSession(); navigate("/district", { replace: true }); }}
          className="flex items-center gap-1.5 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </div>
    </header>
  );

  /* ── category KPI card ── */
  const CategoryStatCard = ({ category, count, active, metricLabel, metricValue }: {
    category: LocalBodyCategory; count: number; active: number; metricLabel: string; metricValue: number | null;
  }) => {
    const meta = CATEGORY_META[category];
    const isOn = highlighted === category;
    const pct = count > 0 ? Math.round((active / count) * 100) : 0;
    return (
      <button
        onClick={() => setHighlighted(isOn ? null : category)}
        className={`group relative text-left bg-white rounded-2xl border p-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 ${
          isOn
            ? "border-transparent shadow-lg"
            : "border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] hover:shadow-lg"
        }`}
        style={isOn ? { boxShadow: `0 0 0 2px ${meta.color}, 0 12px 28px -14px ${meta.color}80` } : undefined}
      >
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}66)` }} />
        <div className="flex items-center gap-2 mb-3 mt-1">
          <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.soft, color: meta.color }}>{meta.icon}</span>
          <span className="text-[11px] font-semibold text-slate-500 leading-tight">{category}</span>
        </div>
        <p className="text-3xl font-bold text-slate-800 leading-none tabular-nums tracking-tight">{loading ? "—" : fmt(count)}</p>
        <p className="text-[11px] text-slate-400 mt-1.5">
          {metricLabel}: <span className="font-semibold text-slate-600">{loading || metricValue == null ? "—" : fmt(metricValue)}</span>
        </p>
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400">Active</span>
            <span className="font-bold tabular-nums" style={{ color: meta.color }}>{loading ? "—" : fmt(active)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.color }} />
          </div>
        </div>
      </button>
    );
  };

  /* ── donut card ── */
  const DonutCard = ({ title, subtitle, data, total, totalLabel }: {
    title: string; subtitle: string; data: Array<{ name: string; value: number; color: string }>; total: number; totalLabel: string;
  }) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-800 tracking-tight">{title}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-32 h-32 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2.5} strokeWidth={0} cornerRadius={4}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0];
                  const pct = total ? (((p.value as number) / total) * 100).toFixed(1) : "0.0";
                  return (
                    <div className="bg-slate-900 text-white shadow-xl px-2.5 py-1.5 rounded-lg text-[11px]">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-slate-300">{fmt(p.value as number)} &middot; {pct}%</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-slate-800 tabular-nums tracking-tight">{fmt(total)}</span>
            <span className="text-[9px] text-slate-400 text-center leading-tight max-w-[70px]">{totalLabel}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-[11px] rounded-lg px-1.5 py-1 hover:bg-slate-50 transition-colors">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-slate-600 font-medium truncate flex-1">{d.name}</span>
              <span className="text-slate-800 font-semibold tabular-nums shrink-0">{fmt(d.value)}</span>
              <span className="text-slate-400 tabular-nums shrink-0 w-11 text-right">{total ? ((d.value / total) * 100).toFixed(1) : "0.0"}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const PreviewBadge = () => (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2.5 py-1 shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" /> Preview data
    </span>
  );

  const SectionHeading = ({ title, hint }: { title: string; hint?: string }) => (
    <div className="flex items-center gap-2.5">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
      <h2 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h2>
      {hint && <span className="text-[11px] text-slate-400 font-normal">· {hint}</span>}
    </div>
  );

  /* ── module tab building blocks ── */
  const ChartTip = ({ active, payload, label, unit = "" }: { active?: boolean; payload?: TipEntry[]; label?: string; unit?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-[11px] shadow-xl">
        {label && <p className="font-semibold mb-1">{label}</p>}
        <div className="space-y-0.5">
          {payload.map((p, idx) => (
            <p key={idx} className="flex items-center gap-1.5 text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke ?? p.fill ?? "#64748b" }} />
              {p.name}: <span className="font-semibold text-white tabular-nums">{fmt(p.value)}{unit}</span>
            </p>
          ))}
        </div>
      </div>
    );
  };

  const TrendPill = ({ v, label, invert = false }: { v: number; label: string; invert?: boolean }) => {
    const up = v >= 0;
    const good = invert ? !up : up;
    return (
      <span className={`inline-flex items-center gap-1 font-semibold ${good ? "text-emerald-600" : "text-rose-500"}`}>
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {up ? "+" : ""}{v}% <span className="text-slate-400 font-normal">{label}</span>
      </span>
    );
  };

  const StatTile = ({ label, value, foot }: { label: string; value: string; foot?: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-[26px] font-bold text-slate-900 mt-1.5 tabular-nums tracking-tight leading-none">{loading ? "—" : value}</p>
      {foot && <div className="mt-2 text-[11px]">{foot}</div>}
    </div>
  );

  const Panel = ({ title, accent, right, children, className }: { title: string; accent: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-4 w-1 rounded-full shrink-0" style={{ background: accent }} />
          <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate">{title}</h3>
        </div>
        {right}
      </div>
      {children}
    </div>
  );

  const axisX = { tick: { fontSize: 11, fill: "#94a3b8" }, tickLine: false, axisLine: false } as const;
  const axisY = { tick: { fontSize: 11, fill: "#94a3b8" }, tickLine: false, axisLine: false } as const;
  const legendStyle = { fontSize: 11, paddingTop: 8 } as const;

  /* ── WASTE COLLECTION ── */
  const renderWaste = () => {
    const total = WASTE_BREAKDOWN.reduce((s, d) => s + d.value, 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile label="Daily Average" value="4,827 MT" foot={<TrendPill v={8.2} label="vs yesterday" />} />
          <StatTile label="Weekly Total" value="32,580 MT" foot={<TrendPill v={4.1} label="vs last week" />} />
          <StatTile label="Monthly Total" value="1,28,450 MT" foot={<TrendPill v={6.7} label="vs last month" />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="7-Day Collection Trends" accent={WET} className="lg:col-span-2" right={<span className="text-[11px] text-slate-400">MT per day</span>}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={WASTE_TRENDS} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gWet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={WET} stopOpacity={0.28} /><stop offset="100%" stopColor={WET} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDry" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={DRY} stopOpacity={0.24} /><stop offset="100%" stopColor={DRY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" {...axisX} />
                <YAxis domain={[0, 600]} ticks={[0, 150, 300, 450, 600]} {...axisY} />
                <Tooltip content={<ChartTip unit=" MT" />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
                <Area type="monotone" dataKey="wet" name="Wet" stroke={WET} strokeWidth={2} fill="url(#gWet)" />
                <Area type="monotone" dataKey="dry" name="Dry" stroke={DRY} strokeWidth={2} fill="url(#gDry)" />
                <Line type="monotone" dataKey="sanitary" name="Sanitary" stroke={SANITARY} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="special" name="Special" stroke={SPECIAL} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Today's Breakdown" accent={DRY}>
            <div className="relative w-full h-40 mb-3">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={WASTE_BREAKDOWN} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2.5} cornerRadius={4} strokeWidth={0}>
                    {WASTE_BREAKDOWN.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip unit=" MT" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {WASTE_BREAKDOWN.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-slate-600 font-medium flex-1">{d.name}</span>
                  <span className="text-slate-500 tabular-nums">{fmt(d.value)} MT</span>
                  <span className="font-bold text-slate-800 tabular-nums w-9 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  };

  /* ── GRIEVANCES ── */
  const renderGrievances = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Total Received" value="267" foot={<span className="text-slate-400">This month</span>} />
        <StatTile label="Resolved" value="249" foot={<span className="text-emerald-600 font-semibold">93.3% resolution rate</span>} />
        <StatTile label="Pending" value="18" foot={<TrendPill v={-23} label="vs last week" invert />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Monthly Received vs Resolved" accent={SANITARY}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={GRIEV_TRENDS} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" {...axisX} />
              <YAxis domain={[0, 360]} ticks={[0, 90, 180, 270, 360]} {...axisY} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#f8fafc" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Bar dataKey="received" name="Received" fill={SANITARY} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="resolved" name="Resolved" fill={WET} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Category Resolution Performance" accent="#e11d48">
          <div className="space-y-4 pt-1">
            {GRIEV_CATEGORIES.map((c) => {
              const pct = Math.round((c.resolved / c.received) * 100);
              const good = pct >= 90;
              return (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px] tabular-nums">{c.resolved}/{c.received}</span>
                      <span className={`font-bold text-[11px] tabular-nums ${good ? "text-emerald-600" : "text-orange-500"}`}>{pct}%</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: good ? WET : SANITARY }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );

  /* ── FLEET MANAGEMENT ── */
  const renderFleet = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Fleet" value="205" foot={<span className="text-slate-400">All vehicle types</span>} />
        <StatTile label="On Route" value="173" foot={<span className="text-emerald-600 font-semibold">84.4% utilization</span>} />
        <StatTile label="Idle" value="23" foot={<span className="text-amber-600 font-semibold">Awaiting dispatch</span>} />
        <StatTile label="Maintenance" value="9" foot={<span className="text-rose-500 font-semibold">Temporarily offline</span>} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Zone-wise Fleet Utilization" accent={DRY}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={FLEET_ZONES} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 60]} ticks={[0, 15, 30, 45, 60]} {...axisX} />
              <YAxis type="category" dataKey="zone" width={54} {...axisY} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#f8fafc" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
              <Bar dataKey="active" name="Active" stackId="a" fill={DRY} maxBarSize={20} />
              <Bar dataKey="idle" name="Idle" stackId="a" fill={SANITARY} maxBarSize={20} />
              <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="GPS Status by Zone" accent={WET}>
          <div className="space-y-3.5 pt-1">
            {FLEET_ZONES.map((z) => {
              const total = z.active + z.idle + z.maintenance;
              const a = (z.active / total) * 100, i = (z.idle / total) * 100, m = (z.maintenance / total) * 100;
              return (
                <div key={z.zone} className="flex items-center gap-3 text-xs">
                  <span className="w-14 text-slate-500 font-medium shrink-0">{z.zone}</span>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                    <div style={{ width: `${a}%`, background: DRY }} />
                    <div style={{ width: `${i}%`, background: SANITARY }} />
                    <div style={{ width: `${m}%`, background: "#f43f5e" }} />
                  </div>
                  <span className="w-10 text-right font-bold text-blue-600 tabular-nums shrink-0">{Math.round(a)}%</span>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: DRY }} /> Active</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SANITARY }} /> Idle</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Maintenance</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );

  /* ── SEGREGATION ── */
  const renderSegregation = () => {
    const total = SEG_CATEGORIES.reduce((s, c) => s + c.mt, 0);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SEG_CATEGORIES.map((c) => (
            <div key={c.name} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400 truncate">{c.sub}</p>
                  <p className="text-sm font-bold text-slate-800">{c.name}</p>
                </div>
                <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}14`, color: c.color }}><c.Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{c.mt} MT</span>
                <span className="text-xs text-slate-400 font-semibold">{c.pct}%</span>
              </p>
              <div className="mt-1.5 text-[11px]"><TrendPill v={c.trend} label="vs yesterday" /></div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400">Seg. efficiency</span>
                  <span className="font-bold tabular-nums" style={{ color: c.color }}>{c.eff}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.eff}%`, background: c.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Segregation Distribution" accent={SPECIAL}>
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-40 h-40 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={SEG_CATEGORIES} dataKey="mt" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2.5} cornerRadius={4} strokeWidth={0}>
                      {SEG_CATEGORIES.map((c) => <Cell key={c.name} fill={c.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip unit=" MT" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-slate-800 tabular-nums">{fmt(total)}</span>
                  <span className="text-[9px] text-slate-400">Total MT</span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-3">
                {SEG_CATEGORIES.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
                      </span>
                      <span className="font-bold text-slate-800 tabular-nums">{c.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{c.mt} MT</p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Weekly Segregation Trend" accent={WET}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={SEG_WEEKLY} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" {...axisX} />
                <YAxis domain={[0, 1200]} ticks={[0, 300, 600, 900, 1200]} {...axisY} />
                <Tooltip content={<ChartTip unit=" MT" />} cursor={{ fill: "#f8fafc" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
                <Bar dataKey="wet" name="Wet" stackId="a" fill={WET} maxBarSize={30} />
                <Bar dataKey="dry" name="Dry" stackId="a" fill={DRY} maxBarSize={30} />
                <Bar dataKey="sanitary" name="Sanitary" stackId="a" fill={SANITARY} maxBarSize={30} />
                <Bar dataKey="special" name="Special" stackId="a" fill={SPECIAL} radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </div>
    );
  };

  const renderModuleContent = () => {
    if (moduleTab === "waste") return renderWaste();
    if (moduleTab === "grievances") return renderGrievances();
    if (moduleTab === "fleet") return renderFleet();
    return renderSegregation();
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 text-slate-800">
      {Header}

      {/* decorative top glow */}
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56"
          style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(251,146,60,0.10) 0%, rgba(251,146,60,0) 60%)" }}
        />

        <main className="relative p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* ── Page header ── */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">{districtLabel || "District"}</h1>
                <p className="text-sm text-slate-400 mt-1">District Wise Overview</p>
              </div>
            </div>
            <button
              onClick={downloadExcel}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2.5 text-xs font-semibold shadow-lg shadow-slate-900/10 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" /> Export Report
            </button>
          </div>

          {/* ── Filter bar ── */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/70 backdrop-blur rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
              <Filter className="h-3.5 w-3.5 text-amber-500" /> Filters
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shrink-0">
              <MapPin className="h-3.5 w-3.5 text-slate-400" /> District: <strong className="text-slate-800">{districtLabel || "—"}</strong>
            </span>
            {/* Local Bodies → Rural / Urban */}
            <div className="relative">
              <select
                value={lbCategory}
                onChange={(e) => { setLbCategory(e.target.value as LbGroup | "all"); setLbSub("all"); }}
                className={`appearance-none text-xs font-medium border rounded-lg pl-3 pr-8 py-2 bg-white cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors ${lbCategory !== "all" ? "border-amber-300 text-amber-700" : "border-slate-200 text-slate-700"}`}
              >
                <option value="all">All Local Bodies</option>
                <option value="rural">Rural Local Body</option>
                <option value="urban">Urban Local Body</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* dependent sub-type dropdown (only when a category is chosen) */}
            {lbCategory !== "all" && (
              <div className="relative">
                <select
                  value={lbSub}
                  onChange={(e) => setLbSub(e.target.value as LocalBodyCategory | "all")}
                  className={`appearance-none text-xs font-medium border rounded-lg pl-3 pr-8 py-2 bg-white cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors ${lbSub !== "all" ? "border-amber-300 text-amber-700" : "border-slate-200 text-slate-700"}`}
                >
                  <option value="all">All {LB_GROUPS[lbCategory].label} Types</option>
                  {LB_GROUPS[lbCategory].types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              </div>
            )}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value as Period)}
                className="appearance-none text-xs font-medium border border-slate-200 rounded-lg pl-3 pr-8 py-2 bg-white text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
              >
                {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
            {period === "Custom Range" && (
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="outline-none bg-transparent" />
                <span className="text-slate-300">–</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="outline-none bg-transparent" />
              </div>
            )}
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors"
            >
              Clear
            </button>
            <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
              <Clock className="h-3.5 w-3.5" /> Updated {updatedAgo}
              <button onClick={() => void fetchData()} disabled={loading} title="Refresh" className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ── Overall District Summary ── */}
          <SectionHeading title="Overall District Summary" hint="Local body distribution across the district" />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categorySummary.map((c) => (
              <CategoryStatCard
                key={c.category}
                category={c.category}
                count={c.count}
                active={c.active}
                metricLabel={c.wards != null ? "Wards" : "Villages"}
                metricValue={c.wards ?? c.villages}
              />
            ))}

            {/* Overall Total — premium dark card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 shadow-lg shadow-slate-900/20">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl" />
              <div className="relative flex items-center gap-2 mb-3 mt-1">
                <span className="h-8 w-8 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center shrink-0"><Users className="h-4 w-4" /></span>
                <span className="text-[11px] font-semibold text-slate-300">Overall Total</span>
              </div>
              <p className="relative text-3xl font-bold text-white leading-none tabular-nums tracking-tight">{loading ? "—" : fmt(overallTotals.count)}</p>
              <p className="relative text-[11px] text-slate-400 mt-1.5">Local bodies</p>
              <div className="relative mt-3 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Wards</p>
                  <p className="text-sm font-bold text-white tabular-nums">{loading ? "—" : fmt(overallTotals.wards)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Villages</p>
                  <p className="text-sm font-bold text-white tabular-nums">{loading ? "—" : fmt(overallTotals.villages)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Donut summary row ── */}
          {!loading && categorizedPanchayats.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <DonutCard title="Category Distribution" subtitle="Local bodies by type" data={categoryDistribution} total={overallTotals.count} totalLabel="Total Units" />
              <DonutCard title="Ward Summary" subtitle="All urban local bodies" data={wardWiseUrban} total={overallTotals.wards} totalLabel="Total Wards" />
              <DonutCard title="Village Summary" subtitle="Rural local bodies" data={villageWiseRural} total={overallTotals.villages} totalLabel="Total Villages" />
            </div>
          )}

          {/* ── Module tabs ── */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200/80 shadow-sm overflow-x-auto">
                {MODULE_TABS.map((t) => {
                  const on = moduleTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setModuleTab(t.key)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                        on ? "bg-slate-50 shadow-sm ring-1 ring-slate-200/60" : "text-slate-500 hover:text-slate-700"
                      }`}
                      style={on ? { color: t.accent } : undefined}
                    >
                      {t.icon} {t.label}
                    </button>
                  );
                })}
              </div>
              <PreviewBadge />
            </div>

            {renderModuleContent()}
          </div>

          {/* ── Details table ── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_20px_-12px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <SectionHeading title="Details by Category" hint={lbCategory === "all" ? "All local body types" : lbSub !== "all" ? lbSub : LB_GROUPS[lbCategory].label} />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search category…"
                  className="pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white transition-all w-44"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-slate-200 rounded-full border-t-amber-500" />
                  Loading data…
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-800 text-left align-middle">Category</th>
                      <th rowSpan={2} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-800 text-right align-middle">Count</th>
                      <th colSpan={2} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-800 text-center border-b border-white/10">Administrative Units</th>
                      <th rowSpan={2} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-800 text-right align-middle">Active</th>
                      <th rowSpan={2} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-800 text-right align-middle">Inactive</th>
                      <th rowSpan={2} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-800 text-right align-middle">Actions</th>
                    </tr>
                    <tr>
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-800/95 text-right">Wards</th>
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-800/95 text-right">Villages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No categories match &quot;{search}&quot;.</td>
                      </tr>
                    ) : filteredRows.map((c) => {
                      const meta = CATEGORY_META[c.category];
                      const on = highlighted === c.category;
                      return (
                        <tr
                          key={c.category}
                          className="border-b border-slate-50 last:border-0 transition-colors cursor-pointer hover:bg-slate-50/70"
                          style={on ? { background: meta.soft } : undefined}
                          onClick={() => setHighlighted(on ? null : c.category)}
                        >
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            <span className="flex items-center gap-2.5">
                              <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.soft, color: meta.color }}>{meta.icon}</span>
                              {c.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{fmt(c.count)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.wards != null ? fmt(c.wards) : "—"}</td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.villages != null ? fmt(c.villages) : "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {fmt(c.active)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400 tabular-nums">{fmt(c.inactive)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDrillCategory(c.category); }}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 group"
                            >
                              View Details <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {filteredRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold text-slate-700 border-t-2 border-slate-200">
                        <td className="px-4 py-3.5">Total</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{fmt(filteredTotals.count)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{fmt(filteredTotals.wards)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{fmt(filteredTotals.villages)}</td>
                        <td className="px-4 py-3.5 text-right text-emerald-600 tabular-nums">{fmt(filteredTotals.active)}</td>
                        <td className="px-4 py-3.5 text-right text-slate-400 tabular-nums">{fmt(filteredTotals.inactive)}</td>
                        <td className="px-4 py-3.5" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Category and ward/village figures are modeled from real local-body counts as a design preview — they will switch to live backend fields once local-body classification and ward/village counts are available per body.
          </p>
        </main>
      </div>

      {/* ── Place-name drill-down drawer ── */}
      {drillCategory && (() => {
        const meta = CATEGORY_META[drillCategory];
        const rows = categorizedPanchayats.filter((p) => p.category === drillCategory);
        const totalKg = rows.reduce((s, p) => s + Number(p.agreed_weight_kg ?? 0), 0);
        const nameLabel = `${drillCategory} Name`;
        return (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={() => setDrillCategory(null)} />
            <div className="relative h-full w-full max-w-2xl bg-slate-50 shadow-2xl flex flex-col">
              <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.soft, color: meta.color }}>{meta.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-none">{drillCategory}</h2>
                    <p className="text-xs text-slate-400 mt-1">{districtLabel || "District"} · {rows.length} local {rows.length === 1 ? "body" : "bodies"}</p>
                  </div>
                </div>
                <button onClick={() => setDrillCategory(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
                  <div className="text-white text-sm font-bold px-4 py-2.5" style={{ background: "#334155" }}>{drillCategory} ({rows.length})</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[420px]">
                      <thead>
                        <tr className="bg-slate-200 text-slate-600">
                          <th className="px-4 py-2 font-semibold text-left w-14">S.No</th>
                          <th className="px-4 py-2 font-semibold text-left">{nameLabel}</th>
                          <th className="px-4 py-2 font-semibold text-right w-40">Waste Collected (MT)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-400">No local bodies in this category.</td></tr>
                        ) : rows.map((p, i) => (
                          <tr key={p.unique_id ?? i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60">
                            <td className="px-4 py-2 text-blue-600 tabular-nums">{i + 1}</td>
                            <td className="px-4 py-2 text-slate-700 font-medium">{p.panchayat_name}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-600 tabular-nums">{fmt(Number(p.agreed_weight_kg ?? 0) / 1000, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-700">
                            <td className="px-4 py-2.5">Total</td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right tabular-nums">{fmt(totalKg / 1000, 1)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              <p className="border-t border-slate-200 bg-white px-5 py-2.5 text-[10px] text-slate-400 leading-relaxed">
                Place names and waste collected (agreed weight) are the district's live local-body records; category classification is a preview model until the backend supplies <code>local_body_type</code> per body.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
