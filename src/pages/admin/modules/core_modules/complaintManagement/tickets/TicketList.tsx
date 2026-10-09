import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Eye, LayoutGrid, List as ListIcon } from "lucide-react";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { complaintFeedbackApi, complaintTicketApi } from "@/features/complaintTicketing/api";
import type { ComplaintFeedback, ComplaintTicket } from "@/features/complaintTicketing/types";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { ActiveFilterChips, FilterPanel } from "@/components/common/ListToolbar";
import { asArray, errorText, formatDateTime, formatDuration, roleLabel } from "../utils";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { Can } from "@/contexts/ScreenPermissionContext";

const PUBLIC_SOURCE_CODE = "PUBLIC_GRIEVANCE";

// Mirrors the sort order seeded for ComplaintStatus so the board reads as a flow.
const STATUS_COLUMN_ORDER = [
  "SUBMITTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ESCALATED",
  "RESOLVED", 
  "REOPENED",
  "CLOSED",
  "REJECTED",
  "CANCELLED",
];

type SourceFilter = "all" | "public" | "internal" | "feedback";
type ViewMode = "table" | "kanban";

const isPublic = (row: ComplaintTicket) => row.source_code === PUBLIC_SOURCE_CODE;

const toRecordList = (value: unknown): ComplaintTicket[] => {
  if (Array.isArray(value)) return value as ComplaintTicket[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ComplaintTicket[] }).results;
  }
  return [];
};

// Backend `ordering_fields` also includes `updated`, but only these
// are rendered as columns whose field name matches a real orderable backend
// column - keep sorting limited to what the server can honor.
const SORTABLE_FIELDS = new Set(["ticket_no", "created", "next_escalation_due_at"]);

export default function TicketList() {
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);
  // Table view: one server-paginated page of raw ticket rows.
  const [tableRows, setTableRows] = useState<ComplaintTicket[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tableLoading, setTableLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  // Kanban view: a separate, un-paginated fetch of everything matching the
  // current filters - the board groups the whole matching dataset by status.
  const [kanbanRows, setKanbanRows] = useState<ComplaintTicket[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);

  // Tab counts (All / Public Grievances / Internal) - sourced from the
  // backend so all three are correct regardless of page/sort/source tab.
  const [counts, setCounts] = useState<{ all: number; public: number; internal: number }>({
    all: 0,
    public: 0,
    internal: 0,
  });

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  // Feedback used to be its own top-level screen; it's read-only and
  // ticket-scoped (also viewable per-ticket via the Detail screen's Feedback
  // tab), so it lives here now as a column + quick-filter instead.
  const [feedbackByTicket, setFeedbackByTicket] = useState<Map<string, ComplaintFeedback>>(new Map());

  // State → District → Area type → Local body, in the table's Filters panel.
  const geo = useHierarchyFilter(() => setFirst(0));
  const geoKey = JSON.stringify(geo.applied);

  useEffect(() => {
    complaintFeedbackApi.readAll({ params: { all: 1 } })
      .then((response) => {
        const rows = asArray<ComplaintFeedback>(response);
        setFeedbackByTicket(new Map(rows.map((row) => [String(row.ticket), row])));
      })
      .catch(() => setFeedbackByTicket(new Map()));
  }, []);

  // Combines every current filter into the params object sent to the
  // backend for both the table's page fetch and the Kanban board's full
  // fetch.
  const buildTicketParams = () => ({
    ...(sourceFilter !== "all" ? { source: sourceFilter } : {}),
    ...geo.applied,
  });

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadTableRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
    setTableLoading(true);
    try {
      const response = await complaintTicketApi.readAllwithPaginated(page, limit, {
        params: {
          ...buildTicketParams(),
          ...(search ? { search } : {}),
          ...(orderingParam ? { ordering: orderingParam } : {}),
        },
      });
      setTableRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (err) {
      notify.fire("Error", errorText(err, "Unable to load tickets"), "error");
    } finally {
      setTableLoading(false);
    }
  };

  // Reset to the first page whenever any filter other than pagination
  // itself changes, so the user isn't left stranded on an out-of-range page.
  useEffect(() => {
    setFirst(0);
  }, [searchTerm, ordering, sourceFilter, geoKey]);

  useEffect(() => {
    void loadTableRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, sourceFilter, geoKey]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearchTerm(query), 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const loadCounts = async () => {
    try {
      const response = await complaintTicketApi.action<{ all: number; public: number; internal: number }>(
        "counts",
        undefined,
        {
          params: geo.applied,
        },
      );
      setCounts({
        all: response?.all ?? 0,
        public: response?.public ?? 0,
        internal: response?.internal ?? 0,
      });
    } catch (err) {
      notify.fire("Error", errorText(err, "Unable to load ticket counts"), "error");
    }
  };

  useEffect(() => {
    void loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey]);

  const loadKanbanRows = async () => {
    setKanbanLoading(true);
    try {
      const response = await complaintTicketApi.readAllForExport({ params: buildTicketParams() });
      setKanbanRows(toRecordList(response));
    } catch (err) {
      notify.fire("Error", errorText(err, "Unable to load tickets"), "error");
    } finally {
      setKanbanLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "kanban") void loadKanbanRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, sourceFilter, geoKey]);

  const feedbackCount = feedbackByTicket.size;

  const feedbackTemplate = (row: ComplaintTicket) => {
    const feedback = feedbackByTicket.get(String(row.unique_id));
    if (!feedback) return <span className="text-xs text-slate-400">-</span>;
    return (
      <span
        className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
        title={feedback.feedback_text ?? undefined}
      >
        {typeof feedback.rating === "number" ? `★ ${feedback.rating}` : "Feedback"}
      </span>
    );
  };

  const statusTemplate = (row: ComplaintTicket) => (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {row.status_name || row.status_code || "-"}
    </span>
  );

  const sourceTemplate = (row: ComplaintTicket) =>
    isPublic(row) ? (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Public</span>
    ) : (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Internal</span>
    );


  // Who owns the ticket now: the escalatee once escalated, else the assignee.
  const assignedTemplate = (row: ComplaintTicket) => {
    const owner = row.escalated_to_staff_name || row.assigned_staff_name;
    if (!owner) return <span className="text-xs text-slate-400">Unassigned</span>;
    return (
      <div className="flex flex-col">
        <span>{owner}</span>
        {row.escalation_level ? (
          <span className={`text-xs ${row.is_escalated ? "text-orange-600" : "text-slate-500"}`}>
            L{row.escalation_level}
            {row.escalation_level_name ? ` · ${roleLabel(row.escalation_level_name)}` : ""}
            {row.is_escalated ? " · Escalated" : ""}
          </span>
        ) : null}
      </div>
    );
  };

  const escalationTemplate = (row: ComplaintTicket) => {
    const remaining = row.escalation_time_remaining_seconds;
    if (typeof remaining !== "number") return <span className="text-xs text-slate-400">-</span>;
    return (
      <div className="flex flex-col">
        <span className="whitespace-nowrap">{formatDateTime(row.next_escalation_due_at)}</span>
        <span className={`text-xs ${remaining < 0 ? "font-semibold text-red-600" : "text-slate-500"}`}>
          {remaining < 0 ? `Overdue ${formatDuration(remaining)}` : `in ${formatDuration(remaining)}`}
        </span>
      </div>
    );
  };

  const contextTemplate = (row: ComplaintTicket) => {
    const context = row.operational_context;
    if (!context) return <span className="text-xs text-slate-400">Other</span>;
    const references = [
      context.trip_reference && `Trip: ${context.trip_reference}`,
      context.vehicle_reference && `Vehicle: ${context.vehicle_reference}`,
      context.driver_reference && `Driver: ${context.driver_reference}`,
      context.operator_reference && `Operator: ${context.operator_reference}`,
      context.other_reference,
    ].filter(Boolean);
    return (
      <div className="min-w-44">
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-indigo-700">
          {context.incident_type || "other"}
        </span>
        {references.length > 0 && (
          <p className="mt-1 max-w-56 truncate text-xs text-slate-500" title={references.join(" · ")}>
            {references.join(" · ")}
          </p>
        )}
      </div>
    );
  };

  const kanbanColumns = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; tickets: ComplaintTicket[] }>();
    kanbanRows.forEach((row) => {
      const code = row.status_code || "UNKNOWN";
      if (!byCode.has(code)) {
        byCode.set(code, { code, name: row.status_name || code, tickets: [] });
      }
      byCode.get(code)!.tickets.push(row);
    });
    const ordered = STATUS_COLUMN_ORDER.filter((code) => byCode.has(code)).map((code) => byCode.get(code)!);
    const extras = [...byCode.keys()]
      .filter((code) => !STATUS_COLUMN_ORDER.includes(code))
      .sort()
      .map((code) => byCode.get(code)!);
    return [...ordered, ...extras];
  }, [kanbanRows]);

  return (
    <div className="p-3">
      <ListPageHeader
        title="Complaint Tickets"
        subtitle="Track submitted complaints and operational actions"
        actions={
          <Can action="add">
            <Button label="Add Ticket" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(newPath)} />
          </Can>
        }
        className="mb-6"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(
            [
              { key: "all", label: `All (${counts.all})` },
              { key: "public", label: `Public Grievances (${counts.public})` },
              { key: "internal", label: `Internal (${counts.internal})` },
              { key: "feedback", label: `With Feedback (${feedbackCount})` },
            ] as { key: SourceFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                sourceFilter === tab.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {/* The table shows the Filters panel in its own toolbar; the board
              has no table, so it gets the same panel here. */}
          {viewMode === "kanban" && (
            <FilterPanel activeCount={geo.count} onApply={geo.apply} onReset={geo.reset}>
              {geo.field}
            </FilterPanel>
          )}
          <button
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "table" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <ListIcon className="h-4 w-4" /> Table
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "kanban" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Kanban
          </button>
        </div>
      </div>

      {viewMode === "kanban" && geo.chips.length > 0 && (
        <div className="mb-4">
          <ActiveFilterChips chips={geo.chips} onClearAll={geo.reset} />
        </div>
      )}

      {viewMode === "table" ? (
        <DataTable
          filterPanel={geo.panel}
          value={tableRows}
          dataKey="unique_id"
          lazy
          paginator
          first={first}
          rows={rowsPerPage}
          totalRecords={totalRecords}
          onPage={onPage}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={onSort}
          rowsPerPageOptions={[5, 10, 25, 50]}
          loading={tableLoading}
          onExportRequest={async () => toRecordList(await complaintTicketApi.readAllForExport({ params: buildTicketParams() }))}
          header={
            <FilterBar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search tickets"
              className="mb-4"
            />
          }
          stripedRows
          showGridlines
          emptyMessage="No tickets found"
          className="p-datatable-sm"
        >
          <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
          <Column field="ticket_no" header="Ticket No" sortable />
          <Column field="created" header="Created" body={(row) => formatDateTime(row.created)} sortable />
          <Column header="Source" body={sourceTemplate} />
          <Column header="Customer" body={(row) => row.customer_name || row.profile_name || "-"} />
          <Column field="wa_phone" header="Phone" />
          <Column field="category_name" header="Category" />
          <Column header="Operational Context" body={contextTemplate} />
          <Column field="waste_type_name" header="Waste Type" />
          <Column field="subcategory_name" header="Subcategory" />
          <Column header="District" body={(row) => row.district_name || "-"} />
          <Column header="City" body={(row) => row.city_name || "-"} />
          <Column field="priority_code" header="Priority" />
          <Column header="Status" body={statusTemplate} />
          <Column header="Assigned To" body={assignedTemplate} />
          <Column field="next_escalation_due_at" header="Next Escalation" body={escalationTemplate} sortable />
          <Column header="Feedback" body={feedbackTemplate} />
          <Column
            header="Actions"
            body={(row) => (
              <button className="inline-flex text-blue-600" onClick={() => navigate(editPath(row.unique_id))} title="Open ticket">
                <Eye className="h-5 w-5" />
              </button>
            )}
            style={{ width: "100px" }}
          />
        </DataTable>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanLoading && kanbanRows.length === 0 && <p className="text-sm text-gray-500">Loading tickets…</p>}
          {!kanbanLoading && kanbanColumns.length === 0 && <p className="text-sm text-gray-500">No tickets found</p>}
          {kanbanColumns.map((column) => (
            <div key={column.code} className="flex w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-sm font-semibold text-slate-700">{column.name}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {column.tickets.length}
                </span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
                {column.tickets.map((row) => (
                  <button
                    key={row.unique_id}
                    onClick={() => navigate(editPath(row.unique_id))}
                    className="rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-400 hover:shadow"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{row.ticket_no || row.unique_id}</span>
                      {isPublic(row) && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Public
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{row.description || row.title || "-"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.category_name && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          {row.category_name}
                        </span>
                      )}
                      {row.waste_type_name && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                          {row.waste_type_name}
                        </span>
                      )}
                      {row.priority_code && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {row.priority_code}
                        </span>
                      )}
                      {row.operational_context?.incident_type && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-indigo-700">
                          {row.operational_context.incident_type}
                        </span>
                      )}
                      {typeof row.escalation_time_remaining_seconds === "number" && row.escalation_time_remaining_seconds < 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          Escalating
                        </span>
                      )}
                      {feedbackByTicket.has(String(row.unique_id)) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          ★ Feedback
                        </span>
                      )}
                      {(row.district_name || row.city_name) && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {[row.city_name, row.district_name].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{row.customer_name || row.profile_name || "-"}</span>
                      <span>{formatDateTime(row.created)}</span>
                    </div>
                  </button>
                ))}
                {column.tickets.length === 0 && (
                  <p className="px-1 py-2 text-center text-xs text-slate-400">No tickets</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
