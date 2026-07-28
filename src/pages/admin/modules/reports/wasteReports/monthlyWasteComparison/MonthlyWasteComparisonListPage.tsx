import type { ReportResponse, ReportRow, LocationComparisonRow, WasteTypeBreakdownRow } from "./types";
import { useEffect, useMemo, useState } from "react";
import ReportMultiSelect from "../ReportMultiSelect";
import { api } from "@/api";
import { adminApi } from "@/helpers/admin/registry";
import {
  areaTypeApi,
  corporationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
  wardApi,
} from "@/helpers/admin";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Leaf,
  MapPin,
  PieChart as PieChartIcon,
  Recycle,
  Scale,
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
import { useTranslation } from "react-i18next";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";
import {
  filterLocalBodyLevelsByScope,
  scopeFieldState,
  scopeHierarchyRecords,
  scopeOptions,
  type ScopeLevel,
} from "../../../masters/shared/dataScopeOptions";

/* ── Palette (fixed categorical order — never cycled/regenerated) ──── */
const SERIES = [
  "#10B981", // emerald
  "#0EA5E9", // cyan
  "#F59E0B", // amber
  "#0F766E", // teal
  "#8B5CF6", // violet
  "#EF4444", // red
  "#14B8A6", // aqua
  "#F97316", // orange
];
const OTHER_SLICE_COLOR = "#94A3B8";

const initialKpis: ReportResponse["kpis"] = {
  total_actual_weight: 0,
  average_weight_per_trip: 0,
  total_trips: 0,
  collection_points_covered: 0,
  waste_type_count: 0,
  local_body_count: 0,
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

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

/** Maps each local-body filter level to the ScopeLevel that gates it. */
const LOCAL_BODY_SCOPE_LEVEL: Record<LocalBodyLevel, ScopeLevel> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
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
      record?.ward_name ??
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
const mergeRecordLists = (
  primary: Record<string, unknown>[],
  fallback: Record<string, unknown>[],
): Record<string, unknown>[] => {
  const seen = new Set(primary.map(resolveGeoId).filter(Boolean));
  return [
    ...primary,
    ...fallback.filter((record) => {
      const id = resolveGeoId(record);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
};

/**
 * Merge a permission-gated hierarchy fetch (raw record list) with the user's
 * own Data Scope value for that level, so report filters always include at
 * least the user's own scoped state/district/area type/local body even when
 * the fetch comes back empty (403/no screen permission on that level's own
 * master) or doesn't otherwise include it. `extra` carries parent-id fields
 * (e.g. state_id/district_id) needed by this page's cascading filters.
 */
const mergeRecordsWithScope = (
  records: Record<string, unknown>[],
  level: ScopeLevel,
  extra: Record<string, unknown> = {},
): Record<string, unknown>[] => {
  const missing = scopeOptions(level)
    .filter((option) => !records.some((record) => resolveGeoId(record) === option.value))
    .map((option) => ({ unique_id: option.value, name: option.label, ...extra }));
  return missing.length ? [...missing, ...records] : records;
};

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
  const pct = maxWeight > 0 ? Math.min((plb.total_actual_weight / maxWeight) * 100, 100) : 0;
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
            className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-20 text-right shrink-0">
        <span className="text-xs font-bold text-gray-700">{fmtKg(plb.total_actual_weight)} kg</span>
      </div>
    </div>
  );
};

/* ── Tooltip components ──────────────────────────────────────────── */
const MonthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[140px]">
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
        <span className="font-bold">{fmtKg(row.total_actual_weight)} kg</span>
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
    MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function MonthlyWasteComparisonListPage({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { t } = useTranslation();

  const [monthValue, setMonthValue] = useState(currentMonth());
  const [appliedMonth, setAppliedMonth] = useState(currentMonth());
  const [sortMode, setSortMode] = useState("weight");
  const [source, setSource] = useState("bin");

  /* ── local body filter cascade ── */
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">("");
  const [localBodyLevel, setLocalBodyLevel] = useState<LocalBodyLevel | "">("");
  const [localBodyIds, setLocalBodyIds] = useState<string[]>([]);
  const [wardIds, setWardIds] = useState<string[]>([]);

  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [areaTypes, setAreaTypes] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [localBodyRecords, setLocalBodyRecords] = useState<Record<LocalBodyLevel, any[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<
    ReportResponse["monthly_trends"]
  >([]);
  const [plbComparison, setPlbComparison] = useState<LocationComparisonRow[]>([]);
  const [wasteTypeBreakdown, setWasteTypeBreakdown] = useState<WasteTypeBreakdownRow[]>([]);
  const [kpis, setKpis] = useState<ReportResponse["kpis"]>(initialKpis);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that filter field shows pre-filled and disabled rather than an
  // editable dropdown — they can't see data outside their own scope anyway.
  // Several scoped values (or none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const localBodyScope = localBodyLevel ? scopeFieldState(LOCAL_BODY_SCOPE_LEVEL[localBodyLevel]) : null;
  const wardScope = scopeFieldState("ward");

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId) setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId) setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId) setAreaTypeId(areaTypeScope.options[0].value);
    if (localBodyScope?.mode === "locked" && !localBodyIds.length) setLocalBodyIds([localBodyScope.options[0].value]);
    if (wardScope.mode === "locked" && localBodyIds.length && !wardIds.length) setWardIds([wardScope.options[0].value]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, areaTypeScope.mode, localBodyScope?.mode, wardScope.mode, stateId, districtId, areaTypeId, localBodyIds, wardIds]);

  /* fetch state/district/area type/local body dropdowns */
  useEffect(() => {
    let cancelled = false;

    // The State/District/Area Type/local-body screens may not be
    // permission-granted to this user at all (View gates their own
    // menu/list, not these report filter dropdowns) — their Data Scope
    // from login always supplies their own hierarchy values regardless.
    const scopedStateId = scopeOptions("state")[0]?.value;
    const scopedDistrictId = scopeOptions("district")[0]?.value;

    const applyScopeFallback = (records: {
      states: Record<string, unknown>[];
      districts: Record<string, unknown>[];
      areaTypes: Record<string, unknown>[];
      corporations: Record<string, unknown>[];
      municipalities: Record<string, unknown>[];
      townPanchayats: Record<string, unknown>[];
      panchayatUnions: Record<string, unknown>[];
      panchayats: Record<string, unknown>[];
      wards: Record<string, unknown>[];
    }) => {
      setStates(mergeRecordsWithScope(records.states, "state"));
      setDistricts(
        mergeRecordsWithScope(
          records.districts,
          "district",
          scopedStateId ? { state_id: scopedStateId } : {},
        ),
      );
      setAreaTypes(
        mergeRecordsWithScope(records.areaTypes, "area_type", {
          ...(scopedStateId ? { state_id: scopedStateId } : {}),
          ...(scopedDistrictId ? { district_id: scopedDistrictId } : {}),
        }),
      );
      setLocalBodyRecords({
        corporation_id: mergeRecordsWithScope(
          records.corporations,
          "corporation",
          scopedDistrictId ? { district_id: scopedDistrictId } : {},
        ),
        municipality_id: mergeRecordsWithScope(
          records.municipalities,
          "municipality",
          scopedDistrictId ? { district_id: scopedDistrictId } : {},
        ),
        town_panchayat_id: mergeRecordsWithScope(
          records.townPanchayats,
          "town_panchayat",
          scopedDistrictId ? { district_id: scopedDistrictId } : {},
        ),
        panchayat_union_id: mergeRecordsWithScope(
          records.panchayatUnions,
          "panchayat_union",
          scopedDistrictId ? { district_id: scopedDistrictId } : {},
        ),
        panchayat_id: mergeRecordsWithScope(
          records.panchayats,
          "panchayat",
          scopedDistrictId ? { district_id: scopedDistrictId } : {},
        ),
      });
      setWards(mergeRecordsWithScope(records.wards, "ward"));
    };

    Promise.allSettled([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
      wardApi.readAll(),
    ]).then((results) => {
      if (cancelled) return;
      const descendants = scopeHierarchyRecords();
      const valueAt = (index: number) => {
        const result = results[index];
        return result?.status === "fulfilled" ? toRecordList(result.value) : [];
      };
      applyScopeFallback({
        states: mergeRecordLists(valueAt(0), descendants.states),
        districts: mergeRecordLists(valueAt(1), descendants.districts),
        areaTypes: mergeRecordLists(valueAt(2), descendants.areaTypes),
        corporations: mergeRecordLists(valueAt(3), descendants.corporations),
        municipalities: mergeRecordLists(valueAt(4), descendants.municipalities),
        townPanchayats: mergeRecordLists(valueAt(5), descendants.townPanchayats),
        panchayatUnions: mergeRecordLists(valueAt(6), descendants.panchayatUnions),
        panchayats: mergeRecordLists(valueAt(7), descendants.panchayats),
        wards: mergeRecordLists(valueAt(8), descendants.wards),
      });
      if (
        results.every((result) => result.status === "rejected") &&
        !scopeOptions("state").length &&
        !scopeOptions("district").length &&
        !scopeOptions("area_type").length &&
        !scopeOptions("corporation").length &&
        !scopeOptions("municipality").length &&
        !scopeOptions("town_panchayat").length &&
        !scopeOptions("panchayat_union").length &&
        !scopeOptions("panchayat").length
      ) {
        Swal.fire(
          t("common.error"),
          "Failed to load local body filter options.",
          "error",
        );
      }
    }).catch(() => {
        if (cancelled) return;
        applyScopeFallback(scopeHierarchyRecords());
        if (
          !scopeOptions("state").length &&
          !scopeOptions("district").length &&
          !scopeOptions("area_type").length &&
          !scopeOptions("corporation").length &&
          !scopeOptions("municipality").length &&
          !scopeOptions("town_panchayat").length &&
          !scopeOptions("panchayat_union").length &&
          !scopeOptions("panchayat").length
        ) {
          Swal.fire(
            t("common.error"),
            "Failed to load local body filter options.",
            "error",
          );
        }
      });

    return () => {
      cancelled = true;
    };
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
  const availableLocalBodyLevels = filterLocalBodyLevelsByScope(
    areaTypeCategory
      ? localBodyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value))
      : [],
  );
  const fetchedLocalBodyOptions = localBodyLevel
    ? toGeoOptions(
        (localBodyRecords[localBodyLevel] ?? []).filter(
          (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
        ),
      )
    : [];
  const localBodyOptions =
    localBodyScope?.mode === "choices"
      ? localBodyScope.options
      : fetchedLocalBodyOptions;
  const fetchedWardOptions = localBodyIds.length
    ? toGeoOptions(
        wards.filter((ward) => {
          const wardLocalBodyId = String(
            ward.local_body_id ??
              (localBodyLevel ? ward[localBodyLevel] : "") ??
              "",
          );
          return localBodyIds.includes(wardLocalBodyId);
        }),
      )
    : [];
  const wardOptions =
    wardScope.mode === "choices" ? wardScope.options : fetchedWardOptions;
  const onlyAvailableLocalBodyLevel =
    availableLocalBodyLevels.length === 1
      ? availableLocalBodyLevels[0].value
      : "";

  useEffect(() => {
    if (
      onlyAvailableLocalBodyLevel &&
      localBodyLevel !== onlyAvailableLocalBodyLevel
    ) {
      setLocalBodyLevel(onlyAvailableLocalBodyLevel);
      setLocalBodyIds([]);
      setWardIds([]);
    }
  }, [onlyAvailableLocalBodyLevel, localBodyLevel]);

  /* ── fetch report ── */
  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {
        sort: sortMode,
        source,
        page: String(detailPage),
        limit: String(detailPageSize),
      };
      if (appliedMonth) params.month = appliedMonth;
      if (stateId) params.state_id = stateId;
      if (districtId) params.district_id = districtId;
      if (areaTypeId) params.area_type_id = areaTypeId;
      if (localBodyLevel && localBodyIds.length) params[localBodyLevel] = localBodyIds.join(",");
      if (wardIds.length) params.ward_id = wardIds.join(",");

      const { data } = await api.get<ReportResponse>(
        "/reports/monthly-waste-comparison/",
        { params },
      );
      setRows(Array.isArray(data?.results) ? data.results : []);
      setTotalCount(
        typeof data?.count === "number"
          ? data.count
          : Array.isArray(data?.results)
            ? data.results.length
            : 0,
      );
      setMonthlyTrends(
        Array.isArray(data?.monthly_trends) ? data.monthly_trends : [],
      );
      setPlbComparison(
        Array.isArray(data?.location_comparison)
          ? data.location_comparison
          : [],
      );
      setWasteTypeBreakdown(
        Array.isArray(data?.waste_type_breakdown) ? data.waste_type_breakdown : [],
      );
      setKpis(data?.kpis ?? initialKpis);
    } catch {
      setRows([]);
      setTotalCount(0);
      setMonthlyTrends([]);
      setPlbComparison([]);
      setWasteTypeBreakdown([]);
      setKpis(initialKpis);
      setError("Unable to load monthly waste collection report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedMonth,
    sortMode,
    source,
    stateId,
    districtId,
    areaTypeId,
    localBodyLevel,
    localBodyIds,
    wardIds,
    detailPage,
    detailPageSize,
  ]);

  /* Reset to page 1 whenever a filter OTHER than pagination changes — the
     server refetch above also fires when detailPage/detailPageSize change
     (i.e. on a "next page" click), so an unconditional reset there would
     immediately snap the user back to page 1. */
  useEffect(() => {
    setDetailPage(1);
  }, [appliedMonth, sortMode, source, stateId, districtId, areaTypeId, localBodyLevel, localBodyIds, wardIds]);

  /* ── derived ── */
  const plbChartData = useMemo(
    () =>
      plbComparison.slice(0, 8).map((p) => ({
        name: p.local_body_name,
        Weight: Number(p.total_actual_weight ?? 0),
      })),
    [plbComparison],
  );

  const maxPlbWeight = useMemo(
    () => plbComparison.reduce((max, p) => Math.max(max, p.total_actual_weight), 0),
    [plbComparison],
  );

  const MAX_PIE_SLICES = 7;
  const wasteTypePieData = useMemo(() => {
    const sorted = [...wasteTypeBreakdown].sort(
      (a, b) => b.total_actual_weight - a.total_actual_weight,
    );
    const head = sorted.slice(0, MAX_PIE_SLICES).map((row, i) => ({
      ...row,
      color: SERIES[i % SERIES.length],
    }));
    const tail = sorted.slice(MAX_PIE_SLICES);
    if (tail.length > 0) {
      const tailWeight = tail.reduce((s, r) => s + r.total_actual_weight, 0);
      const tailTrips = tail.reduce((s, r) => s + r.total_trips, 0);
      const tailPoints = tail.reduce((s, r) => s + r.collection_points_covered, 0);
      const tailShare = tail.reduce((s, r) => s + r.share_percent, 0);
      head.push({
        waste_type_id: "__other__",
        waste_type: `Other (${tail.length})`,
        total_actual_weight: tailWeight,
        total_trips: tailTrips,
        collection_points_covered: tailPoints,
        share_percent: tailShare,
        color: OTHER_SLICE_COLOR,
      });
    }
    return head;
  }, [wasteTypeBreakdown]);

  const selectedLocalBodyLabel = localBodyOptions
    .filter((option) => localBodyIds.includes(option.value))
    .map((option) => option.label)
    .join(", ");
  const selectedWardLabel = wardOptions
    .filter((option) => wardIds.includes(option.value))
    .map((option) => option.label)
    .join(", ");
  const detailPageCount = Math.max(1, Math.ceil(totalCount / detailPageSize));
  const safeDetailPage = Math.min(detailPage, detailPageCount);
  const visibleDetailPages = useMemo(() => {
    const visibleCount = Math.min(5, detailPageCount);
    const start = Math.max(
      1,
      Math.min(safeDetailPage - 2, detailPageCount - visibleCount + 1),
    );
    return Array.from({ length: visibleCount }, (_, index) => start + index);
  }, [detailPageCount, safeDetailPage]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { sort: sortMode, source };
      if (appliedMonth) params.month = appliedMonth;
      if (stateId) params.state_id = stateId;
      if (districtId) params.district_id = districtId;
      if (areaTypeId) params.area_type_id = areaTypeId;
      if (localBodyLevel && localBodyIds.length) params[localBodyLevel] = localBodyIds.join(",");
      if (wardIds.length) params.ward_id = wardIds.join(",");

      const exportRows = await adminApi.monthlyWasteComparison.readAllForExport(
        { params },
      );
      exportRecordsToExcel(
        exportRows.map((r) => ({
          Month: r.month,
          "Local Body Type": r.local_body_type,
          "Local Body": r.local_body_name,
          "Waste Type": r.waste_type,
          "Weight Collected (kg)": r.total_actual_weight,
          Trips: r.total_trips,
          Points: r.collection_points_covered,
          "Avg/Trip (kg)": r.average_weight_per_trip,
        })),
        getAdminScreenExcelFilename("all"),
        "Monthly Waste Comparison",
      );
    } catch {
      Swal.fire(
        t("common.error"),
        "Failed to download monthly waste collection data.",
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  const clearLocalBodyFilter = () => {
    // A locked field can't be cleared to blank — it snaps back to the
    // user's own scoped value instead of leaving a disabled, empty select.
    setStateId(stateScope.mode === "locked" ? stateScope.options[0].value : "");
    setDistrictId(districtScope.mode === "locked" ? districtScope.options[0].value : "");
    setAreaTypeId(areaTypeScope.mode === "locked" ? areaTypeScope.options[0].value : "");
    setAreaTypeCategory("");
    const scopedLevels = filterLocalBodyLevelsByScope(localBodyLevels);
    const onlyScopedLevel = scopedLevels.length === 1 ? scopedLevels[0].value : "";
    const scopedBody = onlyScopedLevel
      ? scopeFieldState(LOCAL_BODY_SCOPE_LEVEL[onlyScopedLevel])
      : null;
    setLocalBodyLevel(onlyScopedLevel);
    setLocalBodyIds(scopedBody?.mode === "locked" ? [scopedBody.options[0].value] : []);
    setWardIds([]);
  };

  /* ══════════════════════════════════════════════════════════════
      RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div
      className={
        embedded
          ? "space-y-5 overflow-hidden rounded-2xl bg-[#F5F7FB] font-sans text-slate-900"
          : "min-h-screen space-y-5 bg-[#F5F7FB] p-5 font-sans text-slate-900"
      }
    >
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0F2744] via-[#115E6D] to-[#0F766E] shadow-[0_20px_60px_-28px_rgba(15,39,68,0.65)]">
        <div
          className="absolute inset-0 opacity-[0.09]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />
        <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative grid gap-7 px-7 py-8 md:px-10 lg:grid-cols-[1.65fr_0.8fr] lg:items-stretch">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 ring-1 ring-inset ring-emerald-300/20">
                  <Leaf className="h-4 w-4 text-emerald-300" />
                </div>
                <span className="font-mono text-[10px] tracking-[0.22em] text-cyan-100/70">
                  CIVIC SANITATION · MONTHLY ANALYTICS
                </span>
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-[2.6rem]">
                Monthly Waste Collection
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-50/65">
                Compare collected weight, trips, coverage, and waste composition across months and accessible local bodies.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="month"
                value={monthValue}
                max={currentMonth()}
                onChange={(e) => setMonthValue(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="weight">Highest weight</option>
                <option value="trips">Most trips</option>
              </select>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-10 rounded-xl border border-white/20 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="bin">Bin Collection</option>
                <option value="household">Household Collection</option>
                <option value="all">All Sources</option>
              </select>
              <button
                onClick={() => setAppliedMonth(monthValue)}
                className="h-10 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-emerald-950 shadow-sm transition-colors hover:bg-emerald-300"
              >
                Go
              </button>
              <button
                onClick={() => {
                  setMonthValue("");
                  setAppliedMonth("");
                }}
                className="h-10 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                All Months
              </button>
              <button
                onClick={handleDownload}
                disabled={!totalCount || exporting}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/15 disabled:opacity-50 lg:ml-auto"
              >
                <Download className="h-4 w-4" />
                {exporting ? "Downloading..." : "Download all"}
              </button>
            </div>
          </div>
          <div className="flex min-h-56 flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-inner backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                  Total collected
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {fmtKg(kpis.total_actual_weight)}
                  <span className="ml-2 text-sm font-medium text-cyan-100/70">kg</span>
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 ring-1 ring-inset ring-emerald-300/20">
                <Scale className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5">
              {[
                ["Trips", fmtKg(kpis.total_trips, 0)],
                ["Points covered", fmtKg(kpis.collection_points_covered, 0)],
                ["Waste types", fmtKg(kpis.waste_type_count, 0)],
                ["Local bodies", fmtKg(kpis.local_body_count, 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100/50">{label}</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] tracking-wide text-cyan-100/50">
              {appliedMonth || "All months"} · aggregated collection
            </p>
          </div>
        </div>
      </div>

      {/* ── Local body filter cascade ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-teal-600" /> Filter by Local Body
          </h2>
          {(stateId || districtId || areaTypeId || localBodyIds.length || wardIds.length) && (
            <button
              onClick={clearLocalBodyFilter}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900"
            >
              Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={stateId}
            onChange={(e) => {
              setStateId(e.target.value);
              setDistrictId("");
              setAreaTypeId("");
              setAreaTypeCategory("");
              setLocalBodyLevel("");
              setLocalBodyIds([]);
              setWardIds([]);
            }}
            disabled={stateScope.mode === "locked"}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
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
              setLocalBodyIds([]);
              setWardIds([]);
            }}
            disabled={!stateId || districtScope.mode === "locked"}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
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
              setLocalBodyIds([]);
              setWardIds([]);
            }}
            disabled={!districtId || areaTypeScope.mode === "locked"}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
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
              setLocalBodyIds([]);
              setWardIds([]);
            }}
            disabled={!areaTypeCategory || availableLocalBodyLevels.length === 1}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50"
          >
            <option value="">{areaTypeCategory ? "Select Local Body Type" : "Select an Area Type first"}</option>
            {availableLocalBodyLevels.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ReportMultiSelect
            value={localBodyIds}
            onChange={(values) => {
              setLocalBodyIds(values);
              setWardIds([]);
            }}
            options={localBodyOptions}
            disabled={!localBodyLevel || localBodyScope?.mode === "locked"}
            placeholder={
              localBodyLevel
                ? `Select ${localBodyLevels.find((level) => level.value === localBodyLevel)?.label}(s)`
                : "Select a Local Body Type first"
            }
            ariaLabel="Local bodies"
          />
          <ReportMultiSelect
            value={wardIds}
            onChange={setWardIds}
            options={wardOptions}
            disabled={!localBodyIds.length || wardScope.mode === "locked"}
            placeholder={localBodyIds.length ? "Select Ward(s)" : "Select a Local Body first"}
            ariaLabel="Wards"
          />
        </div>
        {localBodyIds.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Showing data for{" "}
            <span className="font-semibold text-teal-800">
              {selectedLocalBodyLabel}
              {selectedWardLabel ? ` · ${selectedWardLabel}` : ""}
            </span>
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
            value: `${fmtKg(kpis.total_actual_weight)} kg`,
            accent: "border-t-emerald-500",
            icon: <Scale className="h-4 w-4" />,
          },
          {
            label: "Total Trips",
            value: fmtKg(kpis.total_trips, 0),
            accent: "border-t-cyan-500",
            icon: <Truck className="h-4 w-4" />,
          },
          {
            label: "Points Covered",
            value: fmtKg(kpis.collection_points_covered, 0),
            accent: "border-t-amber-500",
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
            accent: "border-t-teal-700",
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

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend — Area chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">Monthly Trend</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Total weight collected per month
          </p>
          {monthlyTrends.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No trend data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={monthlyTrends}
                margin={{ top: 6, right: 20, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f3f4f6"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
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
                <Tooltip content={<MonthTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="total_actual_weight"
                  name="Weight Collected"
                  stroke="#0F766E"
                  strokeWidth={2.5}
                  fill="url(#gradActual)"
                  dot={{
                    r: 4,
                    fill: "#10B981",
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
                  dataKey="total_actual_weight"
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

        {/* Local Body Weight — progress bars */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">
            Weight Collected by Local Body
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            Corporation / municipality / town panchayat / panchayat union / panchayat
          </p>
          {plbComparison.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No local body data yet.
            </div>
          ) : (
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {plbComparison.slice(0, 10).map((p, i) => (
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
                  fill="#0F766E"
                  maxBarSize={40}
                  radius={[3, 3, 0, 0]}
                >
                  {plbChartData.map((_, i) => (
                    <Cell key={i} fill={SERIES[i % SERIES.length]} />
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
                  .sort((a, b) => b.total_actual_weight - a.total_actual_weight)
                  .map((w, i) => (
                    <tr key={w.waste_type_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle"
                          style={{ backgroundColor: SERIES[i % SERIES.length] }}
                        />
                        {w.waste_type}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-teal-700 whitespace-nowrap">
                        {fmtKg(w.total_actual_weight)}
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
              background: "linear-gradient(135deg,#ECFDF5 0%,#ECFEFF 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-700 flex items-center justify-center shadow-sm">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-800">
                  Monthly Collection Summary
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Overall aggregate for&nbsp;
                  <span className="font-semibold text-teal-700">
                    {appliedMonth || "All Months"}
                  </span>
                  &nbsp;·&nbsp;{totalCount} record
                  {totalCount !== 1 ? "s" : ""} combined
                </p>
              </div>
            </div>
          </div>

          {/* Main stats grid */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Total Weight Collected</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.total_actual_weight)} kg
              </span>
            </div>
            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Total Trips</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.total_trips, 0)}
              </span>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Points Covered</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.collection_points_covered, 0)}
              </span>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Avg Weight / Trip</span>
              <span className="text-2xl font-bold text-gray-800 leading-none">
                {fmtKg(kpis.average_weight_per_trip)} kg
              </span>
            </div>
          </div>

          {/* Local body breakdown cards */}
          {plbComparison.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Local Body Breakdown — {plbComparison.length} Location
                {plbComparison.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plbComparison.slice(0, 8).map((p, i) => (
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
                    <div className="mb-2 rounded-lg bg-emerald-50 py-2 text-center">
                      <p className="text-[10px] font-medium text-emerald-600">
                        Weight Collected
                      </p>
                      <p className="text-sm font-bold text-teal-700">
                        {fmtKg(p.total_actual_weight)} kg
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

          {/* Waste-type breakdown table (per row) */}
          {rows.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Breakdown by Local Body &amp; Waste Type — {totalCount} row
                {totalCount !== 1 ? "s" : ""}
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                      <th className="px-4 py-3 text-left font-semibold">
                        Month
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {rows.map((r) => (
                      <tr
                        key={r.unique_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {r.month}
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
                        <td className="px-4 py-3 text-right font-medium text-teal-700 whitespace-nowrap">
                          {fmtKg(r.total_actual_weight)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {r.total_trips}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {r.collection_points_covered}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Rows per page</span>
                  <select
                    value={detailPageSize}
                    onChange={(event) => {
                      setDetailPageSize(Number(event.target.value));
                      setDetailPage(1);
                    }}
                    className="h-8 rounded-lg border border-emerald-100 bg-emerald-50 px-2 font-mono text-teal-900 outline-none focus:ring-2 focus:ring-emerald-300"
                    aria-label="Rows per page"
                  >
                    {[10, 25, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span className="font-mono text-gray-600">
                    {(safeDetailPage - 1) * detailPageSize + 1}–
                    {Math.min(safeDetailPage * detailPageSize, totalCount)} of {totalCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailPage((page) => Math.max(1, page - 1))}
                    disabled={safeDetailPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-white text-teal-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {visibleDetailPages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setDetailPage(page)}
                      className={`h-8 min-w-8 rounded-lg border px-2 font-mono text-xs transition-colors ${
                        page === safeDetailPage
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-emerald-100 bg-white text-teal-700 hover:bg-emerald-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDetailPage((page) => Math.min(detailPageCount, page + 1))}
                    disabled={safeDetailPage === detailPageCount}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-white text-teal-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 flex items-center justify-center gap-3 text-gray-400">
          <span className="animate-spin h-5 w-5 border-2 border-gray-200 border-t-emerald-500 rounded-full" />
          Loading monthly data…
        </div>
      )}
    </div>
  );
}
