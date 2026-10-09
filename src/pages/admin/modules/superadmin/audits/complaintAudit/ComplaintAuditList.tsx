import type {
  ComplaintAuditDetail as DetailRecord,
  ComplaintAuditFilterOptions,
  ComplaintAuditRecord,
} from "./types";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import type { DataTablePageEvent } from "primereact/datatable";

import { adminApi } from "@/helpers/admin/registry";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { FilterSection, type ActiveFilterChip } from "@/components/common/ListToolbar";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useOptionFilter, type FilterPart } from "@/components/filters/useOptionFilter";
import ComplaintAuditDetail from "./ComplaintAuditDetail";
import { formatDateTime, formatDuration, STATUS_COLORS } from "./format";

const complaintAuditApi = adminApi.complaintAudits;

const toRecordList = (value: unknown): ComplaintAuditRecord[] => {
  if (Array.isArray(value)) return value as ComplaintAuditRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ComplaintAuditRecord[] }).results;
  }
  return [];
};

const DATE_INPUT_CLASS = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** "Raised from / to" for the Filters panel: a draft committed on Apply. */
function useDateRangeFilter({
  section,
  fromLabel,
  toLabel,
  onAppliedChange,
}: {
  section: string;
  fromLabel: string;
  toLabel: string;
  onAppliedChange?: () => void;
}) {
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [draft, setDraft] = useState({ from: "", to: "" });

  const commit = (next: { from: string; to: string }) => {
    setDraft(next);
    if (next.from !== applied.from || next.to !== applied.to) {
      setApplied(next);
      onAppliedChange?.();
    }
  };

  const chips: ActiveFilterChip[] = [
    ...(applied.from
      ? [{ key: "date_from", label: fromLabel, value: applied.from, onRemove: () => commit({ ...applied, from: "" }) }]
      : []),
    ...(applied.to
      ? [{ key: "date_to", label: toLabel, value: applied.to, onRemove: () => commit({ ...applied, to: "" }) }]
      : []),
  ];

  return {
    from: applied.from,
    to: applied.to,
    field: (
      <FilterSection label={section}>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className={DATE_INPUT_CLASS}
            aria-label={fromLabel}
          />
          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className={DATE_INPUT_CLASS}
            aria-label={toLabel}
          />
        </div>
      </FilterSection>
    ),
    chips,
    count: chips.length,
    apply: () => commit(draft),
    reset: () => commit({ from: "", to: "" }),
  } satisfies FilterPart & Record<string, unknown>;
}

const StatTile = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-xl font-semibold text-gray-800 dark:text-gray-100">{value}</div>
  </div>
);

const truncate = (value?: string | null, length = 60) =>
  !value ? "" : value.length > length ? `${value.slice(0, length)}…` : value;

/** "<local body>, <district>" — the ticket's area in one line. */
const formatArea = (r: ComplaintAuditRecord) =>
  [r.local_body_name, r.district_name].filter(Boolean).join(", ");

export default function ComplaintAuditList() {
  const { t } = useTranslation();

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOptions, setFilterOptions] = useState<ComplaintAuditFilterOptions | null>(null);

  const [selectedDetail, setSelectedDetail] = useState<DetailRecord | null>(null);
  const [records, setRecords] = useState<ComplaintAuditRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const loading = isLoading && records.length === 0;

  const historyOptions = useMemo(
    () => [
      { label: t("admin.complaint_audit.history_reopened", "Reopened"), value: "reopened" },
      { label: t("admin.complaint_audit.history_escalated", "Escalated"), value: "escalated" },
    ],
    [t],
  );

  const deletedOptions = useMemo(
    () => [
      { label: t("admin.complaint_audit.deleted_exclude", "Exclude deleted"), value: "exclude" },
      { label: t("admin.complaint_audit.deleted_only", "Deleted only"), value: "only" },
    ],
    [t],
  );

  const toOptions = (items?: { unique_id: string; name: string }[]) =>
    (items ?? []).map((item) => ({ label: item.name, value: item.unique_id }));
  const statusOptions = useMemo(() => toOptions(filterOptions?.statuses), [filterOptions]);
  const categoryOptions = useMemo(() => toOptions(filterOptions?.categories), [filterOptions]);

  // Filters panel: location + status / category / history / deleted / dates,
  // each edited as a draft and committed on "Apply filters".
  const resetPage = () => setFirst(0);
  const geo = useHierarchyFilter(resetPage);
  const status = useOptionFilter({
    param: "status",
    label: t("admin.complaint_audit.status", "Status"),
    options: statusOptions,
    allLabel: t("common.all"),
    onAppliedChange: resetPage,
  });
  const category = useOptionFilter({
    param: "category",
    label: t("admin.complaint_audit.category", "Category"),
    options: categoryOptions,
    allLabel: t("common.all"),
    onAppliedChange: resetPage,
  });
  const history = useOptionFilter({
    param: "history",
    label: t("admin.complaint_audit.history", "History"),
    options: historyOptions,
    allLabel: t("common.all"),
    onAppliedChange: resetPage,
  });
  const deleted = useOptionFilter({
    param: "deleted",
    label: t("admin.complaint_audit.deleted", "Deleted"),
    options: deletedOptions,
    allLabel: t("admin.complaint_audit.deleted_include", "Include deleted"),
    onAppliedChange: resetPage,
  });
  const raised = useDateRangeFilter({
    section: t("admin.complaint_audit.raised", "Raised"),
    fromLabel: t("admin.complaint_audit.raised_from", "Raised from"),
    toLabel: t("admin.complaint_audit.raised_to", "Raised to"),
    onAppliedChange: resetPage,
  });
  const geoKey = JSON.stringify(geo.applied);

  const queryParams = useMemo(
    () => ({
      ...(searchTerm ? { search: searchTerm } : {}),
      ...(JSON.parse(geoKey) as Record<string, string>),
      ...(status.value ? { status: status.value } : {}),
      ...(category.value ? { category: category.value } : {}),
      // "reopened" / "escalated" are flags of their own on the API
      ...(history.value ? { [history.value]: "1" } : {}),
      ...(deleted.value ? { deleted: deleted.value } : {}),
      ...(raised.from ? { date_from: raised.from } : {}),
      ...(raised.to ? { date_to: raised.to } : {}),
    }),
    [searchTerm, geoKey, status.value, category.value, history.value, deleted.value, raised.from, raised.to],
  );

  const loadRows = useCallback(
    async (page: number, limit: number, params: Record<string, string>) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const response = await complaintAuditApi.readAllwithPaginated(page, limit, { params });
        if (requestId !== requestIdRef.current) return;
        const rows = toRecordList(response);
        setRecords(rows);
        setTotalRecords(typeof response?.count === "number" ? response.count : rows.length);
      } catch {
        if (requestId !== requestIdRef.current) return;
        notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, queryParams);
  }, [first, rowsPerPage, queryParams, loadRows]);

  useEffect(() => {
    let mounted = true;
    const loadFilterOptions = async () => {
      try {
        // Status / category choices; location comes from the shared
        // hierarchy filter.
        const data = (await complaintAuditApi.read("filter-options")) as unknown as ComplaintAuditFilterOptions;
        if (mounted && data) setFilterOptions(data);
      } catch {
        // Non-fatal: the list still works without dropdown options.
      }
    };
    void loadFilterOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const loadAllExportRows = async () => {
    const data = await complaintAuditApi.readAllForExport({ params: queryParams });
    return toRecordList(data).map((row) => ({
      [t("admin.complaint_audit.export_ticket_no", "Ticket No")]: row.ticket_no,
      [t("admin.complaint_audit.export_title", "Title")]: row.title ?? "",
      [t("admin.complaint_audit.district", "District")]: row.district_name ?? "",
      [t("admin.complaint_audit.local_body", "Local Body")]: row.local_body_name ?? "",
      [t("admin.complaint_audit.category", "Category")]: [row.category_name, row.subcategory_name]
        .filter(Boolean)
        .join(" / "),
      [t("admin.complaint_audit.status", "Status")]: row.status_name ?? "",
      [t("admin.complaint_audit.deleted", "Deleted")]: row.is_deleted ? t("common.yes") : t("common.no"),
      [t("admin.complaint_audit.delete_reason", "Delete reason")]: row.delete_reason ?? "",
      [t("admin.complaint_audit.raised_on", "Raised on")]: formatDateTime(row.created),
      [t("admin.complaint_audit.raised_by", "Raised by")]: row.created_by_name ?? "",
      [t("admin.complaint_audit.assigned_to", "Assigned to")]: row.assigned_staff_name ?? "",
      [t("admin.complaint_audit.escalated_to", "Escalated to")]: row.escalated_to_staff_name ?? "",
      [t("admin.complaint_audit.first_resolved_after", "First resolved after")]: formatDuration(
        row.first_resolution_seconds,
      ),
      [t("admin.complaint_audit.total_time_taken", "Total time taken")]: formatDuration(row.total_resolution_seconds),
      [t("admin.complaint_audit.open_for", "Open for")]: formatDuration(row.open_seconds),
      [t("admin.complaint_audit.resolution_remarks", "Resolution remarks")]: row.resolution_remarks ?? "",
      [t("admin.complaint_audit.reopens", "Reopens")]: row.reopen_count,
      [t("admin.complaint_audit.last_reopen_reason", "Last reopen reason")]: row.last_reopen_reason ?? "",
      [t("admin.complaint_audit.escalations", "Escalations")]: row.escalation_count,
      [t("admin.complaint_audit.max_escalation_level", "Max escalation level")]: row.max_escalation_level ?? "",
      [t("admin.complaint_audit.feedback_rating", "Feedback rating")]: row.feedback_rating ?? "",
    })) as unknown as Record<string, unknown>[];
  };

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const openDetail = useCallback(
    async (row: ComplaintAuditRecord) => {
      try {
        const detail = (await complaintAuditApi.read(row.unique_id)) as unknown as DetailRecord;
        setSelectedDetail(detail);
      } catch {
        notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      }
    },
    [t],
  );

  const resolvedOnPage = records.filter((r) => r.total_resolution_seconds != null);
  const averageResolution = resolvedOnPage.length
    ? Math.round(resolvedOnPage.reduce((s, r) => s + (r.total_resolution_seconds ?? 0), 0) / resolvedOnPage.length)
    : null;

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.complaint_audit.list_title", "Complaint Audit")}
        subtitle={t(
          "admin.complaint_audit.list_subtitle",
          "When each complaint was raised, how it was resolved, why it was reopened, every escalation, and how long it took. Open a row for its full timeline.",
        )}
        className="mb-4"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t("admin.complaint_audit.stat_total", "Complaints")}
          value={totalRecords.toLocaleString()}
        />
        <StatTile
          label={t("admin.complaint_audit.stat_reopened", "Reopened (this page)")}
          value={records.filter((r) => r.reopen_count > 0).length}
        />
        <StatTile
          label={t("admin.complaint_audit.stat_escalated", "Escalated (this page)")}
          value={records.filter((r) => r.escalation_count > 0).length}
        />
        <StatTile
          label={t("admin.complaint_audit.stat_avg_resolution", "Avg. time to resolve (this page)")}
          value={formatDuration(averageResolution)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <DataTable
          onExportRequest={loadAllExportRows}
          exportFilename="complaint-audit"
          filterPanel={combineFilters(geo, status, category, history, deleted, raised)}
          header={
            <FilterBar
              searchValue={globalFilterValue}
              onSearchChange={setGlobalFilterValue}
              searchPlaceholder={t(
                "admin.complaint_audit.search_placeholder",
                "Search ticket no, title, reporter, phone…",
              )}
              className="mb-4"
            />
          }
          value={records}
          dataKey="unique_id"
          lazy
          paginator
          first={first}
          rows={rowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          totalRecords={totalRecords}
          onPage={onPage}
          loading={loading}
          stripedRows
          showGridlines
          className="p-datatable-sm"
          emptyMessage={t("admin.complaint_audit.empty_message", "No complaints found")}
        >
          <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: 60 }} />
          <Column
            header={t("admin.complaint_audit.ticket", "Ticket")}
            body={(r: ComplaintAuditRecord) => (
              <div className="leading-tight">
                <div className="font-medium">{r.ticket_no}</div>
                <div className="text-xs text-gray-500">{truncate(r.title, 40) || "-"}</div>
                <div className="text-xs text-gray-400">{formatArea(r)}</div>
              </div>
            )}
          />
          <Column
            header={t("admin.complaint_audit.category", "Category")}
            body={(r: ComplaintAuditRecord) => (
              <div className="leading-tight">
                <div>{r.category_name || "-"}</div>
                {r.subcategory_name && <div className="text-xs text-gray-500">{r.subcategory_name}</div>}
              </div>
            )}
          />
          <Column
            header={t("admin.complaint_audit.status", "Status")}
            body={(r: ComplaintAuditRecord) => (
              <div className="flex flex-col items-start gap-1">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[r.status_code ?? ""] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {r.status_name || r.status_code || "-"}
                </span>
                {r.is_deleted && (
                  <span
                    className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-white"
                    title={r.delete_reason ?? ""}
                  >
                    {t("admin.complaint_audit.deleted_badge", "Deleted")}
                  </span>
                )}
              </div>
            )}
          />
          <Column
            header={t("admin.complaint_audit.raised", "Raised")}
            body={(r: ComplaintAuditRecord) => (
              <div className="leading-tight">
                <div className="text-xs">{formatDateTime(r.created)}</div>
                <div className="text-xs text-gray-500">{r.created_by_name || r.reporter_name || "-"}</div>
              </div>
            )}
          />
          <Column
            header={t("admin.complaint_audit.resolution_remarks", "Resolution remarks")}
            body={(r: ComplaintAuditRecord) => (
              <span className="text-xs" title={r.resolution_remarks ?? ""}>
                {truncate(r.resolution_remarks) || "-"}
              </span>
            )}
            style={{ minWidth: 180 }}
          />
          <Column
            header={t("admin.complaint_audit.reopens", "Reopens")}
            body={(r: ComplaintAuditRecord) =>
              r.reopen_count ? (
                <div className="leading-tight" title={r.last_reopen_reason ?? ""}>
                  <div className="font-medium text-purple-700">{r.reopen_count}</div>
                  <div className="text-xs text-gray-500">{truncate(r.last_reopen_reason, 40)}</div>
                </div>
              ) : (
                <span className="text-gray-400">0</span>
              )
            }
            style={{ minWidth: 120 }}
          />
          <Column
            header={t("admin.complaint_audit.escalations", "Escalations")}
            body={(r: ComplaintAuditRecord) =>
              r.escalation_count ? (
                <div className="leading-tight">
                  <div className="font-medium text-red-700">{r.escalation_count}</div>
                  <div className="text-xs text-gray-500">
                    {t("admin.complaint_audit.up_to_level", "up to L{{level}}", {
                      level: r.max_escalation_level,
                    })}
                    {r.auto_escalation_count
                      ? ` · ${t("admin.complaint_audit.auto_count", "{{count}} auto", {
                          count: r.auto_escalation_count,
                        })}`
                      : ""}
                  </div>
                </div>
              ) : (
                <span className="text-gray-400">0</span>
              )
            }
          />
          <Column
            header={t("admin.complaint_audit.time_taken", "Time taken")}
            body={(r: ComplaintAuditRecord) =>
              r.completed_at ? (
                <div className="leading-tight">
                  <div className="font-medium">{formatDuration(r.total_resolution_seconds)}</div>
                  {r.reopen_count > 0 && r.first_resolution_seconds != null && (
                    <div className="text-xs text-gray-500">
                      {t("admin.complaint_audit.first_fix", "first fix {{duration}}", {
                        duration: formatDuration(r.first_resolution_seconds),
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs font-medium text-amber-700">
                  {r.is_deleted
                    ? "-"
                    : t("admin.complaint_audit.open_duration", "Open {{duration}}", {
                        duration: formatDuration(r.open_seconds),
                      })}
                </span>
              )
            }
          />
          <Column
            header={t("common.actions")}
            body={(row: ComplaintAuditRecord) => (
              <div className="flex justify-center">
                <button onClick={() => void openDetail(row)} className="text-blue-600 hover:text-blue-800">
                  {t("admin.complaint_audit.timeline_action", "Timeline")}
                </button>
              </div>
            )}
            style={{ width: 100 }}
          />
        </DataTable>
      </div>

      <ComplaintAuditDetail record={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </div>
  );
}
