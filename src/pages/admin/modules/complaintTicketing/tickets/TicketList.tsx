import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import { Eye } from "lucide-react";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { complaintTicketApi } from "@/features/complaintTicketing/api";
import type { ComplaintTicket } from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime } from "../utils";

export default function TicketList() {
  const navigate = useNavigate();
  const { encComplaintTicket, encComplaint } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(encComplaintTicket, encComplaint);
  const [records, setRecords] = useState<ComplaintTicket[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    complaintTicketApi.readAll({ params: { all: 1 } })
      .then((response) => setRecords(asArray<ComplaintTicket>(response)))
      .catch((err) => Swal.fire("Error", errorText(err, "Unable to load tickets"), "error"));
  }, []);

  const statusTemplate = (row: ComplaintTicket) => (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {row.status_name || row.status_code || "-"}
    </span>
  );

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Complaint Tickets</h1>
          <p className="text-sm text-gray-500">Track submitted complaints and operational actions</p>
        </div>
        <Button label="Add Ticket" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(newPath)} />
      </div>
      <DataTable
        value={records}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        onFilter={(event: any) => setFilters(event.filters)}
        globalFilterFields={["ticket_no", "customer_name", "wa_phone", "category_name", "subcategory_name", "status_name", "priority_code", "assigned_team_name"]}
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
        <Column field="customer_name" header="Customer" sortable />
        <Column field="wa_phone" header="Phone" />
        <Column field="category_name" header="Category" sortable />
        <Column field="subcategory_name" header="Subcategory" />
        <Column field="priority_code" header="Priority" sortable />
        <Column header="Status" body={statusTemplate} sortable />
        <Column field="assigned_team_name" header="Assigned Team" />
        <Column header="SLA Due" body={(row) => formatDateTime(row.sla_due_at)} />
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
    </div>
  );
}
