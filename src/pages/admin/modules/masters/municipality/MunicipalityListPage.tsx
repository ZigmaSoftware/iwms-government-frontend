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
import { municipalityApi } from "@/helpers/admin";

type MunicipalityListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

const toRecordList = (value: unknown): MunicipalityListRecord[] => {
  if (Array.isArray(value)) return value as MunicipalityListRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: MunicipalityListRecord[] }).results;
  }
  return [];
};

const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

const columns = [
  { field: "state_name", header: "State" },
  { field: "district_name", header: "District" },
  { field: "area_type_name", header: "Area Type" },
  { field: "municipality_name", header: "Municipality Name" },
];

export default function MunicipalityListPage() {
  const navigate = useNavigate();
  const { encMasters, encMunicipalities } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encMasters, encMunicipalities);

  const [rows, setRows] = useState<MunicipalityListRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
  });

  const loadRows = async () => {
    setIsLoading(true);
    try {
      setRows(toRecordList(await municipalityApi.readAll()));
    } catch (error: any) {
      Swal.fire("Error", String(error?.response?.data?.detail ?? error?.message ?? "Failed to load Municipality"), "error");
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

  const statusTemplate = (row: MunicipalityListRecord) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);
      try {
        await municipalityApi.update(id, { is_active: value });
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

  const actionTemplate = (row: MunicipalityListRecord) => (
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
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Municipality</h1>
          <p className="text-sm text-gray-500">Manage Municipality records</p>
        </div>
        <Button
          label="Add Municipality"
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
          placeholder: "Search Municipality...",
        })}
        stripedRows
        showGridlines
        emptyMessage="No Municipality records found."
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
            body={(row: MunicipalityListRecord) => displayValue(row[column.field])}
          />
        ))}
        <Column header="Status" body={statusTemplate} style={{ width: 120 }} />
        <Column header="Actions" body={actionTemplate} style={{ width: 120, textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
