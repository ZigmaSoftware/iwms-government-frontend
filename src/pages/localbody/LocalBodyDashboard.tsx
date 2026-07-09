import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Activity, ArrowLeft, BarChart3, Calendar, ClipboardList,
  Download, FileBarChart2, LogOut, MapPin, Printer, Scale, TrendingUp,
} from "lucide-react";
import ZigmaLogo from "../../images/logo.png";
import { API_ROOT } from "../../config/configApi";

const lbApi = axios.create({ baseURL: API_ROOT });
lbApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("lb_access_token");
  if (token) { config.headers = config.headers ?? {}; config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

/* ─── types ──────────────────────────────────────────────── */
type MonthlyRow = {
  unique_id: string; month: string; waste_type: string;
  total_agreed_weight: number; total_actual_weight: number;
  variance_kg: number; variance_percent: number; report_status: string;
  total_trips: number; collection_points_covered: number;
  collection_efficiency_percent: number; coverage_efficiency_percent?: number;
  average_weight_per_trip: number;
};
type DailyComparisonRow = {
  unique_id: string; date: string; waste_type: string;
  agreed_weight_kg: number; actual_weight_kg: number;
  variance_kg: number; variance_percent: number; report_status: string;
  total_trips: number; collection_points_covered: number;
};
type DayWiseBreakdown = {
  date: string; waste_type: string; actual_weight_kg: number;
  agreed_weight_kg: number; trip_count: number; points_covered: number;
};
type Kpis = {
  total_agreed_weight: number; total_actual_weight: number; variance_kg: number;
  collection_efficiency_percent: number; average_weight_per_trip: number;
  coverage_efficiency_percent: number; total_trips: number;
  collection_points_covered: number; report_status: string;
};
type DailyKpis = {
  total_actual_kg: number; total_agreed_kg: number; variance_kg: number;
  collection_efficiency_percent: number; total_trips: number;
  collection_points_covered: number;
};
type ApiResponse = {
  panchayat_name: string; results: MonthlyRow[];
  monthly_trends: Array<Record<string, number | string>>;
  waste_type_breakdown: Array<Record<string, number | string>>;
  kpis: Kpis;
  day_wise_collection: Array<{ date: string; collected_weight_kg: number; trip_count: number }>;
  trip_waste_types: Array<{ waste_type: string; collected_weight_kg: number; trip_count: number }>;
  day_wise_breakdown: DayWiseBreakdown[];
  daily_rows: DailyComparisonRow[];
  daily_kpis: DailyKpis;
};

const ZERO_DAILY_KPIS: DailyKpis = {
  total_actual_kg: 0, total_agreed_kg: 0, variance_kg: 0,
  collection_efficiency_percent: 0, total_trips: 0, collection_points_covered: 0,
};

const currentMonth = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
};
const todayStr = () => new Date().toISOString().split("T")[0];

function clearLocalBodySession() {
  ["lb_access_token","lb_panchayat_unique_id","lb_panchayat_name","lb_leader_name","lb_role"]
    .forEach((k) => localStorage.removeItem(k));
}

type View = "home" | "daily" | "monthly";

const fmt = (v?: number | null, dec = 3) =>
  v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec });

const StatusBadge = ({ s }: { s: string }) => {
  const cls = s === "Surplus"
    ? "bg-green-50 border border-green-200 text-green-700"
    : s === "Deficit"
    ? "bg-red-50 border border-red-200 text-red-700"
    : "bg-blue-50 border border-blue-200 text-blue-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {s || "—"}
    </span>
  );
};

/* ════════════════════════════════════════════════════════════
    COMPONENT
════════════════════════════════════════════════════════════ */
export default function LocalBodyDashboard() {
  const navigate      = useNavigate();
  const leaderName    = localStorage.getItem("lb_leader_name") ?? "Leader";
  const panchayatName = localStorage.getItem("lb_panchayat_name") ?? "";
  const printRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const role  = localStorage.getItem("lb_role");
    const token = localStorage.getItem("lb_access_token");
    if (role !== "panchayat_leader" || !token) navigate("/auth/localbody", { replace: true });
  }, [navigate]);

  /* ── view / filters ── */
  const [view,      setView]      = useState<View>("home");
  const [appliedMonth, setAppliedMonth] = useState(currentMonth());

  const [fromDate, setFromDate]   = useState(todayStr());
  const [toDate,   setToDate]     = useState(todayStr());
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo,   setAppliedTo]   = useState("");

  const [monthValue, setMonthValue] = useState(currentMonth());
  const [appliedMonthFilter, setAppliedMonthFilter] = useState("");

  /* ── data ── */
  const [rows,      setRows]      = useState<MonthlyRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyComparisonRow[]>([]);
  const [dailyKpis, setDailyKpis] = useState<DailyKpis>(ZERO_DAILY_KPIS);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const fetchData = async () => {
    setLoading(true); setError("");
    try {
      const params: Record<string, string> = {};
      if (appliedMonth) params.month = appliedMonth;
      const { data } = await lbApi.get<ApiResponse>("/localbody/dashboard/", { params });
      setRows(Array.isArray(data?.results) ? data.results : []);
      setDailyRows(Array.isArray(data?.daily_rows) ? data.daily_rows : []);
      setDailyKpis(data?.daily_kpis ?? ZERO_DAILY_KPIS);
    } catch {
      setRows([]); setDailyRows([]); setDailyKpis(ZERO_DAILY_KPIS);
      setError("Unable to load data. Please try again.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchData(); }, [appliedMonth]);

  /* ── filtered rows (client-side) ── */
  const filteredDailyRows = useMemo(() => {
    if (!appliedFrom && !appliedTo) return dailyRows;
    return dailyRows.filter((r) => {
      const d = r.date ?? "";
      if (!d) return false;
      if (appliedFrom && d < appliedFrom) return false;
      if (appliedTo   && d > appliedTo)   return false;
      return true;
    });
  }, [dailyRows, appliedFrom, appliedTo]);

  const filteredMonthlyRows = useMemo(() => {
    if (!appliedMonthFilter) return rows;
    return rows.filter((r) => r.month === appliedMonthFilter);
  }, [rows, appliedMonthFilter]);

  /* ── totals ── */
  const dailyTotal = useMemo(() => ({
    agreed:   filteredDailyRows.reduce((s, r) => s + Number(r.agreed_weight_kg), 0),
    actual:   filteredDailyRows.reduce((s, r) => s + Number(r.actual_weight_kg), 0),
    variance: filteredDailyRows.reduce((s, r) => s + Number(r.variance_kg), 0),
    trips:    filteredDailyRows.reduce((s, r) => s + r.total_trips, 0),
    points:   filteredDailyRows.reduce((s, r) => s + r.collection_points_covered, 0),
  }), [filteredDailyRows]);

  const monthlyTotal = useMemo(() => ({
    agreed:   filteredMonthlyRows.reduce((s, r) => s + Number(r.total_agreed_weight), 0),
    actual:   filteredMonthlyRows.reduce((s, r) => s + Number(r.total_actual_weight), 0),
    variance: filteredMonthlyRows.reduce((s, r) => s + Number(r.variance_kg), 0),
    trips:    filteredMonthlyRows.reduce((s, r) => s + r.total_trips, 0),
    points:   filteredMonthlyRows.reduce((s, r) => s + r.collection_points_covered, 0),
  }), [filteredMonthlyRows]);

  /* ── actions ── */
  const handlePrint = () => window.print();

  const downloadDaily = () => {
    const ws = XLSX.utils.json_to_sheet(filteredDailyRows.map((r, i) => ({
      "S.No": i + 1, "Date": r.date, "Waste Type": r.waste_type,
      "Agreed (Kg)": r.agreed_weight_kg, "Actual (Kg)": r.actual_weight_kg,
      "Variance (Kg)": r.variance_kg, "Variance %": r.variance_percent,
      "Status": r.report_status, "Trips": r.total_trips, "Points": r.collection_points_covered,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Report");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      `daily-report-${panchayatName}.xlsx`);
  };

  const downloadMonthly = () => {
    const ws = XLSX.utils.json_to_sheet(filteredMonthlyRows.map((r, i) => ({
      "S.No": i + 1, "Month": r.month, "Waste Type": r.waste_type,
      "Agreed (Kg)": r.total_agreed_weight, "Actual (Kg)": r.total_actual_weight,
      "Variance (Kg)": r.variance_kg, "Status": r.report_status,
      "Trips": r.total_trips, "Points": r.collection_points_covered,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      `monthly-report-${panchayatName}.xlsx`);
  };

  /* ── shared header ── */
  const Header = (
    <header className="print:hidden sticky top-0 z-20 flex items-center justify-between px-6 h-16 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
          <img src={ZigmaLogo} className="h-7 w-7 object-contain" alt="Zigma" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800 leading-tight">IWMS Portal</p>
          <p className="text-[11px] text-gray-400 leading-tight">PLB (Participating Local Bodies) Leader Dashboard</p>
        </div>
      </div>

      <p className="text-sm font-medium text-gray-700 hidden md:block">
        <span className="font-semibold text-green-600">{panchayatName}</span>
        <span className="text-gray-300 mx-2">|</span>
        Waste Collection Analytics
      </p>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <span className="h-6 w-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
            {(leaderName[0] ?? "L").toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-gray-700 hidden sm:block">{leaderName}</span>
        </div>
        <button
          onClick={() => { clearLocalBodySession(); navigate("/auth/localbody", { replace: true }); }}
          className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </div>
    </header>
  );

  /* ── print-only company header ── */
  const PrintHeader = (
    <div className="hidden print:block mb-6">
      <div className="flex items-center justify-between pb-3 border-b-2 border-green-500">
        <div className="flex items-center gap-3">
          <img src={ZigmaLogo} className="h-12 w-12 object-contain" alt="Zigma" />
          <div>
            <p className="text-base font-bold text-gray-900">ZIGMA Global Environ Solutions Pvt. Ltd.</p>
            <p className="text-sm text-gray-500">{panchayatName} — IWMS PLB (Participating Local Bodies) Leader Portal</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">Printed: {new Date().toLocaleString("en-IN")}</p>
      </div>
    </div>
  );

  /* ── stat card (admin-style: white + colored top border) ── */
  const StatCard = ({
    label, value, accent, icon,
  }: { label: string; value: string; accent: string; icon: React.ReactNode }) => (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-t-4 ${accent} flex flex-col gap-2 p-4`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800 leading-none">{loading ? "—" : value}</p>
    </div>
  );

  /* ── action button ── */
  const ActionBtn = ({
    label, icon, onClick, variant = "green",
  }: { label: string; icon: React.ReactNode; onClick: () => void; variant?: "green" | "blue" | "gray" }) => {
    const cls = {
      green: "border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-300",
      blue:  "border-blue-200  text-blue-700  bg-blue-50  hover:bg-blue-100  hover:border-blue-300",
      gray:  "border-gray-200  text-gray-600  bg-gray-50  hover:bg-gray-100  hover:border-gray-300",
    }[variant];
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-all hover:shadow-sm print:hidden ${cls}`}
      >
        {icon} {label}
      </button>
    );
  };

  /* ── table header columns ── */
  const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 text-xs font-semibold text-white bg-green-600 border-r border-white/20 last:border-0 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
  const TH_B = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 text-xs font-semibold text-white bg-blue-600 border-r border-white/20 last:border-0 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );

  /* ════════════════════════════════════════════════════════════
      HOME
  ════════════════════════════════════════════════════════════ */
  if (view === "home") {
    return (
      <div className="min-h-screen font-sans bg-gray-50">
        {Header}
        <main className="p-6 space-y-6 max-w-7xl mx-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* ── Welcome strip ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                Welcome, <span className="text-green-600">{leaderName}</span>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {panchayatName} · PLB (Participating Local Bodies) Waste Collection Report Portal
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4 text-green-500" />
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>

          {/* ── KPI Stats ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Input Waste Statistics</h2>
                <p className="text-sm text-gray-400 mt-0.5">Daily &amp; monthly collection KPIs</p>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Records (Daily)"   value={fmt(dailyRows.length, 0)}                             accent="border-t-green-500"  icon={<ClipboardList className="h-4 w-4" />} />
                <StatCard label="Actual Weight (Kg)"      value={fmt(dailyKpis.total_actual_kg)}                        accent="border-t-blue-500"   icon={<TrendingUp    className="h-4 w-4" />} />
                <StatCard label="Agreed Weight (Kg)"      value={fmt(dailyKpis.total_agreed_kg)}                        accent="border-t-purple-500" icon={<BarChart3     className="h-4 w-4" />} />
                <StatCard label="Collection Efficiency"   value={`${fmt(dailyKpis.collection_efficiency_percent, 2)}%`} accent="border-t-orange-400" icon={<Activity      className="h-4 w-4" />} />
                <StatCard label="Total Trips"             value={fmt(dailyKpis.total_trips, 0)}                         accent="border-t-teal-500"   icon={<ClipboardList className="h-4 w-4" />} />
                <StatCard label="Points Covered"          value={fmt(dailyKpis.collection_points_covered, 0)}           accent="border-t-pink-500"   icon={<MapPin        className="h-4 w-4" />} />
                <StatCard label="Total Variance (Kg)"     value={fmt(dailyKpis.variance_kg)}                            accent="border-t-red-400"    icon={<Scale         className="h-4 w-4" />} />
                <StatCard label="Monthly Records"         value={fmt(rows.length, 0)}                                   accent="border-t-indigo-500" icon={<FileBarChart2 className="h-4 w-4" />} />
              </div>
            </div>
          </div>

          {/* ── Report cards ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Reports</h2>
              <p className="text-sm text-gray-400 mt-0.5">Access your collection reports</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Day Wise */}
                <button
                  onClick={() => { const today = todayStr(); setFromDate(today); setToDate(today); setAppliedFrom(today); setAppliedTo(today); setView("daily"); }}
                  className="group bg-white rounded-xl border border-gray-200 hover:border-green-300 shadow-sm hover:shadow-md p-5 text-left transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                      <ClipboardList className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-green-700 transition-colors">
                        Day Wise Report
                      </p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Daily waste collection comparison with date range filter, totals and print support.
                      </p>
                      <span className="inline-flex items-center mt-3 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                        Open Report →
                      </span>
                    </div>
                  </div>
                </button>

                {/* Monthly */}
                <button
                  onClick={() => { setAppliedMonthFilter(""); setMonthValue(currentMonth()); setView("monthly"); }}
                  className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md p-5 text-left transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <FileBarChart2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                        Monthly Report
                      </p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Monthly waste comparison, performance metrics and variance analysis with print support.
                      </p>
                      <span className="inline-flex items-center mt-3 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                        Open Report →
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-gray-400 py-5 border-t border-gray-100 mt-4">
          Copyright © 2017–2026 ZIGMA Global Environ Solutions · All Rights Reserved.
        </footer>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
      DAILY / MONTHLY TABLE VIEW
  ═══════════════════════════════════════════════════════════ */
  const isDaily    = view === "daily";
  const accentHex  = isDaily ? "#16a34a" : "#2563eb";
  const accentSoft = isDaily ? "#f0fdf4" : "#eff6ff";
  const accentCls  = isDaily ? "text-green-600" : "text-blue-600";
  const title      = isDaily ? "Day Wise Report" : "Monthly Report";
  const theRows    = isDaily ? filteredDailyRows : filteredMonthlyRows;
  const theTotal   = isDaily ? dailyTotal : monthlyTotal;

  return (
    <div className="min-h-screen font-sans bg-gray-50" ref={printRef}>
      {Header}

      <main className="p-6 space-y-5 max-w-screen-2xl mx-auto">

        {/* ── Breadcrumb + title ── */}
        <div className="flex items-center gap-3 print:hidden">
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shadow-sm transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <span className="text-gray-300 text-sm">|</span>
          <h1 className={`text-xl font-bold ${accentCls}`}>{title}</h1>
        </div>

        {/* ── Filter card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 print:hidden">
          <div className="flex flex-wrap items-end gap-4">
            {isDaily ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">From Date</label>
                  <input
                    type="date" value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">To Date</label>
                  <input
                    type="date" value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 transition-all"
                  />
                </div>
                <button
                  onClick={() => {
                    setAppliedFrom(fromDate);
                    setAppliedTo(toDate);
                    const fromMonth = fromDate.slice(0, 7);
                    if (fromMonth !== appliedMonth) setAppliedMonth(fromMonth);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors"
                >GO</button>
                <button
                  onClick={() => { setAppliedFrom(""); setAppliedTo(""); setFromDate(todayStr()); setToDate(todayStr()); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm border border-gray-200 transition-colors"
                >All Dates</button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Month</label>
                  <input
                    type="month" value={monthValue}
                    onChange={(e) => setMonthValue(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <button
                  onClick={() => { setAppliedMonthFilter(monthValue); setAppliedMonth(monthValue); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors"
                >GO</button>
                <button
                  onClick={() => { setAppliedMonthFilter(""); setAppliedMonth(""); setMonthValue(currentMonth()); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm border border-gray-200 transition-colors"
                >All Months</button>
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              <ActionBtn
                label="Download" icon={<Download className="h-3.5 w-3.5" />}
                onClick={isDaily ? downloadDaily : downloadMonthly}
                variant={isDaily ? "green" : "blue"}
              />
              <ActionBtn
                label="Print" icon={<Printer className="h-3.5 w-3.5" />}
                onClick={handlePrint}
                variant="gray"
              />
            </div>
          </div>
        </div>

        {/* ── Summary pills ── */}
        {theRows.length > 0 && (
          <div className="flex flex-wrap gap-2 print:hidden">
            {[
              { label: "Records",     v: `${theRows.length}`,    cls: "text-green-700 bg-green-50 border-green-200" },
              { label: "Agreed Kg",   v: fmt(theTotal.agreed),   cls: "text-purple-700 bg-purple-50 border-purple-200" },
              { label: "Actual Kg",   v: fmt(theTotal.actual),   cls: isDaily ? "text-green-700 bg-green-50 border-green-200" : "text-blue-700 bg-blue-50 border-blue-200" },
              { label: "Variance Kg", v: fmt(theTotal.variance), cls: theTotal.variance < 0 ? "text-red-700 bg-red-50 border-red-200" : "text-emerald-700 bg-emerald-50 border-emerald-200" },
              { label: "Total Trips", v: fmt(theTotal.trips, 0), cls: "text-teal-700 bg-teal-50 border-teal-200" },
              { label: "Points",      v: fmt(theTotal.points, 0), cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
            ].map((p) => (
              <span key={p.label} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${p.cls}`}>
                {p.label}: {p.v}
              </span>
            ))}
          </div>
        )}

        {/* ── Print header ── */}
        {PrintHeader}
        <div className="hidden print:flex gap-8 text-sm mb-4 font-medium text-gray-600">
          {isDaily ? (
            <>
              <span>From: <strong>{appliedFrom || "All"}</strong></span>
              <span>To: <strong>{appliedTo || "All"}</strong></span>
            </>
          ) : (
            <span>Month: <strong>{appliedMonthFilter || "All"}</strong></span>
          )}
          <span>PLB (Participating Local Bodies): <strong>{panchayatName}</strong></span>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
              <span className={`animate-spin h-5 w-5 border-2 border-gray-200 rounded-full ${isDaily ? "border-t-green-500" : "border-t-blue-500"}`} />
              Loading data…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {isDaily ? (
                      <>
                        <TH>S.No</TH><TH>Date</TH><TH>Waste Type</TH>
                        <TH right>Agreed (Kg)</TH><TH right>Actual (Kg)</TH>
                        <TH right>Variance (Kg)</TH><TH right>Variance %</TH>
                        <TH>Status</TH><TH right>Trips</TH><TH right>Points</TH>
                      </>
                    ) : (
                      <>
                        <TH_B>S.No</TH_B><TH_B>Month</TH_B><TH_B>Waste Type</TH_B>
                        <TH_B right>Agreed (Kg)</TH_B><TH_B right>Actual (Kg)</TH_B>
                        <TH_B right>Variance (Kg)</TH_B><TH_B right>Variance %</TH_B>
                        <TH_B>Status</TH_B><TH_B right>Trips</TH_B><TH_B right>Points</TH_B>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {theRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                        No records found for the selected period.
                      </td>
                    </tr>
                  ) : theRows.map((r: any, i) => (
                    <tr
                      key={r.unique_id}
                      className="border-t border-gray-50 transition-colors"
                      style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = accentSoft)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafafa")}
                    >
                      <td className="px-3 py-2.5 text-gray-400 text-xs font-medium w-12">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-700">
                        {isDaily ? r.date : r.month}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{r.waste_type}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {fmt(isDaily ? r.agreed_weight_kg : r.total_agreed_weight)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold ${accentCls}`}>
                        {fmt(isDaily ? r.actual_weight_kg : r.total_actual_weight)}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${r.variance_kg < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmt(r.variance_kg)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{fmt(r.variance_percent, 2)}%</td>
                      <td className="px-3 py-2.5"><StatusBadge s={r.report_status} /></td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.total_trips}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.collection_points_covered}</td>
                    </tr>
                  ))}
                </tbody>

                {theRows.length > 0 && (
                  <tfoot>
                    <tr
                      className="border-t-2"
                      style={{ borderColor: accentHex + "60", background: accentSoft }}
                    >
                      <td colSpan={3} className="px-3 py-3 text-right text-sm font-bold text-gray-700">Total</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-700">{fmt(theTotal.agreed)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${accentCls}`}>{fmt(theTotal.actual)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${theTotal.variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmt(theTotal.variance)}
                      </td>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 text-right font-bold text-gray-700">{theTotal.trips}</td>
                      <td className="px-3 py-3 text-right font-bold text-gray-700">{theTotal.points}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {theRows.length > 0 && (
          <p className="text-xs text-gray-400 print:hidden">
            Showing {theRows.length} record{theRows.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-5 border-t border-gray-100 print:mt-8">
        Copyright © 2017–2026 ZIGMA Global Environ Solutions · All Rights Reserved.
      </footer>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          main, main * { visibility: visible; }
          main { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          table { font-size: 11px; border-collapse: collapse; }
          th, td { padding: 5px 8px !important; border: 1px solid #e5e7eb; }
          thead th { background: ${isDaily ? "#16a34a" : "#2563eb"} !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) { background: #f9fafb !important; }
          tfoot tr { background: ${isDaily ? "#f0fdf4" : "#eff6ff"} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
