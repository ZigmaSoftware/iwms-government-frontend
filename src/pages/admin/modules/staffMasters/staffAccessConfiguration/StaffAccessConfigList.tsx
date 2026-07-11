import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import { DataTable } from "@/components/common/SafeDataTable";
import ComponentCard from "@/components/common/ComponentCard";
import Swal from "@/lib/notify";
import { adminApi } from "@/helpers/admin/registry";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { PencilIcon } from "@/icons";

type StaffAccessRecord = {
  unique_id?: string;
  id?: string;
  employee_name?: string;
  staff_name?: string;
  username?: string;
  user_name?: string;
  role_label?: string;
  role_name?: string;
  governmentusertype_name?: string;
  government_user_type_name?: string;
  governmentusertype_id?: string;
  permissions?: unknown[];
  permission_count?: number;
  active_status?: boolean;
  account_status?: string;
  created_at?: string;
  [key: string]: unknown;
};

type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
};

const getRows = (payload: unknown): StaffAccessRecord[] => {
  if (Array.isArray(payload)) return payload as StaffAccessRecord[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.results)) return record.results as StaffAccessRecord[];
  if (Array.isArray(record.data)) return record.data as StaffAccessRecord[];
  const nestedData = record.data;
  if (nestedData && typeof nestedData === "object" && Array.isArray((nestedData as Record<string, unknown>).results)) {
    return (nestedData as { results: StaffAccessRecord[] }).results;
  }
  return [];
};

const textOf = (...values: unknown[]) => {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim() !== "");
  return value === undefined ? "-" : String(value);
};

export default function StaffAccessConfigList() {
  const navigate = useNavigate();
  const { encStaffMasters, encStaffAccessConfiguration } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(
    encStaffMasters,
    encStaffAccessConfiguration,
  );

  const [records, setRecords] = useState<StaffAccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const payload = await adminApi.staffAccessConfiguration.readAll();
        if (mounted) setRecords(getRows(payload));
      } catch {
        if (mounted) Swal.fire("Error", "Failed to load staff access configurations.", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const globalFilterFields = useMemo(
    () => [
      "employee_name",
      "staff_name",
      "username",
      "user_name",
      "role_label",
      "role_name",
      "governmentusertype_name",
      "government_user_type_name",
    ],
    [],
  );

  const onGlobalFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setGlobalFilterValue(value);
    setFilters({
      ...filters,
      global: { ...filters.global, value },
    });
  };

  const idTemplate = (row: StaffAccessRecord) => textOf(row.unique_id, row.id);
  const nameTemplate = (row: StaffAccessRecord) => textOf(row.employee_name, row.staff_name);
  const usernameTemplate = (row: StaffAccessRecord) => textOf(row.username, row.user_name);
  const roleTemplate = (row: StaffAccessRecord) =>
    textOf(
      row.role_label,
      row.role_name,
      row.governmentusertype_name,
      row.government_user_type_name,
      row.governmentusertype_id,
    );
  const permissionTemplate = (row: StaffAccessRecord) =>
    row.permission_count ?? (Array.isArray(row.permissions) ? row.permissions.length : "-");
  const statusTemplate = (row: StaffAccessRecord) => {
    const status = row.account_status ?? (row.active_status === false ? "Inactive" : "Active");
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        String(status).toLowerCase() === "inactive"
          ? "bg-red-50 text-red-700"
          : "bg-green-50 text-green-700"
      }`}
      >
        {String(status)}
      </span>
    );
  };

  const actionTemplate = (row: StaffAccessRecord) => {
    const id = textOf(row.unique_id, row.id);
    if (id === "-") return null;
    return (
      <button
        type="button"
        title="Edit"
        onClick={() => navigate(editPath(id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    );
  };

  const header = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Staff Access Configuration</h1>
          <p className="text-sm text-gray-500">Manage staff access, permissions, and scope.</p>
        </div>
        <Button
          label="New staff access"
          icon="pi pi-plus"
          className="p-button-success p-button-sm"
          onClick={() => navigate(newPath)}
        />
      </div>
      <span className="p-input-icon-left w-full md:w-80">
      
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder="Search staff access..."
          className="w-full"
        />
      </span>
    </div>
  );

  return (
    <ComponentCard title="">
      <DataTable
        value={records}
        loading={loading}
        paginator
        rows={10}
        dataKey="unique_id"
        header={header}
        filters={filters}
        globalFilterFields={globalFilterFields}
        emptyMessage="No staff access configurations found."
        responsiveLayout="scroll"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        <Column header="ID" body={idTemplate} sortable />
        <Column header="Name" body={nameTemplate} sortable />
        <Column header="Username" body={usernameTemplate} sortable />
        <Column header="Role" body={roleTemplate} sortable />
        <Column header="Permissions" body={permissionTemplate} sortable />
        <Column header="Status" body={statusTemplate} sortable />
        <Column header="Action" body={actionTemplate} style={{ width: "100px", textAlign: "center" }} />
      </DataTable>
    </ComponentCard>
  );
}
