import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { getEncryptedRoute } from "@/utils/routeCache";
import Swal from "@/lib/notify";
import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { districtApi } from "@/helpers/admin";
import { formatCoordinates } from "../shared/formatCoordinates";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

type DistrictListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

const toRecordList = (value: unknown): DistrictListRecord[] => {
  if (Array.isArray(value)) return value as DistrictListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: DistrictListRecord[] }).results;
  }
  return [];
};

const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const SORTABLE_FIELDS = new Set(["district_name", "district_code"]);

const BACKEND_ORDER_FIELD: Record<string, string> = {
  district_name: "name",
  district_code: "district_code",
};

const columns = [
  { field: "state_name", header: "State" },
  { field: "district_name", header: "District Name" },
  { field: "district_code", header: "District Code" },
  { field: "coordinates", header: "Coordinates" },
];

export default function DistrictListPage() {
  const navigate = useNavigate();
  const { encMasters, encDistricts } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encMasters, encDistricts);

  const [rows, setRows] = useState<DistrictListRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await districtApi.readAllwithPaginated(page, limit, {
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
      Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to load District"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${BACKEND_ORDER_FIELD[sortField] ?? sortField}`
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

  const onExportRequest = async () => toRecordList(await districtApi.readAllForExport());

  const statusTemplate = (row: DistrictListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      try {
        await districtApi.update(id, { is_active: value });
        setRows((current) => current.map((item) => item.unique_id === row.unique_id ? { ...item, is_active: value } : item));
      } catch (error: any) {
        Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to update status"), "error");
      } finally {
        setPendingStatusId(null);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={pendingStatusId === String(row.unique_id)}
        onCheckedChange={(checked) => void updateStatus(checked)}
      />
    );
  };

  const actionTemplate = (row: DistrictListRecord) => (
    <div className="flex justify-center gap-3">
      <button
        title="Edit"
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  return (
    <div className="p-3">
      <ListPageHeader
        title="District"
        subtitle="Manage District records"
        actions={
          <Button
            label="Add District"
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        }
        className="mb-6"
      />

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
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={setGlobalFilterValue}
            searchPlaceholder="Search District..."
            className="mb-4"
          />
        }
        stripedRows
        showGridlines
        emptyMessage="No District records found."
        onExportRequest={onExportRequest}
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: 80 }} />
        {columns.map((column) => (
          <Column
            key={column.field}
            field={column.field}
            header={column.header}
            sortable={SORTABLE_FIELDS.has(column.field)}
            body={(row: DistrictListRecord) =>
              column.field === "coordinates"
                ? formatCoordinates(row.coordinates)
                : displayValue(row[column.field])
            }
          />
        ))}
        <Column header="Status" body={statusTemplate} style={{ width: 120 }} />
        <Column header="Actions" body={actionTemplate} style={{ width: 120, textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
