import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";
import { designationApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";

const { encMasters, encDesignations } = getEncryptedRoute();
const { newPath: NEW_PATH } = createCrudRoutePaths(encMasters, encDesignations);
const { editPath } = createCrudRoutePaths(encMasters, encDesignations);

export default function DesignationListPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    designation_name: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const load = async () => {
    const response: any = await designationApi.readAll();
    setRecords(Array.isArray(response) ? response : response?.data?.results ?? response?.data ?? []);
  };

  useEffect(() => {
    load().catch(() => Swal.fire("Error", "Failed to load designations", "error"));
  }, []);

  const toggleStatus = async (row: any, value: boolean) => {
    await designationApi.update(row.unique_id, {
      designation_name: row.designation_name,
      department_id: row.department_id ?? null,
      description: row.description ?? "",
      status: value ? "active" : "inactive",
    });
    await load();
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
        value={records}
        paginator
        rows={10}
        filters={filters}
        onFilter={(e: any) => setFilters(e.filters)}
        globalFilterFields={["designation_name", "department_name", "description"]}
        header={
          <div className="flex justify-end">
            <InputText
              value={globalFilterValue}
              onChange={(e) => {
                setGlobalFilterValue(e.target.value);
                setFilters((prev) => ({ ...prev, global: { ...prev.global, value: e.target.value } }));
              }}
              placeholder="Search designations"
              className="p-inputtext-sm"
            />
          </div>
        }
      >
        <Column header="S.No" body={(_, opts) => opts.rowIndex + 1} />
        <Column field="designation_name" header="Designation Name" sortable filter />
        <Column field="department_name" header="Department" sortable />
        <Column field="description" header="Description" />
        <Column header="Status" body={(row) => <Switch checked={Boolean(row.is_active)} onCheckedChange={(value) => toggleStatus(row, value)} />} />
        <Column header="Action" body={(row) => <button className="text-blue-600" onClick={() => navigate(editPath(row.unique_id))}><PencilIcon className="size-5" /></button>} />
      </DataTable>
    </div>
  );
}
