import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { Eye, LayoutGrid, List as ListIcon } from "lucide-react";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { complaintTicketApi, geoHierarchyApi } from "@/features/complaintTicketing/api";
import type { ComplaintTicket, HierarchyNode } from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime } from "../utils";

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

type SourceFilter = "all" | "public" | "internal";
type ViewMode = "table" | "kanban";

const isPublic = (row: ComplaintTicket) => row.source_code === PUBLIC_SOURCE_CODE;

export default function TicketList() {
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);
  const [records, setRecords] = useState<ComplaintTicket[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const [districts, setDistricts] = useState<HierarchyNode[]>([]);
  const [cities, setCities] = useState<HierarchyNode[]>([]);
  const [districtFilter, setDistrictFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    complaintTicketApi.readAll({ params: { all: 1 } })
      .then((response) => setRecords(asArray<ComplaintTicket>(response)))
      .catch((err) => Swal.fire("Error", errorText(err, "Unable to load tickets"), "error"));
    geoHierarchyApi.districts()
      .then(setDistricts)
      .catch(() => setDistricts([]));
  }, []);

  const onDistrictFilterChange = async (value: string) => {
    setDistrictFilter(value);
    setCityFilter("");
    if (!value) {
      setCities([]);
      return;
    }
    const cityRows = await geoHierarchyApi.citiesInDistrict(value).catch(() => []);
    setCities(cityRows);
  };

  const scopedRecords = useMemo(() => {
    let rows = records;
    if (sourceFilter === "public") rows = rows.filter(isPublic);
    else if (sourceFilter === "internal") rows = rows.filter((row) => !isPublic(row));
    if (districtFilter) rows = rows.filter((row) => String(row.district_id ?? "") === districtFilter);
    if (cityFilter) rows = rows.filter((row) => String(row.city_id ?? "") === cityFilter);
    return rows;
  }, [records, sourceFilter, districtFilter, cityFilter]);

  const publicCount = useMemo(() => records.filter(isPublic).length, [records]);

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

  const slaTemplate = (row: ComplaintTicket) => {
    if (row.sla_breached) {
      return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Breached</span>;
    }
    if (typeof row.sla_time_remaining_seconds === "number" && row.sla_time_remaining_seconds < 0) {
      return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue</span>;
    }
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">On Track</span>;
  };

  const kanbanColumns = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; tickets: ComplaintTicket[] }>();
    scopedRecords.forEach((row) => {
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
  }, [scopedRecords]);

  return (
    <div className="p-3">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Complaint Tickets</h1>
          <p className="text-sm text-gray-500">Track submitted complaints and operational actions</p>
        </div>
        <Button label="Add Ticket" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(newPath)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(
            [
              { key: "all", label: `All (${records.length})` },
              { key: "public", label: `Public Grievances (${publicCount})` },
              { key: "internal", label: `Internal (${records.length - publicCount})` },
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
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={districtFilter}
            onChange={(e) => onDistrictFilterChange(e.target.value)}
          >
            <option value="">All districts</option>
            {districts.map((item) => (
              <option key={item.unique_id} value={item.unique_id}>{item.name}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            disabled={!districtFilter}
          >
            <option value="">All cities</option>
            {cities.map((item) => (
              <option key={item.unique_id} value={item.unique_id}>{item.name} ({item.level_name})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
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

      {viewMode === "table" ? (
        <DataTable
          value={scopedRecords}
          dataKey="unique_id"
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          filters={filters}
          onFilter={(event: any) => setFilters(event.filters)}
          globalFilterFields={[
            "ticket_no",
            "customer_name",
            "profile_name",
            "wa_phone",
            "category_name",
            "waste_type_name",
            "subcategory_name",
            "status_name",
            "priority_code",
            "assigned_team_name",
            "district_name",
            "city_name",
          ]}
          header={
            <div className="flex justify-end">
              <InputText
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFilters((prev: any) => ({ ...prev, global: { ...prev.global, value: event.target.value } }));
                }}
                placeholder="Search tickets"
                className="p-inputtext-sm"
              />
            </div>
          }
          stripedRows
          showGridlines
          emptyMessage="No tickets found"
          className="p-datatable-sm"
        >
          <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
          <Column field="ticket_no" header="Ticket No" sortable />
          <Column field="created" header="Created" body={(row) => formatDateTime(row.created)} sortable />
          <Column header="Source" body={sourceTemplate} sortable sortField="source_code" />
          <Column header="Customer" body={(row) => row.customer_name || row.profile_name || "-"} sortable sortField="customer_name" />
          <Column field="wa_phone" header="Phone" />
          <Column field="category_name" header="Category" sortable />
          <Column field="waste_type_name" header="Waste Type" sortable />
          <Column field="subcategory_name" header="Subcategory" />
          <Column header="District" body={(row) => row.district_name || "-"} sortable sortField="district_name" />
          <Column header="City" body={(row) => row.city_name || "-"} sortable sortField="city_name" />
          <Column field="priority_code" header="Priority" sortable />
          <Column header="Status" body={statusTemplate} sortable sortField="status_name" />
          <Column field="assigned_team_name" header="Assigned Team" />
          <Column header="SLA Due" body={(row) => formatDateTime(row.sla_due_at)} />
          <Column header="SLA" body={slaTemplate} />
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
          {kanbanColumns.length === 0 && <p className="text-sm text-gray-500">No tickets found</p>}
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
                      {row.sla_breached && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          SLA Breached
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
