import type { DailyReportResponse, DailyReportRow } from "./types";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  MapPin,
  Pencil,
  Plus,
  Scale,
  TrendingDown,
  TrendingUp,
  Trash2,
  Truck,
} from "lucide-react";
import Swal from "@/lib/notify";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useTranslation } from "react-i18next";
import { dailyWasteComparisonApi } from "@/helpers/admin";
import { api } from "@/api";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";

/* ── Types ───────────────────────────────────────────────────────── */


const initialKpis: DailyReportResponse["kpis"] = {
  total_agreed_weight_kg: 0,
  total_actual_weight_kg: 0,
  variance_kg: 0,
  collection_efficiency_percent: 0,
  average_weight_per_trip: 0,
  coverage_efficiency_percent: 0,
  total_trips: 0,
  collection_points_covered: 0,
  report_status: "On Target",
};

const todayValue = () => new Date().toISOString().split("T")[0];

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmtKg = (v?: number | string | null, dec = 2) => {
  const n = Number(v);
  return Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: dec });
};
const fmtAxis = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

const effColor = (e: number) =>
  e >= 90
    ? {
        text: "text-green-600",
        bg: "bg-green-500",
        ring: "border-green-200 bg-green-50",
      }
    : e >= 70
      ? {
          text: "text-amber-600",
          bg: "bg-amber-400",
          ring: "border-amber-200 bg-amber-50",
        }
      : {
          text: "text-red-600",
          bg: "bg-red-500",
          ring: "border-red-200 bg-red-50",
        };

const statusBadgeCls = (s: string) =>
  s === "Surplus"
    ? "bg-green-100 text-green-800 border-green-200"
    : s === "Deficit"
      ? "bg-red-100 text-red-800 border-red-200"
      : "bg-blue-100 text-blue-800 border-blue-200";

/* ── PLB Efficiency Row ─────────────────────────────────────────── */
const PlbEffRow = ({ plb }: { plb: any }) => {
  const eff = Math.min(Number(plb.collection_efficiency_percent ?? 0), 100);
  const agreed = Number(plb.agreed_weight_kg ?? plb.total_agreed_weight ?? 0);
  const actual = Number(plb.actual_weight_kg ?? plb.total_actual_weight ?? 0);
  const c = effColor(eff);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-24 shrink-0">
        <p className="text-xs font-semibold text-gray-800 truncate">
          {plb.panchayat_name ?? plb.panchayat_id}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {fmtKg(actual)} / {fmtKg(agreed)} kg
        </p>
      </div>
      <div className="flex-1">
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${c.bg}`}
            style={{ width: `${eff}%` }}
          />
        </div>
      </div>
      <div className="w-14 text-right shrink-0">
        <span className={`text-xs font-bold ${c.text}`}>{eff.toFixed(1)}%</span>
      </div>
      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusBadgeCls(plb.report_status)}`}
      >
        {plb.report_status}
      </span>
    </div>
  );
};

/* ── Stat Cell ───────────────────────────────────────────────────── */
const StatCell = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) => (
  <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
    <span className="text-xs font-medium text-gray-500">{label}</span>
    <span className="text-2xl font-bold text-gray-800 leading-none">
      {value}
    </span>
  </div>
);

/* ── Tooltip components ──────────────────────────────────────────── */
const DateTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[150px]">
      <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
        <Calendar className="h-3 w-3" /> {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mt-1">
          <span style={{ color: p.stroke ?? p.fill }}>{p.name}</span>
          <span className="font-bold">{fmtKg(p.value)} kg</span>
        </div>
      ))}
    </div>
  );
};

const PLBTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mt-1">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-bold">{fmtKg(p.value)} kg</span>
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
    MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function DailyWasteComparisonList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [dateValue, setDateValue] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [sortMode, setSortMode] = useState("absolute");
  const [source, setSource] = useState("bin");
  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [dateTrends, setDateTrends] = useState<
    DailyReportResponse["date_trends"]
  >([]);
  const [plbCompare, setPlbCompare] = useState<
    DailyReportResponse["panchayat_comparison"]
  >([]);
  const [kpis, setKpis] = useState<DailyReportResponse["kpis"]>(initialKpis);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const { encScheduleMasters, encDailyWasteComparison } = getEncryptedRoute();
  const { newPath: dailyComparisonNewPath, editPath: dailyComparisonEditPath } =
    createCrudRoutePaths(encScheduleMasters, encDailyWasteComparison);

  /* ── fetch ── */
  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { sort: sortMode, source };
      if (appliedDate) params.date = appliedDate;

      const { data } = await api.get<DailyReportResponse>(
        "/schedule-masters/daily-waste-comparisons/",
        { params },
      );
      setRows(Array.isArray(data?.results) ? data.results : []);
      setDateTrends(Array.isArray(data?.date_trends) ? data.date_trends : []);
      setPlbCompare(
        Array.isArray(data?.panchayat_comparison)
          ? data.panchayat_comparison
          : [],
      );
      setKpis(data?.kpis ?? initialKpis);
    } catch {
      setRows([]);
      setDateTrends([]);
      setPlbCompare([]);
      setKpis(initialKpis);
      setError("Unable to load daily waste comparison data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, [appliedDate, sortMode, source]);

  /* ── delete ── */
  const handleDelete = async (row: DailyReportRow) => {
    const result = await Swal.fire({
      title: t("common.are_you_sure"),
      text: `Delete record for ${row.panchayat_name ?? row.panchayat_id} — ${row.collection_date}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: t("common.delete"),
      cancelButtonText: t("common.cancel"),
    });
    if (!result.isConfirmed) return;
    try {
      await dailyWasteComparisonApi.delete(row.unique_id);
      await fetchReport();
      Swal.fire(t("common.success"), t("common.deleted_success"), "success");
    } catch {
      Swal.fire(t("common.error"), "Failed to delete record.", "error");
    }
  };

  /* ── derived ── */
  const eff = Number(kpis.collection_efficiency_percent ?? 0);
  const effC = effColor(eff);
  const reportStatus = kpis.report_status ?? "On Target";

  const plbChartData = useMemo(
    () =>
      (plbCompare as any[]).slice(0, 8).map((p) => ({
        name: String(p.panchayat_name ?? p.panchayat_id).replace(
          "Panchayat ",
          "PLB ",
        ),
        Agreed: Number(p.agreed_weight_kg ?? p.total_agreed_weight ?? 0),
        Actual: Number(p.actual_weight_kg ?? p.total_actual_weight ?? 0),
      })),
    [plbCompare],
  );

  const handleDownload = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { sort: sortMode, source };
      if (appliedDate) params.date = appliedDate;

      const exportRows = await dailyWasteComparisonApi.readAllForExport({
        params,
      });
      exportRecordsToExcel(
        exportRows.map((r) => ({
          Date: r.collection_date,
          PLB: r.panchayat_name ?? r.panchayat_id,
          "Waste Type": r.waste_type,
          "Agreed (kg)": r.agreed_weight_kg,
          "Actual (kg)": r.actual_weight_kg,
          "Variance (kg)": r.variance_kg,
          "Variance %": r.variance_percent,
          Status: r.report_status,
          Trips: r.total_trips,
          Points: r.collection_points_covered,
        })),
        getAdminScreenExcelFilename("all"),
        "Daily Waste Comparison",
      );
    } catch {
      Swal.fire(
        t("common.error"),
        "Failed to download daily waste comparison data.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════
      RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-5 space-y-5 bg-gray-50 min-h-screen font-sans">
      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Daily Waste Collection Comparison
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daily aggregate — agreed vs actual by PLB and waste type
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateValue}
            max={todayValue()}
            onChange={(e) => setDateValue(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="absolute">Highest variance</option>
            <option value="deficit">Highest deficit</option>
            <option value="surplus">Highest surplus</option>
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="bin">Bin Collection</option>
            <option value="household">Household Collection</option>
            <option value="all">All Sources</option>
          </select>
          <button
            onClick={() => setAppliedDate(dateValue)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Go
          </button>
          <button
            onClick={() => {
              setDateValue("");
              setAppliedDate("");
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            All Dates
          </button>
          <button
            onClick={handleDownload}
            disabled={!rows.length || exporting}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />{" "}
            {exporting ? "Downloading..." : "Download All"}
          </button>
          <button
            onClick={() =>
              navigate(dailyComparisonNewPath)
            }
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Record
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── 6 KPI cards (admin-style border-t-4) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          {
            label: "Collection Efficiency",
            value: `${fmtKg(kpis.collection_efficiency_percent)}%`,
            accent: "border-t-green-500",
            icon: <Activity className="h-4 w-4" />,
          },
          {
            label: "Total Variance",
            value: `${fmtKg(kpis.variance_kg)} kg`,
            accent:
              Number(kpis.variance_kg) >= 0
                ? "border-t-emerald-500"
                : "border-t-red-500",
            icon:
              Number(kpis.variance_kg) >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              ),
          },
          {
            label: "Total Trips",
            value: fmtKg(kpis.total_trips, 0),
            accent: "border-t-teal-500",
            icon: <Truck className="h-4 w-4" />,
          },
          {
            label: "Points Covered",
            value: fmtKg(kpis.collection_points_covered, 0),
            accent: "border-t-pink-500",
            icon: <MapPin className="h-4 w-4" />,
          },
          {
            label: "Agreed Weight",
            value: `${fmtKg(kpis.total_agreed_weight_kg)} kg`,
            accent: "border-t-indigo-500",
            icon: <BarChart3 className="h-4 w-4" />,
          },
          {
            label: "Actual Weight",
            value: `${fmtKg(kpis.total_actual_weight_kg)} kg`,
            accent: "border-t-cyan-500",
            icon: <Scale className="h-4 w-4" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-t-4 ${k.accent} flex flex-col gap-2 p-4`}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-gray-500 leading-tight">
                {k.label}
              </p>
              <span className="text-gray-400">{k.icon}</span>
            </div>
            <p className="text-xl font-bold text-gray-800 leading-none">
              {loading ? "—" : k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Date-wise trend — Area chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">
            Date-wise Collection Trend
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Agreed vs Actual collection weight per date
          </p>
          {dateTrends.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No trend data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={dateTrends}
                margin={{ top: 6, right: 20, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="gradAgreedD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradActualD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                  vertical={false}
                />
                <XAxis
                  dataKey="collection_date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <Tooltip content={<DateTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="agreed_weight_kg"
                  name="Agreed"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  fill="url(#gradAgreedD)"
                  dot={{
                    r: 4,
                    fill: "#2563eb",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="actual_weight_kg"
                  name="Actual"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="url(#gradActualD)"
                  dot={{
                    r: 4,
                    fill: "#16a34a",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* PLB Efficiency — progress bars */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">
            PLB Collection Efficiency
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Actual ÷ Agreed — per PLB (Participating Local Body)
          </p>
          {plbCompare.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No PLB data yet.
            </div>
          ) : (
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {(plbCompare as any[]).slice(0, 10).map((p, i) => (
                <PlbEffRow key={i} plb={p} />
              ))}
            </div>
          )}
        </div>

        {/* PLB Agreed vs Actual — grouped bar (full width) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-800">
            PLB Collection — Agreed vs Actual
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Side-by-side daily totals per PLB&nbsp;·&nbsp;
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-300 mr-1 align-middle" />
            Agreed&nbsp;&nbsp;
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-600 mr-1 align-middle" />
            Actual
          </p>
          {plbChartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={plbChartData}
                margin={{ top: 6, right: 16, left: 0, bottom: 56 }}
                barCategoryGap="30%"
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  angle={-35}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxis}
                />
                <Tooltip content={<PLBTooltip />} />
                <Legend
                  iconType="square"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11, paddingTop: 14 }}
                />
                <Bar
                  dataKey="Agreed"
                  fill="#93c5fd"
                  maxBarSize={36}
                  radius={[3, 3, 0, 0]}
                >
                  {plbChartData.map((_, i) => (
                    <Cell key={i} fill="#93c5fd" />
                  ))}
                </Bar>
                <Bar
                  dataKey="Actual"
                  fill="#16a34a"
                  maxBarSize={36}
                  radius={[3, 3, 0, 0]}
                >
                  {plbChartData.map((e, i) => (
                    <Cell
                      key={i}
                      fill={e.Actual >= e.Agreed ? "#16a34a" : "#f97316"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SINGLE DAILY SUMMARY RECORD
      ══════════════════════════════════════════════════════ */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Card header */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-100"
            style={{
              background: "linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-600 flex items-center justify-center shadow-sm">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-800">
                  Daily Collection Summary
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Totals for&nbsp;
                  <span className="font-semibold text-green-700">
                    {appliedDate || "All Dates"}
                  </span>
                  &nbsp;·&nbsp;{rows.length} record
                  {rows.length !== 1 ? "s" : ""} combined
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeCls(reportStatus)}`}
            >
              {reportStatus === "Deficit" && (
                <TrendingDown className="h-3 w-3" />
              )}
              {reportStatus === "Surplus" && <TrendingUp className="h-3 w-3" />}
              {reportStatus}
            </span>
          </div>

          {/* 4 main stat cells */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCell
              label="Total Agreed Weight"
              value={`${fmtKg(kpis.total_agreed_weight_kg)} kg`}
              color="border-blue-100 bg-blue-50"
            />
            <StatCell
              label="Total Actual Weight"
              value={`${fmtKg(kpis.total_actual_weight_kg)} kg`}
              color="border-green-100 bg-green-50"
            />
            <StatCell
              label="Total Variance"
              value={`${fmtKg(kpis.variance_kg)} kg`}
              color={
                Number(kpis.variance_kg) >= 0
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-red-100 bg-red-50"
              }
            />
            <StatCell
              label="Collection Efficiency"
              value={`${fmtKg(kpis.collection_efficiency_percent)}%`}
              color={`${effC.ring} border`}
            />
          </div>

          {/* Efficiency progress bar */}
          <div className="px-6 pb-5">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-medium">Actual vs Agreed Target</span>
              <span className={`font-bold ${effC.text}`}>{fmtKg(eff)}%</span>
            </div>
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${effC.bg}`}
                style={{ width: `${Math.min(eff, 100)}%` }}
              />
              {eff >= 10 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                  {fmtKg(kpis.total_actual_weight_kg)} /{" "}
                  {fmtKg(kpis.total_agreed_weight_kg)} kg
                </span>
              )}
            </div>
          </div>

          {/* Footer stats row */}
          <div className="border-t border-gray-100 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50/60">
            {[
              {
                label: "Total Trips",
                value: fmtKg(kpis.total_trips, 0),
                icon: <Truck className="h-4 w-4 text-teal-500" />,
              },
              {
                label: "Points Covered",
                value: fmtKg(kpis.collection_points_covered, 0),
                icon: <MapPin className="h-4 w-4 text-pink-500" />,
              },
              {
                label: "Coverage Efficiency",
                value: `${fmtKg(kpis.coverage_efficiency_percent ?? 0)}%`,
                icon: <Activity className="h-4 w-4 text-purple-500" />,
              },
              {
                label: "Avg Weight / Trip",
                value: `${fmtKg(kpis.average_weight_per_trip ?? 0)} kg`,
                icon: <Scale className="h-4 w-4 text-indigo-500" />,
              },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-medium">
                    {s.label}
                  </p>
                  <p className="text-sm font-bold text-gray-800 leading-tight">
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* PLB breakdown cards */}
          {plbCompare.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                PLB Breakdown — {plbCompare.length} Participating Local Bodies
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(plbCompare as any[]).slice(0, 8).map((p, i) => {
                  const pEff = Number(p.collection_efficiency_percent ?? 0);
                  const pc = effColor(Math.min(pEff, 100));
                  const pAgreed = Number(
                    p.agreed_weight_kg ?? p.total_agreed_weight ?? 0,
                  );
                  const pActual = Number(
                    p.actual_weight_kg ?? p.total_actual_weight ?? 0,
                  );
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-gray-200 p-3.5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold text-gray-800">
                            {p.panchayat_name ?? p.panchayat_id}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {p.waste_type ?? "All types"}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadgeCls(p.report_status)}`}
                        >
                          {p.report_status}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>Efficiency</span>
                          <span className={`font-bold ${pc.text}`}>
                            {pEff.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pc.bg}`}
                            style={{ width: `${Math.min(pEff, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="text-center bg-blue-50 rounded-lg py-1.5">
                          <p className="text-[10px] text-blue-500 font-medium">
                            Agreed
                          </p>
                          <p className="text-xs font-bold text-blue-700">
                            {fmtKg(pAgreed)} kg
                          </p>
                        </div>
                        <div className="text-center bg-green-50 rounded-lg py-1.5">
                          <p className="text-[10px] text-green-500 font-medium">
                            Actual
                          </p>
                          <p className="text-xs font-bold text-green-700">
                            {fmtKg(pActual)} kg
                          </p>
                        </div>
                      </div>
                      {rows.filter((r) => r.panchayat_id === p.panchayat_id)
                        .length > 0 && (
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-[10px] text-gray-400">
                            Trips:{" "}
                            <strong className="text-gray-600">
                              {rows
                                .filter(
                                  (r) => r.panchayat_id === p.panchayat_id,
                                )
                                .reduce((s, r) => s + r.total_trips, 0)}
                            </strong>
                          </span>
                          <button
                            onClick={() =>
                              navigate(
                                dailyComparisonEditPath(
                                  rows.find((r) => r.panchayat_id === p.panchayat_id)?.unique_id ?? "",
                                ),
                                {
                                  state: {
                                    record: rows.find(
                                      (r) => r.panchayat_id === p.panchayat_id,
                                    ),
                                  },
                                },
                              )
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                          >
                            <Pencil className="h-2.5 w-2.5" /> Edit
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waste-type breakdown table */}
          {rows.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Breakdown by PLB &amp; Waste Type — {rows.length} row
                {rows.length !== 1 ? "s" : ""}
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                      <th className="px-4 py-3 text-left font-semibold">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        PLB (Panchayat)
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        Waste Type
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Agreed (kg)
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Actual (kg)
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Variance (kg)
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Efficiency
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Trips
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Points
                      </th>
                      <th className="px-4 py-3 text-center font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rows.map((r) => {
                      const rowEff = Number(
                        r.collection_efficiency_percent ?? 0,
                      );
                      const ec = effColor(Math.min(rowEff, 100));
                      return (
                        <tr
                          key={r.unique_id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {r.collection_date}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                            {r.panchayat_name ?? r.panchayat_id}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {r.waste_type}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-blue-700 whitespace-nowrap">
                            {fmtKg(r.agreed_weight_kg)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-700 whitespace-nowrap">
                            {fmtKg(r.actual_weight_kg)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${r.variance_kg >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {r.variance_kg >= 0 ? "+" : ""}
                            {fmtKg(r.variance_kg)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`font-bold ${ec.text}`}>
                              {rowEff.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeCls(r.report_status)}`}
                            >
                              {r.report_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {r.total_trips}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {r.collection_points_covered}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  navigate(
                                    dailyComparisonEditPath(r.unique_id),
                                    {
                                      state: {
                                        record: r,
                                      },
                                    },
                                  )
                                }
                                className="text-blue-500 hover:text-blue-700"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="text-red-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex items-center justify-center gap-3 text-gray-400">
          <span className="animate-spin h-5 w-5 border-2 border-gray-200 border-t-green-500 rounded-full" />
          Loading daily data…
        </div>
      )}
    </div>
  );
}
