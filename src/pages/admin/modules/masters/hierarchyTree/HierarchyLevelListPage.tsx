import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import type { DataTableFilterMeta } from "primereact/datatable";

import { DataTable } from "@/components/common/SafeDataTable";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";
import { hierarchyLevelApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";

import type { HierarchyLevel } from "./types";

const { encMasters, encHierarchyLevels } = getEncryptedRoute();
const { newPath: NEW_PATH, editPath } = createCrudRoutePaths(encMasters, encHierarchyLevels);

export default function HierarchyLevelListPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<HierarchyLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.CONTAINS },
    code: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const load = async () => {
    setLoading(true);
    try {
      const response = await hierarchyLevelApi.readAll();
      setRecords(Array.isArray(response) ? (response as HierarchyLevel[]) : []);
    } catch (error) {
      Swal.fire("Error", String((error as { message?: string })?.message ?? "Failed to load hierarchy levels"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleStatus = async (row: HierarchyLevel, value: boolean) => {
    await hierarchyLevelApi.update(row.unique_id, {
      name: row.name,
      code: row.code ?? "",
      order: row.order,
      is_active: value,
    });
    await load();
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-gray-800">Hierarchy Tree Levels</h1>
          <p className="text-sm text-gray-500">Create and order configurable hierarchy levels.</p>
        </div>
        <Button
          label="Add Level"
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(NEW_PATH)}
        />
      </div>

      <DataTable
        value={records}
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        onFilter={(event: { filters: DataTableFilterMeta }) => setFilters(event.filters)}
        globalFilterFields={["name", "code", "order"]}
        header={
          <div className="flex justify-end">
            <InputText
              value={globalFilterValue}
              onChange={(event) => {
                const value = event.target.value;
                setGlobalFilterValue(value);
                setFilters((prev) => ({
                  ...prev,
                  global: { value, matchMode: FilterMatchMode.CONTAINS },
                }));
              }}
              placeholder="Search levels"
              className="p-inputtext-sm"
            />
          </div>
        }
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} />
        <Column field="name" header="Level Name" sortable filter />
        <Column field="code" header="Code" sortable />
        <Column field="order" header="Order" sortable />
        <Column
          header="Status"
          body={(row: HierarchyLevel) => (
            <Switch
              checked={row.is_active !== false}
              onCheckedChange={(value) => void toggleStatus(row, value)}
            />
          )}
        />
        <Column
          header="Action"
          body={(row: HierarchyLevel) => (
            <button className="text-blue-600" onClick={() => navigate(editPath(row.unique_id))}>
              <PencilIcon className="size-5" />
            </button>
          )}
        />
      </DataTable>
    </div>
  );
}
