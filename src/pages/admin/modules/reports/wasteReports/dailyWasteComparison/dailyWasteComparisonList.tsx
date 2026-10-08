import type {
  DailyReportResponse,
  DailyReportRow,
  LocationComparisonRow,
  WasteTypeBreakdownRow,
} from "./types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReportMultiSelect from "../ReportMultiSelect";
import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import notify from "@/lib/notify";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  wardApi,
  wasteTypeApi,
} from "@/helpers/admin";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/api";
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

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ══════════════════════════════════════════════════════════════════
   TOKENS — civic sanitation ledger palette, layered onto shadcn primitives
══════════════════════════════════════════════════════════════════ */
const C = {
  bg: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceSunk: "#F1F5F9",
  ink: "#0F172A",
  inkSoft: "#475569",
  inkFaint: "#94A3B8",
  line: "#E2E8F0",
  primary: "#0F766E",
  primaryDeep: "#0F2744",
  leaf: "#10B981",
  teal: "#0EA5E9",
  ochre: "#F59E0B",
  brick: "#EF4444",
  violet: "#8B5CF6",
} as const;

const WASTE_PALETTE: string[] = [C.leaf, C.teal, C.ochre, C.violet, C.brick, C.primary, "#3E8E7E"];
const OTHER_SLICE_COLOR = "#9CA3AF";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.dwcr{font-family:'Manrope',system-ui,sans-serif;color:${C.ink};background:${C.bg};}
.dwcr .font-display{font-family:'Manrope',system-ui,sans-serif;}
.dwcr .font-mono{font-family:'IBM Plex Mono',monospace;}
.dwcr ::-webkit-scrollbar{height:6px;width:6px;}
.dwcr ::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px;}
.dwcr .dwcr-select{background:${C.surfaceSunk};border-color:${C.line};color:${C.ink};font-size:0.75rem;height:2.25rem;}
.dwcr .dwcr-select-dark{background:#fff;border-color:rgba(255,255,255,0.3);color:${C.ink};height:2.5rem;}
.dwcr .dwcr-select-dark svg{color:${C.inkSoft};opacity:0.8;}
`;

const initialKpis: DailyReportResponse["kpis"] = {
  total_actual_weight_kg: 0,
  average_weight_per_trip: 0,
  total_trips: 0,
  collection_points_covered: 0,
  waste_type_count: 0,
  local_body_count: 0,
};

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayValue = () => isoDate(new Date());
const monthStartValue = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};
const fmtDay = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtShortDay = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

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
const fmtKg = (v?: number | string | null, dec = 0) => {
  const n = Number(v);
  return Number.isNaN(n)
    ? "—"
    : n.toLocaleString("en-IN", { maximumFractionDigits: dec });
};
const fmtAxis = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

/* ── Tooltip components ──────────────────────────────────────────── */
const ChipTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2.5 text-xs shadow-lg" style={{ background: C.primaryDeep, color: "#F4F5EE", minWidth: 140 }}>
      <p className="font-semibold mb-1 opacity-80">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 font-mono">
          <span>{p.name}</span>
          <span className="font-semibold">{`${fmtKg(p.value)} kg`}</span>
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
    <div className="rounded-lg px-3 py-2.5 text-xs shadow-lg" style={{ background: C.primaryDeep, color: "#F4F5EE", minWidth: 160 }}>
      <p className="font-semibold mb-1.5 flex items-center gap-1.5 opacity-90">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
        {row.waste_type}
      </p>
      <div className="flex justify-between gap-4 font-mono">
        <span className="opacity-70">Weight</span>
        <span className="font-semibold">{fmtKg(row.actual_weight_kg)} kg</span>
      </div>
      <div className="flex justify-between gap-4 font-mono mt-0.5">
        <span className="opacity-70">Share</span>
        <span className="font-semibold">{row.share_percent.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between gap-4 font-mono mt-0.5">
        <span className="opacity-70">Trips</span>
        <span className="font-semibold">{row.total_trips}</span>
      </div>
    </div>
  );
};

/* ── local, small select wrapper for the "value=all/none" placeholder pattern ── */
const NONE = "__none__";

function FilterSelect({
  value,
  onChange,
  placeholder,
  disabled,
  options,
  dark = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
  dark?: boolean;
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={dark ? "dwcr-select-dark rounded-xl border-0" : "dwcr-select rounded-lg"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ══════════════════════════════════════════════════════════════════
    MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function DailyWasteComparisonList({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { t } = useTranslation();

  // date range (defaults to this month so far); either end may be cleared
  const [dateFrom, setDateFrom] = useState(monthStartValue());
  const [dateTo, setDateTo] = useState(todayValue());
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [wasteTypeOptions, setWasteTypeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [bottomTab, setBottomTab] = useState<"locality" | "localbody">("locality");
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

    const liteConfig = { params: { lite: 1 } };
    Promise.allSettled([
      stateApi.readAll(liteConfig),
      districtApi.readAll(liteConfig),
      areaTypeApi.readAll(liteConfig),
      corporationApi.readAll(liteConfig),
      municipalityApi.readAll(liteConfig),
      townPanchayatApi.readAll(liteConfig),
      panchayatUnionApi.readAll(liteConfig),
      panchayatApi.readAll(liteConfig),
      wardApi.readAll(liteConfig),
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
        notify.fire(
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
          notify.fire(
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

  /* waste type filter options */
  useEffect(() => {
    let cancelled = false;
    wasteTypeApi
      .readAll({ params: { lite: 1 } })
      .then((list) => {
        if (cancelled) return;
        setWasteTypeOptions(
          toRecordList(list)
            .map((w) => ({ value: resolveGeoId(w), label: String(w.waste_type_name ?? w.name ?? resolveGeoId(w)) }))
            .filter((o) => o.value),
        );
      })
      .catch(() => { if (!cancelled) setWasteTypeOptions([]); });
    return () => { cancelled = true; };
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
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (wasteTypeId) params.waste_type_id = wasteTypeId;
      if (stateId) params.state_id = stateId;
      if (districtId) params.district_id = districtId;
      if (areaTypeId) params.area_type_id = areaTypeId;
      if (localBodyLevel && localBodyIds.length) params[localBodyLevel] = localBodyIds.join(",");
      if (wardIds.length) params.ward_id = wardIds.join(",");

      const { data } = await api.get<DailyReportResponse>(
        "/schedule-masters/daily-waste-comparisons/",
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
      setTotalCount(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dateFrom,
    dateTo,
    wasteTypeId,
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
  }, [dateFrom, dateTo, wasteTypeId, sortMode, source, stateId, districtId, areaTypeId, localBodyLevel, localBodyIds, wardIds]);

  /* ── derived ── */

  /* the page fills the space left in its shell (admin layout, or the
     dashboard's Reports tab) — no page scroll; the tables scroll inside
     their cards. Measured, since the
     shell's header / breadcrumb / paddings vary with the sidebar state. */
  const rootRef = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el || window.innerWidth < 1024) return setFitHeight(null);
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      // the shell's own bottom padding / borders between this page and the
      // bottom of <main> (the document height itself is clamped by the
      // shell's min-h-screen, so it can't be used to measure this)
      // — plus anything laid out after us on the way up (footers, margins)
      let below = 0;
      for (let child: Element = el, n = el.parentElement; n && n.tagName !== "BODY"; child = n, n = n.parentElement) {
        const cs = getComputedStyle(n);
        below += parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth) + parseFloat(getComputedStyle(child).marginBottom);
        for (let sib = child.nextElementSibling; sib; sib = sib.nextElementSibling) {
          const pos = getComputedStyle(sib).position;
          if (pos !== "absolute" && pos !== "fixed") below += sib.getBoundingClientRect().height;
        }
      }
      setFitHeight(Math.max(480, Math.floor(window.innerHeight - top - below)));
    };
    measure();
    const ro = new ResizeObserver(measure); // same value → React skips the update
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* waste-type pie data — top slots take fixed categorical colors in order,
     the tail (past the 7-slot ceiling) folds into "Other" per the series-count rule */
  const MAX_PIE_SLICES = 7;
  const wasteTypePieData = useMemo(() => {
    const sorted = [...wasteTypeBreakdown].sort(
      (a, b) => b.actual_weight_kg - a.actual_weight_kg,
    );
    const head = sorted.slice(0, MAX_PIE_SLICES).map((row, i) => ({
      ...row,
      color: WASTE_PALETTE[i % WASTE_PALETTE.length],
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
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (wasteTypeId) params.waste_type_id = wasteTypeId;
      if (stateId) params.state_id = stateId;
      if (districtId) params.district_id = districtId;
      if (areaTypeId) params.area_type_id = areaTypeId;
      if (localBodyLevel && localBodyIds.length) params[localBodyLevel] = localBodyIds.join(",");
      if (wardIds.length) params.ward_id = wardIds.join(",");

      const exportRows = await dailyWasteComparisonApi.readAllForExport({
        params,
      });
      await exportRecordsToExcel(
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
      notify.fire(
        t("common.error"),
        "Failed to download daily waste collection data.",
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

  /* ── presentational helpers ── */
  const card = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border shadow-sm";
  const cardStyle = { background: C.surface, borderColor: C.line };
  const label = "mb-1 block text-[10px] font-bold uppercase tracking-wider";
  const fieldCls = "h-9 rounded-lg border px-2.5 text-xs outline-none focus:ring-2 focus:ring-teal-100";
  const fieldStyle = { borderColor: C.line, background: C.surface, color: C.ink };
  const th = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide";
  const td = "px-3 py-2 text-xs";
  const spinner = (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-xs" style={{ color: C.inkFaint }}>
      <span className="h-7 w-7 animate-spin rounded-full" style={{ border: `3px solid ${C.line}`, borderTopColor: C.primary }} />
      Loading…
    </div>
  );
  const empty = (msg: string) => (
    <div className="flex h-full min-h-[120px] items-center justify-center text-xs" style={{ color: C.inkFaint }}>{msg}</div>
  );

  const rangeLabel =
    dateFrom && dateTo ? `${fmtShortDay(dateFrom)} – ${fmtDay(dateTo)}`
      : dateFrom ? `From ${fmtDay(dateFrom)}`
        : dateTo ? `Up to ${fmtDay(dateTo)}`
          : "All dates";
  const localBodyLabel = localBodyIds.length
    ? `${selectedLocalBodyLabel}${selectedWardLabel ? ` · ${selectedWardLabel}` : ""}`
    : "All local bodies";
  const localBodyFiltered = !!(stateId || districtId || areaTypeId || localBodyIds.length || wardIds.length);
  const dayCount = dateTrends.length;
  const topBodies = [...plbCompare]
    .sort((a, b) => (sortMode === "trips" ? b.total_trips - a.total_trips : b.actual_weight_kg - a.actual_weight_kg))
    .slice(0, 5);
  const topMax = Math.max(1, ...topBodies.map((p) => (sortMode === "trips" ? p.total_trips : p.actual_weight_kg)));
  const wasteRows = [...wasteTypeBreakdown].sort((a, b) => b.actual_weight_kg - a.actual_weight_kg);
  const wasteColor = (id: string) => wasteTypePieData.find((w) => w.waste_type_id === id)?.color ?? OTHER_SLICE_COLOR;

  const kpiTiles = [
    { label: "Total weight", value: fmtKg(kpis.total_actual_weight_kg), unit: "kg", sub: `${fmtKg(kpis.total_actual_weight_kg / 1000, 2)} MT this period` },
    { label: "Total trips", value: fmtKg(kpis.total_trips), sub: dayCount ? `across ${dayCount} day${dayCount === 1 ? "" : "s"}` : "no trips" },
    { label: "Points covered", value: fmtKg(kpis.collection_points_covered), sub: "collection points" },
    { label: "Waste types", value: fmtKg(kpis.waste_type_count), sub: "tracked categories" },
    { label: "Local bodies", value: fmtKg(kpis.local_body_count), sub: `avg ${fmtKg(kpis.average_weight_per_trip, 1)} kg / trip` },
  ];

  /* ══════════════════════════════════════════════════════════════
      RENDER — one screen: header + KPIs + 3 chart cards + tables
  ══════════════════════════════════════════════════════════════ */
  return (
    <div
      ref={rootRef}
      className={`dwcr flex flex-col gap-3 ${embedded ? "overflow-hidden rounded-2xl p-1" : ""}`}
      style={fitHeight ? { minHeight: fitHeight } : undefined}
    >
      <style>{FONTS}</style>

      {/* ── header: title + filters ── */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight">Daily Waste Collection</h1>
          <p className="mt-0.5 truncate text-xs" style={{ color: C.inkFaint }}>
            {localBodyFiltered ? localBodyLabel : "Across all local bodies"} · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="shrink-0">
            <span className={label} style={{ color: C.inkFaint }}>Date range</span>
            <div className={`${fieldCls} flex items-center gap-1`} style={fieldStyle}>
              <input type="date" value={dateFrom} className="w-[104px] bg-transparent outline-none" max={dateTo || todayValue()} onChange={(e) => setDateFrom(e.target.value)} style={{ colorScheme: "light" }} aria-label="From date" />
              <span style={{ color: C.inkFaint }}>–</span>
              <input type="date" value={dateTo} className="w-[104px] bg-transparent outline-none" min={dateFrom || undefined} max={todayValue()} onChange={(e) => setDateTo(e.target.value)} style={{ colorScheme: "light" }} aria-label="To date" />
            </div>
          </div>

          <div>
            <span className={label} style={{ color: C.inkFaint }}>Local body</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={`${fieldCls} flex max-w-[170px] items-center gap-1.5`} style={{ ...fieldStyle, borderColor: localBodyFiltered ? C.primary : C.line }}>
                  <span className="truncate">{localBodyLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: C.inkFaint }} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[440px] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold" style={{ color: C.inkSoft }}>Filter by local body</p>
                  {localBodyFiltered && (
                    <Button variant="link" onClick={clearLocalBodyFilter} className="h-auto p-0 text-xs font-semibold" style={{ color: C.teal }}>
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FilterSelect
                    value={stateId}
                    onChange={(v) => {
                      setStateId(v);
                      setDistrictId("");
                      setAreaTypeId("");
                      setAreaTypeCategory("");
                      setLocalBodyLevel("");
                      setLocalBodyIds([]);
                      setWardIds([]);
                    }}
                    placeholder="Select state"
                    disabled={stateScope.mode === "locked"}
                    options={toGeoOptions(states)}
                  />
                  <FilterSelect
                    value={districtId}
                    onChange={(v) => {
                      setDistrictId(v);
                      setAreaTypeId("");
                      setAreaTypeCategory("");
                      setLocalBodyLevel("");
                      setLocalBodyIds([]);
                      setWardIds([]);
                    }}
                    placeholder={stateId ? "Select district" : "Select a state first"}
                    disabled={!stateId || districtScope.mode === "locked"}
                    options={toGeoOptions(filteredDistricts)}
                  />
                  <FilterSelect
                    value={areaTypeId}
                    onChange={(v) => {
                      const selected = filteredAreaTypes.find((a) => resolveGeoId(a) === v);
                      setAreaTypeId(v);
                      setAreaTypeCategory(areaTypeCategoryFromName(String(selected?.name ?? "")));
                      setLocalBodyLevel("");
                      setLocalBodyIds([]);
                      setWardIds([]);
                    }}
                    placeholder={districtId ? "Select area type" : "Select a district first"}
                    disabled={!districtId || areaTypeScope.mode === "locked"}
                    options={toGeoOptions(filteredAreaTypes)}
                  />
                  <FilterSelect
                    value={localBodyLevel}
                    onChange={(v) => {
                      setLocalBodyLevel(v as LocalBodyLevel);
                      setLocalBodyIds([]);
                      setWardIds([]);
                    }}
                    placeholder={areaTypeCategory ? "Select local body type" : "Select an area type first"}
                    disabled={!areaTypeCategory || availableLocalBodyLevels.length === 1}
                    options={availableLocalBodyLevels}
                  />
                  <ReportMultiSelect
                    value={localBodyIds}
                    onChange={(values) => {
                      setLocalBodyIds(values);
                      setWardIds([]);
                    }}
                    options={localBodyOptions}
                    placeholder={
                      localBodyLevel
                        ? `Select ${localBodyLevels.find((l) => l.value === localBodyLevel)?.label}(s)`
                        : "Select a local body type first"
                    }
                    disabled={!localBodyLevel || localBodyScope?.mode === "locked"}
                    ariaLabel="Local bodies"
                  />
                  <ReportMultiSelect
                    value={wardIds}
                    onChange={setWardIds}
                    options={wardOptions}
                    placeholder={localBodyIds.length ? "Select ward(s)" : "Select a local body first"}
                    disabled={!localBodyIds.length || wardScope.mode === "locked"}
                    ariaLabel="Wards"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <span className={label} style={{ color: C.inkFaint }}>Source</span>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={`${fieldCls} max-w-[150px]`} style={fieldStyle}>
              <option value="bin">Bin collection</option>
              <option value="household">Household collection</option>
              <option value="all">All sources</option>
            </select>
          </div>

          <div>
            <span className={label} style={{ color: C.inkFaint }}>Waste type</span>
            <select value={wasteTypeId} onChange={(e) => setWasteTypeId(e.target.value)} className={`${fieldCls} max-w-[130px]`} style={fieldStyle}>
              <option value="">All types</option>
              {wasteTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <Button
            onClick={handleDownload}
            disabled={!totalCount || exporting}
            variant="outline"
            title="Download all rows (Excel)"
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold"
            style={{ borderColor: C.line, color: C.ink, background: C.surface }}
          >
            <Download className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">{exporting ? "Downloading…" : "Download"}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-xl px-4 py-2.5 text-sm" style={{ background: `${C.brick}14`, border: `1px solid ${C.brick}44`, color: C.brick }}>
          {error}
        </div>
      )}

      {/* ── KPI strip ── */}
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpiTiles.map((k) => (
          <div key={k.label} className="min-w-0 rounded-2xl border px-4 py-3 shadow-sm" style={cardStyle}>
            <p className="truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: C.inkFaint }}>{k.label}</p>
            {loading ? (
              <>
                <span className="mt-2 block h-6 w-24 animate-pulse rounded-md" style={{ background: C.surfaceSunk }} />
                <span className="mt-2 block h-3 w-28 animate-pulse rounded-md" style={{ background: C.surfaceSunk }} />
              </>
            ) : (
              <>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: C.ink }}>{k.value}</span>
                  {k.unit && <span className="text-xs font-semibold" style={{ color: C.inkFaint }}>{k.unit}</span>}
                </p>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: C.inkFaint }}>{k.sub}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── trend · composition · top local bodies ── */}
      <div className="grid shrink-0 gap-3 lg:grid-cols-3">
        <div className={`${card} h-[180px] p-4`} style={cardStyle}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold">Day-wise trend</h2>
            <span className="text-[10px]" style={{ color: C.inkFaint }}>{rangeLabel} · kg</span>
          </div>
          <div className="min-h-0 flex-1">
            {loading ? spinner : dateTrends.length === 0 ? empty("No trend data for this period.") : (
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                <AreaChart data={dateTrends} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="collection_date" tick={{ fontSize: 10, fill: C.inkFaint }} axisLine={false} tickLine={false} tickFormatter={(d: string) => d.slice(8)} />
                  <YAxis tick={{ fontSize: 10, fill: C.inkFaint }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={36} />
                  <Tooltip content={<ChipTooltip />} />
                  <Area type="linear" dataKey="actual_weight_kg" name="Collected weight" stroke={C.primary} strokeWidth={2} fill="url(#gradTrend)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`${card} h-[180px] p-4`} style={cardStyle}>
          <h2 className="mb-1 text-sm font-bold">Waste composition</h2>
          {loading ? spinner : wasteTypePieData.length === 0 ? empty("No waste-type data for this period.") : (
            <div className="flex min-h-0 flex-1 items-center gap-4">
              <div className="h-[128px] w-[128px] shrink-0">
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                  <PieChart>
                    <Tooltip content={<WasteTypeTooltip />} />
                    <Pie data={wasteTypePieData} dataKey="actual_weight_kg" nameKey="waste_type" innerRadius={38} outerRadius={60} paddingAngle={1.5} stroke={C.surface} strokeWidth={2}>
                      {wasteTypePieData.map((entry) => <Cell key={entry.waste_type_id} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 overflow-y-auto text-xs">
                {wasteTypePieData.map((w) => (
                  <li key={w.waste_type_id} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: w.color }} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: C.inkSoft }} title={w.waste_type}>{w.waste_type}</span>
                    <span className="font-semibold tabular-nums">{w.share_percent.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={`${card} h-[180px] p-4`} style={cardStyle}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Top local bodies · {sortMode === "trips" ? "trips" : "weight"}</h2>
            <button type="button" onClick={() => setBottomTab("localbody")} className="text-[11px] font-semibold hover:underline" style={{ color: C.primary }}>
              View all
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
            {loading ? spinner : topBodies.length === 0 ? empty("No local body data for this period.") : (
              topBodies.map((p, i) => {
                const v = sortMode === "trips" ? p.total_trips : p.actual_weight_kg;
                return (
                  <div key={p.local_body_id}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="truncate font-semibold" title={p.local_body_name}>{i + 1}. {p.local_body_name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{sortMode === "trips" ? fmtKg(v) : `${fmtKg(v)} kg`}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: C.surfaceSunk }}>
                      <div className="h-full rounded-full" style={{ width: `${(v / topMax) * 100}%`, background: "#4f46e5" }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── tables: rows (tab) · waste type summary ── */}
      <div className={`${card} h-[480px] lg:h-auto lg:min-h-[240px] lg:shrink lg:grow lg:basis-[0px]`} style={cardStyle}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: C.line, background: C.surfaceSunk }}>
            {([
              { key: "locality", label: "By locality" },
              { key: "localbody", label: "By local body" },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setBottomTab(t.key)}
                className="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                style={bottomTab === t.key ? { background: C.surface, color: C.ink, boxShadow: "0 1px 2px rgba(15,23,42,.08)" } : { color: C.inkFaint }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="h-7 rounded-lg border px-2 text-[11px] outline-none" style={fieldStyle} aria-label="Sort">
              <option value="weight">Highest weight</option>
              <option value="trips">Most trips</option>
            </select>
            <span className="text-[11px]" style={{ color: C.inkFaint }}>
              {bottomTab === "locality" ? `${fmtKg(totalCount)} rows` : `${fmtKg(plbCompare.length)} local bodies`}
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* left: detailed rows / local body totals */}
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border" style={{ borderColor: C.line }}>
            <div className="min-h-0 flex-1 overflow-auto">
              {bottomTab === "locality" ? (
                loading && rows.length === 0 ? spinner : rows.length === 0 ? empty("No records for this selection.") : (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10" style={{ background: C.surfaceSunk }}>
                      <tr style={{ color: C.inkFaint }}>
                        <th className={th}>Date</th>
                        <th className={th}>Locality</th>
                        <th className={th}>Waste type</th>
                        <th className={`${th} text-right`}>Weight</th>
                        <th className={`${th} text-right`}>Trips</th>
                      </tr>
                    </thead>
                    <tbody className={loading ? "opacity-50" : undefined}>
                      {rows.map((r) => (
                        <tr key={r.unique_id} className="border-t" style={{ borderColor: C.line }}>
                          <td className={`${td} whitespace-nowrap tabular-nums`} style={{ color: C.inkSoft }}>{r.collection_date}</td>
                          <td className={td}>
                            <span className="block font-medium">{r.local_body_name}</span>
                            <span className="text-[10px]" style={{ color: C.inkFaint }}>{r.local_body_type}</span>
                          </td>
                          <td className={`${td} whitespace-nowrap`}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ background: wasteColor(r.waste_type_id) }} />
                              {r.waste_type}
                            </span>
                          </td>
                          <td className={`${td} text-right font-semibold tabular-nums`}>{fmtKg(r.actual_weight_kg)} kg</td>
                          <td className={`${td} text-right tabular-nums`}>{fmtKg(r.total_trips)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : loading && plbCompare.length === 0 ? spinner : plbCompare.length === 0 ? empty("No local bodies for this selection.") : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10" style={{ background: C.surfaceSunk }}>
                    <tr style={{ color: C.inkFaint }}>
                      <th className={th}>#</th>
                      <th className={th}>Local body</th>
                      <th className={`${th} text-right`}>Weight</th>
                      <th className={`${th} text-right`}>Trips</th>
                      <th className={`${th} text-right`}>Points</th>
                      <th className={`${th} text-right`}>Avg / trip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...plbCompare]
                      .sort((a, b) => (sortMode === "trips" ? b.total_trips - a.total_trips : b.actual_weight_kg - a.actual_weight_kg))
                      .map((p, i) => (
                        <tr key={p.local_body_id} className="border-t" style={{ borderColor: C.line }}>
                          <td className={`${td} tabular-nums`} style={{ color: C.inkFaint }}>{i + 1}</td>
                          <td className={td}>
                            <span className="block font-medium">{p.local_body_name}</span>
                            <span className="text-[10px]" style={{ color: C.inkFaint }}>{p.local_body_type}</span>
                          </td>
                          <td className={`${td} text-right font-semibold tabular-nums`}>{fmtKg(p.actual_weight_kg)} kg</td>
                          <td className={`${td} text-right tabular-nums`}>{fmtKg(p.total_trips)}</td>
                          <td className={`${td} text-right tabular-nums`}>{fmtKg(p.collection_points_covered)}</td>
                          <td className={`${td} text-right tabular-nums`}>
                            {fmtKg(p.average_weight_per_trip ?? (p.total_trips ? p.actual_weight_kg / p.total_trips : 0), 1)} kg
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            {bottomTab === "locality" && totalCount > 0 && (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2" style={{ borderColor: C.line }}>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: C.inkFaint }}>
                  <span>
                    Showing {(safeDetailPage - 1) * detailPageSize + 1}–{Math.min(safeDetailPage * detailPageSize, totalCount)} of {fmtKg(totalCount)}
                  </span>
                  {/* inline buttons, not a native <select>: at the bottom of the
                      screen the browser opens a select's list off-screen */}
                  <span className="inline-flex items-center gap-0.5" role="group" aria-label="Rows per page">
                    {[10, 25, 50].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setDetailPageSize(size);
                          setDetailPage(1);
                        }}
                        aria-pressed={detailPageSize === size}
                        className="h-6 rounded-md border px-1.5 text-[11px] font-semibold tabular-nums"
                        style={detailPageSize === size ? { background: C.ink, borderColor: C.ink, color: "#fff" } : { borderColor: C.line, color: C.inkSoft }}
                      >
                        {size}
                      </button>
                    ))}
                    <span className="ml-1">/ page</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setDetailPage((page) => Math.max(1, page - 1))} disabled={safeDetailPage === 1} className="flex h-6 w-6 items-center justify-center rounded-md border disabled:opacity-40" style={{ borderColor: C.line }} aria-label="Previous page">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {visibleDetailPages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setDetailPage(page)}
                      className="h-6 min-w-6 rounded-md border px-1.5 text-[11px] font-semibold tabular-nums"
                      style={page === safeDetailPage ? { background: "#4f46e5", borderColor: "#4f46e5", color: "#fff" } : { borderColor: C.line, color: C.inkSoft }}
                    >
                      {page}
                    </button>
                  ))}
                  <button type="button" onClick={() => setDetailPage((page) => Math.min(detailPageCount, page + 1))} disabled={safeDetailPage === detailPageCount} className="flex h-6 w-6 items-center justify-center rounded-md border disabled:opacity-40" style={{ borderColor: C.line }} aria-label="Next page">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* right: waste type summary */}
          <div className="min-h-0 min-w-0 overflow-auto rounded-xl border" style={{ borderColor: C.line }}>
            {loading && wasteRows.length === 0 ? spinner : wasteRows.length === 0 ? empty("No waste types for this selection.") : (
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10" style={{ background: C.surfaceSunk }}>
                  <tr style={{ color: C.inkFaint }}>
                    <th className={th}>Waste type</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>Avg / trip</th>
                    <th className={`${th} text-right`}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteRows.map((w) => (
                    <tr key={w.waste_type_id} className="border-t" style={{ borderColor: C.line }}>
                      <td className={`${td} whitespace-nowrap`}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: wasteColor(w.waste_type_id) }} />
                          {w.waste_type}
                        </span>
                      </td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{fmtKg(w.actual_weight_kg)} kg</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtKg(w.total_trips ? w.actual_weight_kg / w.total_trips : 0, 1)} kg</td>
                      <td className={`${td} text-right tabular-nums`}>{fmtKg(w.collection_points_covered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
