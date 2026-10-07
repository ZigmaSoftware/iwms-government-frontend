import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { LogOut, AlertCircle, Inbox, Map as MapIcon, List, X } from "lucide-react";
import ZigmaLogo from "../../images/logo.png";
import { API_ROOT } from "../../config/configApi";
import LeaderGeoMap, { type LeaderMapPayload, type MapMetric } from "@/components/maps/LeaderGeoMap";
import { wasteTypeColors } from "@/components/maps/leaderMapTheme";
import { AreaTrend, Card, Donut, KpiTile, RankBars, Segmented } from "@/components/leader/DashboardKit";
import { fmtInt, fmtWeight, weightParts } from "@/components/leader/format";
import type { LeaderSummary } from "@/components/leader/types";
import ComparisonView, { type CmpTable, type CmpView } from "@/components/leader/ComparisonView";

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

  /* ── overview: state map (districts + ULB/RLB, one month's totals) ── */
  const [overviewView, setOverviewView] = useState<"map" | "list">("map");
  const [mapMonth, setMapMonth] = useState(currentMonth());
  const [mapSource, setMapSource] = useState<"bin" | "household" | "all">("all");
  const [mapMetric, setMapMetric] = useState<MapMetric>("weight");
  const [mapData, setMapData] = useState<LeaderMapPayload | null>(null);
  const [mapError, setMapError] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    stApi
      .get<LeaderMapPayload>("/statebody/map/", { params: { month: mapMonth || currentMonth(), source: mapSource } })
      .then(({ data }) => { if (!cancelled) { setMapError(""); setMapData(data); } })
      .catch(() => {
        if (cancelled) return;
        setMapData(null);
        setMapError("Unable to load the state map data.");
      });
    return () => { cancelled = true; };
  }, [mapMonth, mapSource]);

  const mapDistrictById = useMemo(
    () => new Map((mapData?.districts ?? []).map((d) => [d.district_id, d])),
    [mapData]
  );
  const selectedDistrict = selectedMapId ? mapDistrictById.get(selectedMapId) : undefined;
  const selectedLbs = useMemo(
    () => (mapData?.local_bodies ?? []).filter((lb) => lb.district_id === selectedMapId),
    [mapData, selectedMapId]
  );

  /* ── overview side panels: period summary (7-day trend, reporting today)
        and the selected month's waste-type split ── */
  const [summary, setSummary] = useState<LeaderSummary | null>(null);
  const [overviewWaste, setOverviewWaste] = useState<WasteBreakdownRow[]>([]);
  useEffect(() => {
    if (activeTab !== "overview") return;
    let cancelled = false;
    const district = selectedMapId ? { district_id: selectedMapId } : {};
    stApi
      .get<LeaderSummary>("/statebody/summary/", { params: { source: mapSource, ...district } })
      .then(({ data }) => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setSummary(null); });
    stApi
      .get<MonthlyResponse>("/statebody/monthly-waste-comparison/", { params: { month: mapMonth || currentMonth(), source: mapSource, ...district } })
      .then(({ data }) => { if (!cancelled) setOverviewWaste(data?.waste_type_breakdown ?? []); })
      .catch(() => { if (!cancelled) setOverviewWaste([]); });
    return () => { cancelled = true; };
  }, [activeTab, mapMonth, mapSource, selectedMapId]);

  const metricValue = (d: { weight: number; trips: number; points: number }) => d[mapMetric];
  const metricFormat = (v: number) => (mapMetric === "weight" ? fmtWeight(v) : fmtInt(v));
  const rankedDistricts = useMemo(
    () => [...(mapData?.districts ?? [])].sort((a, b) => metricValue(b) - metricValue(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapData, mapMetric]
  );
  const lbCountsByDistrict = useMemo(() => {
    const m = new Map<string, { ulb: number; rlb: number }>();
    for (const lb of mapData?.local_bodies ?? []) {
      const c = m.get(lb.district_id) ?? { ulb: 0, rlb: 0 };
      c[lb.category] += 1;
      m.set(lb.district_id, c);
    }
    return m;
  }, [mapData]);
  const wasteColors = useMemo(
    () => wasteTypeColors(summary?.waste_types?.length ? summary.waste_types : overviewWaste.map((w) => w.waste_type)),
    [summary, overviewWaste]
  );
  const totalDistricts = districts.length || mapData?.districts.length || 0;
  const monthLabel = mapMonth
    ? new Date(`${mapMonth}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "this month";

  /* ── monthly / daily: map district picked to filter the tables ── */
  const [cmpDistrictId, setCmpDistrictId] = useState<string | null>(null);
  const [cmpTable, setCmpTable] = useState<CmpTable>("comparison");

  /** the state map re-coloured with a comparison response's per-district
   *  totals (district-level only — no ULB/RLB layer on these tabs) */
  const comparisonMap = (rows: DistrictComparisonRow[] | undefined, kpis: ComparisonKpis | undefined): LeaderMapPayload | null => {
    if (!mapData) return null;
    const byId = new Map((rows ?? []).map((r) => [r.district_id, r]));
    return {
      ...mapData,
      local_bodies: [],
      districts: mapData.districts.map((d) => {
        const r = byId.get(d.district_id);
        return { ...d, weight: r?.total_actual_weight ?? 0, trips: r?.total_trips ?? 0, points: r?.collection_points_covered ?? 0 };
      }),
      totals: { weight: kpis?.total_actual_weight ?? 0, trips: kpis?.total_trips ?? 0, points: kpis?.collection_points_covered ?? 0 },
    };
  };

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

  /* picking a district on the Monthly / Daily map re-requests the same
     comparison narrowed to that district (server-side, so KPIs, trend,
     waste mix and every detailed row are complete — the unscoped response
     caps detailed rows). The unscoped response keeps driving the map and
     the District comparison table. Keyed by district + filters so a stale
     response is never shown for a newer pick. */
  const cmpTab = activeTab === "monthly" || activeTab === "daily" ? activeTab : null;
  const scopedKey = cmpTab && cmpDistrictId
    ? JSON.stringify(
        cmpTab === "monthly"
          ? [cmpTab, cmpDistrictId, monthlyMonth, monthlySource, monthlySort]
          : [cmpTab, cmpDistrictId, dailyMonth, dailyDate, dailySource, dailySort]
      )
    : null;
  const [scoped, setScoped] = useState<{ key: string; data: MonthlyResponse | DailyResponse | null } | null>(null);
  useEffect(() => {
    if (!scopedKey || !cmpTab || !cmpDistrictId) return;
    let cancelled = false;
    const params: Record<string, string> =
      cmpTab === "monthly"
        ? { source: monthlySource, sort: monthlySort, district_id: cmpDistrictId, ...(monthlyMonth ? { month: monthlyMonth } : {}) }
        : { source: dailySource, sort: dailySort, district_id: cmpDistrictId, ...(dailyDate ? { date: dailyDate } : dailyMonth ? { month: dailyMonth } : {}) };
    stApi
      .get<MonthlyResponse | DailyResponse>(`/statebody/${cmpTab}-waste-comparison/`, { params })
      .then(({ data }) => { if (!cancelled) setScoped({ key: scopedKey, data }); })
      .catch(() => { if (!cancelled) setScoped({ key: scopedKey, data: null }); });
    return () => { cancelled = true; };
    // scopedKey already encodes every input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedKey]);


  const selectCls = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";
  const viewToggle = (
    <Segmented
      value={overviewView}
      onChange={setOverviewView}
      options={[
        { value: "map", label: <span className="flex items-center gap-1"><MapIcon size={12} /> Map</span> },
        { value: "list", label: <span className="flex items-center gap-1"><List size={12} /> List</span> },
      ]}
    />
  );
  // map + side column fill the viewport below the header and KPI row
  const PANEL_H = "lg:h-[calc(100vh-196px)] lg:min-h-[500px]";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 font-sans">
      {/* ── header: title · tabs · overview filters · user ── */}
      <header className="z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <img src={ZigmaLogo} className="h-9 w-9 rounded-lg object-contain p-0.5 ring-1 ring-slate-200" alt="Zigma" />
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold text-gray-900">{stateLabel || "State"} Dashboard</h1>
            <p className="text-[11px] text-gray-500">Zigma IWMS · State Body Portal</p>
          </div>
        </div>
        <Segmented
          size="md"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "monthly", label: "Monthly" },
            { value: "daily", label: "Daily" },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {activeTab === "overview" && (
            <>
              <input type="month" value={mapMonth} onChange={(e) => setMapMonth(e.target.value)} className={selectCls} title="Month" />
              <select value={mapSource} onChange={(e) => setMapSource(e.target.value as typeof mapSource)} className={selectCls} title="Source">
                <option value="all">All sources</option>
                <option value="bin">Bin collection</option>
                <option value="household">Household collection</option>
              </select>
              <select value={mapMetric} onChange={(e) => setMapMetric(e.target.value as MapMetric)} className={selectCls} title="Districts ranked / bubbles sized by">
                <option value="weight">Weight (kg)</option>
                <option value="trips">Trips</option>
                <option value="points">Points covered</option>
              </select>
              <span className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />
            </>
          )}
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-xs font-semibold text-gray-900">{leaderName}</p>
            <p className="text-[11px] text-violet-600">{stateLabel || "State Leader"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      {/* ── scrollable dashboard body ── */}
      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "overview" && (
          <div className="space-y-3">
            {(overviewError || mapError) && <ErrorBanner message={overviewError || mapError} />}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <KpiTile loading={!totalDistricts && (overviewLoading || !mapData)} label="Total districts" value={fmtInt(totalDistricts)} sub="in your state" />
              <KpiTile
                loading={overviewLoading && !districts.length}
                label="Active districts"
                value={fmtInt(activeCount)}
                sub={totalDistricts ? `${Math.round((activeCount / totalDistricts) * 100)}% active` : undefined}
                subTone="good"
              />
              {(() => {
                // a district picked on the map narrows these tiles to it
                const scope = selectedDistrict ?? mapData?.totals;
                const lbs = selectedDistrict ? selectedLbs : mapData?.local_bodies ?? [];
                const where = selectedDistrict ? ` · ${selectedDistrict.name}` : "";
                return (
                  <>
                    <KpiTile loading={!scope} label="Collected" value={scope ? weightParts(scope.weight).value : "—"} unit={scope ? weightParts(scope.weight).unit : undefined} sub={`${monthLabel}${where}`} />
                    <KpiTile loading={!scope} label="Trips" value={scope ? fmtInt(scope.trips) : "—"} sub={scope ? `${fmtInt(scope.points)} points covered${where}` : undefined} />
                    <KpiTile
                      loading={!mapData}
                      label="Local bodies"
                      value={mapData ? fmtInt(lbs.length) : "—"}
                      sub={mapData ? `${fmtInt(lbs.filter((l) => l.category === "ulb").length)} ULB · ${fmtInt(lbs.filter((l) => l.category === "rlb").length)} RLB${where}` : undefined}
                    />
                    <KpiTile
                      loading={!summary}
                      label="Reporting today"
                      value={summary ? fmtInt(summary.reporting_today) : "—"}
                      unit={selectedDistrict ? `of ${fmtInt(lbs.length)}` : totalDistricts ? `of ${totalDistricts}` : undefined}
                      sub={
                        summary
                          ? summary.reporting_today
                            ? selectedDistrict ? `local bodies with a trip today${where}` : "districts with a trip today"
                            : `no trips logged yet today${where}`
                          : undefined
                      }
                      subTone={summary && summary.reporting_today < (selectedDistrict ? lbs.length : totalDistricts) / 2 ? "warn" : "muted"}
                    />
                  </>
                );
              })()}
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* map / list */}
              <div className={`relative h-[560px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${PANEL_H}`}>
                {overviewView === "map" ? (
                  <>
                    <LeaderGeoMap
                      mode="state"
                      data={mapData}
                      metric={mapMetric}
                      selectedDistrictId={selectedMapId}
                      onSelectDistrict={setSelectedMapId}
                      showSummary={false}
                      topLeft={viewToggle}
                    />
                    {selectedDistrict && (
                      <div className="absolute right-3 top-12 z-[1000] w-60 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-gray-900">{selectedDistrict.name}</p>
                          <button onClick={() => setSelectedMapId(null)} className="rounded-md p-0.5 text-gray-400 hover:bg-slate-100 hover:text-gray-600" title="Close">
                            <X size={14} />
                          </button>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                          <dt className="text-gray-500">Status</dt>
                          <dd className={`text-right font-semibold ${selectedDistrict.is_active ? "text-green-700" : "text-slate-500"}`}>{selectedDistrict.is_active ? "Active" : "Inactive"}</dd>
                          <dt className="text-gray-500">Collected</dt>
                          <dd className="text-right font-semibold tabular-nums text-gray-900">{fmtWeight(selectedDistrict.weight)}</dd>
                          <dt className="text-gray-500">Trips</dt>
                          <dd className="text-right font-semibold tabular-nums text-gray-900">{fmtInt(selectedDistrict.trips)}</dd>
                          <dt className="text-gray-500">Points covered</dt>
                          <dd className="text-right font-semibold tabular-nums text-gray-900">{fmtInt(selectedDistrict.points)}</dd>
                          <dt className="text-gray-500">ULB / RLB</dt>
                          <dd className="text-right font-semibold tabular-nums text-gray-900">
                            {selectedLbs.filter((l) => l.category === "ulb").length} / {selectedLbs.filter((l) => l.category === "rlb").length}
                          </dd>
                        </dl>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                      {viewToggle}
                      <p className="text-[11px] text-gray-500">{fmtInt(totalDistricts)} districts · {monthLabel}</p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-white">
                          <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-gray-500">
                            <th className="px-4 py-2.5 font-semibold">#</th>
                            <th className="px-4 py-2.5 font-semibold">District</th>
                            <th className="px-4 py-2.5 font-semibold">Status</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Collected</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Trips</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Points</th>
                            <th className="px-4 py-2.5 text-right font-semibold">ULB</th>
                            <th className="px-4 py-2.5 text-right font-semibold">RLB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewLoading && !mapData ? (
                            <TableRowsSkeleton cols={8} />
                          ) : rankedDistricts.length === 0 ? (
                            <tr><td colSpan={8}><EmptyState message="No districts found for this state." /></td></tr>
                          ) : (
                            rankedDistricts.map((d, i) => (
                              <tr
                                key={d.district_id}
                                onClick={() => { setSelectedMapId(d.district_id); setOverviewView("map"); }}
                                className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-violet-50/50"
                                title="Show on the map"
                              >
                                <td className="px-4 py-2 tabular-nums text-gray-400">{i + 1}</td>
                                <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                                <td className="px-4 py-2">
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${d.is_active ? "text-green-700" : "text-slate-500"}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${d.is_active ? "bg-green-500" : "bg-slate-400"}`} />
                                    {d.is_active ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">{fmtWeight(d.weight)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{fmtInt(d.trips)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{fmtInt(d.points)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{fmtInt(lbCountsByDistrict.get(d.district_id)?.ulb ?? 0)}</td>
                                <td className="px-4 py-2 text-right tabular-nums">{fmtInt(lbCountsByDistrict.get(d.district_id)?.rlb ?? 0)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* side column */}
              <div className={`flex min-w-0 flex-col gap-3 ${PANEL_H}`}>
                <Card
                  title="Top districts"
                  right={
                    <button onClick={() => setOverviewView("list")} className="text-[11px] font-semibold text-violet-700 underline-offset-2 hover:underline">
                      View all {fmtInt(totalDistricts)}
                    </button>
                  }
                  className="shrink-0"
                >
                  <RankBars
                    rows={rankedDistricts.slice(0, 5).map((d) => ({ id: d.district_id, name: d.name, value: metricValue(d) }))}
                    format={metricFormat}
                    onRowClick={(id) => { setSelectedMapId(id); setOverviewView("map"); }}
                  />
                </Card>
                <Card
                  title={`Waste by type${selectedDistrict ? ` · ${selectedDistrict.name}` : ""}`}
                  right={<span className="text-[11px] text-gray-500">{monthLabel}</span>}
                  className="shrink-0"
                >
                  <Donut
                    data={overviewWaste.map((w) => ({ name: w.waste_type, value: w.total_actual_weight, color: wasteColors[w.waste_type] ?? "#8f8d86" }))}
                    center={weightParts(overviewWaste.reduce((a, w) => a + w.total_actual_weight, 0)).value}
                    centerLabel={weightParts(overviewWaste.reduce((a, w) => a + w.total_actual_weight, 0)).unit}
                    format={fmtWeight}
                  />
                </Card>
                <Card
                  title={`7-day collection${selectedDistrict ? ` · ${selectedDistrict.name}` : ""}`}
                  right={<span className="text-[11px] text-gray-500">kg / day</span>}
                  className="min-h-[170px] flex-1"
                >
                  <AreaTrend
                    data={(summary?.trend ?? []).map((t) => ({ date: t.date, value: t.weight }))}
                    name="Collected"
                    format={fmtWeight}
                  />
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── MONTHLY / DAILY COMPARISON (shared three-panel layout) ── */}
        {(activeTab === "monthly" || activeTab === "daily") && (() => {
          const monthly = activeTab === "monthly";
          // `data`: every district (map + District comparison); `view`: what
          // the KPIs, charts and detailed rows describe — the picked district's
          // scoped response, or `data` when none is picked
          const data = monthly ? monthlyData : dailyData;
          const scopedReady = !!scopedKey && scoped?.key === scopedKey;
          const view = cmpDistrictId ? (scopedReady ? scoped!.data : null) : data;
          const tableLoading = monthly ? monthlyLoading : dailyLoading;
          const sort = monthly ? monthlySort : dailySort;
          const cmpName = cmpDistrictId ? mapData?.districts.find((d) => d.district_id === cmpDistrictId)?.name : undefined;
          const field = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";
          const label = "mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500";

          const cmpView: CmpView | null = view && {
            kpis: {
              weight: view.kpis.total_actual_weight, trips: view.kpis.total_trips, points: view.kpis.collection_points_covered,
              avg: view.kpis.average_weight_per_trip, groups: view.kpis.district_count, wasteTypes: view.kpis.waste_type_count,
            },
            trend: "monthly_trends" in view
              ? view.monthly_trends.map((m) => ({ label: m.month, weight: m.total_actual_weight }))
              : view.date_trends.map((d) => ({ label: d.collection_date, weight: d.actual_weight_kg })),
            breakdown: view.waste_type_breakdown.map((w) => ({ name: w.waste_type, weight: w.total_actual_weight })),
            detail: view.results.map((r) => ({
              key: r.unique_id,
              period: "month" in r ? r.month : r.collection_date,
              id: r.district_id,
              name: r.district_name,
              wasteType: r.waste_type,
              weight: "total_actual_weight" in r ? r.total_actual_weight : r.actual_weight_kg,
              trips: r.total_trips,
            })),
          };

          const filters = monthly ? (
            <>
              <div>
                <label className={label}>Month</label>
                <input type="month" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Source</label>
                <select value={monthlySource} onChange={(e) => setMonthlySource(e.target.value as typeof monthlySource)} className={field}>
                  <option value="bin">Bin collection</option>
                  <option value="household">Household collection</option>
                  <option value="all">All sources</option>
                </select>
              </div>
              <div>
                <label className={label}>Sort by</label>
                <select value={monthlySort} onChange={(e) => setMonthlySort(e.target.value as typeof monthlySort)} className={field}>
                  <option value="weight">Weight</option>
                  <option value="trips">Trips</option>
                </select>
              </div>
              {monthlyMonth && (
                <button onClick={() => setMonthlyMonth("")} className={`${field} font-semibold hover:bg-violet-50 hover:text-violet-700`}>
                  Clear month (show all)
                </button>
              )}
            </>
          ) : (
            <>
              <div>
                <label className={label}>Month</label>
                <input type="month" value={dailyMonth} onChange={(e) => { setDailyMonth(e.target.value); setDailyDate(""); }} className={field} />
              </div>
              <div>
                <label className={label}>Specific date (optional)</label>
                <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Source</label>
                <select value={dailySource} onChange={(e) => setDailySource(e.target.value as typeof dailySource)} className={field}>
                  <option value="bin">Bin collection</option>
                  <option value="household">Household collection</option>
                  <option value="all">All sources</option>
                </select>
              </div>
              <div>
                <label className={label}>Sort by</label>
                <select value={dailySort} onChange={(e) => setDailySort(e.target.value as typeof dailySort)} className={field}>
                  <option value="weight">Weight</option>
                  <option value="trips">Trips</option>
                </select>
              </div>
              {dailyDate && (
                <button onClick={() => setDailyDate("")} className={`${field} font-semibold hover:bg-violet-50 hover:text-violet-700`}>
                  Clear date (show month)
                </button>
              )}
            </>
          );

          return (
            <ComparisonView
              granularity={monthly ? "month" : "day"}
              filters={filters}
              error={monthly ? monthlyError : dailyError}
              entity={{ one: "District", many: "Districts" }}
              view={cmpView}
              viewLoading={tableLoading || (!!cmpDistrictId && !scopedReady)}
              comparison={(data?.district_comparison ?? []).map((r) => ({
                id: r.district_id, name: r.district_name, weight: r.total_actual_weight,
                trips: r.total_trips, points: r.collection_points_covered, avg: r.average_weight_per_trip,
              }))}
              comparisonLoading={tableLoading}
              picked={cmpDistrictId && cmpName ? { id: cmpDistrictId, name: cmpName } : null}
              onPick={setCmpDistrictId}
              sort={sort}
              wasteColors={wasteColors}
              trendNote={monthly ? (monthlyMonth ? "selected month" : "all months") : dailyDate || "this month"}
              table={cmpTable}
              onTableChange={setCmpTable}
              map={
                <LeaderGeoMap
                  mode="state"
                  data={comparisonMap(data?.district_comparison, data?.kpis)}
                  metric={sort === "trips" ? "trips" : "weight"}
                  localBodies={false}
                  selectedDistrictId={cmpDistrictId}
                  onSelectDistrict={(id) => { setCmpDistrictId(id); if (id) setCmpTable("rows"); }}
                />
              }
            />
          );
        })()}
      </main>
    </div>
  );
}
