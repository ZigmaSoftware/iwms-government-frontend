import type {
  DailyReportResponse,
  DailyReportRow,
  LocationComparisonRow,
  WasteTypeBreakdownRow,
} from "./types";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  Download,
  MapPin,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  Recycle,
  Scale,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useTranslation } from "react-i18next";
import {
  areaTypeApi,
  corporationApi,
  dailyWasteComparisonApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
} from "@/helpers/admin";
import { api } from "@/api";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";

/* ── Palette (fixed categorical order — never cycled/regenerated) ──── */
const SERIES = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];
const OTHER_SLICE_COLOR = "#9ca3af";

const initialKpis: DailyReportResponse["kpis"] = {
  total_actual_weight_kg: 0,
  average_weight_per_trip: 0,
  total_trips: 0,
  collection_points_covered: 0,
  waste_type_count: 0,
  local_body_count: 0,
};

const todayValue = () => new Date().toISOString().split("T")[0];

/* ── Local body hierarchy (State -> District -> Area Type -> Local Body Type -> Local Body) ── */
type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

const localBodyLevels: Array<{ value: LocalBodyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat" },
];

const AREA_TYPE_LEVELS: Record<"urban" | "rural", LocalBodyLevel[]> = {
  urban: ["corporation_id", "municipality_id", "town_panchayat_id"],
  rural: ["panchayat_union_id", "panchayat_id"],
};

const areaTypeCategoryFromName = (name: string): "urban" | "rural" | "" => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const resolveGeoId = (record: any): string => String(record?.unique_id ?? record?.id ?? "");
const resolveGeoName = (record: any): string =>
  String(
    record?.name ??
      record?.corporation_name ??
      record?.municipality_name ??
      record?.town_panchayat_name ??
      record?.union_name ??
      record?.panchayat_name ??
      resolveGeoId(record),
  );
const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter((x) => x && typeof x === "object");
  if (value && typeof value === "object") {
    const r = (value as { results?: unknown }).results;
    if (Array.isArray(r)) return r.filter((x) => x && typeof x === "object");
  }
  return [];
};
const toGeoOptions = (records: any[]) =>
  records.filter((r) => resolveGeoId(r)).map((r) => ({ value: resolveGeoId(r), label: resolveGeoName(r) }));

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmtKg = (v?: number | string | null, dec = 2) => {
  const n = Number(v);
  return Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: dec });
};
const fmtAxis = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

/* ── Local-body weight row (simple bar, no target) ──────────────── */
const LocalBodyWeightRow = ({
  plb,
  maxWeight,
}: {
  plb: LocationComparisonRow;
  maxWeight: number;
}) => {
  const pct = maxWeight > 0 ? Math.min((plb.actual_weight_kg / maxWeight) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-28 shrink-0">
        <p className="text-xs font-semibold text-gray-800 truncate" title={plb.local_body_name}>
          {plb.local_body_name}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {plb.local_body_type} · {plb.total_trips} trip{plb.total_trips !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex-1">
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-20 text-right shrink-0">
        <span className="text-xs font-bold text-gray-700">{fmtKg(plb.actual_weight_kg)} kg</span>
      </div>
    </div>
  );
};

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
          <span className="font-bold">
            {p.dataKey === "total_trips" ? p.value : `${fmtKg(p.value)} kg`}
          </span>
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

const WasteTypeTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const row = p.payload as WasteTypeBreakdownRow & { color: string };
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[170px]">
      <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: row.color }}
        />
        {row.waste_type}
      </p>
      <div className="flex justify-between gap-4">
        <span className="text-gray-500">Weight</span>
        <span className="font-bold">{fmtKg(row.actual_weight_kg)} kg</span>
      </div>
      <div className="flex justify-between gap-4 mt-1">
        <span className="text-gray-500">Share</span>
        <span className="font-bold">{fmtKg(row.share_percent, 1)}%</span>
      </div>
      <div className="flex justify-between gap-4 mt-1">
        <span className="text-gray-500">Trips</span>
        <span className="font-bold">{row.total_trips}</span>
      </div>
    </div>
  );
};

const WasteTypeLegend = ({ payload }: any) => (
  <ul className="flex flex-wrap justify-center gap-3 mt-3">
    {(payload ?? []).map((entry: any) => (
      <li key={entry.value} className="flex items-center gap-1.5 text-xs text-gray-600">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.color }}
        />
        {entry.value}
      </li>
    ))}
  </ul>
);

/* ══════════════════════════════════════════════════════════════════
    MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function DailyWasteComparisonList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [dateValue, setDateValue] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [sortMode, setSortMode] = useState("weight");
  const [source, setSource] = useState("bin");

  /* ── local body filter cascade ── */
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">("");
  const [localBodyLevel, setLocalBodyLevel] = useState<LocalBodyLevel | "">("");
  const [localBodyId, setLocalBodyId] = useState("");

  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [areaTypes, setAreaTypes] = useState<any[]>([]);
  const [localBodyRecords, setLocalBodyRecords] = useState<Record<LocalBodyLevel, any[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });

  const [rows, setRows] = useState<DailyReportRow[]>([]);
  const [dateTrends, setDateTrends] = useState<
    DailyReportResponse["date_trends"]
  >([]);
  const [plbCompare, setPlbCompare] = useState<LocationComparisonRow[]>([]);
  const [wasteTypeBreakdown, setWasteTypeBreakdown] = useState<
    WasteTypeBreakdownRow[]
  >([]);
  const [kpis, setKpis] = useState<DailyReportResponse["kpis"]>(initialKpis);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const { encScheduleMasters, encDailyWasteComparison } = getEncryptedRoute();
  const { newPath: dailyComparisonNewPath, editPath: dailyComparisonEditPath } =
    createCrudRoutePaths(encScheduleMasters, encDailyWasteComparison);

  /* fetch state/district/area type/local body dropdowns */
  useEffect(() => {
    Promise.all([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ]).then(
      ([
        stateRes,
        districtRes,
        areaTypeRes,
        corporationRes,
        municipalityRes,
        townPanchayatRes,
        panchayatUnionRes,
        panchayatRes,
      ]) => {
        setStates(toRecordList(stateRes));
        setDistricts(toRecordList(districtRes));
        setAreaTypes(toRecordList(areaTypeRes));
        setLocalBodyRecords({
          corporation_id: toRecordList(corporationRes),
          municipality_id: toRecordList(municipalityRes),
          town_panchayat_id: toRecordList(townPanchayatRes),
          panchayat_union_id: toRecordList(panchayatUnionRes),
          panchayat_id: toRecordList(panchayatRes),
        });
      },
    );
  }, []);

  /* area type -> urban/rural category */
  useEffect(() => {
    if (!areaTypeId || !areaTypes.length) {
      if (!areaTypeId) setAreaTypeCategory("");
      return;
    }
    const selected = areaTypes.find((item) => resolveGeoId(item) === areaTypeId);
    if (selected) {
      setAreaTypeCategory(areaTypeCategoryFromName(String(selected.name ?? "")));
    }
  }, [areaTypeId, areaTypes]);

  const filteredDistricts = districts.filter(
    (d) => !stateId || String(d.state_id ?? d.state ?? "") === stateId,
  );
  const filteredAreaTypes = areaTypes.filter(
    (a) => !districtId || String(a.district_id ?? a.district ?? "") === districtId,
  );
  const availableLocalBodyLevels = areaTypeCategory
    ? localBodyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value))
    : [];
  const localBodyOptions = localBodyLevel
    ? toGeoOptions(
        (localBodyRecords[localBodyLevel] ?? []).filter(
          (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
        ),
      )
    : [];

  /* ── fetch report ── */
  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = { sort: sortMode, source };
      if (appliedDate) params.date = appliedDate;
      if (localBodyLevel && localBodyId) params[localBodyLevel] = localBodyId;

      const { data } = await api.get<DailyReportResponse>(
        "/schedule-masters/daily-waste-comparisons/",
        { params },
      );
      setRows(Array.isArray(data?.results) ? data.results : []);
      setDateTrends(Array.isArray(data?.date_trends) ? data.date_trends : []);
      setPlbCompare(
        Array.isArray(data?.location_comparison)
          ? data.location_comparison
          : [],
      );
      setWasteTypeBreakdown(
        Array.isArray(data?.waste_type_breakdown)
          ? data.waste_type_breakdown
          : [],
      );
      setKpis(data?.kpis ?? initialKpis);
    } catch {
      setRows([]);
      setDateTrends([]);
      setPlbCompare([]);
      setWasteTypeBreakdown([]);
      setKpis(initialKpis);
      setError("Unable to load daily waste collection data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, [appliedDate, sortMode, source, localBodyLevel, localBodyId]);

  /* ── delete ── */
  const handleDelete = async (row: DailyReportRow) => {
    const result = await Swal.fire({
      title: t("common.are_you_sure"),
      text: `Delete record for ${row.local_body_name} — ${row.collection_date}?`,
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
  const plbChartData = useMemo(
    () =>
      plbCompare.slice(0, 8).map((p) => ({
        name: p.local_body_name,
        Weight: Number(p.actual_weight_kg ?? 0),
      })),
    [plbCompare],
  );

  const maxPlbWeight = useMemo(
    () => plbCompare.reduce((max, p) => Math.max(max, p.actual_weight_kg), 0),
    [plbCompare],
  );

  /* waste-type pie data — top slots take fixed categorical colors in order,
     the tail (past the 7-slot ceiling) folds into "Other" per the series-count rule */
  const MAX_PIE_SLICES = 7;
  const wasteTypePieData = useMemo(() => {
    const sorted = [...wasteTypeBreakdown].sort(
      (a, b) => b.actual_weight_kg - a.actual_weight_kg,
    );
    const head = sorted.slice(0, MAX_PIE_SLICES).map((row, i) => ({
      ...row,
      color: SERIES[i % SERIES.length],
    }));
    const tail = sorted.slice(MAX_PIE_SLICES);
    if (tail.length > 0) {
      const tailWeight = tail.reduce((s, r) => s + r.actual_weight_kg, 0);
      const tailTrips = tail.reduce((s, r) => s + r.total_trips, 0);
      const tailPoints = tail.reduce((s, r) => s + r.collection_points_covered, 0);
      const tailShare = tail.reduce((s, r) => s + r.share_percent, 0);
      head.push({
        waste_type_id: "__other__",
        waste_type: `Other (${tail.length})`,
        actual_weight_kg: tailWeight,
        total_trips: tailTrips,
        collection_points_covered: tailPoints,
        share_percent: tailShare,
        color: OTHER_SLICE_COLOR,
      });
    }
    return head;
  }, [wasteTypeBreakdown]);

  const selectedLocalBodyLabel = localBodyOptions.find((o) => o.value === localBodyId)?.label;

  const handleDownload = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { sort: sortMode, source };
      if (appliedDate) params.date = appliedDate;
      if (localBodyLevel && localBodyId) params[localBodyLevel] = localBodyId;

      const exportRows = await dailyWasteComparisonApi.readAllForExport({
        params,
      });
      exportRecordsToExcel(
        exportRows.map((r) => ({
          Date: r.collection_date,
          "Local Body Type": r.local_body_type,
          "Local Body": r.local_body_name,
          "Waste Type": r.waste_type,
          "Weight Collected (kg)": r.actual_weight_kg,
          Trips: r.total_trips,
          Points: r.collection_points_covered,
          "Avg Weight / Trip (kg)": r.average_weight_per_trip,
        })),
        getAdminScreenExcelFilename("all"),
        "Daily Waste Collection",
      );
    } catch {
      Swal.fire(
        t("common.error"),
        "Failed to download daily waste collection data.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  const clearLocalBodyFilter = () => {
    setStateId("");
    setDistrictId("");
    setAreaTypeId("");
    setAreaTypeCategory("");
    setLocalBodyLevel("");
    setLocalBodyId("");
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
            Daily Waste Collection Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Total collected weight, trips, and waste-type composition by local body
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
            <option value="weight">Highest weight</option>
            <option value="trips">Most trips</option>
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
        </div>
      </div>

      {/* ── Local body filter cascade ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-gray-400" /> Filter by Local Body
          </h2>
          {(stateId || districtId || areaTypeId || localBodyId) && (
            <button
              onClick={clearLocalBodyFilter}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={stateId}
            onChange={(e) => {
              setStateId(e.target.value);
              setDistrictId("");
              setAreaTypeId("");
              setAreaTypeCategory("");
              setLocalBodyLevel("");
              setLocalBodyId("");
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="">Select State</option>
            {toGeoOptions(states).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setAreaTypeId("");
              setAreaTypeCategory("");
              setLocalBodyLevel("");
              setLocalBodyId("");
            }}
            disabled={!stateId}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
          >
            <option value="">{stateId ? "Select District" : "Select a State first"}</option>
            {toGeoOptions(filteredDistricts).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={areaTypeId}
            onChange={(e) => {
              const v = e.target.value;
              const selected = filteredAreaTypes.find((a) => resolveGeoId(a) === v);
              setAreaTypeId(v);
              setAreaTypeCategory(areaTypeCategoryFromName(String(selected?.name ?? "")));
              setLocalBodyLevel("");
              setLocalBodyId("");
            }}
            disabled={!districtId}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
          >
            <option value="">{districtId ? "Select Area Type" : "Select a District first"}</option>
            {toGeoOptions(filteredAreaTypes).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={localBodyLevel}
            onChange={(e) => {
              setLocalBodyLevel(e.target.value as LocalBodyLevel);
              setLocalBodyId("");
            }}
            disabled={!areaTypeCategory}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
          >
            <option value="">{areaTypeCategory ? "Select Local Body Type" : "Select an Area Type first"}</option>
            {availableLocalBodyLevels.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={localBodyId}
            onChange={(e) => setLocalBodyId(e.target.value)}
            disabled={!localBodyLevel}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50"
          >
            <option value="">
              {localBodyLevel
                ? `Select ${localBodyLevels.find((l) => l.value === localBodyLevel)?.label}`
                : "Select a Local Body Type first"}
            </option>
            {localBodyOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {localBodyId && (
          <p className="mt-3 text-xs text-gray-500">
            Showing data for <span className="font-semibold text-gray-700">{selectedLocalBodyLabel}</span>
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── 5 KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          {
            label: "Total Weight Collected",
            value: `${fmtKg(kpis.total_actual_weight_kg)} kg`,
            accent: "border-t-green-500",
            icon: <Scale className="h-4 w-4" />,
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
            label: "Waste Types",
            value: fmtKg(kpis.waste_type_count, 0),
            accent: "border-t-violet-500",
            icon: <Recycle className="h-4 w-4" />,
          },
          {
            label: "Local Bodies",
            value: fmtKg(kpis.local_body_count, 0),
            accent: "border-t-indigo-500",
            icon: <BarChart3 className="h-4 w-4" />,
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
            Total weight collected per date
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
                  <linearGradient id="gradActualD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1baf7a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1baf7a" stopOpacity={0.02} />
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
                  dataKey="actual_weight_kg"
                  name="Weight Collected"
                  stroke="#1baf7a"
                  strokeWidth={2.5}
                  fill="url(#gradActualD)"
                  dot={{
                    r: 4,
                    fill: "#1baf7a",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Waste composition — Pie chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <PieChartIcon className="h-4 w-4 text-gray-400" /> Waste Composition
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">
            Share of total collected weight by waste type
          </p>
          {wasteTypePieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No waste-type data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Tooltip content={<WasteTypeTooltip />} />
                <Pie
                  data={wasteTypePieData}
                  dataKey="actual_weight_kg"
                  nameKey="waste_type"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="#fcfcfb"
                  strokeWidth={2}
                  label={({ share_percent }: any) =>
                    share_percent >= 5 ? `${share_percent.toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {wasteTypePieData.map((entry) => (
                    <Cell key={entry.waste_type_id} fill={entry.color} />
                  ))}
                </Pie>
                <Legend content={<WasteTypeLegend />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Local Body Weight — bars */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">
            Weight Collected by Local Body
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Corporation / municipality / town panchayat / panchayat union / panchayat
          </p>
          {plbCompare.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No local body data yet.
            </div>
          ) : (
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {plbCompare.slice(0, 10).map((p, i) => (
                <LocalBodyWeightRow key={i} plb={p} maxWeight={maxPlbWeight} />
              ))}
            </div>
          )}
        </div>

        {/* Local Body Weight — grouped bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">
            Local Body Comparison
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Total weight collected per local body
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
                <Bar
                  dataKey="Weight"
                  fill="#1baf7a"
                  maxBarSize={40}
                  radius={[3, 3, 0, 0]}
                >
                  {plbChartData.map((_, i) => (
                    <Cell key={i} fill="#1baf7a" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          WASTE TYPE BREAKDOWN TABLE
      ══════════════════════════════════════════════════════ */}
      {wasteTypeBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Recycle className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-800">
              Waste Type Breakdown
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                  <th className="px-4 py-3 text-left font-semibold">Waste Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Weight Collected (kg)</th>
                  <th className="px-4 py-3 text-right font-semibold">Share</th>
                  <th className="px-4 py-3 text-right font-semibold">Trips</th>
                  <th className="px-4 py-3 text-right font-semibold">Points Covered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {[...wasteTypeBreakdown]
                  .sort((a, b) => b.actual_weight_kg - a.actual_weight_kg)
                  .map((w, i) => (
                    <tr key={w.waste_type_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle"
                          style={{ backgroundColor: SERIES[i % SERIES.length] }}
                        />
                        {w.waste_type}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-700 whitespace-nowrap">
                        {fmtKg(w.actual_weight_kg)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                        {fmtKg(w.share_percent, 1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {w.total_trips}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {w.collection_points_covered}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SUMMARY + DETAIL
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
          </div>

          {/* 4 main stat cells */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-green-100 bg-green-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Total Weight Collected</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.total_actual_weight_kg)} kg
              </span>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Total Trips</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.total_trips, 0)}
              </span>
            </div>
            <div className="rounded-xl border border-pink-100 bg-pink-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Points Covered</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.collection_points_covered, 0)}
              </span>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Avg Weight / Trip</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.average_weight_per_trip)} kg
              </span>
            </div>
          </div>

          {/* Local body breakdown cards */}
          {plbCompare.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Local Body Breakdown — {plbCompare.length} Location
                {plbCompare.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plbCompare.slice(0, 8).map((p, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-200 p-3.5 hover:shadow-md transition-shadow"
                  >
                    <div className="mb-2">
                      <p className="text-xs font-bold text-gray-800">
                        {p.local_body_name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {p.local_body_type}
                      </p>
                    </div>
                    <div className="text-center bg-green-50 rounded-lg py-2 mb-2">
                      <p className="text-[10px] text-green-500 font-medium">
                        Weight Collected
                      </p>
                      <p className="text-sm font-bold text-green-700">
                        {fmtKg(p.actual_weight_kg)} kg
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-400">
                        Trips:{" "}
                        <strong className="text-gray-600">
                          {p.total_trips}
                        </strong>
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Points:{" "}
                        <strong className="text-gray-600">
                          {p.collection_points_covered}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed breakdown table */}
          {rows.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Breakdown by Local Body &amp; Waste Type — {rows.length} row
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
                        Local Body Type
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        Local Body
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">
                        Waste Type
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Weight Collected (kg)
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
                    {rows.map((r) => (
                      <tr
                        key={r.unique_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {r.collection_date}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {r.local_body_type}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                          {r.local_body_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {r.waste_type}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-700 whitespace-nowrap">
                          {fmtKg(r.actual_weight_kg)}
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
                    ))}
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
