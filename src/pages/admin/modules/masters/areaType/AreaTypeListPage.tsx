import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
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
import { areaTypeApi } from "@/helpers/admin";
import { formatCoordinates } from "../shared/formatCoordinates";

type AreaTypeListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

const toRecordList = (value: unknown): AreaTypeListRecord[] => {
  if (Array.isArray(value)) return value as AreaTypeListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: AreaTypeListRecord[] }).results;
  }
  return [];
};

const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

// Backend `ordering_fields = ["name", "is_active"]`. The `area_type_name` column is
// serialized from the model's `name` field (source="name" in AreaTypeSerializer), so
// sorting that column must send `ordering=name` to the backend.
const SORTABLE_FIELDS = new Set(["area_type_name", "is_active"]);
const FIELD_TO_ORDERING: Record<string, string> = {
  area_type_name: "name",
  is_active: "is_active",
};

const columns = [
  { field: "state_name", header: "State" },
  { field: "district_name", header: "District" },
  { field: "area_type_name", header: "Area Type" },
  { field: "coordinates", header: "Coordinates" },
];

export default function AreaTypeListPage() {
  const navigate = useNavigate();
  const { encMasters, encAreaTypes } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encMasters, encAreaTypes);

  const [rows, setRows] = useState<AreaTypeListRecord[]>([]);
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
      const response = await areaTypeApi.readAllwithPaginated(page, limit, {
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
      Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to load Area Type"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${FIELD_TO_ORDERING[sortField] ?? sortField}`
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

  const onExportRequest = async () => toRecordList(await areaTypeApi.readAllForExport());

  const statusTemplate = (row: AreaTypeListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      try {
        await areaTypeApi.update(id, { is_active: value });
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

  const actionTemplate = (row: AreaTypeListRecord) => (
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Area Type</h1>
          <p className="text-sm text-gray-500">Manage Area Type records</p>
        </div>
        <Button
          label="Add Area Type"
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />
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
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        header={renderListSearchHeader({
          value: globalFilterValue,
          onChange: onGlobalFilterChange,
          placeholder: "Search Area Type...",
        })}
        stripedRows
        showGridlines
        emptyMessage="No Area Type records found."
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
            body={(row: AreaTypeListRecord) =>
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
