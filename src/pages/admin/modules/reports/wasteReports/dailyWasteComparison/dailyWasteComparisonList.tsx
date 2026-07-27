import type {
  DailyReportResponse,
  DailyReportRow,
  LocationComparisonRow,
  WasteTypeBreakdownRow,
} from "./types";
import { useEffect, useMemo, useState } from "react";
import ReportMultiSelect from "../ReportMultiSelect";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Leaf,
  MapPin,
  Recycle,
  Scale,
  Truck,
} from "lucide-react";
import Swal from "@/lib/notify";
import {
  Area,
  AreaChart,
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
} from "@/helpers/admin";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

/* ── Hero collection snapshot ──────────────────────────────────── */
function WeighDial({
  value,
  max,
  unit = "kg",
  trips,
  points,
}: {
  value: number;
  max: number;
  unit?: string;
  trips: number;
  points: number;
}) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
            Total collected
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {value.toLocaleString("en-IN")}
            <span className="ml-2 text-sm font-medium text-cyan-100/70">{unit}</span>
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 ring-1 ring-inset ring-emerald-300/20">
          <Scale className="h-5 w-5 text-emerald-300" />
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[10px] font-medium text-cyan-100/60">
          <span>Against peak collection</span>
          <span className="font-mono">{Math.round(pct * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-700"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cyan-100/50">Trips</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">{fmtKg(trips)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cyan-100/50">Points covered</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">{fmtKg(points)}</p>
        </div>
      </div>
    </div>
  );
}

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

const WasteTypeLegend = ({ payload }: any) => (
  <ul className="flex flex-wrap justify-center gap-3 mt-3">
    {(payload ?? []).map((entry: any) => (
      <li key={entry.value} className="flex items-center gap-1.5 text-xs" style={{ color: C.inkSoft }}>
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
        {entry.value}
      </li>
    ))}
  </ul>
);

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
export default function DailyWasteComparisonList() {
  const { t } = useTranslation();

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
      const params: Record<string, string> = { sort: sortMode, source };
      if (appliedDate) params.date = appliedDate;
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
      setDetailPage(1);
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
  }, [appliedDate, sortMode, source, stateId, districtId, areaTypeId, localBodyLevel, localBodyIds, wardIds]);

  /* ── derived ── */
  const maxPlbWeight = useMemo(
    () => plbCompare.reduce((max, p) => Math.max(max, p.actual_weight_kg), 0),
    [plbCompare],
  );

  const dayMax = useMemo(
    () => dateTrends.reduce((max, d) => Math.max(max, Number(d.actual_weight_kg ?? 0)), 0) || 1,
    [dateTrends],
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
  const detailPageCount = Math.max(1, Math.ceil(rows.length / detailPageSize));
  const safeDetailPage = Math.min(detailPage, detailPageCount);
  const paginatedRows = useMemo(
    () =>
      rows.slice(
        (safeDetailPage - 1) * detailPageSize,
        safeDetailPage * detailPageSize,
      ),
    [rows, safeDetailPage, detailPageSize],
  );
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
      if (appliedDate) params.date = appliedDate;
      if (stateId) params.state_id = stateId;
      if (districtId) params.district_id = districtId;
      if (areaTypeId) params.area_type_id = areaTypeId;
      if (localBodyLevel && localBodyIds.length) params[localBodyLevel] = localBodyIds.join(",");
      if (wardIds.length) params.ward_id = wardIds.join(",");

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
    <div className="dwcr min-h-screen">
      <style>{FONTS}</style>

      {/* ── breadcrumb rail ── */}
      <div className="px-6 md:px-10 pt-6 flex items-center gap-1.5 text-xs" style={{ color: C.inkFaint }}>
        <span>Schedule Masters</span>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: C.primary }} className="font-semibold">
          Daily Waste Comparison
        </span>
      </div>

      {/* ══════════════ HERO ══════════════ */}
      <div className="px-6 md:px-10 pt-5">
        <div
          className="relative overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_60px_-28px_rgba(15,39,68,0.65)]"
          style={{ background: `linear-gradient(120deg, ${C.primaryDeep} 0%, #115E6D 58%, ${C.primary} 100%)` }}
        >
          <div
            className="absolute inset-0 opacity-[0.09]"
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative grid grid-cols-1 gap-7 px-7 py-8 md:px-10 lg:grid-cols-[1.65fr_0.8fr] lg:items-stretch">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 ring-1 ring-inset ring-emerald-300/20">
                    <Leaf className="h-4 w-4 text-emerald-300" />
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.22em] text-cyan-100/70">
                    CIVIC SANITATION · DAILY OPERATIONS
                  </span>
                </div>
                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-[2.6rem]">
                  Daily Waste Collection
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-50/65">
                  Monitor collected weight, completed trips, coverage, and waste composition across every accessible local body.
                </p>
              </div>

              {/* ── toolbar ── */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Input
                  type="date"
                  value={dateValue}
                  max={todayValue()}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="h-10 w-auto rounded-xl border-white/20 bg-white px-3 text-sm text-slate-900 shadow-sm"
                  style={{ colorScheme: "light" }}
                />
                <div className="w-44">
                  <FilterSelect
                    value={sortMode}
                    onChange={setSortMode}
                    placeholder="Sort"
                    dark
                    options={[
                      { value: "weight", label: "Highest weight" },
                      { value: "trips", label: "Most trips" },
                    ]}
                  />
                </div>
                <div className="w-44">
                  <FilterSelect
                    value={source}
                    onChange={setSource}
                    placeholder="Source"
                    dark
                    options={[
                      { value: "bin", label: "Bin Collection" },
                      { value: "household", label: "Household Collection" },
                      { value: "all", label: "All Sources" },
                    ]}
                  />
                </div>
                <Button
                  onClick={() => setAppliedDate(dateValue)}
                  className="h-10 rounded-xl bg-emerald-400 px-5 font-semibold text-emerald-950 shadow-sm transition-all hover:bg-emerald-300"
                >
                  Go
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDateValue("");
                    setAppliedDate("");
                  }}
                  className="h-10 rounded-xl border-white/20 bg-white/5 font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  All dates
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={!rows.length || exporting}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 font-semibold text-white shadow-sm transition-colors hover:bg-white/15 lg:ml-auto"
                >
                  <Download className="h-3.5 w-3.5" /> {exporting ? "Downloading…" : "Download all"}
                </Button>
              </div>
            </div>

            {/* ── signature weighbridge dial ── */}
            <div
              className="flex min-h-56 flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-inner backdrop-blur-sm"
            >
              <WeighDial
                value={kpis.total_actual_weight_kg}
                max={dayMax}
                unit="kg"
                trips={kpis.total_trips}
                points={kpis.collection_points_covered}
              />
              <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] tracking-wide text-cyan-100/50">
                {appliedDate || "All dates"} · load against day's peak
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ LOCAL BODY FILTER ══════════════ */}
      <div className="px-6 md:px-10 mt-5">
        <Card className="rounded-2xl px-5 py-4 shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: C.inkSoft }}>
              <MapPin className="h-3.5 w-3.5" /> Filter by local body
            </h2>
            {(stateId || districtId || areaTypeId || localBodyIds.length || wardIds.length) && (
              <Button variant="link" onClick={clearLocalBodyFilter} className="h-auto p-0 text-xs font-semibold" style={{ color: C.teal }}>
                Clear filter
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
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

          {localBodyIds.length > 0 && (
            <p className="mt-3 text-xs" style={{ color: C.inkFaint }}>
              Showing data for{" "}
              <span className="font-semibold" style={{ color: C.ink }}>
                {selectedLocalBodyLabel}
                {selectedWardLabel ? ` · ${selectedWardLabel}` : ""}
              </span>
            </p>
          )}
        </Card>
      </div>

      {error && (
        <div className="px-6 md:px-10 mt-5">
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: `${C.brick}14`, border: `1px solid ${C.brick}44`, color: C.brick }}>
            {error}
          </div>
        </div>
      )}

      {/* ══════════════ KPI STRIP ══════════════ */}
      <div className="px-6 md:px-10 mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { label: "Total weight collected", value: `${fmtKg(kpis.total_actual_weight_kg)} kg`, icon: Scale, accent: C.leaf },
          { label: "Total trips", value: fmtKg(kpis.total_trips), icon: Truck, accent: C.teal },
          { label: "Points covered", value: fmtKg(kpis.collection_points_covered), icon: MapPin, accent: C.ochre },
          { label: "Waste types", value: fmtKg(kpis.waste_type_count), icon: Recycle, accent: C.violet },
          { label: "Local bodies", value: fmtKg(kpis.local_body_count), icon: Leaf, accent: C.primary },
        ].map((k) => (
          <Card key={k.label} className="rounded-2xl p-4 flex flex-col gap-3 shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>
                {k.label}
              </span>
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${k.accent}1A` }}>
                <k.icon className="h-3.5 w-3.5" style={{ color: k.accent }} />
              </div>
            </div>
            <p className="font-mono text-2xl font-semibold" style={{ color: C.ink }}>
              {loading ? "—" : k.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ══════════════ CHARTS ══════════════ */}
      <div className="px-6 md:px-10 mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* trend */}
        <Card className="rounded-2xl p-5 shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
          <h2 className="font-display text-base font-semibold">Date-wise collection trend</h2>
          <p className="text-xs mt-0.5 mb-4" style={{ color: C.inkFaint }}>
            Total weight collected per date
          </p>
          {dateTrends.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: C.inkFaint }}>
              No trend data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dateTrends} margin={{ top: 6, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.leaf} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.leaf} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis
                  dataKey="collection_date"
                  tick={{ fontSize: 10, fill: C.inkFaint }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: C.inkFaint }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
                <Tooltip content={<ChipTooltip />} />
                <Area
                  type="monotone"
                  dataKey="actual_weight_kg"
                  name="Weight collected"
                  stroke={C.leaf}
                  strokeWidth={2.5}
                  fill="url(#gradTrend)"
                  dot={{ r: 3.5, fill: C.leaf, stroke: C.surface, strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* composition */}
        <Card className="rounded-2xl p-5 shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
          <h2 className="font-display text-base font-semibold flex items-center gap-1.5">
            <Recycle className="h-4 w-4" style={{ color: C.inkFaint }} /> Waste composition
          </h2>
          <p className="text-xs mt-0.5 mb-2" style={{ color: C.inkFaint }}>
            Share of total weight by waste type
          </p>
          {wasteTypePieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: C.inkFaint }}>
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
                  stroke={C.surface}
                  strokeWidth={2}
                  label={(props: unknown) => {
                    const p = props as { share_percent: number };
                    return p.share_percent >= 5 ? `${p.share_percent.toFixed(0)}%` : "";
                  }}
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
        </Card>

        {/* local body ranked bars */}
        <Card className="rounded-2xl p-5 lg:col-span-2 shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
          <h2 className="font-display text-base font-semibold">Weight collected by local body</h2>
          <p className="text-xs mt-0.5 mb-4" style={{ color: C.inkFaint }}>
            Corporation · municipality · town panchayat · panchayat union · panchayat
          </p>
          {plbCompare.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm" style={{ color: C.inkFaint }}>
              No local body data yet.
            </div>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
              {plbCompare.map((p) => {
                const pct = maxPlbWeight > 0 ? Math.min((p.actual_weight_kg / maxPlbWeight) * 100, 100) : 0;
                return (
                  <div key={p.local_body_id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                    <div className="w-40 shrink-0">
                      <p className="text-xs font-semibold truncate" title={p.local_body_name}>
                        {p.local_body_name}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: C.inkFaint }}>
                        {p.local_body_type} · {p.total_trips} trip{p.total_trips !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: C.surfaceSunk }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: C.leaf }} />
                    </div>
                    <div className="w-24 text-right shrink-0 font-mono text-xs font-semibold">{fmtKg(p.actual_weight_kg)} kg</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ══════════════ WASTE TYPE TABLE ══════════════ */}
      {wasteTypeBreakdown.length > 0 && (
        <div className="px-6 md:px-10 mt-5">
          <Card className="rounded-2xl overflow-hidden shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <Recycle className="h-4 w-4" style={{ color: C.inkFaint }} />
              <h2 className="font-display text-base font-semibold">Waste type breakdown</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow style={{ background: C.surfaceSunk, borderColor: C.line }} className="hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>
                    Waste type
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>
                    Weight (kg)
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>
                    Share
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>
                    Trips
                  </TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>
                    Points covered
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...wasteTypeBreakdown]
                  .sort((a, b) => b.actual_weight_kg - a.actual_weight_kg)
                  .map((w, i) => (
                    <TableRow key={w.waste_type_id} style={{ borderColor: C.line }}>
                      <TableCell className="font-semibold whitespace-nowrap text-xs">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle"
                          style={{ background: WASTE_PALETTE[i % WASTE_PALETTE.length] }}
                        />
                        {w.waste_type}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-xs" style={{ color: C.primary }}>
                        {fmtKg(w.actual_weight_kg)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: C.inkSoft }}>
                        {w.share_percent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: C.inkSoft }}>
                        {w.total_trips}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: C.inkSoft }}>
                        {w.collection_points_covered}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ══════════════ SUMMARY ══════════════ */}
      <div className="px-6 md:px-10 mt-5 pb-10">
        <Card className="rounded-2xl overflow-hidden shadow-sm" style={{ background: C.surface, borderColor: C.line }}>
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-5"
            style={{ background: `linear-gradient(120deg, ${C.primaryDeep}, ${C.primary})` }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.14)" }}>
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-display font-semibold text-white">Daily collection summary</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(244,245,238,0.7)" }}>
                  Totals for{" "}
                  <span className="font-semibold" style={{ color: "#B8E6C6" }}>
                    {appliedDate || "All dates"}
                  </span>{" "}
                  · {rows.length} record{rows.length !== 1 ? "s" : ""} combined
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total weight collected", value: `${fmtKg(kpis.total_actual_weight_kg)} kg`, tint: `${C.leaf}14`, border: `${C.leaf}33` },
              { label: "Total trips", value: fmtKg(kpis.total_trips), tint: `${C.teal}14`, border: `${C.teal}33` },
              { label: "Points covered", value: fmtKg(kpis.collection_points_covered), tint: `${C.ochre}14`, border: `${C.ochre}33` },
              { label: "Avg weight / trip", value: `${fmtKg(kpis.average_weight_per_trip)} kg`, tint: `${C.violet}14`, border: `${C.violet}33` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: s.tint, border: `1px solid ${s.border}` }}>
                <span className="text-xs font-medium" style={{ color: C.inkSoft }}>
                  {s.label}
                </span>
                <span className="font-mono text-xl font-semibold">{s.value}</span>
              </div>
            ))}
          </div>

          {/* local body cards */}
          {plbCompare.length > 0 && (
            <div className="px-6 py-5" style={{ borderTop: `1px solid ${C.line}` }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: C.inkFaint }}>
                Local body breakdown — {plbCompare.length} location{plbCompare.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plbCompare.slice(0, 8).map((p) => (
                  <Card key={p.local_body_id} className="rounded-xl p-3.5 hover:shadow-md transition-shadow" style={{ borderColor: C.line }}>
                    <p className="text-xs font-bold">{p.local_body_name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.inkFaint }}>
                      {p.local_body_type}
                    </p>
                    <div className="text-center rounded-lg py-2 my-2" style={{ background: `${C.leaf}14` }}>
                      <p className="text-[10px] font-medium" style={{ color: C.leaf }}>
                        Weight collected
                      </p>
                      <p className="text-sm font-mono font-bold" style={{ color: C.primary }}>
                        {fmtKg(p.actual_weight_kg)} kg
                      </p>
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: C.inkFaint }}>
                      <span>
                        Trips: <strong style={{ color: C.inkSoft }}>{p.total_trips}</strong>
                      </span>
                      <span>
                        Points: <strong style={{ color: C.inkSoft }}>{p.collection_points_covered}</strong>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* detail table */}
          {rows.length > 0 && (
            <div className="px-6 py-5" style={{ borderTop: `1px solid ${C.line}` }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: C.inkFaint }}>
                Breakdown by local body &amp; waste type — {rows.length} row{rows.length !== 1 ? "s" : ""}
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: C.surfaceSunk, borderColor: C.line }} className="hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Date</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Type</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Local body</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Waste type</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Weight (kg)</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Trips</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wide font-semibold" style={{ color: C.inkFaint }}>Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((r) => (
                      <TableRow key={r.unique_id} style={{ borderColor: C.line }}>
                        <TableCell className="whitespace-nowrap font-mono text-xs" style={{ color: C.inkSoft }}>
                          {r.collection_date}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs" style={{ color: C.inkFaint }}>
                          {r.local_body_type}
                        </TableCell>
                        <TableCell className="font-semibold whitespace-nowrap text-xs">{r.local_body_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs" style={{ color: C.inkSoft }}>
                          {r.waste_type}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-xs" style={{ color: C.primary }}>
                          {fmtKg(r.actual_weight_kg)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs" style={{ color: C.inkSoft }}>
                          {r.total_trips}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs" style={{ color: C.inkSoft }}>
                          {r.collection_points_covered}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs" style={{ color: C.inkSoft }}>
                  <span>Rows per page</span>
                  <select
                    value={detailPageSize}
                    onChange={(event) => {
                      setDetailPageSize(Number(event.target.value));
                      setDetailPage(1);
                    }}
                    className="h-8 rounded-lg border px-2 font-mono outline-none"
                    style={{ borderColor: C.line, background: C.surfaceSunk, color: C.ink }}
                    aria-label="Rows per page"
                  >
                    {[10, 25, 50].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span className="font-mono">
                    {(safeDetailPage - 1) * detailPageSize + 1}–
                    {Math.min(safeDetailPage * detailPageSize, rows.length)} of {rows.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailPage((page) => Math.max(1, page - 1))}
                    disabled={safeDetailPage === 1}
                    className="h-8 w-8 rounded-lg p-0"
                    style={{ borderColor: C.line }}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {visibleDetailPages.map((page) => (
                    <Button
                      key={page}
                      type="button"
                      variant={page === safeDetailPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDetailPage(page)}
                      className="h-8 min-w-8 rounded-lg px-2 font-mono text-xs"
                      style={
                        page === safeDetailPage
                          ? { background: C.primary, color: "#fff" }
                          : { borderColor: C.line, color: C.inkSoft }
                      }
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailPage((page) => Math.min(detailPageCount, page + 1))}
                    disabled={safeDetailPage === detailPageCount}
                    className="h-8 w-8 rounded-lg p-0"
                    style={{ borderColor: C.line }}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {loading && (
        <div className="px-6 md:px-10 pb-10">
          <Card className="rounded-2xl p-12 flex items-center justify-center gap-3 text-sm shadow-sm" style={{ background: C.surface, borderColor: C.line, color: C.inkFaint }}>
            <span
              className="animate-spin h-5 w-5 rounded-full"
              style={{ border: `2px solid ${C.line}`, borderTopColor: C.leaf }}
            />
            Loading daily data…
          </Card>
        </div>
      )}
    </div>
  );
}
