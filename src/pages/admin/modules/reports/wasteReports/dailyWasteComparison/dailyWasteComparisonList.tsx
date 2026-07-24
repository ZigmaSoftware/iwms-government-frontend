import type {
  DailyReportResponse,
  DailyReportRow,
  LocationComparisonRow,
  WasteTypeBreakdownRow,
} from "./types";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
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
} from "@/helpers/admin";
import { api } from "@/api";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";
import { scopeOption, scopeFieldState, type ScopeLevel } from "../../../masters/shared/dataScopeOptions";

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
  bg: "#F4F5EE",
  surface: "#FFFFFF",
  surfaceSunk: "#EEF0E6",
  ink: "#152420",
  inkSoft: "#5D6B60",
  inkFaint: "#93A096",
  line: "#E2E5D9",
  primary: "#1F5B44",
  primaryDeep: "#123A2B",
  leaf: "#3FA66A",
  teal: "#2C6E8E",
  ochre: "#D98E2B",
  brick: "#B84A3E",
  violet: "#7C6FAE",
} as const;

const WASTE_PALETTE: string[] = [C.leaf, C.teal, C.ochre, C.violet, C.brick, C.primary, "#3E8E7E"];
const OTHER_SLICE_COLOR = "#9CA3AF";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.dwcr{font-family:'Manrope',system-ui,sans-serif;color:${C.ink};background:${C.bg};}
.dwcr .font-display{font-family:'Fraunces',serif;}
.dwcr .font-mono{font-family:'IBM Plex Mono',monospace;}
.dwcr ::-webkit-scrollbar{height:6px;width:6px;}
.dwcr ::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px;}
.dwcr .dwcr-select > button{background:${C.surfaceSunk};border-color:${C.line};color:${C.ink};font-size:0.75rem;height:2.25rem;}
.dwcr .dwcr-select-dark > button{background:rgba(255,255,255,0.14);border-color:transparent;color:#fff;height:2.5rem;}
.dwcr .dwcr-select-dark > button svg{color:#fff;opacity:0.7;}
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
  const scoped = scopeOption(level);
  if (!scoped) return records;
  if (records.some((r) => resolveGeoId(r) === scoped.value)) return records;
  return [{ unique_id: scoped.value, name: scoped.label, ...extra }, ...records];
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

/* ══════════════════════════════════════════════════════════════════
   SIGNATURE ELEMENT — weighbridge dial
══════════════════════════════════════════════════════════════════ */
interface Point {
  x: number;
  y: number;
}

function polar(cx: number, cy: number, r: number, deg: number): Point {
  const rad = ((deg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function WeighDial({ value, max, unit = "kg" }: { value: number; max: number; unit?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const sweep = pct * 180;
  const needle = polar(110, 110, 78, sweep);
  const ticks: number[] = [0, 25, 50, 75, 100];
  return (
    <svg viewBox="0 0 220 128" className="w-full max-w-[260px]">
      <path d={arcPath(110, 110, 92, 0, 180)} fill="none" stroke={C.line} strokeWidth={14} strokeLinecap="round" />
      <path d={arcPath(110, 110, 92, 0, Math.max(sweep, 2))} fill="none" stroke={C.leaf} strokeWidth={14} strokeLinecap="round" />
      {ticks.map((t) => {
        const p1 = polar(110, 110, 100, t * 1.8);
        const p2 = polar(110, 110, 108, t * 1.8);
        return <line key={t} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={C.inkFaint} strokeWidth={1.5} />;
      })}
      <line x1={110} y1={110} x2={needle.x} y2={needle.y} stroke={C.primaryDeep} strokeWidth={3} strokeLinecap="round" />
      <circle cx={110} cy={110} r={7} fill={C.primaryDeep} />
      <text x={110} y={98} textAnchor="middle" className="font-mono" fontSize={22} fontWeight={600} fill={C.ink}>
        {value.toLocaleString("en-IN")}
      </text>
      <text x={110} y={114} textAnchor="middle" className="font-mono" fontSize={10} fill={C.inkSoft} letterSpacing={1.5}>
        {unit.toUpperCase()} TODAY
      </text>
    </svg>
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

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that filter field shows pre-filled and disabled rather than an
  // editable dropdown — they can't see data outside their own scope anyway.
  // Several scoped values (or none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const localBodyScope = localBodyLevel ? scopeFieldState(LOCAL_BODY_SCOPE_LEVEL[localBodyLevel]) : null;

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId) setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId) setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId) setAreaTypeId(areaTypeScope.options[0].value);
    if (localBodyScope?.mode === "locked" && !localBodyId) setLocalBodyId(localBodyScope.options[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, areaTypeScope.mode, localBodyScope?.mode, stateId, districtId, areaTypeId, localBodyId]);

  /* fetch state/district/area type/local body dropdowns */
  useEffect(() => {
    let cancelled = false;

    // The State/District/Area Type/local-body screens may not be
    // permission-granted to this user at all (View gates their own
    // menu/list, not these report filter dropdowns) — their Data Scope
    // from login always supplies their own hierarchy values regardless.
    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    const applyScopeFallback = (records: {
      states: Record<string, unknown>[];
      districts: Record<string, unknown>[];
      areaTypes: Record<string, unknown>[];
      corporations: Record<string, unknown>[];
      municipalities: Record<string, unknown>[];
      townPanchayats: Record<string, unknown>[];
      panchayatUnions: Record<string, unknown>[];
      panchayats: Record<string, unknown>[];
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
    };

    Promise.all([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ])
      .then(
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
          if (cancelled) return;
          applyScopeFallback({
            states: toRecordList(stateRes),
            districts: toRecordList(districtRes),
            areaTypes: toRecordList(areaTypeRes),
            corporations: toRecordList(corporationRes),
            municipalities: toRecordList(municipalityRes),
            townPanchayats: toRecordList(townPanchayatRes),
            panchayatUnions: toRecordList(panchayatUnionRes),
            panchayats: toRecordList(panchayatRes),
          });
        },
      )
      .catch(() => {
        if (cancelled) return;
        applyScopeFallback({
          states: [],
          districts: [],
          areaTypes: [],
          corporations: [],
          municipalities: [],
          townPanchayats: [],
          panchayatUnions: [],
          panchayats: [],
        });
        if (
          !scopeOption("state") &&
          !scopeOption("district") &&
          !scopeOption("area_type") &&
          !scopeOption("corporation") &&
          !scopeOption("municipality") &&
          !scopeOption("town_panchayat") &&
          !scopeOption("panchayat_union") &&
          !scopeOption("panchayat")
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
    // A locked field can't be cleared to blank — it snaps back to the
    // user's own scoped value instead of leaving a disabled, empty select.
    setStateId(stateScope.mode === "locked" ? stateScope.options[0].value : "");
    setDistrictId(districtScope.mode === "locked" ? districtScope.options[0].value : "");
    setAreaTypeId(areaTypeScope.mode === "locked" ? areaTypeScope.options[0].value : "");
    setAreaTypeCategory("");
    setLocalBodyLevel("");
    setLocalBodyId("");
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
          className="rounded-3xl overflow-hidden relative"
          style={{ background: `linear-gradient(120deg, ${C.primaryDeep} 0%, ${C.primary} 62%, #2C6E52 100%)` }}
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 px-7 md:px-10 py-8">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                    <Leaf className="h-4 w-4" style={{ color: "#B8E6C6" }} />
                  </div>
                  <span className="font-mono text-[11px] tracking-[0.2em]" style={{ color: "#B8E6C6" }}>
                    CIVIC SANITATION · COLLECTION LEDGER
                  </span>
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold text-white leading-tight">Daily Waste Collection Report</h1>
                <p className="mt-2 text-sm max-w-md" style={{ color: "rgba(244,245,238,0.72)" }}>
                  Every load, weighed and logged — total weight, trips, and composition across every local body on record.
                </p>
              </div>

              {/* ── toolbar ── */}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={dateValue}
                  max={todayValue()}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-auto rounded-xl border-0 h-10 text-sm"
                  style={{ background: "rgba(255,255,255,0.14)", color: "white", colorScheme: "dark" }}
                />
                <div className="w-40">
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
                  className="rounded-xl font-semibold transition-transform hover:scale-[1.03]"
                  style={{ background: C.leaf, color: C.primaryDeep }}
                >
                  Go
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDateValue("");
                    setAppliedDate("");
                  }}
                  className="rounded-xl font-semibold bg-transparent hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.3)", color: "white" }}
                >
                  All dates
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={!rows.length || exporting}
                  className="flex items-center gap-1.5 rounded-xl font-semibold ml-auto transition-transform hover:scale-[1.03]"
                  style={{ background: "rgba(255,255,255,0.14)", color: "white" }}
                >
                  <Download className="h-3.5 w-3.5" /> {exporting ? "Downloading…" : "Download all"}
                </Button>
              </div>
            </div>

            {/* ── signature weighbridge dial ── */}
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-4"
              style={{ background: "rgba(244,245,238,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <WeighDial value={kpis.total_actual_weight_kg} max={dayMax} unit="kg" />
              <p className="text-[11px] mt-1 font-mono tracking-wide" style={{ color: "rgba(244,245,238,0.6)" }}>
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
            {(stateId || districtId || areaTypeId || localBodyId) && (
              <Button variant="link" onClick={clearLocalBodyFilter} className="h-auto p-0 text-xs font-semibold" style={{ color: C.teal }}>
                Clear filter
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <FilterSelect
              value={stateId}
              onChange={(v) => {
                setStateId(v);
                setDistrictId("");
                setAreaTypeId("");
                setAreaTypeCategory("");
                setLocalBodyLevel("");
                setLocalBodyId("");
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
                setLocalBodyId("");
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
                setLocalBodyId("");
              }}
              placeholder={districtId ? "Select area type" : "Select a district first"}
              disabled={!districtId || areaTypeScope.mode === "locked"}
              options={toGeoOptions(filteredAreaTypes)}
            />
            <FilterSelect
              value={localBodyLevel}
              onChange={(v) => {
                setLocalBodyLevel(v as LocalBodyLevel);
                setLocalBodyId("");
              }}
              placeholder={areaTypeCategory ? "Select local body type" : "Select an area type first"}
              disabled={!areaTypeCategory}
              options={availableLocalBodyLevels}
            />
            <FilterSelect
              value={localBodyId}
              onChange={setLocalBodyId}
              placeholder={
                localBodyLevel
                  ? `Select ${localBodyLevels.find((l) => l.value === localBodyLevel)?.label}`
                  : "Select a local body type first"
              }
              disabled={!localBodyLevel || localBodyScope?.mode === "locked"}
              options={localBodyOptions}
            />
          </div>

          {localBodyId && (
            <p className="mt-3 text-xs" style={{ color: C.inkFaint }}>
              Showing data for{" "}
              <span className="font-semibold" style={{ color: C.ink }}>
                {selectedLocalBodyLabel}
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
                    {rows.map((r) => (
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
