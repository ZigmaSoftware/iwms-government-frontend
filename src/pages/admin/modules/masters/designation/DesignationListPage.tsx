import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";
import { designationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";

const { encMasters, encDesignations } = getEncryptedRoute();
const { newPath: NEW_PATH } = createCrudRoutePaths(encMasters, encDesignations);
const { editPath } = createCrudRoutePaths(encMasters, encDesignations);

type DesignationListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

const toRecordList = (value: unknown): DesignationListRecord[] => {
  if (Array.isArray(value)) return value as DesignationListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: DesignationListRecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["designation_name"]);

export default function DesignationListPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<DesignationListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await designationApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (error: any) {
      Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to load designations"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onExportRequest = async () => toRecordList(await designationApi.readAllForExport());

  const toggleStatus = async (row: DesignationListRecord, value: boolean) => {
    await designationApi.update(row.unique_id, {
      designation_name: row.designation_name,
      department_id: row.department_id ?? null,
      description: row.description ?? "",
      status: value ? "active" : "inactive",
    });
    await loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Designation Master</h1>
          <p className="text-sm text-gray-500">Manage designation records</p>
        </div>
        <Button label="Add Designation" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(NEW_PATH)} />
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
        onExportRequest={onExportRequest}
        header={
          <div className="flex justify-end">
            <InputText
              value={globalFilterValue}
              onChange={(e) => setGlobalFilterValue(e.target.value)}
              placeholder="Search designations"
              className="p-inputtext-sm"
            />
          </div>
        }
      >
        <Column header="S.No" body={(_, opts) => opts.rowIndex + 1} />
        <Column field="designation_name" header="Designation Name" sortable={SORTABLE_FIELDS.has("designation_name")} />
        <Column field="department_name" header="Department" />
        <Column field="description" header="Description" />
        <Column header="Status" body={(row) => <Switch checked={Boolean(row.is_active)} onCheckedChange={(value) => toggleStatus(row, value)} />} />
        <Column header="Action" body={(row) => <button className="text-blue-600" onClick={() => navigate(editPath(row.unique_id))}><PencilIcon className="size-5" /></button>} />
      </DataTable>
    </div>
  );
}
