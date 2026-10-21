import type {
  ComplaintsReportResponse,
  ComplaintsReportRow,
  ComplaintStatusBucket,
  PendingAgingBucket,
} from "./types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import TicketLocationFilters from "@/pages/admin/modules/core_modules/complaintManagement/tickets/TicketLocationFilters";
import {
  emptyTicketLocationFilter,
  ticketLocationParams,
  type TicketLocationFilterValue,
} from "@/pages/admin/modules/core_modules/complaintManagement/tickets/ticketLocationFilter";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  MapPin,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Tags,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Swal from "@/lib/notify";
import {
  CartesianGrid,
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

  const resetFilters = () => {
    const fresh = initialFilters();
    setDraft(fresh);
    setApplied(fresh);
  };

  /* filters apply as soon as they change (no separate Go / Apply step) */
  const setFilter = (patch: Partial<Filters>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setApplied((a) => ({ ...a, ...patch }));
  };

  /* the page fills the space left in the admin shell (no page scroll);
     the register / area tables scroll inside their card. Measured, since
     the shell's header / breadcrumb / paddings vary with the sidebar. */
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

  const [bottomTab, setBottomTab] = useState<"register" | "areas">("register");

  const locationFiltered = !!(applied.location.state || applied.location.district || applied.location.city);
  const card = "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";
  const label = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400";
  const fieldCls = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-100";
  const iconBtn = "flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50";
  const th = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-left";
  const td = "px-3 py-2 text-xs whitespace-nowrap";
  const spinner = (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-xs text-slate-400">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-teal-600" />
      Loading…
    </div>
  );
  const empty = (msg: string) => <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-slate-400">{msg}</div>;
  const periodLabel = period.from_date ? `${fmtDayLabel(period.from_date)} – ${fmtPeriodDate(period.to_date)}` : "";

  const kpiTiles = [
    { label: "Total received", value: kpis.total, sub: `${kpis.resolved_percent.toFixed(1)}% resolved`, tone: "text-slate-900" },
    { label: "Open", value: kpis.open, sub: "awaiting action", tone: "text-amber-600" },
    { label: "In progress", value: kpis.in_progress, sub: "being worked on", tone: "text-sky-600" },
    { label: "Resolved", value: kpis.resolved, sub: kpis.avg_resolution_hours != null ? `avg ${kpis.avg_resolution_hours.toFixed(1)} h to close` : "—", tone: "text-emerald-600" },
    { label: "Escalated", value: kpis.escalated, sub: `SLA ${kpis.sla_compliance_percent.toFixed(1)}% compliance`, tone: "text-red-600" },
    { label: "Pending", value: kpis.pending, sub: `${fmt(kpis.district_count)} districts · ${fmt(kpis.local_body_count)} local bodies`, tone: "text-violet-600" },
  ];

  /* ══════════════════════════════════════════════════════════════
      RENDER — one screen: header + KPIs + 3 cards + tables
  ══════════════════════════════════════════════════════════════ */
  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-3 bg-[#F5F7FB] font-sans text-slate-900"
      style={fitHeight ? { minHeight: fitHeight } : undefined}
    >
      {/* ── header: title + filters + actions ── */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Complaints Report</h1>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {scopeLabel}{periodLabel && ` · ${periodLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <div className="shrink-0">
            <span className={label}>Date range</span>
            <div className={`${fieldCls} flex items-center gap-1`}>
              <input
                type="date"
                value={draft.fromDate}
                max={draft.toDate || undefined}
                onChange={(e) => setFilter({ fromDate: e.target.value })}
                aria-label="From date"
                className="w-[104px] bg-transparent outline-none"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={draft.toDate}
                min={draft.fromDate || undefined}
                max={isoDate(new Date())}
                onChange={(e) => setFilter({ toDate: e.target.value })}
                aria-label="To date"
                className="w-[104px] bg-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <span className={label}>Location</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={`${fieldCls} flex max-w-[170px] items-center gap-1.5 ${locationFiltered ? "border-teal-600" : ""}`}>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{locationFiltered ? scopeLabel : "All areas"}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[520px] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600">Filter by location</p>
                  {locationFiltered && (
                    <button type="button" onClick={() => setFilter({ location: emptyTicketLocationFilter })} className="text-xs font-semibold text-teal-700 hover:underline">
                      Clear
                    </button>
                  )}
                </div>
                <TicketLocationFilters value={draft.location} onChange={(location) => setFilter({ location })} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <span className={label}>Category</span>
            <select value={draft.categoryId} onChange={(e) => setFilter({ categoryId: e.target.value })} className={`${fieldCls} max-w-[150px]`}>
              <option value="">All categories</option>
              {report.filter_options.categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <span className={label}>Source</span>
            <select value={draft.sourceId} onChange={(e) => setFilter({ sourceId: e.target.value })} className={`${fieldCls} max-w-[130px]`}>
              <option value="">All sources</option>
              {report.filter_options.sources.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <button type="button" onClick={() => void fetchReport()} disabled={loading} className={iconBtn} aria-label="Refresh" title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={resetFilters} className={iconBtn} title="Reset filters (last 14 days, all areas)" aria-label="Reset filters">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => window.print()} className={iconBtn} title="Print">
            <Printer className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">Print</span>
          </button>
          <button type="button" onClick={handleExcel} disabled={!report.count || !!exporting} className={iconBtn} title="Download Excel">
            <FileSpreadsheet className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">{exporting === "excel" ? "…" : "Excel"}</span>
          </button>
          <button type="button" onClick={handlePdf} disabled={!report.count || !!exporting} className={iconBtn} title="Download PDF">
            <Download className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">{exporting === "pdf" ? "…" : "PDF"}</span>
          </button>
        </div>
      </div>

      {error && <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      {/* ── KPI strip ── */}
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpiTiles.map((k) => (
          <div key={k.label} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            {loading ? (
              <>
                <span className="mt-2 block h-6 w-16 animate-pulse rounded-md bg-slate-100" />
                <span className="mt-2 block h-3 w-28 animate-pulse rounded-md bg-slate-100" />
              </>
            ) : (
              <>
                <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${k.tone}`}>{fmt(k.value)}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{k.sub}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── trend · category · pending by age ── */}
      <div className="grid shrink-0 gap-3 lg:grid-cols-3">
        <div className={`${card} h-[180px] p-4`}>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold">Daily trend</h2>
            <span className="flex items-center gap-2.5 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ background: RECEIVED_COLOR }} /> Received</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded border-t-2 border-dashed" style={{ borderColor: RESOLVED_COLOR }} /> Resolved</span>
            </span>
          </div>
          <div className="min-h-0 flex-1">
            {loading ? spinner : report.daily_trend.length === 0 ? empty("No trend data for this period.") : (
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
                <LineChart data={report.daily_trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDayLabel} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<TrendTooltip />} />
                  <Line type="monotone" dataKey="received" name="Received" stroke={RECEIVED_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke={RESOLVED_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={`${card} h-[180px] p-4`}>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <Tags className="h-4 w-4 text-slate-400" /> By category
          </h2>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {loading ? spinner : report.category_breakdown.length === 0 ? empty("No complaints in this period.") : (
              report.category_breakdown.map((c) => (
                <div key={c.category_id || c.category_name}>
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-slate-800" title={c.category_name}>{c.category_name}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                      {fmt(c.count)} <span className="font-normal text-slate-400">({c.share_percent.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`${card} h-[180px] p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Pending by age</h2>
            <span className="text-[10px] text-slate-400">{fmt(kpis.pending)} unresolved</span>
          </div>
          {loading ? spinner : (
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              {report.pending_aging.map((a) => (
                <div key={a.key} className={`flex flex-col justify-center rounded-xl border px-3 py-1.5 ${AGING_STYLE[a.key].box}`}>
                  <span className="text-[10px] font-medium text-slate-500">{a.label}</span>
                  <span className={`text-lg font-bold leading-tight tabular-nums ${AGING_STYLE[a.key].value}`}>{fmt(a.count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── register / areas ── */}
      <div className={`${card} h-[520px] lg:h-auto lg:min-h-[260px] lg:shrink lg:grow lg:basis-[0px]`}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              {([
                { key: "register", label: "Complaint register" },
                { key: "areas", label: "Areas by pendency" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setBottomTab(t.key)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${bottomTab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {bottomTab === "register" && (
              <div className="flex flex-wrap gap-1 print:hidden" role="group" aria-label="Filter by status">
                {STATUS_TABS.map((tab) => {
                  const selected = tab.key === activeTab;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors ${
                        selected ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                      <span className={`rounded px-1 tabular-nums ${selected ? "bg-white/20" : "bg-slate-100"}`}>{fmt(report.status_counts[tab.key])}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {bottomTab === "register" ? (
            <form
              className="flex h-8 w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 print:hidden"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput.trim());
              }}
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value) setSearch("");
                }}
                placeholder="Search complaint ID"
                aria-label="Search complaint ID"
                className="w-full bg-transparent text-xs outline-none"
              />
            </form>
          ) : (
            <span className="text-[11px] text-slate-400">{fmt(report.area_breakdown.length)} areas</span>
          )}
        </div>

        <div className="m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
          <div className="min-h-0 flex-1 overflow-auto">
            {bottomTab === "register" ? (
              loading && !report.results.length ? spinner : !report.results.length ? empty("No complaints match these filters for the selected period.") : (
                <table className="min-w-full">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-400">
                    <tr>
                      <th className={th}>Complaint ID</th>
                      <th className={th}>Received</th>
                      <th className={th}>Category</th>
                      <th className={th}>Local body / District</th>
                      <th className={th}>Source</th>
                      <th className={th}>With</th>
                      <th className={th}>Escalation</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right print:hidden`}>Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y divide-slate-100 ${loading ? "opacity-50" : ""}`}>
                    {report.results.map((r) => (
                      <tr key={r.unique_id} className="hover:bg-slate-50">
                        <td className={`${td} font-semibold text-slate-800`}>{r.ticket_no}</td>
                        <td className={`${td} text-slate-500`}>{fmtReceived(r.created)}</td>
                        <td className={`${td} text-slate-600`}>{r.category_name || "—"}</td>
                        <td className={`${td} text-slate-600`}>{areaLabel(r.local_body_name, r.district_name)}</td>
                        <td className={`${td} text-slate-500`}>{r.source_name || "—"}</td>
                        <td className={`${td} text-slate-600`}>{r.assigned_staff_name || "Unassigned"}</td>
                        <td className={`${td} ${r.is_breached ? "font-semibold text-red-600" : "text-slate-500"}`}>{slaLabel(r)}</td>
                        <td className={td}>
                          <span title={r.status_name} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BUCKET_BADGE[r.status_bucket]}`}>
                            {BUCKET_LABEL[r.status_bucket]}
                          </span>
                        </td>
                        <td className={`${td} text-right print:hidden`}>
                          <button type="button" onClick={() => navigate(editPath(r.unique_id))} className="text-xs font-semibold text-teal-700 hover:underline">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : loading && !report.area_breakdown.length ? spinner : !report.area_breakdown.length ? empty("No area data for this period.") : (
              <table className="min-w-full">
                <thead className="sticky top-0 z-10 bg-slate-50 text-slate-400">
                  <tr>
                    <th className={th}>Local body / District</th>
                    <th className={`${th} text-right`}>Received</th>
                    <th className={`${th} text-right`}>Resolved</th>
                    <th className={`${th} text-right`}>Pending</th>
                    <th className={`${th} text-right`}>Escalated</th>
                    <th className={th}>SLA compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.area_breakdown.map((w) => (
                    <tr key={`${w.local_body_id}|${w.district_id}`} className="hover:bg-slate-50">
                      <td className={`${td} font-semibold text-slate-800`}>
                        {areaLabel(w.local_body_name, w.district_name)}
                        {w.local_body_type && <span className="ml-1.5 font-normal text-slate-400">{w.local_body_type}</span>}
                      </td>
                      <td className={`${td} text-right tabular-nums text-slate-600`}>{fmt(w.received)}</td>
                      <td className={`${td} text-right tabular-nums text-slate-600`}>{fmt(w.resolved)}</td>
                      <td className={`${td} text-right font-semibold tabular-nums text-amber-700`}>{fmt(w.pending)}</td>
                      <td className={`${td} text-right font-semibold tabular-nums text-red-600`}>{fmt(w.escalated)}</td>
                      <td className={td}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${w.sla_compliance_percent}%` }} />
                          </div>
                          <span className="font-medium tabular-nums text-slate-700">{w.sla_compliance_percent.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {bottomTab === "register" && report.count > 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 print:hidden">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Showing {firstRow}–{lastRow} of {fmt(report.count)}</span>
                {/* inline buttons, not a native <select> — its list would open off-screen here */}
                <span className="inline-flex items-center gap-0.5" role="group" aria-label="Rows per page">
                  {[10, 25, 50, 100].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPageSize(size)}
                      aria-pressed={pageSize === size}
                      className={`h-6 rounded-md border px-1.5 text-[11px] font-semibold tabular-nums ${
                        pageSize === size ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                  <span className="ml-1">/ page</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40" aria-label="Previous page">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {visiblePages.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => setPage(n)}
                    className={`h-6 min-w-6 rounded-md border px-1.5 text-[11px] font-semibold tabular-nums ${
                      n === page ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40" aria-label="Next page">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
