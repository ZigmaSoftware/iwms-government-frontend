import type {
  ComplaintsReportResponse,
  ComplaintsReportRow,
  ComplaintStatusBucket,
  PendingAgingBucket,
} from "./types";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import TicketLocationFilters from "@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketLocationFilters";
import {
  emptyTicketLocationFilter,
  ticketLocationParams,
  type TicketLocationFilterValue,
} from "@/pages/admin/modules/core_modules/complaintManagement/tickets/ticketLocationFilter";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Inbox,
  Loader,
  MapPin,
  MessageSquareWarning,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
} from "lucide-react";
import Swal from "@/lib/notify";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { downloadRecordsPdf } from "@/utils/exportPdf";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";

const REPORT_URL = "/complaint-ticket/complaints-report/";
const RECEIVED_COLOR = "#0EA5E9";
const RESOLVED_COLOR = "#10B981";

type StatusTab = "all" | Exclude<ComplaintStatusBucket, "rejected">;

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "escalated", label: "Escalated" },
];

const BUCKET_LABEL: Record<ComplaintStatusBucket, string> = {
  open: "Open",
  in_progress: "In Progress",
  escalated: "Escalated",
  resolved: "Resolved",
  rejected: "Rejected",
};

const BUCKET_BADGE: Record<ComplaintStatusBucket, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  in_progress: "bg-sky-50 text-sky-700 ring-sky-200",
  escalated: "bg-red-50 text-red-700 ring-red-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-gray-100 text-gray-600 ring-gray-200",
};

const AGING_STYLE: Record<PendingAgingBucket["key"], { box: string; value: string; note: string }> = {
  "0_24": { box: "border-sky-100 bg-sky-50", value: "text-sky-700", note: "Received today" },
  "24_48": { box: "border-amber-100 bg-amber-50", value: "text-amber-700", note: "One to two days old" },
  "48_72": { box: "border-orange-100 bg-orange-50", value: "text-orange-700", note: "Two to three days old" },
  "72_plus": { box: "border-red-100 bg-red-50", value: "text-red-700", note: "Needs follow-up" },
};

const emptyReport: ComplaintsReportResponse = {
  period: { from_date: "", to_date: "" },
  kpis: {
    total: 0,
    open: 0,
    in_progress: 0,
    escalated: 0,
    resolved: 0,
    rejected: 0,
    pending: 0,
    resolved_percent: 0,
    sla_compliance_percent: 0,
    avg_resolution_hours: null,
    district_count: 0,
    local_body_count: 0,
  },
  status_counts: { all: 0, open: 0, in_progress: 0, escalated: 0, resolved: 0 },
  daily_trend: [],
  category_breakdown: [],
  pending_aging: [],
  area_breakdown: [],
  filter_options: { categories: [], sources: [] },
  results: [],
  count: 0,
};

/* ── Helpers ─────────────────────────────────────────────────────── */
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 13);
  return { from: isoDate(from), to: isoDate(to) };
};

const fmt = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString("en-IN") : "—";

const fmtPeriodDate = (value: string) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

const fmtDayLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

const fmtReceived = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const fmtHours = (hours: number) =>
  hours >= 1 ? `${Math.round(hours)} h` : `${Math.max(1, Math.round(hours * 60))} min`;

/** Escalation state for the register: level + time left on it, or how it closed. */
const slaLabel = (row: ComplaintsReportRow): string => {
  if (row.status_bucket === "resolved") {
    return row.resolution_hours != null ? `Closed in ${row.resolution_hours.toFixed(1)} h` : "Closed";
  }
  if (row.status_bucket === "rejected") return "—";
  const level = row.escalation_level ? `L${row.escalation_level}` : "";
  if (!row.next_escalation_due_at) return [level, row.is_breached ? "escalated, top level" : ""].filter(Boolean).join(" · ") || "—";
  const diffHours = (new Date(row.next_escalation_due_at).getTime() - Date.now()) / 3_600_000;
  const timing = diffHours > 0 ? `${fmtHours(diffHours)} left` : `overdue ${fmtHours(-diffHours)}`;
  return [level, timing].filter(Boolean).join(" · ");
};

const areaLabel = (localBody: string, district: string) =>
  [localBody, district].filter(Boolean).join(" / ") || "—";

type Filters = {
  fromDate: string;
  toDate: string;
  location: TicketLocationFilterValue;
  categoryId: string;
  sourceId: string;
};

const initialFilters = (): Filters => {
  const range = defaultRange();
  return {
    fromDate: range.from,
    toDate: range.to,
    location: emptyTicketLocationFilter,
    categoryId: "",
    sourceId: "",
  };
};

/* ── Tooltip ─────────────────────────────────────────────────────── */
type TrendTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; name: string; value: number; stroke: string }[];
};

const TrendTooltip = ({ active, payload, label }: TrendTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-2">{fmtPeriodDate(label ?? "")}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mt-1">
          <span style={{ color: p.stroke }}>{p.name}</span>
          <span className="font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
    MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function ComplaintsReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { editPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);

  // Draft filters are edited in the form; applied filters drive the fetch.
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);

  const [report, setReport] = useState<ComplaintsReportResponse>(emptyReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");

  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showAllAreas, setShowAllAreas] = useState(false);

  const buildParams = (): Record<string, string> => {
    const params: Record<string, string> = {
      from_date: applied.fromDate,
      to_date: applied.toDate,
    };
    Object.assign(params, ticketLocationParams(applied.location));
    if (applied.categoryId) params.category_id = applied.categoryId;
    if (applied.sourceId) params.source_id = applied.sourceId;
    if (activeTab !== "all") params.status = activeTab;
    if (search) params.search = search;
    return params;
  };

  /* ── fetch report ── */
  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<ComplaintsReportResponse>(REPORT_URL, {
        params: { ...buildParams(), page: String(page), limit: String(pageSize) },
      });
      setReport({ ...emptyReport, ...data });
    } catch {
      setReport(emptyReport);
      setError("Unable to load the complaints report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, activeTab, search, page, pageSize]);

  /* Back to page 1 whenever anything other than the page itself changes. */
  useEffect(() => {
    setPage(1);
  }, [applied, activeTab, search, pageSize]);

  /* ── derived ── */
  const { kpis, period } = report;
  const pageCount = Math.max(1, Math.ceil(report.count / pageSize));
  const visiblePages = useMemo(() => {
    const visibleCount = Math.min(5, pageCount);
    const start = Math.max(1, Math.min(page - 2, pageCount - visibleCount + 1));
    return Array.from({ length: visibleCount }, (_, i) => start + i);
  }, [page, pageCount]);
  const maxCategory = Math.max(1, ...report.category_breakdown.map((c) => c.count));
  const areas = showAllAreas ? report.area_breakdown : report.area_breakdown.slice(0, 5);
  const firstRow = report.count ? (page - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(page * pageSize, report.count);

  const scopeLabel = applied.location.city
    ? "Selected local body"
    : applied.location.district
      ? "Selected district"
      : applied.location.state
        ? "Selected state"
        : "All areas";

  /* ── exports ── */
  const fetchExportRows = async () => {
    const { data } = await api.get<ComplaintsReportResponse>(REPORT_URL, {
      params: { ...buildParams(), export: "1" },
    });
    return (data?.results ?? []).map((r) => ({
      "Complaint ID": r.ticket_no,
      Received: fmtReceived(r.created),
      Category: r.category_name || "—",
      "Local body": r.local_body_name || "—",
      District: r.district_name || "—",
      Source: r.source_name || "—",
      "Assigned to": r.assigned_staff_name || "Unassigned",
      Escalation: slaLabel(r),
      Status: BUCKET_LABEL[r.status_bucket],
    }));
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const rows = await fetchExportRows();
      await exportRecordsToExcel(rows, getAdminScreenExcelFilename("all"), "Complaints Report");
    } catch {
      Swal.fire(t("common.error"), "Failed to export the complaints report.", "error");
    } finally {
      setExporting("");
    }
  };

  const handlePdf = async () => {
    setExporting("pdf");
    try {
      const rows = await fetchExportRows();
      if (!rows.length) {
        Swal.fire(t("common.error"), "There are no complaints to download for these filters.", "info");
        return;
      }
      const columns = Object.keys(rows[0]).map((key) => ({ key, label: key }));
      await downloadRecordsPdf({
        title: `Complaints Report (${fmtPeriodDate(period.from_date)} to ${fmtPeriodDate(period.to_date)})`,
        filename: `complaints-report-${period.from_date}-to-${period.to_date}`,
        rows,
        columns,
      });
    } catch {
      Swal.fire(t("common.error"), "Failed to download the PDF.", "error");
    } finally {
      setExporting("");
    }
  };

  const applyFilters = () => setApplied({ ...draft });
  const resetFilters = () => {
    const fresh = initialFilters();
    setDraft(fresh);
    setApplied(fresh);
  };

  const fieldClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-50";
  const labelClass = "flex flex-col gap-1 text-xs font-medium text-gray-500";

  /* ══════════════════════════════════════════════════════════════
      RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen space-y-5 bg-[#F5F7FB] p-5 font-sans text-slate-900">
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
                  <MessageSquareWarning className="h-4 w-4 text-emerald-300" />
                </div>
                <span className="font-mono text-[10px] tracking-[0.22em] text-cyan-100/70">
                  CITIZEN GRIEVANCES · COMPLAINTS ANALYTICS
                </span>
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-[2.6rem]">
                Complaints Report
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-50/65">
                Complaints received, resolved and pending
                {period.from_date && `, ${fmtPeriodDate(period.from_date)} to ${fmtPeriodDate(period.to_date)}`} · {scopeLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <input
                type="date"
                value={draft.fromDate}
                max={draft.toDate || undefined}
                onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value }))}
                aria-label="From date"
                className="h-10 rounded-xl border border-white/20 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <span className="text-sm text-cyan-50/65">to</span>
              <input
                type="date"
                value={draft.toDate}
                min={draft.fromDate || undefined}
                max={isoDate(new Date())}
                onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))}
                aria-label="To date"
                className="h-10 rounded-xl border border-white/20 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <button
                type="button"
                onClick={applyFilters}
                className="h-10 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-emerald-950 shadow-sm transition-colors hover:bg-emerald-300"
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => void fetchReport()}
                disabled={loading}
                className="flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <div className="flex flex-wrap gap-2.5 lg:ml-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/15"
                >
                  <Printer className="h-4 w-4" /> Print
                </button>
                <button
                  type="button"
                  onClick={handleExcel}
                  disabled={!report.count || !!exporting}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting === "excel" ? "Exporting..." : "Excel"}
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  disabled={!report.count || !!exporting}
                  className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting === "pdf" ? "Preparing..." : "PDF"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex min-h-56 flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-inner backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/70">
                  SLA compliance
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {kpis.sla_compliance_percent.toFixed(1)}
                  <span className="ml-1 text-sm font-medium text-cyan-100/70">%</span>
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 ring-1 ring-inset ring-emerald-300/20">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-white/10 pt-5">
              {[
                ["Avg resolution", kpis.avg_resolution_hours != null ? `${kpis.avg_resolution_hours.toFixed(1)} h` : "—"],
                ["Resolved", `${kpis.resolved_percent.toFixed(1)}%`],
                ["Districts", fmt(kpis.district_count)],
                ["Local bodies", fmt(kpis.local_body_count)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100/50">{label}</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm print:hidden">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <MapPin className="h-4 w-4 text-teal-600" /> Filter by Location, Category and Source
          </h2>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-teal-700 hover:text-teal-900"
          >
            Reset filters
          </button>
        </div>
        <div className="mb-3">
          <TicketLocationFilters
            value={draft.location}
            onChange={(location) => setDraft((d) => ({ ...d, location }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Category
            <select
              value={draft.categoryId}
              onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">All Categories</option>
              {report.filter_options.categories.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Source
            <select
              value={draft.sourceId}
              onChange={(e) => setDraft((d) => ({ ...d, sourceId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">All Sources</option>
              {report.filter_options.sources.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={applyFilters}
            className="h-9 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
          >
            Apply filters
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Total Received", value: fmt(kpis.total), accent: "border-t-teal-700", icon: <Inbox className="h-4 w-4" /> },
          { label: "Open", value: fmt(kpis.open), accent: "border-t-amber-500", icon: <Clock className="h-4 w-4" /> },
          { label: "In Progress", value: fmt(kpis.in_progress), accent: "border-t-cyan-500", icon: <Loader className="h-4 w-4" /> },
          { label: "Resolved", value: fmt(kpis.resolved), accent: "border-t-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: "Escalated", value: fmt(kpis.escalated), accent: "border-t-red-500", icon: <AlertTriangle className="h-4 w-4" /> },
          { label: "Pending", value: fmt(kpis.pending), accent: "border-t-violet-500", icon: <BarChart3 className="h-4 w-4" /> },
        ].map((k) => (
          <div
            key={k.label}
            className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-t-4 ${k.accent} flex flex-col gap-2 p-4`}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-gray-500 leading-tight">{k.label}</p>
              <span className="text-gray-400">{k.icon}</span>
            </div>
            <p className="text-xl font-bold text-gray-800 leading-none">{loading ? "—" : k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Trend + categories ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-800">Daily Trend</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Complaints received and resolved per day</p>
          {report.daily_trend.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No trend data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={report.daily_trend} margin={{ top: 6, right: 20, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDayLabel}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<TrendTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="received" name="Received" stroke={RECEIVED_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke={RESOLVED_COLOR} strokeWidth={2.5} strokeDasharray="6 4" dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Tags className="h-4 w-4 text-gray-400" /> By Category
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">Share of complaints received</p>
          {report.category_breakdown.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No complaints in this period.</div>
          ) : (
            <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
              {report.category_breakdown.map((c) => (
                <div key={c.category_id || c.category_name} className="py-2 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between gap-3 mb-1.5">
                    <p className="text-xs font-semibold text-gray-800 truncate" title={c.category_name}>{c.category_name}</p>
                    <span className="text-xs font-bold text-gray-700 shrink-0">
                      {fmt(c.count)} <span className="font-medium text-gray-400">({c.share_percent.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-400 transition-all duration-700"
                      style={{ width: `${(c.count / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Aging + areas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800">Pending by Age</h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">{fmt(kpis.pending)} unresolved complaints</p>
          <div className="grid grid-cols-2 gap-3">
            {report.pending_aging.map((a) => (
              <div key={a.key} className={`rounded-xl border p-4 flex flex-col gap-1 ${AGING_STYLE[a.key].box}`}>
                <span className="text-xs font-medium text-gray-500">{a.label}</span>
                <span className={`text-2xl font-semibold leading-none ${AGING_STYLE[a.key].value}`}>{fmt(a.count)}</span>
                <span className="text-[10px] text-gray-400">{AGING_STYLE[a.key].note}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-gray-400" />
              {showAllAreas ? "All Areas by Pendency" : "Top 5 Areas by Pendency"}
            </h2>
            {report.area_breakdown.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllAreas((v) => !v)}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 print:hidden"
              >
                {showAllAreas ? "Show top 5" : `View all areas (${report.area_breakdown.length})`}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                  <th className="px-4 py-3 text-left font-semibold">Local Body / District</th>
                  <th className="px-4 py-3 text-right font-semibold">Received</th>
                  <th className="px-4 py-3 text-right font-semibold">Resolved</th>
                  <th className="px-4 py-3 text-right font-semibold">Pending</th>
                  <th className="px-4 py-3 text-right font-semibold">Escalated</th>
                  <th className="px-4 py-3 text-left font-semibold">SLA Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {areas.length ? (
                  areas.map((w) => (
                    <tr key={`${w.local_body_id}|${w.district_id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        {areaLabel(w.local_body_name, w.district_name)}
                        {w.local_body_type && <span className="ml-1.5 font-normal text-gray-400">{w.local_body_type}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(w.received)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(w.resolved)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmt(w.pending)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(w.escalated)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${w.sla_compliance_percent}%` }} />
                          </div>
                          <span className="font-medium text-gray-700">{w.sla_compliance_percent.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No area data for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Complaint register ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-100"
          style={{ background: "linear-gradient(135deg,#ECFDF5 0%,#ECFEFF 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-700 flex items-center justify-center shadow-sm">
              <MessageSquareWarning className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-800">Complaint Register</p>
              <p className="text-xs text-gray-500 mt-0.5">Newest first · {fmt(report.count)} complaint{report.count !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <form
            className="flex h-9 w-full items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 sm:w-72 print:hidden"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
          >
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value) setSearch("");
              }}
              placeholder="Search complaint ID"
              aria-label="Search complaint ID"
              className="w-full bg-transparent text-sm outline-none"
            />
          </form>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-gray-100 print:hidden" role="group" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-emerald-100 bg-white text-teal-700 hover:bg-emerald-50"
                }`}
              >
                {tab.label}
                <span className={`rounded-md px-1.5 font-mono ${selected ? "bg-white/20" : "bg-emerald-50"}`}>
                  {fmt(report.status_counts[tab.key])}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
                <th className="px-4 py-3 text-left font-semibold">Complaint ID</th>
                <th className="px-4 py-3 text-left font-semibold">Received</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">Local Body / District</th>
                <th className="px-4 py-3 text-left font-semibold">Source</th>
                <th className="px-4 py-3 text-left font-semibold">With</th>
                <th className="px-4 py-3 text-left font-semibold">Escalation</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {report.results.length ? (
                report.results.map((r) => (
                  <tr key={r.unique_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{r.ticket_no}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtReceived(r.created)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.category_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{areaLabel(r.local_body_name, r.district_name)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.source_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.assigned_staff_name || "Unassigned"}</td>
                    <td className={`px-4 py-3 whitespace-nowrap ${r.is_breached ? "font-semibold text-red-600" : "text-gray-500"}`}>
                      {slaLabel(r)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        title={r.status_name}
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${BUCKET_BADGE[r.status_bucket]}`}
                      >
                        {BUCKET_LABEL[r.status_bucket]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap print:hidden">
                      <button
                        type="button"
                        onClick={() => navigate(editPath(r.unique_id))}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                    {loading ? "Loading complaints…" : "No complaints match these filters for the selected period."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 px-6 py-4 border-t border-gray-100 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 rounded-lg border border-emerald-100 bg-emerald-50 px-2 font-mono text-teal-900 outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="font-mono text-gray-600">
              {firstRow}–{lastRow} of {report.count}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-white text-teal-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {visiblePages.map((n) => (
              <button
                key={n}
                type="button"
                aria-current={n === page ? "page" : undefined}
                onClick={() => setPage(n)}
                className={`h-8 min-w-8 rounded-lg border px-2 font-mono text-xs transition-colors ${
                  n === page
                    ? "border-teal-700 bg-teal-700 text-white"
                    : "border-emerald-100 bg-white text-teal-700 hover:bg-emerald-50"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-100 bg-white text-teal-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
