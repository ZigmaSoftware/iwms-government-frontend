import type {
  AuditDashboardFilterOptions,
  AuditDashboardPage,
  AuditDashboardRow,
  AuditDashboardSummary,
  AuditModuleKey,
} from "./types";
import {
  useCallback,
  useEffect,
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
import { Paginator, type PaginatorPageChangeEvent } from "primereact/paginator";

import notify from "@/lib/notify";
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

const PAGE_SIZES = [10, 25, 50, 100];
const RANGES = [7, 30, 90] as const;
const ALL = "";

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
const panelClass =
  "rounded-[10px] border border-[#dfe8e2] bg-white p-4 dark:border-[#26352b] dark:bg-[#17221b]";

export default function AuditDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [current, setCurrent] = useState<AuditModuleKey>("common");
  const [days, setDays] = useState<number>(30);
  const [districtId, setDistrictId] = useState(ALL);
  const [localBodyId, setLocalBodyId] = useState(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZES[0]);

  const [options, setOptions] = useState<AuditDashboardFilterOptions | null>(
    null,
  );
  const [summary, setSummary] = useState<AuditDashboardSummary | null>(null);
  const [records, setRecords] = useState<AuditDashboardPage | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);

  const summaryRequest = useRef(0);
  const recordsRequest = useRef(0);
  const optionsRequest = useRef(0);

  const modules = useMemo(() => buildModules(t), [t]);
  const module = modules[current];

  const scopeParams = useMemo(
    () => ({
      module: current,
      days,
      ...(districtId ? { district_id: districtId } : {}),
      ...(localBodyId ? { local_body_id: localBodyId } : {}),
    }),
    [current, days, districtId, localBodyId],
  );

  // Districts / local bodies come from the selected trail's rows the
  // requester may see, so they are reloaded per trail; a selection the new
  // list no longer offers is dropped.
  useEffect(() => {
    const id = ++optionsRequest.current;
    auditDashboardApi
      .read("filter-options", {
        params: {
          module: current,
          ...(districtId ? { district_id: districtId } : {}),
        },
      })
      .then((data) => {
        if (id !== optionsRequest.current) return;
        const next = data as AuditDashboardFilterOptions;
        setOptions(next);
        setDistrictId((prev) =>
          prev && !next.districts.some((o) => o.unique_id === prev) ? ALL : prev,
        );
        setLocalBodyId((prev) =>
          prev && !next.local_bodies.some((o) => o.unique_id === prev)
            ? ALL
            : prev,
        );
      })
      .catch(() => {
        // Non-fatal: the scope dropdowns just offer "All".
      });
  }, [current, districtId]);

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
        district_id: districtId || null,
        local_body_id: localBodyId || null,
        search: search || null,
        rows: rows.length,
      });
    } catch {
      notify.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setExporting(false);
    }
  }, [current, days, districtId, localBodyId, module, scopeParams, search, t]);

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
          position: "bottom" as const,
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
    <div className="p-3 text-sm text-[#1d2b22] dark:text-[#e6efe8]">
      <header className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-semibold">
            {t("admin.audit_dashboard.title", "Audit dashboard")}
          </h1>
          <p className="mt-0.5 text-[#66756b] dark:text-[#9aaba0]">
            {t(
              "admin.audit_dashboard.subtitle",
              "Activity and changes across IWMS audit modules",
            )}
          </p>
        </div>
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
          <select
            aria-label={t("admin.audit_dashboard.district", "District")}
            className={selectClass}
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              // The local body list narrows to the district picked.
              setLocalBodyId(ALL);
              setPage(1);
            }}
          >
            <option value={ALL}>
              {t("admin.audit_dashboard.all_districts", "All districts")}
            </option>
            {(options?.districts ?? []).map((o) => (
              <option key={o.unique_id} value={o.unique_id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t("admin.audit_dashboard.local_body", "Local body")}
            className={`${selectClass} max-w-[240px]`}
            value={localBodyId}
            onChange={(e) => {
              setLocalBodyId(e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>
              {t("admin.audit_dashboard.all_local_bodies", "All local bodies")}
            </option>
            {(options?.local_bodies ?? []).map((o) => (
              <option key={`${o.level}-${o.unique_id}`} value={o.unique_id}>
                {o.level ? `${o.name} (${o.level})` : o.name}
              </option>
            ))}
          </select>
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

      <nav
        role="tablist"
        className="mb-[18px] flex gap-1.5 overflow-x-auto pb-1"
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
              className={`whitespace-nowrap rounded-[10px] border px-[14px] py-2 text-sm font-medium ${
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

      <section className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {module.kpis.map((kpi, i) => {
          const value = summary ? (summary.kpis[kpi.key] ?? null) : null;
          return (
            <div
              key={kpi.key}
              className={`rounded-[10px] border border-l-4 border-[#dfe8e2] bg-white px-4 py-[14px] dark:border-[#26352b] dark:bg-[#17221b] ${
                KPI_BORDER[kpi.tone ?? "ok"]
              }`}
            >
              <div className="text-[#66756b] dark:text-[#9aaba0]">
                {kpi.label}
              </div>
              <div className="text-[26px] font-semibold">
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

      <section className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className={`${panelClass} lg:col-span-2`}>
          <h2 className="mb-3 mt-0 text-[15px] font-semibold">
            {module.trendLabel}
          </h2>
          <div className="relative h-[260px]">
            <Bar data={trendData} options={trendOptions} />
          </div>
        </div>
        <div className={panelClass}>
          <h2 className="mb-3 mt-0 text-[15px] font-semibold">
            {module.splitTitle}
          </h2>
          <div className="relative h-[260px]">
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

      <section className={panelClass}>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[15px] font-semibold">
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
        <div className="overflow-x-auto">
          <table
            className={`w-full min-w-[680px] border-collapse ${loadingRecords ? "opacity-60" : ""}`}
          >
            <thead>
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
                        className="whitespace-nowrap border-b border-[#dfe8e2] px-2.5 py-[9px] text-left dark:border-[#26352b]"
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
        <Paginator
          className="mt-2.5 justify-end bg-transparent p-0"
          first={(page - 1) * rowsPerPage}
          rows={rowsPerPage}
          totalRecords={records?.count ?? 0}
          rowsPerPageOptions={PAGE_SIZES}
          onPageChange={(event: PaginatorPageChangeEvent) => {
            setRowsPerPage(event.rows);
            setPage(event.page + 1);
          }}
          template="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate={t(
            "admin.audit_dashboard.page_report",
            "{first}–{last} of {totalRecords} records",
          )}
        />
      </section>
    </div>
  );
}
