import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable, type DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { getEncryptedRoute } from "@/utils/routeCache";
import Swal from "@/lib/notify";
import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { wardApi } from "@/helpers/admin";
import { formatCoordinates } from "../shared/formatCoordinates";

type WardListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

const toRecordList = (value: unknown): WardListRecord[] => {
  if (Array.isArray(value)) return value as WardListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: WardListRecord[] }).results;
  }
  return [];
};

const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const LOCAL_BODY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const columns = [
  { field: "state_name", header: "State" },
  { field: "district_name", header: "District" },
  { field: "area_type_name", header: "Area Type" },
  { field: "local_body_type", header: "Local Body Type" },
  { field: "local_body_name", header: "Local Body" },
  { field: "ward_name", header: "Ward Name" },
  { field: "coordinates", header: "Coordinates" },
];

export default function WardListPage() {
  const navigate = useNavigate();
  const { encMasters, encWards } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encMasters, encWards);

  const [rows, setRows] = useState<WardListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  const loadRows = async () => {
    setIsLoading(true);
    try {
      setRows(toRecordList(await wardApi.readAll()));
    } catch (error: any) {
      Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to load Ward"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const onFilter = (event: DataTableFilterEvent) => {
    setFilters(event.filters as DataTableFilterMeta);
  };

  const onGlobalFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters((current) => ({ ...current, global: { ...current.global, value } }));
    setGlobalFilterValue(value);
  };

  const statusTemplate = (row: WardListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      try {
        await wardApi.update(id, { is_active: value });
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

  const actionTemplate = (row: WardListRecord) => (
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
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Ward</h1>
          <p className="text-sm text-gray-500">Manage Ward records</p>
        </div>
        <Button
          label="Add Ward"
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />
      </div>

      <DataTable
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        filters={filters}
        onFilter={onFilter}
        header={renderListSearchHeader({
          value: globalFilterValue,
          onChange: onGlobalFilterChange,
          placeholder: "Search Ward...",
        })}
        stripedRows
        showGridlines
        emptyMessage="No Ward records found."
        globalFilterFields={columns.map((column) => column.field)}
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: 80 }} />
        {columns.map((column) => (
          <Column
            key={column.field}
            field={column.field}
            header={column.header}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: WardListRecord) =>
              column.field === "coordinates"
                ? formatCoordinates(row.coordinates)
                : column.field === "local_body_type"
                  ? displayValue(LOCAL_BODY_TYPE_LABELS[String(row.local_body_type ?? "")])
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
