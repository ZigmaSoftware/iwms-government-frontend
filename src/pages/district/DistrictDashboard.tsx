import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { Download, LogOut, Search, TableProperties } from "lucide-react";
import ZigmaLogo from "../../images/logo.png";
import LeaderGeoMap, { type LbFilter, type LeaderMapPayload, type MapLocalBody } from "@/components/maps/LeaderGeoMap";
import { DISTRICT_ACCENT, LB_TYPES, MAP_LINE, SERIES, TYPE_CATEGORY, TYPE_COLOR, TYPE_LABEL, skyShades, wasteTypeColors } from "@/components/maps/leaderMapTheme";
import { ChartAccent } from "@/components/leader/chartTheme";
import { Card, Change, Donut, EmptyNote, MultiLineTrend, Segmented, Shimmer, Spinner } from "@/components/leader/DashboardKit";
import { currentMonth, fmtInt, fmtWeight, weightParts } from "@/components/leader/format";
import type { LeaderSummary } from "@/components/leader/types";
import ComparisonView, { type CmpTable, type CmpView } from "@/components/leader/ComparisonView";

/* ─────────────────────────────────────────────────────────────────────
   District Leader dashboard — every figure is live:
     /districtbody/map/      the district's local bodies (type, status,
                             wards, boundary) + the month's collection
     /districtbody/summary/  today / 7-day / month totals, 7-day trend and
                             waste-type split, grievances, fleet
   The header stays put; the dashboard body scrolls beneath it.
   ──────────────────────────────────────────────────────────────────── */

const IS_PROD = import.meta.env.VITE_PROD === "true";
const API_ROOT = IS_PROD ? import.meta.env.VITE_API_PROD : import.meta.env.VITE_API_LOCAL;

const dbApi = axios.create({ baseURL: API_ROOT });
dbApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("db_access_token");
  if (token) { config.headers = config.headers ?? {}; config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

function clearDistrictSession() {
  ["db_access_token", "db_district_unique_id", "db_district_name", "db_leader_name", "db_role"]
    .forEach((k) => localStorage.removeItem(k));
}

// an expired token answers 401 everywhere — send the leader back to sign in
dbApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401) {
      clearDistrictSession();
      window.location.replace("/district");
    }
    return Promise.reject(error);
  }
);

type Source = "all" | "bin" | "household";
type Tab = "overview" | "monthly" | "daily";

/* /districtbody/{monthly,daily}-waste-comparison/ (app/utils/leader_comparison.py) */
type LbComparisonResponse = {
  kpis: {
    total_actual_weight: number; total_trips: number; collection_points_covered: number;
    average_weight_per_trip: number; waste_type_count: number; local_body_count: number;
  };
  trends: Array<{ period: string; total_actual_weight: number; total_trips: number }>;
  waste_type_breakdown: Array<{ waste_type_id: string; waste_type: string; total_actual_weight: number; share_percent: number }>;
  comparison: Array<{
    id: string; type: MapLocalBody["type"]; name: string; total_actual_weight: number;
    total_trips: number; collection_points_covered: number; average_weight_per_trip: number;
  }>;
  results: Array<{
    unique_id: string; period: string; id: string; type: MapLocalBody["type"]; name: string;
    waste_type_id: string; waste_type: string; total_actual_weight: number; total_trips: number;
  }>;
  results_total: number;
};

/** a comparison response tagged with the request key ([tab, params]) it answers */
type Keyed = { key: string; data: LbComparisonResponse | null };

const fetchComparison = (key: string, set: (k: Keyed) => void, isCancelled: () => boolean) => {
  const [t, params] = JSON.parse(key) as [Tab, Record<string, string>];
  dbApi
    .get<LbComparisonResponse>(`/districtbody/${t}-waste-comparison/`, { params })
    .then(({ data }) => { if (!isCancelled()) set({ key, data }); })
    .catch(() => { if (!isCancelled()) set({ key, data: null }); });
};

const toCmpView = (d: LbComparisonResponse): CmpView => ({
  kpis: {
    weight: d.kpis.total_actual_weight, trips: d.kpis.total_trips, points: d.kpis.collection_points_covered,
    avg: d.kpis.average_weight_per_trip, groups: d.kpis.local_body_count, wasteTypes: d.kpis.waste_type_count,
  },
  trend: d.trends.map((t) => ({ label: t.period, weight: t.total_actual_weight })),
  breakdown: d.waste_type_breakdown.map((w) => ({ name: w.waste_type, weight: w.total_actual_weight })),
  detail: d.results.map((r) => ({ key: r.unique_id, period: r.period, id: r.id, name: r.name, wasteType: r.waste_type, weight: r.total_actual_weight, trips: r.total_trips })),
  detailTotal: d.results_total,
});
type SideTab = "category" | "wards" | "status";
type OpsTab = "collection" | "grievances" | "fleet" | "segregation";

const matches = (lb: MapLocalBody, f: LbFilter) => f === "all" || f === lb.category || f === lb.type;
const ACTIVE_COLOR = SERIES[2];
const INACTIVE_COLOR = "#c3c2b7";

export default function DistrictDashboard() {
  const navigate = useNavigate();
  const leaderName = localStorage.getItem("db_leader_name") ?? "Leader";

  useEffect(() => {
    const role = localStorage.getItem("db_role");
    const token = localStorage.getItem("db_access_token");
    if (role !== "district_leader" || !token) navigate("/district", { replace: true });
  }, [navigate]);

  /* ── filters ── */
  const [month, setMonth] = useState(currentMonth());
  const [source, setSource] = useState<Source>("all");
  const [lbFilter, setLbFilter] = useState<LbFilter>("all");
  const [sideTab, setSideTab] = useState<SideTab>("category");
  const [opsTab, setOpsTab] = useState<OpsTab>("collection");
  const [search, setSearch] = useState("");

  /* ── data ── */
  const [mapData, setMapData] = useState<LeaderMapPayload | null>(null);
  const [summary, setSummary] = useState<LeaderSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    dbApi
      .get<LeaderMapPayload>("/districtbody/map/", { params: { month: month || currentMonth(), source } })
      .then(({ data }) => {
        if (cancelled) return;
        setError("");
        setMapData(data);
        if (data?.district_name) localStorage.setItem("db_district_name", data.district_name);
      })
      .catch(() => { if (!cancelled) { setMapData(null); setError("Unable to load the district's local bodies."); } });
    return () => { cancelled = true; };
  }, [month, source]);

  useEffect(() => {
    let cancelled = false;
    dbApi
      .get<LeaderSummary>("/districtbody/summary/", { params: { source } })
      .then(({ data }) => { if (!cancelled) setSummary(data); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [source]);

  const districtName = mapData?.district_name || localStorage.getItem("db_district_name") || "District";
  const lbs = useMemo(() => mapData?.local_bodies ?? [], [mapData]);
  const monthLabel = new Date(`${month || currentMonth()}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  /* ── Monthly / Daily tabs: local-body comparison ──
     `all` (every local body) feeds the map and the comparison table; a
     local body picked on the map / in a table re-requests the same
     comparison narrowed to it for the KPIs, charts and detailed rows.
     Responses are keyed by tab + filters (+ pick) so a slow, stale reply
     is never shown for a newer choice. */
  const [tab, setTab] = useState<Tab>("overview");
  const [cmMonth, setCmMonth] = useState("");
  const [cmSource, setCmSource] = useState<Source>("bin");
  const [cmSort, setCmSort] = useState<"weight" | "trips">("weight");
  const [cdMonth, setCdMonth] = useState(currentMonth());
  const [cdDate, setCdDate] = useState("");
  const [cdSource, setCdSource] = useState<Source>("bin");
  const [cdSort, setCdSort] = useState<"weight" | "trips">("weight");
  const [cmpLbId, setCmpLbId] = useState<string | null>(null);
  const [cmpTable, setCmpTable] = useState<CmpTable>("comparison");

  const cmpTab = tab === "overview" ? null : tab;
  const cmpParams: Record<string, string> | null =
    cmpTab === "monthly"
      ? { source: cmSource, sort: cmSort, ...(cmMonth ? { month: cmMonth } : {}) }
      : cmpTab === "daily"
        ? { source: cdSource, sort: cdSort, ...(cdDate ? { date: cdDate } : cdMonth ? { month: cdMonth } : {}) }
        : null;
  const allKey = cmpTab && cmpParams ? JSON.stringify([cmpTab, cmpParams]) : null;
  const scopedKey = allKey && cmpLbId ? JSON.stringify([cmpTab, { ...cmpParams, local_body_id: cmpLbId }]) : null;
  const [allResp, setAllResp] = useState<Keyed | null>(null);
  const [scopedResp, setScopedResp] = useState<Keyed | null>(null);

  useEffect(() => {
    if (!allKey) return;
    let cancelled = false;
    fetchComparison(allKey, setAllResp, () => cancelled);
    return () => { cancelled = true; };
  }, [allKey]);
  useEffect(() => {
    if (!scopedKey) return;
    let cancelled = false;
    fetchComparison(scopedKey, setScopedResp, () => cancelled);
    return () => { cancelled = true; };
  }, [scopedKey]);

  /* ── per-type summary (category cards, category / wards / status donuts) ── */
  const byType = useMemo(
    () =>
      LB_TYPES.map((t) => {
        const rows = lbs.filter((l) => l.type === t);
        return {
          type: t,
          count: rows.length,
          active: rows.filter((l) => l.is_active).length,
          wards: TYPE_CATEGORY[t] === "ulb" ? rows.reduce((a, l) => a + (l.wards ?? 0), 0) : null,
        };
      }),
    [lbs]
  );
  const totals = useMemo(
    () => ({
      count: lbs.length,
      active: lbs.filter((l) => l.is_active).length,
      wards: byType.reduce((a, t) => a + (t.wards ?? 0), 0),
    }),
    [lbs, byType]
  );

  /* ── details table ── */
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lbs
      .filter((l) => matches(l, lbFilter) && (!q || l.name.toLowerCase().includes(q)))
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  }, [lbs, lbFilter, search]);

  const detailsRef = useRef<HTMLDivElement>(null);

  const exportReport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        tableRows.map((l) => ({
          "Local body": l.name,
          Type: TYPE_LABEL[l.type],
          Category: l.category.toUpperCase(),
          Wards: l.wards ?? "",
          Status: l.is_active ? "Active" : "Inactive",
          [`Collected kg (${monthLabel})`]: l.weight,
          Trips: l.trips,
          "Points covered": l.points,
        }))
      ),
      "Local bodies"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byType.map((t) => ({ Type: TYPE_LABEL[t.type], Count: t.count, Active: t.active, Wards: t.wards ?? "" }))),
      "By type"
    );
    if (summary)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(summary.trend.map((d) => ({ Date: d.date, "Collected kg": d.weight, Trips: d.trips, ...d.by_type }))),
        "Last 7 days"
      );
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([out], { type: "application/octet-stream" }), `${districtName}_district_report_${month}.xlsx`);
  };

  /* ── chart data ── */
  // pie charts keep their categorical colours; the 7-day trend lines use sky shades
  const wasteColors = useMemo(() => wasteTypeColors(summary?.waste_types ?? []), [summary]);
  const wasteLineColors = useMemo(() => skyShades(summary?.waste_types ?? []), [summary]);
  const trendData = useMemo(
    () => (summary?.trend ?? []).map((d) => ({ date: d.date, ...Object.fromEntries((summary?.waste_types ?? []).map((w) => [w, d.by_type[w] ?? 0])) })),
    [summary]
  );

  const sideDonut = (() => {
    if (sideTab === "category")
      return { data: byType.map((t) => ({ name: TYPE_LABEL[t.type], value: t.count, color: TYPE_COLOR[t.type] })), center: fmtInt(totals.count), label: "local bodies" };
    if (sideTab === "wards")
      return {
        data: byType.filter((t) => t.wards != null).map((t) => ({ name: TYPE_LABEL[t.type], value: t.wards ?? 0, color: TYPE_COLOR[t.type] })),
        center: fmtInt(totals.wards),
        label: "wards (ULB)",
      };
    return {
      data: [
        { name: "Active", value: totals.active, color: ACTIVE_COLOR },
        { name: "Inactive", value: totals.count - totals.active, color: INACTIVE_COLOR },
      ],
      center: fmtInt(totals.active),
      label: "active",
    };
  })();

  function renderComparison() {
    const monthly = tab === "monthly";
    const allReady = !!allKey && allResp?.key === allKey;
    const all = allReady ? allResp!.data : null;
    const scopedReady = !!scopedKey && scopedResp?.key === scopedKey;
    const view = cmpLbId ? (scopedReady ? scopedResp!.data : null) : all;
    const byId = new Map((all?.comparison ?? []).map((r) => [r.id, r]));
    const lbById = new Map(lbs.map((l) => [l.id, l]));
    const pickedName = cmpLbId ? byId.get(cmpLbId)?.name ?? lbById.get(cmpLbId)?.name ?? cmpLbId : null;
    const sort = monthly ? cmSort : cdSort;
    const field = selectCls;
    const label = "mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500";

    // the district map re-coloured with this tab's per-local-body figures
    const cmpMapData: LeaderMapPayload | null = mapData && {
      ...mapData,
      local_bodies: mapData.local_bodies.map((l) => {
        const r = byId.get(l.id);
        return { ...l, weight: r?.total_actual_weight ?? 0, trips: r?.total_trips ?? 0, points: r?.collection_points_covered ?? 0 };
      }),
      totals: { weight: all?.kpis.total_actual_weight ?? 0, trips: all?.kpis.total_trips ?? 0, points: all?.kpis.collection_points_covered ?? 0 },
    };

    const sourceSelect = (value: Source, set: (v: Source) => void) => (
      <div>
        <label className={label}>Source</label>
        <select value={value} onChange={(e) => set(e.target.value as Source)} className={field}>
          <option value="bin">Bin collection</option>
          <option value="household">Household collection</option>
          <option value="all">All sources</option>
        </select>
      </div>
    );
    const sortSelect = (value: "weight" | "trips", set: (v: "weight" | "trips") => void) => (
      <div>
        <label className={label}>Sort by</label>
        <select value={value} onChange={(e) => set(e.target.value as "weight" | "trips")} className={field}>
          <option value="weight">Weight</option>
          <option value="trips">Trips</option>
        </select>
      </div>
    );
    const filters = monthly ? (
      <>
        <div>
          <label className={label}>Month</label>
          <input type="month" value={cmMonth} onChange={(e) => setCmMonth(e.target.value)} className={field} />
        </div>
        {sourceSelect(cmSource, setCmSource)}
        {sortSelect(cmSort, setCmSort)}
        {cmMonth && (
          <button onClick={() => setCmMonth("")} className={`${field} font-semibold hover:bg-amber-50`}>Clear month (show all)</button>
        )}
      </>
    ) : (
      <>
        <div>
          <label className={label}>Month</label>
          <input type="month" value={cdMonth} onChange={(e) => { setCdMonth(e.target.value); setCdDate(""); }} className={field} />
        </div>
        <div>
          <label className={label}>Specific date (optional)</label>
          <input type="date" value={cdDate} onChange={(e) => setCdDate(e.target.value)} className={field} />
        </div>
        {sourceSelect(cdSource, setCdSource)}
        {sortSelect(cdSort, setCdSort)}
        {cdDate && (
          <button onClick={() => setCdDate("")} className={`${field} font-semibold hover:bg-amber-50`}>Clear date (show month)</button>
        )}
      </>
    );

    return (
      <ComparisonView
        granularity={monthly ? "month" : "day"}
        filters={filters}
        error={allReady && !all ? "Unable to load the local-body comparison." : undefined}
        entity={{ one: "Local body", many: "Local bodies" }}
        view={view ? toCmpView(view) : null}
        viewLoading={!allReady || (!!cmpLbId && !scopedReady)}
        comparison={(all?.comparison ?? []).map((r) => ({
          id: r.id, name: r.name, weight: r.total_actual_weight, trips: r.total_trips,
          points: r.collection_points_covered, avg: r.average_weight_per_trip,
        }))}
        comparisonLoading={!allReady}
        picked={cmpLbId && pickedName ? { id: cmpLbId, name: pickedName } : null}
        onPick={setCmpLbId}
        sort={sort}
        wasteColors={wasteTypeColors(
          summary?.waste_types?.length ? summary.waste_types : (all?.waste_type_breakdown ?? []).map((w) => w.waste_type)
        )}
        trendNote={monthly ? (cmMonth ? "selected month" : "all months") : cdDate || "this month"}
        table={cmpTable}
        onTableChange={setCmpTable}
        nameCell={(id, name) => {
          const t = byId.get(id)?.type ?? lbById.get(id)?.type;
          return (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate">{name}</span>
              {t && <span className="shrink-0 text-[10px] font-normal text-gray-400">{TYPE_LABEL[t]}</span>}
            </span>
          );
        }}
        map={
          <LeaderGeoMap
            mode="district"
            data={cmpMapData}
            showSummary={false}
            selectedLocalBodyId={cmpLbId}
            onSelectLocalBody={(id) => { setCmpLbId(id); if (id) setCmpTable("rows"); }}
          />
        }
      />
    );
  }

  const selectCls =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100";

  return (
    <ChartAccent.Provider value={DISTRICT_ACCENT}>
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 font-sans">
      {/* ── header ── */}
      <header className="z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <img src={ZigmaLogo} className="h-9 w-9 rounded-lg object-contain p-0.5 ring-1 ring-slate-200" alt="Zigma" />
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold text-gray-900">{districtName}</h1>
            <p className="text-[11px] text-gray-500">District overview{mapData?.state_name ? ` · ${mapData.state_name}` : ""}</p>
          </div>
        </div>
        <Segmented
          size="md"
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "monthly", label: "Monthly" },
            { value: "daily", label: "Daily" },
          ]}
        />
        {tab === "overview" && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls} title="Month" />
          <select value={lbFilter} onChange={(e) => setLbFilter(e.target.value as LbFilter)} className={selectCls} title="Local bodies">
            <option value="all">All local bodies</option>
            <optgroup label="Urban (ULB)">
              <option value="ulb">All ULB</option>
              {LB_TYPES.filter((t) => TYPE_CATEGORY[t] === "ulb").map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </optgroup>
            <optgroup label="Rural (RLB)">
              <option value="rlb">All RLB</option>
              {LB_TYPES.filter((t) => TYPE_CATEGORY[t] === "rlb").map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </optgroup>
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as Source)} className={selectCls} title="Source">
            <option value="all">All sources</option>
            <option value="bin">Bin collection</option>
            <option value="household">Household collection</option>
          </select>
        </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {tab === "overview" && (
          <>
          <button
            onClick={() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-slate-50"
          >
            <TableProperties size={13} /> View details table
          </button>
          <button
            onClick={exportReport}
            disabled={!mapData}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            <Download size={13} /> Export report
          </button>
          </>
          )}
          <span className="mx-1 hidden h-7 w-px bg-slate-200 sm:block" />
          <span className="hidden text-xs font-semibold text-gray-900 sm:block">{leaderName}</span>
          <button
            onClick={() => { clearDistrictSession(); navigate("/district", { replace: true }); }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      {/* ── scrollable dashboard body ── */}
      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tab !== "overview" ? renderComparison() : (
        <div className="flex flex-col gap-3 lg:h-full">
        {error && <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

        {/* KPI row: one card per local-body type · total · period collection */}
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.05fr)_minmax(0,1.7fr)]">
          {byType.map((t) => (
            <button
              key={t.type}
              onClick={() => setLbFilter(lbFilter === t.type ? "all" : t.type)}
              className={`relative min-w-0 overflow-hidden rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md ${
                lbFilter === t.type ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
              }`}
              title={`Show only ${TYPE_LABEL[t.type]}s on the map and in the table`}
            >
              <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: MAP_LINE }} />
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-500">{TYPE_LABEL[t.type]}</p>
              <p className="mt-1 text-[26px] font-bold leading-none tabular-nums tracking-tight text-gray-900">{mapData ? fmtInt(t.count) : <Shimmer className="mt-0.5 h-6 w-14" />}</p>
              <p className="mt-1.5 truncate text-[11px] text-gray-500">
                {t.wards != null && `${fmtInt(t.wards)} ward${t.wards === 1 ? "" : "s"} · `}
                {fmtInt(t.active)} active
              </p>
            </button>
          ))}
          <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 shadow-sm">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-300">Total local bodies</p>
            <p className="mt-1 text-[26px] font-bold leading-none tabular-nums tracking-tight text-white">{mapData ? fmtInt(totals.count) : <Shimmer className="mt-0.5 h-6 w-16 bg-slate-700" />}</p>
            <p className="mt-1.5 truncate text-[11px] text-slate-400">{fmtInt(totals.wards)} ward{totals.wards === 1 ? "" : "s"} · {fmtInt(totals.active)} active</p>
          </div>
          <div className="col-span-2 grid min-w-0 grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 bg-white py-3 shadow-sm md:col-span-3 xl:col-span-1">
            {(["today", "week", "month"] as const).map((k) => {
              const p = summary?.periods[k];
              const w = weightParts(p?.weight ?? 0);
              return (
                <div key={k} className="min-w-0 px-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{{ today: "Daily", week: "Weekly", month: "Monthly" }[k]}</p>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold leading-none tabular-nums text-gray-900">{summary ? w.value : <Shimmer className="h-5 w-12" />}</span>
                    <span className="text-[10px] font-semibold text-gray-500">{w.unit}</span>
                  </p>
                  <p className="mt-1.5 text-[11px]">{summary ? <Change pct={p?.change_percent ?? null} /> : " "}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* map · analytics · table — side by side, filling the viewport; the
            analytics column and the table scroll inside their own panels */}
        <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.2fr)]">
          {/* 1 — map */}
          <div className="relative h-[460px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-[380px]">
            <LeaderGeoMap mode="district" data={mapData} lbFilter={lbFilter} onLbFilterChange={setLbFilter} />
          </div>

          {/* 2 — analytics */}
          <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
            <Card
              title={
                <Segmented
                  value={sideTab}
                  onChange={setSideTab}
                  options={[
                    { value: "category", label: "Category" },
                    { value: "wards", label: "Wards" },
                    { value: "status", label: "Status" },
                  ]}
                />
              }
              className="shrink-0"
            >
              {mapData ? <Donut data={sideDonut.data} center={sideDonut.center} centerLabel={sideDonut.label} /> : <Spinner />}
            </Card>

            <Card
              title={
                <Segmented
                  value={opsTab}
                  onChange={setOpsTab}
                  options={[
                    { value: "collection", label: "Collection" },
                    { value: "grievances", label: "Grievances" },
                    { value: "fleet", label: "Fleet" },
                    { value: "segregation", label: "Segregation" },
                  ]}
                />
              }
              className="shrink-0"
            >
              {!summary ? (
                <Spinner />
              ) : opsTab === "collection" ? (
                <>
                  <p className="mb-2 text-[11px] text-gray-500">
                    {summary.today_breakdown.length ? "Today's breakdown" : `No collection logged today — ${monthLabel} so far`}
                  </p>
                  {(() => {
                    const rows = summary.today_breakdown.length ? summary.today_breakdown : summary.month_breakdown;
                    const total = rows.reduce((a, r) => a + r.weight, 0);
                    return (
                      <Donut
                        data={rows.map((r) => ({ name: r.waste_type, value: r.weight, color: wasteColors[r.waste_type] ?? "#8f8d86" }))}
                        center={weightParts(total).value}
                        centerLabel={weightParts(total).unit}
                        format={fmtWeight}
                      />
                    );
                  })()}
                </>
              ) : opsTab === "grievances" ? (
                <>
                  <p className="mb-2 text-[11px] text-gray-500">
                    {fmtInt(summary.grievances.open)} open · {fmtInt(summary.grievances.this_month)} raised this month
                  </p>
                  <Donut
                    data={summary.grievances.by_status.map((r, i) => ({ name: r.status, value: r.count, color: SERIES[i] ?? "#8f8d86" }))}
                    center={fmtInt(summary.grievances.total)}
                    centerLabel="tickets"
                  />
                </>
              ) : opsTab === "fleet" ? (
                <>
                  <p className="mb-2 text-[11px] text-gray-500">
                    {fmtInt(summary.fleet.on_trip_today)} on a trip today · {fmtInt(summary.fleet.open_breakdowns)} open breakdown{summary.fleet.open_breakdowns === 1 ? "" : "s"}
                  </p>
                  <Donut
                    data={[
                      { name: "Active", value: summary.fleet.active, color: ACTIVE_COLOR },
                      { name: "Inactive", value: summary.fleet.inactive, color: INACTIVE_COLOR },
                    ]}
                    center={fmtInt(summary.fleet.total)}
                    centerLabel="vehicles"
                  />
                </>
              ) : (
                <>
                  <p className="mb-2 text-[11px] text-gray-500">Waste-type mix · {monthLabel} so far</p>
                  {(() => {
                    const total = summary.month_breakdown.reduce((a, r) => a + r.weight, 0);
                    return (
                      <Donut
                        data={summary.month_breakdown.map((r) => ({ name: r.waste_type, value: r.weight, color: wasteColors[r.waste_type] ?? "#8f8d86" }))}
                        center={weightParts(total).value}
                        centerLabel={weightParts(total).unit}
                        format={fmtWeight}
                      />
                    );
                  })()}
                </>
              )}
            </Card>

            <Card title="7-day collection trend" right={<span className="text-[11px] text-gray-500">kg / day</span>} className="shrink-0" bodyClassName="h-[240px]">
          {summary ? (
            <MultiLineTrend
              data={trendData}
              series={(summary.waste_types ?? []).map((w) => ({ key: w, color: wasteLineColors[w] }))}
              format={fmtWeight}
            />
          ) : (
                <Spinner />
              )}
            </Card>
          </div>

          {/* 3 — local bodies table */}
          <div ref={detailsRef} className="flex h-[520px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-auto">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
              <p className="text-[13px] font-bold text-gray-900">
                Local bodies <span className="font-normal text-gray-500">· {monthLabel} · {fmtInt(tableRows.length)} shown</span>
              </p>
              <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm focus-within:ring-2 focus-within:ring-sky-100">
                <Search size={13} className="text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search local body…" className="w-40 bg-transparent outline-none" />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2 font-semibold">Local body</th>
                    <th className="px-3 py-2 text-right font-semibold">Wards</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Collected</th>
                    <th className="px-3 py-2 text-right font-semibold">Trips</th>
                    <th className="px-3 py-2 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {!mapData ? (
                    <tr><td colSpan={6}><Spinner /></td></tr>
                  ) : tableRows.length === 0 ? (
                    <tr><td colSpan={6}><EmptyNote>No local bodies match.</EmptyNote></td></tr>
                  ) : (
                    tableRows.map((l) => (
                      <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-amber-50/40">
                        <td className="px-3 py-2">
                          <span className="block font-medium text-gray-900">{l.name}</span>
                          <span className="text-[10px] text-gray-500">{TYPE_LABEL[l.type]} · {l.category.toUpperCase()}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.wards != null ? fmtInt(l.wards) : "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${l.is_active ? "text-green-700" : "text-slate-500"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${l.is_active ? "bg-green-500" : "bg-slate-400"}`} />
                            {l.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtWeight(l.weight)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtInt(l.trips)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtInt(l.points)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
        )}
      </main>
    </div>
    </ChartAccent.Provider>
  );
}
