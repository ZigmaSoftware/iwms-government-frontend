import { useEffect, useState } from "react";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { complaintFeedbackApi } from "@/features/complaintTicketing/api";
import type { ComplaintFeedback } from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime, yesNo } from "../utils";

const SORTABLE_FIELDS = new Set(["rating", "submitted_at"]);

export default function FeedbackList() {
  const [rows, setRows] = useState<ComplaintFeedback[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
    setIsLoading(true);
    try {
      const response = await complaintFeedbackApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(orderingParam ? { ordering: orderingParam } : {}),
        },
      });
      setRows(asArray<ComplaintFeedback>(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : asArray<ComplaintFeedback>(response).length,
      );
    } catch (err) {
      Swal.fire("Error", errorText(err, "Unable to load feedback"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const onGlobalFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(event.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  return (
    <div className="p-3">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Complaint Feedback</h1>
        <p className="text-sm text-gray-500">Citizen feedback captured after resolution</p>
      </div>
      <DataTable
        value={rows}
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
        loading={isLoading}
        header={renderListSearchHeader({
          value: globalFilterValue,
          onChange: onGlobalFilterChange,
          placeholder: "Search Feedback...",
        })}
        stripedRows
        showGridlines
        emptyMessage="No feedback found"
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        <Column field="ticket_no" header="Ticket" body={(row) => row.ticket_no || row.ticket || "-"} />
        <Column field="customer_name" header="Customer" body={(row) => row.customer_name || row.customer || "-"} />
        <Column field="rating" header="Rating" sortable />
        <Column header="Issue Solved" body={(row) => yesNo(row.is_issue_solved)} />
        <Column field="feedback_text" header="Feedback" />
        <Column field="submitted_at" header="Submitted" sortable={SORTABLE_FIELDS.has("submitted_at")} body={(row) => formatDateTime(row.submitted_at)} />
      </DataTable>
    </div>
  );
}
