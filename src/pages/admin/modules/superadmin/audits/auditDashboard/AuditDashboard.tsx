import type {
  AuditDashboardPage,
  AuditDashboardRow,
  AuditDashboardSummary,
  AuditModuleKey,
} from "./types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { saveAs } from "file-saver";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import type { PaginatorPageChangeEvent } from "primereact/paginator";
import { ListPaginator } from "@/components/common/ListPaginator";
import { DEFAULT_ROWS_PER_PAGE_OPTIONS } from "@/components/common/paginatorDefaults";

import notify from "@/lib/notify";
import { ChevronDown, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Combobox } from "@/components/ui/combobox";
import ReportMultiSelect from "@/pages/admin/modules/reports/wasteReports/ReportMultiSelect";
import { geoApi } from "@/features/complaintTicketing/api";
import { api } from "@/api";
import type { GeoOption, LocalBodyOption, LocalBodyType } from "@/features/complaintTicketing/types";
import { adminApi } from "@/helpers/admin/registry";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { useTheme } from "@/contexts/ThemeContext";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

const auditDashboardApi = adminApi.auditDashboard;

const PAGE_SIZES = DEFAULT_ROWS_PER_PAGE_OPTIONS;
const RANGES = [7, 30, 90] as const;
const ALL = "";
/** "All" item value for the searchable pickers (an empty item value can't be selected) */
const ANY = "__all__";

type GeoScope = {
  state: string;
  district: string;
  areaType: string;
  lbType: LocalBodyType | "";
  localBodyIds: string[];
};
const EMPTY_GEO: GeoScope = { state: "", district: "", areaType: "", lbType: "", localBodyIds: [] };
const LB_TYPES: LocalBodyType[] = ["corporation", "municipality", "town_panchayat", "panchayat_union", "panchayat"];
const LB_TYPE_LABEL: Record<LocalBodyType, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};
const AREA_LB_TYPES: Record<"urban" | "rural", LocalBodyType[]> = {
  urban: ["corporation", "municipality", "town_panchayat"],
  rural: ["panchayat_union", "panchayat"],
};
const LB_SOURCES: Array<{ type: LocalBodyType; path: string; nameKey: string }> = [
  { type: "corporation", path: "/masters/corporations/", nameKey: "corporation_name" },
  { type: "municipality", path: "/masters/municipalities/", nameKey: "municipality_name" },
  { type: "town_panchayat", path: "/masters/town-panchayats/", nameKey: "town_panchayat_name" },
  { type: "panchayat_union", path: "/masters/panchayat-unions/", nameKey: "union_name" },
  { type: "panchayat", path: "/masters/panchayat/", nameKey: "panchayat_name" },
];
const areaCategoryOf = (name: string): "urban" | "rural" | "" => {
  const n = name.toLowerCase();
  return n.includes("urban") ? "urban" : n.includes("rural") ? "rural" : "";
};

/* ---------- Formatting ---------- */

const formatDateTime = (value?: string | number | boolean | null) =>
  typeof value === "string"
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const dash = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

type Tone = "ok" | "info" | "warn" | "bad" | "neutral";

const BADGE_CLASSES: Record<Tone, string> = {
  ok: "bg-[#e3f6e8] text-[#167a37] dark:bg-green-900/40 dark:text-green-300",
  info: "bg-[#e3eefc] text-[#2357a0] dark:bg-blue-900/40 dark:text-blue-300",
  warn: "bg-[#fff3d6] text-[#9a6c00] dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-[#fde4e4] text-[#b42626] dark:bg-red-900/40 dark:text-red-300",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

const Badge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span
    className={`inline-block rounded-full px-[9px] py-0.5 text-xs font-medium ${BADGE_CLASSES[tone]}`}
  >
    {children}
  </span>
);

const KPI_BORDER: Record<Tone, string> = {
  ok: "border-l-[#1f9d47]",
  info: "border-l-[#2f72c9]",
  warn: "border-l-[#d99a06]",
  bad: "border-l-[#d63b3b]",
  neutral: "border-l-[#1f9d47]",
};

const PALETTE = [
  "#1f9d47",
  "#2f72c9",
  "#d99a06",
  "#ef5a1c",
  "#d63b3b",
  "#7a5bd1",
  "#0f9488",
  "#9ca3af",
];

/* ---------- Module definitions ---------- */

type KpiDef = {
  key: string;
  label: string;
  tone?: Tone;
  format?: (value: number | null) => string;
};

type ColumnDef = {
  key: string;
  header: string;
  render: (row: AuditDashboardRow) => ReactNode;
  /** Plain text for the CSV export; defaults to the raw field. */
  csv: (row: AuditDashboardRow) => string;
};

type ModuleDef = {
  name: string;
  trendLabel: string;
  splitTitle: string;
  /** Slice labels by key; otherwise the server's label is shown. */
  splitLabels?: Record<string, string>;
  kpis: KpiDef[];
  columns: ColumnDef[];
};

const MODULE_KEYS: AuditModuleKey[] = ["common", "login", "access", "complaint"];

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const field = (key: string, header: string): ColumnDef => ({
  key,
  header,
  render: (row) => dash(row[key]),
  csv: (row) => dash(row[key]),
});

const badgeColumn = (
  key: string,
  header: string,
  tones: Record<string, Tone>,
  labels: Record<string, string> = {},
  labelKey?: string,
): ColumnDef => {
  const text = (row: AuditDashboardRow) =>
    dash((labelKey && row[labelKey]) || labels[String(row[key])] || row[key]);
  return {
    key,
    header,
    render: (row) => (
      <Badge tone={tones[String(row[key])] ?? "neutral"}>{text(row)}</Badge>
    ),
    csv: text,
  };
};

/**
 * Per-trail KPIs and columns. Government has no projects: every trail ends
 * with the row's district and local body instead.
 */
const buildModules = (t: TFunction): Record<AuditModuleKey, ModuleDef> => {
  const percent = (value: number | null) => (value === null ? "–" : `${value}%`);
  const hours = (value: number | null) =>
    value === null
      ? "–"
      : t("admin.audit_dashboard.hours_value", "{{value}} hrs", { value });

  const dateColumn: ColumnDef = {
    key: "date",
    header: t("admin.audit_dashboard.col_date", "Date"),
    render: (row) => formatDateTime(row.date),
    csv: (row) => formatDateTime(row.date),
  };
  const geoColumns = [
    field("district", t("admin.audit_dashboard.col_district", "District")),
    field("local_body", t("admin.audit_dashboard.col_local_body", "Local body")),
  ];

  const actionLabels: Record<string, string> = {
    CREATE: t("admin.audit_dashboard.action_create", "Create"),
    UPDATE: t("admin.audit_dashboard.action_update", "Update"),
    DELETE: t("admin.audit_dashboard.action_delete", "Delete"),
    OTHER: t("admin.audit_dashboard.action_other", "Export / import"),
    SUCCESS: t("admin.audit_dashboard.status_success", "Success"),
    FAILED: t("admin.audit_dashboard.status_failed", "Failed"),
    CREATED: t("admin.audit_dashboard.change_created", "Granted"),
    UPDATED: t("admin.audit_dashboard.change_updated", "Updated"),
    DELETED: t("admin.audit_dashboard.change_deleted", "Revoked"),
  };

  return {
    common: {
      name: t("admin.audit_dashboard.module_common", "Common Audit"),
      trendLabel: t("admin.audit_dashboard.common_trend", "Changes per day"),
      splitTitle: t("admin.audit_dashboard.common_split", "Changes by action"),
      splitLabels: actionLabels,
      kpis: [
        { key: "total", label: t("admin.audit_dashboard.common_total", "Total changes") },
        {
          key: "updates",
          label: t("admin.audit_dashboard.common_updates", "Updates"),
          tone: "info",
        },
        {
          key: "deletions",
          label: t("admin.audit_dashboard.common_deletions", "Deletions"),
          tone: "bad",
        },
        {
          key: "active_users",
          label: t("admin.audit_dashboard.common_active_users", "Active users"),
        },
      ],
      columns: [
        dateColumn,
        field("user", t("admin.audit_dashboard.col_user", "User")),
        field("module", t("admin.audit_dashboard.col_module", "Module")),
        badgeColumn(
          "action",
          t("admin.audit_dashboard.col_action", "Action"),
          { CREATE: "ok", UPDATE: "info", DELETE: "bad" },
          actionLabels,
        ),
        field("record", t("admin.audit_dashboard.col_record", "Record")),
        ...geoColumns,
      ],
    },
    login: {
      name: t("admin.audit_dashboard.module_login", "Login Audit"),
      trendLabel: t("admin.audit_dashboard.login_trend", "Logins per day"),
      splitTitle: t("admin.audit_dashboard.login_split", "Login outcome"),
      splitLabels: actionLabels,
      kpis: [
        { key: "total", label: t("admin.audit_dashboard.login_total", "Total logins") },
        {
          key: "success_rate",
          label: t("admin.audit_dashboard.login_success_rate", "Success rate"),
          format: percent,
        },
        {
          key: "failed",
          label: t("admin.audit_dashboard.login_failed", "Failed attempts"),
          tone: "warn",
        },
        {
          key: "unique_users",
          label: t("admin.audit_dashboard.login_unique_users", "Users signed in"),
        },
      ],
      columns: [
        dateColumn,
        field("user", t("admin.audit_dashboard.col_user", "User")),
        field("device", t("admin.audit_dashboard.col_device", "Device")),
        field("ip", t("admin.audit_dashboard.col_ip", "IP address")),
        badgeColumn(
          "status",
          t("admin.audit_dashboard.col_status", "Status"),
          { SUCCESS: "ok", FAILED: "warn" },
          actionLabels,
        ),
        ...geoColumns,
      ],
    },
    access: {
      name: t("admin.audit_dashboard.module_access", "User Access Audit"),
      trendLabel: t("admin.audit_dashboard.access_trend", "Access changes per day"),
      splitTitle: t("admin.audit_dashboard.access_split", "Changes by source"),
      kpis: [
        { key: "total", label: t("admin.audit_dashboard.access_total", "Access changes") },
        {
          key: "created",
          label: t("admin.audit_dashboard.access_created", "Access granted"),
          tone: "info",
        },
        {
          key: "updated",
          label: t("admin.audit_dashboard.access_updated", "Access updated"),
          tone: "warn",
        },
        {
          key: "deleted",
          label: t("admin.audit_dashboard.access_deleted", "Access revoked"),
          tone: "bad",
        },
      ],
      columns: [
        dateColumn,
        field("user", t("admin.audit_dashboard.col_changed_by", "Changed by")),
        field("target", t("admin.audit_dashboard.col_access_for", "Access for")),
        field("source_label", t("admin.audit_dashboard.col_source", "Source")),
        badgeColumn(
          "change",
          t("admin.audit_dashboard.col_change", "Change"),
          { CREATED: "ok", UPDATED: "info", DELETED: "bad" },
          actionLabels,
        ),
        {
          // Grants added / removed by an access save; legacy per-grant
          // rows carry no snapshot and show "-".
          key: "grants",
          header: t("admin.audit_dashboard.col_grants", "Granted / revoked"),
          render: (row) =>
            row.granted === null || row.granted === undefined ? (
              "-"
            ) : (
              <span>
                <span className="text-[#1f9d47]">+{String(row.granted)}</span>
                {" / "}
                <span className="text-[#d63b3b]">−{String(row.revoked ?? 0)}</span>
              </span>
            ),
          csv: (row) =>
            row.granted === null || row.granted === undefined
              ? "-"
              : `+${row.granted} / -${row.revoked ?? 0}`,
        },
        ...geoColumns,
      ],
    },
    complaint: {
      name: t("admin.audit_dashboard.module_complaint", "Complaint Audit"),
      trendLabel: t("admin.audit_dashboard.complaint_trend", "Complaints per day"),
      splitTitle: t("admin.audit_dashboard.complaint_split", "Complaint status"),
      kpis: [
        { key: "total", label: t("admin.audit_dashboard.complaint_total", "Complaints") },
        {
          key: "resolved_rate",
          label: t("admin.audit_dashboard.complaint_resolved", "Resolved"),
          format: percent,
        },
        {
          key: "avg_resolution_hours",
          label: t("admin.audit_dashboard.complaint_avg_resolution", "Avg resolution time"),
          tone: "info",
          format: hours,
        },
        {
          key: "escalated",
          label: t("admin.audit_dashboard.complaint_escalated", "Escalated"),
          tone: "bad",
        },
      ],
      columns: [
        dateColumn,
        field("ticket_no", t("admin.audit_dashboard.col_complaint", "Complaint")),
        field("category", t("admin.audit_dashboard.col_category", "Category")),
        field("user", t("admin.audit_dashboard.col_assigned_to", "Assigned to")),
        badgeColumn(
          "status",
          t("admin.audit_dashboard.col_status", "Status"),
          {
            RESOLVED: "ok",
            CLOSED: "ok",
            IN_PROGRESS: "info",
            ESCALATED: "bad",
            REOPENED: "warn",
            SUBMITTED: "warn",
          },
          {},
          "status_label",
        ),
        {
          key: "tat_hours",
          header: t("admin.audit_dashboard.col_tat", "TAT (hrs)"),
          // Unresolved tickets show time open so far.
          render: (row) =>
            row.tat_hours === null || row.tat_hours === undefined ? (
              "-"
            ) : row.resolved ? (
              String(row.tat_hours)
            ) : (
              <span className="text-[#66756b] dark:text-gray-400">
                {t("admin.audit_dashboard.tat_open", "{{value}} (open)", {
                  value: row.tat_hours,
                })}
              </span>
            ),
          csv: (row) => dash(row.tat_hours),
        },
        ...geoColumns,
      ],
    },
  };
};

/* ---------- Page ---------- */

const selectClass =
  "rounded-lg border border-[#dfe8e2] bg-white px-[10px] py-[7px] text-sm text-[#1d2b22] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f9d47] dark:border-[#26352b] dark:bg-[#17221b] dark:text-[#e6efe8]";
const comboTrigger =
  "h-9 rounded-lg border-[#dfe8e2] bg-white px-[10px] text-sm text-[#1d2b22] dark:border-[#26352b] dark:bg-[#17221b] dark:text-[#e6efe8]";
const panelClass =
  "rounded-[10px] border border-[#dfe8e2] bg-white p-4 dark:border-[#26352b] dark:bg-[#17221b]";

export default function AuditDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [current, setCurrent] = useState<AuditModuleKey>("common");
  const [days, setDays] = useState<number>(30);
  /* location scope: State → District → Area type → Local body type →
     Local bodies, the same cascade as the waste comparison reports. The
     audit API narrows by district_id / local_body_id (repeatable), so the
     upper levels are turned into those ids (see `scopeIds`). */
  const [geo, setGeo] = useState<GeoScope>(EMPTY_GEO);
  const [states, setStates] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [areaTypes, setAreaTypes] = useState<GeoOption[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBodyOption[]>([]);
  const [localBodiesLoading, setLocalBodiesLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);

  const [summary, setSummary] = useState<AuditDashboardSummary | null>(null);
  const [records, setRecords] = useState<AuditDashboardPage | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);

  const summaryRequest = useRef(0);
  const recordsRequest = useRef(0);

  const modules = useMemo(() => buildModules(t), [t]);
  const module = modules[current];

  const selectedArea = areaTypes.find((a) => a.unique_id === geo.areaType);
  const areaCategory = areaCategoryOf(selectedArea?.name ?? "");
  const lbTypes = areaCategory ? AREA_LB_TYPES[areaCategory] : LB_TYPES;
  const scopedLocalBodies = useMemo(
    () =>
      localBodies.filter(
        (lb) =>
          (!geo.areaType || !lb.area_type_id || lb.area_type_id === geo.areaType) &&
          (!areaCategory || AREA_LB_TYPES[areaCategory].includes(lb.type)) &&
          (!geo.lbType || lb.type === geo.lbType),
      ),
    [localBodies, geo.areaType, geo.lbType, areaCategory],
  );

  /** what the API is narrowed to for the current cascade selection */
  const scopeIds = useMemo((): { district_id?: string; local_body_id?: string } => {
    if (geo.localBodyIds.length) return { local_body_id: geo.localBodyIds.join(",") };
    if (geo.district && (geo.areaType || geo.lbType) && !localBodiesLoading)
      // every local body of the picked area / type in that district (none
      // matching → an id no row has, i.e. an honest empty result)
      return { local_body_id: scopedLocalBodies.map((lb) => lb.unique_id).join(",") || "__none__" };
    if (geo.district) return { district_id: geo.district };
    if (geo.state)
      return {
        district_id:
          districts.filter((d) => d.state_id === geo.state).map((d) => d.unique_id).join(",") || "__none__",
      };
    return {};
  }, [geo, scopedLocalBodies, districts, localBodiesLoading]);

  // keyed by value: the fetch effects depend on this object, so it must only
  // change when the ids actually change
  const scopeKey = JSON.stringify(scopeIds);
  const scopeParams = useMemo(
    () => ({ module: current, days, ...(JSON.parse(scopeKey) as typeof scopeIds) }),
    [current, days, scopeKey],
  );

  // States / districts once; area types and local bodies per district.
  useEffect(() => {
    geoApi.states().then(setStates).catch(() => setStates([]));
    geoApi.districts().then(setDistricts).catch(() => setDistricts([]));
  }, []);
  useEffect(() => {
    if (!geo.district) {
      setAreaTypes([]);
      setLocalBodies([]);
      return;
    }
    let cancelled = false;
    geoApi.areaTypes(geo.district).then((r) => { if (!cancelled) setAreaTypes(r); }).catch(() => {});
    // the district's own local bodies only, light payload (the full masters
    // run to MBs state-wide)
    setLocalBodiesLoading(true);
    Promise.all(
      LB_SOURCES.map(({ type, path, nameKey }) =>
        api
          .get(path, { params: { lite: 1, district_id: geo.district } })
          .then(({ data }) =>
            (Array.isArray(data) ? data : data?.results ?? data?.data ?? []).map((row: Record<string, unknown>) => ({
              unique_id: String(row.unique_id),
              name: String(row[nameKey] ?? row.name ?? row.unique_id),
              type,
              district_id: geo.district,
              area_type_id: row.area_type_id ? String(row.area_type_id) : null,
            })),
          )
          .catch(() => [] as LocalBodyOption[]),
      ),
    )
      .then((lists) => { if (!cancelled) setLocalBodies(lists.flat()); })
      .finally(() => { if (!cancelled) setLocalBodiesLoading(false); });
    return () => { cancelled = true; };
  }, [geo.district]);

  const updateGeo = (patch: Partial<GeoScope>) => {
    setGeo((g) => ({ ...g, ...patch }));
    setPage(1);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const id = ++summaryRequest.current;
    setSummary(null);
    auditDashboardApi
      .read("summary/", { params: scopeParams })
      .then((data) => {
        if (id === summaryRequest.current)
          setSummary(data as AuditDashboardSummary);
      })
      .catch(() => {
        if (id === summaryRequest.current)
          notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      });
  }, [scopeParams, t]);

  useEffect(() => {
    const id = ++recordsRequest.current;
    setLoadingRecords(true);
    auditDashboardApi
      .read("records/", {
        params: {
          ...scopeParams,
          page,
          limit: rowsPerPage,
          ...(search ? { search } : {}),
        },
      })
      .then((data) => {
        if (id === recordsRequest.current)
          setRecords(data as unknown as AuditDashboardPage);
      })
      .catch(() => {
        if (id === recordsRequest.current) {
          setRecords(null);
          notify.fire(t("common.error"), t("common.fetch_failed"), "error");
        }
      })
      .finally(() => {
        if (id === recordsRequest.current) setLoadingRecords(false);
      });
  }, [scopeParams, page, rowsPerPage, search, t]);

  const switchModule = (key: AuditModuleKey) => {
    setCurrent(key);
    setPage(1);
    setSearchInput("");
    setSearch("");
  };

  // Every row matching the filters, fetched in pages since the table only
  // holds one. Logged like the other audit screens' exports.
  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const rows: AuditDashboardRow[] = [];
      for (let next = 1, total = 1; next <= total; next++) {
        const data = (await auditDashboardApi.read("records/", {
          params: {
            ...scopeParams,
            page: next,
            limit: 500,
            ...(search ? { search } : {}),
          },
        })) as unknown as AuditDashboardPage;
        rows.push(...data.results);
        total = data.total_pages;
      }
      const lines = [
        module.columns.map((c) => csvCell(c.header)).join(","),
        ...rows.map((row) =>
          module.columns.map((c) => csvCell(c.csv(row))).join(","),
        ),
      ];
      const stamp = new Date().toISOString().slice(0, 10);
      saveAs(
        new Blob(["﻿" + lines.join("\n")], {
          type: "text/csv;charset=utf-8",
        }),
        `${current}-audit-${days}d-${stamp}.csv`,
      );
      void recordExcelAudit("download_all_excel", {
        format: "csv",
        audit: current,
        days,
        district_id: scopeIds.district_id ?? null,
        local_body_id: scopeIds.local_body_id ?? null,
        search: search || null,
        rows: rows.length,
      });
    } catch {
      notify.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setExporting(false);
    }
  }, [current, days, scopeIds, module, scopeParams, search, t]);

  /* ---------- Fit to the screen ----------
     The page fills the space left in the admin shell (no page scroll);
     the records table scrolls inside its panel. Measured, since the
     shell's header / breadcrumb / paddings vary with the sidebar. */
  const rootRef = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el || window.innerWidth < 1024) return setFitHeight(null);
      const top = el.getBoundingClientRect().top + window.scrollY;
      // the shell's bottom padding / borders + anything laid out after us
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

  /* ---------- Charts ---------- */

  const gridColor = dark ? "#26352b" : "#dfe8e2";
  const tickColor = dark ? "#9aaba0" : "#66756b";

  const trendData = useMemo(
    () => ({
      labels: (summary?.trend ?? []).map((d) => formatDay(d.date)),
      datasets: [
        {
          data: (summary?.trend ?? []).map((d) => d.count),
          backgroundColor: "#1f9d47",
          borderRadius: 4,
        },
      ],
    }),
    [summary],
  );

  const trendOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: tickColor, precision: 0 },
        },
      },
    }),
    [gridColor, tickColor],
  );

  const splitData = useMemo(
    () => ({
      labels: (summary?.breakdown ?? []).map(
        (s) => module.splitLabels?.[s.key] ?? s.label,
      ),
      datasets: [
        {
          data: (summary?.breakdown ?? []).map((s) => s.count),
          backgroundColor: PALETTE,
          borderWidth: 0,
        },
      ],
    }),
    [module, summary],
  );

  const splitOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            color: tickColor,
            boxWidth: 12,
            font: { family: "Poppins" },
          },
        },
      },
    }),
    [tickColor],
  );

  /* ---------- Local body scope (popover) ---------- */

  const nameOf = (list: GeoOption[], id: string) => list.find((o) => o.unique_id === id)?.name;
  const pickedBodies = localBodies.filter((lb) => geo.localBodyIds.includes(lb.unique_id));
  const scopeActive = !!(geo.state || geo.district || geo.areaType || geo.lbType || geo.localBodyIds.length);
  const scopeLabel = pickedBodies.length
    ? pickedBodies.length === 1 ? pickedBodies[0].name : `${pickedBodies.length} local bodies`
    : geo.district
      ? [nameOf(districts, geo.district), geo.lbType ? LB_TYPE_LABEL[geo.lbType] : selectedArea?.name].filter(Boolean).join(" · ")
      : geo.state
        ? nameOf(states, geo.state) ?? t("admin.audit_dashboard.all_local_bodies", "All local bodies")
        : t("admin.audit_dashboard.all_local_bodies", "All local bodies");

  /* ---------- KPIs ---------- */

  const delta =
    summary && summary.previous_total
      ? Math.round(
          (((summary.kpis.total ?? 0) - summary.previous_total) /
            summary.previous_total) *
            100,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-3 text-sm text-[#1d2b22] dark:text-[#e6efe8]"
      style={fitHeight ? { minHeight: fitHeight } : undefined}
    >
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3">
        <h1 className="m-0 text-xl font-semibold">
          {t("admin.audit_dashboard.title", "Audit dashboard")}
        </h1>
        <p className="m-0 text-[13px] text-[#66756b] dark:text-[#9aaba0]">
          {t(
            "admin.audit_dashboard.subtitle",
            "Activity and changes across IWMS audit modules",
          )}
        </p>
      </div>
      {/* module tabs (left) + scope filters / export (right) on one row */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <nav
        role="tablist"
        className="flex gap-1.5 overflow-x-auto"
      >
        {MODULE_KEYS.map((key) => {
          const selected = key === current;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => switchModule(key)}
              className={`whitespace-nowrap rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${
                selected
                  ? "border-[#9fd7ae] bg-[#fdeee6] text-[#ef5a1c] dark:bg-[#3a2216]"
                  : "border-[#dfe8e2] bg-white text-[#66756b] hover:text-[#1d2b22] dark:border-[#26352b] dark:bg-[#17221b] dark:text-[#9aaba0] dark:hover:text-[#e6efe8]"
              }`}
            >
              {modules[key].name}
            </button>
          );
        })}
      </nav>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t("admin.audit_dashboard.date_range", "Date range")}
            className={selectClass}
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
          >
            {RANGES.map((n) => (
              <option key={n} value={n}>
                {t("admin.audit_dashboard.last_n_days", "Last {{days}} days", {
                  days: n,
                })}
              </option>
            ))}
          </select>
          {/* District / local body scope in one popover (same as the waste
              comparison reports) */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("admin.audit_dashboard.local_body", "Local body")}
                className={`${selectClass} flex max-w-[240px] items-center gap-1.5 ${scopeActive ? "!border-[#1f9d47]" : ""}`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#66756b]" />
                <span className="truncate">{scopeLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#66756b]" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[460px] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="m-0 text-xs font-bold text-[#66756b]">
                  {t("admin.audit_dashboard.filter_by_local_body", "Filter by local body")}
                </p>
                {scopeActive && (
                  <button
                    type="button"
                    onClick={() => updateGeo(EMPTY_GEO)}
                    className="text-xs font-semibold text-[#1f9d47] hover:underline"
                  >
                    {t("common.clear", "Clear")}
                  </button>
                )}
              </div>
              {/* searchable pickers, like the other filters in the app */}
              <div className="grid grid-cols-2 gap-2">
                <Combobox
                  aria-label={t("admin.audit_dashboard.state", "State")}
                  triggerClassName={comboTrigger}
                  value={geo.state || ANY}
                  searchPlaceholder={t("admin.audit_dashboard.search_state", "Search state…")}
                  options={[
                    { value: ANY, label: t("admin.audit_dashboard.all_states", "All states") },
                    ...states.map((o) => ({ value: o.unique_id, label: o.name })),
                  ]}
                  onChange={(v) => updateGeo({ ...EMPTY_GEO, state: v === ANY ? ALL : v })}
                />
                <Combobox
                  aria-label={t("admin.audit_dashboard.district", "District")}
                  triggerClassName={comboTrigger}
                  value={geo.district || ANY}
                  searchPlaceholder={t("admin.audit_dashboard.search_district", "Search district…")}
                  options={[
                    { value: ANY, label: t("admin.audit_dashboard.all_districts", "All districts") },
                    ...districts
                      .filter((d) => !geo.state || d.state_id === geo.state)
                      .map((o) => ({ value: o.unique_id, label: o.name })),
                  ]}
                  onChange={(v) => updateGeo({ ...EMPTY_GEO, state: geo.state, district: v === ANY ? ALL : v })}
                />
                <Combobox
                  aria-label={t("admin.audit_dashboard.area_type", "Area type")}
                  triggerClassName={comboTrigger}
                  value={geo.areaType || ANY}
                  disabled={!geo.district}
                  placeholder={t("admin.audit_dashboard.pick_district_first", "Select a district first")}
                  searchPlaceholder={t("admin.audit_dashboard.search_area_type", "Search area type…")}
                  options={[
                    { value: ANY, label: t("admin.audit_dashboard.all_area_types", "All area types") },
                    ...areaTypes.map((o) => ({ value: o.unique_id, label: o.name })),
                  ]}
                  onChange={(v) => updateGeo({ areaType: v === ANY ? ALL : v, lbType: "", localBodyIds: [] })}
                />
                <Combobox
                  aria-label={t("admin.audit_dashboard.local_body_type", "Local body type")}
                  triggerClassName={comboTrigger}
                  value={geo.lbType || ANY}
                  disabled={!geo.district}
                  placeholder={t("admin.audit_dashboard.pick_district_first", "Select a district first")}
                  searchPlaceholder={t("admin.audit_dashboard.search_type", "Search type…")}
                  options={[
                    { value: ANY, label: t("admin.audit_dashboard.all_local_body_types", "All local body types") },
                    ...lbTypes.map((type) => ({ value: type, label: LB_TYPE_LABEL[type] })),
                  ]}
                  onChange={(v) => updateGeo({ lbType: v === ANY ? "" : (v as LocalBodyType), localBodyIds: [] })}
                />
                <div className="col-span-2">
                  <ReportMultiSelect
                    value={geo.localBodyIds}
                    onChange={(ids) => updateGeo({ localBodyIds: ids })}
                    options={scopedLocalBodies.map((lb) => ({
                      value: lb.unique_id,
                      label: geo.lbType ? lb.name : `${lb.name} (${LB_TYPE_LABEL[lb.type]})`,
                    }))}
                    placeholder={
                      localBodiesLoading
                        ? t("admin.audit_dashboard.loading", "Loading…")
                        : geo.district
                        ? t("admin.audit_dashboard.pick_local_bodies", "Select local bod(ies)")
                        : t("admin.audit_dashboard.pick_district_first", "Select a district first")
                    }
                    disabled={!geo.district || localBodiesLoading || !scopedLocalBodies.length}
                    ariaLabel={t("admin.audit_dashboard.local_bodies", "Local bodies")}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || !records?.count}
            className="rounded-lg border border-[#1f9d47] bg-[#1f9d47] px-[10px] py-[7px] text-sm font-medium text-white hover:bg-[#167a37] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting
              ? t("admin.audit_dashboard.exporting", "Exporting…")
              : t("admin.audit_dashboard.export_csv", "Export CSV")}
          </button>
        </div>
      </header>


      <section className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {module.kpis.map((kpi, i) => {
          const value = summary ? (summary.kpis[kpi.key] ?? null) : null;
          return (
            <div
              key={kpi.key}
              className={`rounded-[10px] border border-l-4 border-[#dfe8e2] bg-white px-4 py-2.5 dark:border-[#26352b] dark:bg-[#17221b] ${
                KPI_BORDER[kpi.tone ?? "ok"]
              }`}
            >
              <div className="text-[#66756b] dark:text-[#9aaba0]">
                {kpi.label}
              </div>
              <div className="text-[24px] font-semibold leading-tight">
                {summary ? (kpi.format ? kpi.format(value) : dash(value)) : "…"}
              </div>
              {i === 0 && delta !== null ? (
                <div
                  className={`mt-0.5 text-xs ${delta >= 0 ? "text-[#1f9d47]" : "text-[#d63b3b]"}`}
                >
                  {t(
                    "admin.audit_dashboard.vs_previous",
                    "{{delta}}% vs previous period",
                    { delta: `${delta >= 0 ? "+" : ""}${delta}` },
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
        <div className={`${panelClass} lg:col-span-2`}>
          <h2 className="mb-2 mt-0 text-sm font-semibold">
            {module.trendLabel}
          </h2>
          <div className="relative h-[150px]">
            <Bar data={trendData} options={trendOptions} />
          </div>
        </div>
        <div className={panelClass}>
          <h2 className="mb-2 mt-0 text-sm font-semibold">
            {module.splitTitle}
          </h2>
          <div className="relative h-[150px]">
            {summary && summary.breakdown.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[#66756b] dark:text-[#9aaba0]">
                {t(
                  "admin.audit_dashboard.no_activity",
                  "No activity in this period",
                )}
              </div>
            ) : (
              <Doughnut data={splitData} options={splitOptions} />
            )}
          </div>
        </div>
      </section>

      <section className={`${panelClass} flex h-[560px] min-h-0 flex-col lg:h-auto lg:min-h-[230px] lg:shrink lg:grow lg:basis-[0px]`}>
        <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold">
            {t("admin.audit_dashboard.records_title", "{{module}} records", {
              module: module.name,
            })}
          </h2>
          <input
            type="search"
            aria-label={t("admin.audit_dashboard.search_label", "Search records")}
            placeholder={t(
              "admin.audit_dashboard.search_placeholder",
              "Search user, action, record…",
            )}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${selectClass} w-full sm:w-[290px]`}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table
            className={`w-full min-w-[680px] border-collapse ${loadingRecords ? "opacity-60" : ""}`}
          >
            <thead className="sticky top-0 z-10 bg-white dark:bg-[#17221b]">
              <tr>
                {module.columns.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap border-b border-[#dfe8e2] px-2.5 py-[9px] text-left text-[13px] font-medium text-[#66756b] dark:border-[#26352b] dark:text-[#9aaba0]"
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records?.results.length ? (
                records.results.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#e6f5ea] dark:hover:bg-[#1b3323]"
                  >
                    {module.columns.map((c) => (
                      <td
                        key={c.key}
                        className="whitespace-nowrap border-b border-[#dfe8e2] px-2.5 py-2 text-left dark:border-[#26352b]"
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={module.columns.length}
                    className="p-6 text-center text-[#66756b] dark:text-[#9aaba0]"
                  >
                    {loadingRecords
                      ? t("admin.audit_dashboard.loading", "Loading…")
                      : t(
                          "admin.audit_dashboard.no_records",
                          "No records match these filters. Widen the date range or clear the search.",
                        )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ListPaginator
          className="mt-1 shrink-0 bg-transparent p-0 text-xs [&_.p-dropdown]:!h-8 [&_.p-dropdown-label]:!py-1 [&_.p-dropdown-label]:!text-xs [&_.p-paginator-current]:!h-8 [&_.p-paginator-element]:!h-8 [&_.p-paginator-element]:!min-w-8 [&_.p-paginator-element]:!text-xs"
          first={(page - 1) * rowsPerPage}
          rows={rowsPerPage}
          totalRecords={records?.count ?? 0}
          rowsPerPageOptions={PAGE_SIZES}
          onPageChange={(event: PaginatorPageChangeEvent) => {
            setRowsPerPage(event.rows);
            setPage(event.page + 1);
          }}
        />
      </section>
    </div>
  );
}
