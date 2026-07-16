import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Building2, LogOut, MapPin, BarChart3, CalendarDays, LayoutGrid,
  Scale, Truck, Target, Gauge, Landmark, Recycle, AlertCircle, Inbox,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import ZigmaLogo from "../../images/logo.png";
import { API_ROOT } from "../../config/configApi";

const stApi = axios.create({ baseURL: API_ROOT });
stApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("st_access_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearStateSession() {
  ["st_access_token", "st_state_unique_id", "st_state_name", "st_leader_name", "st_role"].forEach((k) =>
    localStorage.removeItem(k)
  );
}

// A dead/expired st_access_token (or an unauthenticated request) surfaces as
// 401 from every /statebody/* endpoint. Without this, the dashboard renders
// from cached localStorage profile fields and silently fails every fetch
// forever ("Unable to load data") instead of sending the leader back to
// login. Clear the stale session and bounce to /state so they can sign in
// again and get a fresh token.
stApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearStateSession();
      window.location.replace("/state");
    }
    return Promise.reject(error);
  }
);

// CVD-validated categorical order (worst adjacent ΔE 24.2 — see dataviz skill's
// palette.md). Never reorder ad hoc: the order itself is the safety mechanism.
const PIE_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
const BRAND = "#7c3aed"; // single-series accent (trend bars) — brand violet

const fmt = (v?: number | null, dec = 2) =>
  v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec });

const currentMonth = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
};

/* ─── types ──────────────────────────────────────────────── */
type DistrictRow = { district_id: string; district_name: string; is_active: boolean };
type StateDashboardResponse = {
  state_id: string;
  state_name: string;
  districts: DistrictRow[];
  kpis: { total_districts: number };
};

type DistrictComparisonRow = {
  district_id: string;
  district_name: string;
  total_actual_weight: number;
  total_trips: number;
  collection_points_covered: number;
  average_weight_per_trip: number;
};
type WasteBreakdownRow = {
  waste_type_id: string;
  waste_type: string;
  total_actual_weight: number;
  total_trips: number;
  collection_points_covered: number;
  share_percent: number;
};
type ComparisonKpis = {
  total_actual_weight: number;
  average_weight_per_trip: number;
  total_trips: number;
  collection_points_covered: number;
  waste_type_count: number;
  district_count: number;
};

type MonthlyRow = {
  unique_id: string; month: string; district_id: string; district_name: string;
  waste_type_id: string; waste_type: string; total_actual_weight: number;
  total_trips: number; collection_points_covered: number; average_weight_per_trip: number;
};
type MonthlyTrend = {
  month: string; total_actual_weight: number; total_trips: number;
  collection_points_covered: number; average_weight_per_trip: number;
};
type MonthlyResponse = {
  state_id: string; state_name: string; source: string;
  results: MonthlyRow[];
  monthly_trends: MonthlyTrend[];
  district_comparison: DistrictComparisonRow[];
  waste_type_breakdown: WasteBreakdownRow[];
  kpis: ComparisonKpis;
};

type DailyRow = {
  unique_id: string; collection_date: string; district_id: string; district_name: string;
  waste_type_id: string; waste_type: string; actual_weight_kg: number;
  total_trips: number; collection_points_covered: number; average_weight_per_trip: number;
};
type DateTrend = {
  collection_date: string; actual_weight_kg: number; total_trips: number;
  collection_points_covered: number; average_weight_per_trip: number;
};
type DailyResponse = {
  state_id: string; state_name: string; source: string;
  results: DailyRow[];
  date_trends: DateTrend[];
  district_comparison: DistrictComparisonRow[];
  waste_type_breakdown: WasteBreakdownRow[];
  kpis: ComparisonKpis;
};

type TabKey = "overview" | "monthly" | "daily";

/* ─── small shared UI bits ──────────────────────────────────────────── */
function KpiCard({
  label, value, icon, accent = "violet",
}: { label: string; value: string; icon: React.ReactNode; accent?: "violet" | "indigo" }) {
  const ring = accent === "indigo" ? "from-indigo-500 to-blue-500" : "from-violet-500 to-fuchsia-500";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-100">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ring} opacity-80`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ring} text-white shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-violet-500">{icon}</span>}
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SectionCard({
  title, icon, children, scroll = false,
}: { title: string; icon?: React.ReactNode; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-violet-50/60 to-transparent px-5 py-4">
        {icon && <span className="text-violet-500">{icon}</span>}
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      <div className={scroll ? "max-h-96 overflow-auto" : "overflow-x-auto"}>{children}</div>
    </div>
  );
}

function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-xl shadow-slate-200/60">
      <p className="mb-1 font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-gray-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill || p.color }} />
          {p.name}: <span className="font-semibold tabular-nums text-gray-800">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-64 animate-pulse flex-col items-center justify-center gap-3">
      <div className="h-32 w-32 rounded-full border-8 border-violet-100 border-t-violet-400" />
      <p className="text-xs font-medium text-gray-400">Loading chart…</p>
    </div>
  );
}

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-400">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function TableRowsSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-5 py-3.5">
              <div className="h-3 w-4/5 rounded-full bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
    COMPONENT
════════════════════════════════════════════════════════════ */
export default function StateLeaderDashboard() {
  const navigate = useNavigate();
  const leaderName = localStorage.getItem("st_leader_name") ?? "Leader";
  const [stateLabel, setStateLabel] = useState(localStorage.getItem("st_state_name") ?? "");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    const role = localStorage.getItem("st_role");
    const token = localStorage.getItem("st_access_token");
    if (role !== "state_leader" || !token) navigate("/state", { replace: true });
  }, [navigate]);

  const handleLogout = () => {
    clearStateSession();
    navigate("/state", { replace: true });
  };

  /* ── overview: districts ── */
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  const fetchOverview = async () => {
    setOverviewLoading(true);
    setOverviewError("");
    try {
      const { data } = await stApi.get<StateDashboardResponse>("/statebody/dashboard/");
      setDistricts(Array.isArray(data?.districts) ? data.districts : []);
      if (data?.state_name) {
        setStateLabel(data.state_name);
        localStorage.setItem("st_state_name", data.state_name);
      }
    } catch {
      setDistricts([]);
      setOverviewError("Unable to load data. Please try again.");
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount = districts.filter((d) => d.is_active).length;

  /* ── monthly comparison ── */
  const [monthlyMonth, setMonthlyMonth] = useState("");
  const [monthlySource, setMonthlySource] = useState<"bin" | "household" | "all">("bin");
  const [monthlySort, setMonthlySort] = useState<"weight" | "trips">("weight");
  const [monthlyData, setMonthlyData] = useState<MonthlyResponse | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState("");

  const fetchMonthly = async () => {
    setMonthlyLoading(true);
    setMonthlyError("");
    try {
      const params: Record<string, string> = { source: monthlySource, sort: monthlySort };
      if (monthlyMonth) params.month = monthlyMonth;
      const { data } = await stApi.get<MonthlyResponse>("/statebody/monthly-waste-comparison/", { params });
      setMonthlyData(data);
    } catch {
      setMonthlyData(null);
      setMonthlyError("Unable to load monthly waste comparison data.");
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "monthly") void fetchMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, monthlyMonth, monthlySource, monthlySort]);

  /* ── daily comparison ── */
  const [dailyMonth, setDailyMonth] = useState(currentMonth());
  const [dailyDate, setDailyDate] = useState("");
  const [dailySource, setDailySource] = useState<"bin" | "household" | "all">("bin");
  const [dailySort, setDailySort] = useState<"weight" | "trips">("weight");
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState("");

  const fetchDaily = async () => {
    setDailyLoading(true);
    setDailyError("");
    try {
      const params: Record<string, string> = { source: dailySource, sort: dailySort };
      if (dailyDate) params.date = dailyDate;
      else if (dailyMonth) params.month = dailyMonth;
      const { data } = await stApi.get<DailyResponse>("/statebody/daily-waste-comparison/", { params });
      setDailyData(data);
    } catch {
      setDailyData(null);
      setDailyError("Unable to load daily waste comparison data.");
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "daily") void fetchDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dailyMonth, dailyDate, dailySource, dailySort]);

  const monthlyChartData = useMemo(
    () => (monthlyData?.monthly_trends ?? []).map((m) => ({ label: m.month, weight: m.total_actual_weight })),
    [monthlyData]
  );
  const dailyChartData = useMemo(
    () => (dailyData?.date_trends ?? []).map((d) => ({ label: d.collection_date, weight: d.actual_weight_kg })),
    [dailyData]
  );

  const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "overview", label: "Overview", icon: <LayoutGrid size={14} /> },
    { key: "monthly", label: "Monthly Comparison", icon: <BarChart3 size={14} /> },
    { key: "daily", label: "Daily Comparison", icon: <CalendarDays size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 via-slate-50 to-slate-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-violet-100 bg-white/90 backdrop-blur-sm">
        <div className="h-[3px] bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-1 shadow-sm ring-1 ring-violet-100">
              <img src={ZigmaLogo} className="h-8 w-8 object-contain" alt="Zigma" />
            </div>
            <div>
              <p className="text-sm font-black tracking-wide text-gray-800">ZIGMA IWMS</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                State Body Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-800">{leaderName}</p>
              <p className="text-xs text-gray-500">{stateLabel || "State Leader"}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-sm">
              {leaderName.trim().charAt(0).toUpperCase() || "L"}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-7 flex items-center gap-4">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-200">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {stateLabel || "State"} Dashboard
            </h1>
            <p className="text-sm text-gray-500">Waste collection overview for your state</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-7 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-slate-50 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KpiCard label="Total Districts" value={String(districts.length)} icon={<Landmark size={17} />} />
              <KpiCard label="Active Districts" value={String(activeCount)} icon={<Target size={17} />} accent="indigo" />
            </div>

            {overviewError && <ErrorBanner message={overviewError} />}

            <SectionCard title="Districts" icon={<MapPin size={15} />}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-gray-400">
                    <th className="px-5 py-3 font-semibold">District</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewLoading ? (
                    <TableRowsSkeleton cols={2} />
                  ) : districts.length === 0 ? (
                    <tr><td colSpan={2}><EmptyState message="No districts found for this state." /></td></tr>
                  ) : (
                    districts.map((d) => (
                      <tr key={d.district_id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/40">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-violet-400" />
                            <span className="font-medium text-gray-800">{d.district_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            d.is_active
                              ? "bg-green-50 border border-green-200 text-green-700"
                              : "bg-slate-100 border border-slate-200 text-slate-500"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${d.is_active ? "bg-green-500" : "bg-slate-400"}`} />
                            {d.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionCard>
          </>
        )}

        {/* ── MONTHLY COMPARISON TAB ── */}
        {activeTab === "monthly" && (
          <>
            <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Month</label>
                <input
                  type="month"
                  value={monthlyMonth}
                  onChange={(e) => setMonthlyMonth(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Source</label>
                <select
                  value={monthlySource}
                  onChange={(e) => setMonthlySource(e.target.value as typeof monthlySource)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="bin">Bin Collection</option>
                  <option value="household">Household Collection</option>
                  <option value="all">All Sources</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Sort By</label>
                <select
                  value={monthlySort}
                  onChange={(e) => setMonthlySort(e.target.value as typeof monthlySort)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="weight">Weight</option>
                  <option value="trips">Trips</option>
                </select>
              </div>
              {monthlyMonth && (
                <button
                  onClick={() => setMonthlyMonth("")}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                >
                  Clear month (show all)
                </button>
              )}
            </div>

            {monthlyError && <ErrorBanner message={monthlyError} />}

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Total Weight (kg)" value={fmt(monthlyData?.kpis.total_actual_weight)} icon={<Scale size={16} />} />
              <KpiCard label="Total Trips" value={fmt(monthlyData?.kpis.total_trips, 0)} icon={<Truck size={16} />} accent="indigo" />
              <KpiCard label="Points Covered" value={fmt(monthlyData?.kpis.collection_points_covered, 0)} icon={<Target size={16} />} />
              <KpiCard label="Avg / Trip (kg)" value={fmt(monthlyData?.kpis.average_weight_per_trip)} icon={<Gauge size={16} />} accent="indigo" />
              <KpiCard label="Districts" value={fmt(monthlyData?.kpis.district_count, 0)} icon={<Landmark size={16} />} />
              <KpiCard label="Waste Types" value={fmt(monthlyData?.kpis.waste_type_count, 0)} icon={<Recycle size={16} />} accent="indigo" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Monthly Trend (kg)" icon={<BarChart3 size={15} />}>
                {monthlyLoading ? (
                  <ChartSkeleton />
                ) : monthlyChartData.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyChartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e0d9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#e1e0d9" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
                      <RTooltip content={<ComparisonTooltip />} cursor={{ fill: "#f5f3ff" }} />
                      <Bar dataKey="weight" name="Weight (kg)" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Waste Type Composition" icon={<Recycle size={15} />}>
                {monthlyLoading ? (
                  <ChartSkeleton />
                ) : (monthlyData?.waste_type_breakdown.length ?? 0) === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={monthlyData?.waste_type_breakdown}
                        dataKey="total_actual_weight"
                        nameKey="waste_type"
                        cx="50%"
                        cy="46%"
                        innerRadius={48}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="#fff"
                        strokeWidth={2}
                        label={(d: any) => `${d.share_percent}%`}
                        labelLine={false}
                      >
                        {(monthlyData?.waste_type_breakdown ?? []).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip content={<ComparisonTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: 11, color: "#52514e" }}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <div className="mb-6">
              <SectionCard title="District Comparison" icon={<Landmark size={15} />}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-gray-400">
                      <th className="px-5 py-3 font-semibold">District</th>
                      <th className="px-5 py-3 font-semibold">Weight (kg)</th>
                      <th className="px-5 py-3 font-semibold">Trips</th>
                      <th className="px-5 py-3 font-semibold">Points Covered</th>
                      <th className="px-5 py-3 font-semibold">Avg / Trip (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyLoading ? (
                      <TableRowsSkeleton cols={5} />
                    ) : (monthlyData?.district_comparison ?? []).length === 0 ? (
                      <tr><td colSpan={5}><EmptyState /></td></tr>
                    ) : (
                      monthlyData!.district_comparison.map((r) => (
                        <tr key={r.district_id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/40">
                          <td className="px-5 py-3 font-medium text-gray-800">{r.district_name}</td>
                          <td className="px-5 py-3 tabular-nums">{fmt(r.total_actual_weight)}</td>
                          <td className="px-5 py-3 tabular-nums">{r.total_trips}</td>
                          <td className="px-5 py-3 tabular-nums">{r.collection_points_covered}</td>
                          <td className="px-5 py-3 tabular-nums">{fmt(r.average_weight_per_trip)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>
            </div>

            <SectionCard title="Detailed Rows" icon={<LayoutGrid size={15} />} scroll>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-gray-400">
                    <th className="px-5 py-3 font-semibold">Month</th>
                    <th className="px-5 py-3 font-semibold">District</th>
                    <th className="px-5 py-3 font-semibold">Waste Type</th>
                    <th className="px-5 py-3 font-semibold">Weight (kg)</th>
                    <th className="px-5 py-3 font-semibold">Trips</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyLoading ? (
                    <TableRowsSkeleton cols={5} />
                  ) : (monthlyData?.results ?? []).length === 0 ? (
                    <tr><td colSpan={5}><EmptyState /></td></tr>
                  ) : (
                    monthlyData!.results.map((r) => (
                      <tr key={r.unique_id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/40">
                        <td className="px-5 py-3 tabular-nums">{r.month}</td>
                        <td className="px-5 py-3">{r.district_name}</td>
                        <td className="px-5 py-3">{r.waste_type}</td>
                        <td className="px-5 py-3 tabular-nums">{fmt(r.total_actual_weight)}</td>
                        <td className="px-5 py-3 tabular-nums">{r.total_trips}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionCard>
          </>
        )}

        {/* ── DAILY COMPARISON TAB ── */}
        {activeTab === "daily" && (
          <>
            <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Month</label>
                <input
                  type="month"
                  value={dailyMonth}
                  onChange={(e) => { setDailyMonth(e.target.value); setDailyDate(""); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Specific Date (optional)</label>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Source</label>
                <select
                  value={dailySource}
                  onChange={(e) => setDailySource(e.target.value as typeof dailySource)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="bin">Bin Collection</option>
                  <option value="household">Household Collection</option>
                  <option value="all">All Sources</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-gray-400">Sort By</label>
                <select
                  value={dailySort}
                  onChange={(e) => setDailySort(e.target.value as typeof dailySort)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="weight">Weight</option>
                  <option value="trips">Trips</option>
                </select>
              </div>
              {dailyDate && (
                <button
                  onClick={() => setDailyDate("")}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                >
                  Clear date (show month)
                </button>
              )}
            </div>

            {dailyError && <ErrorBanner message={dailyError} />}

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Total Weight (kg)" value={fmt(dailyData?.kpis.total_actual_weight)} icon={<Scale size={16} />} />
              <KpiCard label="Total Trips" value={fmt(dailyData?.kpis.total_trips, 0)} icon={<Truck size={16} />} accent="indigo" />
              <KpiCard label="Points Covered" value={fmt(dailyData?.kpis.collection_points_covered, 0)} icon={<Target size={16} />} />
              <KpiCard label="Avg / Trip (kg)" value={fmt(dailyData?.kpis.average_weight_per_trip)} icon={<Gauge size={16} />} accent="indigo" />
              <KpiCard label="Districts" value={fmt(dailyData?.kpis.district_count, 0)} icon={<Landmark size={16} />} />
              <KpiCard label="Waste Types" value={fmt(dailyData?.kpis.waste_type_count, 0)} icon={<Recycle size={16} />} accent="indigo" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Day-wise Trend (kg)" icon={<CalendarDays size={15} />}>
                {dailyLoading ? (
                  <ChartSkeleton />
                ) : dailyChartData.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={dailyChartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e0d9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#898781" }} axisLine={{ stroke: "#e1e0d9" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} />
                      <RTooltip content={<ComparisonTooltip />} cursor={{ fill: "#f5f3ff" }} />
                      <Bar dataKey="weight" name="Weight (kg)" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Waste Type Composition" icon={<Recycle size={15} />}>
                {dailyLoading ? (
                  <ChartSkeleton />
                ) : (dailyData?.waste_type_breakdown.length ?? 0) === 0 ? (
                  <EmptyState />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={dailyData?.waste_type_breakdown}
                        dataKey="total_actual_weight"
                        nameKey="waste_type"
                        cx="50%"
                        cy="46%"
                        innerRadius={48}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="#fff"
                        strokeWidth={2}
                        label={(d: any) => `${d.share_percent}%`}
                        labelLine={false}
                      >
                        {(dailyData?.waste_type_breakdown ?? []).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip content={<ComparisonTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: 11, color: "#52514e" }}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <div className="mb-6">
              <SectionCard title="District Comparison" icon={<Landmark size={15} />}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-gray-400">
                      <th className="px-5 py-3 font-semibold">District</th>
                      <th className="px-5 py-3 font-semibold">Weight (kg)</th>
                      <th className="px-5 py-3 font-semibold">Trips</th>
                      <th className="px-5 py-3 font-semibold">Points Covered</th>
                      <th className="px-5 py-3 font-semibold">Avg / Trip (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyLoading ? (
                      <TableRowsSkeleton cols={5} />
                    ) : (dailyData?.district_comparison ?? []).length === 0 ? (
                      <tr><td colSpan={5}><EmptyState /></td></tr>
                    ) : (
                      dailyData!.district_comparison.map((r) => (
                        <tr key={r.district_id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/40">
                          <td className="px-5 py-3 font-medium text-gray-800">{r.district_name}</td>
                          <td className="px-5 py-3 tabular-nums">{fmt(r.total_actual_weight)}</td>
                          <td className="px-5 py-3 tabular-nums">{r.total_trips}</td>
                          <td className="px-5 py-3 tabular-nums">{r.collection_points_covered}</td>
                          <td className="px-5 py-3 tabular-nums">{fmt(r.average_weight_per_trip)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>
            </div>

            <SectionCard title="Detailed Rows" icon={<LayoutGrid size={15} />} scroll>
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-gray-400">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">District</th>
                    <th className="px-5 py-3 font-semibold">Waste Type</th>
                    <th className="px-5 py-3 font-semibold">Weight (kg)</th>
                    <th className="px-5 py-3 font-semibold">Trips</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyLoading ? (
                    <TableRowsSkeleton cols={5} />
                  ) : (dailyData?.results ?? []).length === 0 ? (
                    <tr><td colSpan={5}><EmptyState /></td></tr>
                  ) : (
                    dailyData!.results.map((r) => (
                      <tr key={r.unique_id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/40">
                        <td className="px-5 py-3 tabular-nums">{r.collection_date}</td>
                        <td className="px-5 py-3">{r.district_name}</td>
                        <td className="px-5 py-3">{r.waste_type}</td>
                        <td className="px-5 py-3 tabular-nums">{fmt(r.actual_weight_kg)}</td>
                        <td className="px-5 py-3 tabular-nums">{r.total_trips}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}
