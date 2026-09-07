import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { DataTable } from "@/components/common/SafeDataTable";
import ComponentCard from "@/components/common/ComponentCard";
import Swal from "@/lib/notify";
import { adminApi } from "@/helpers/admin/registry";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
import { PencilIcon } from "@/icons";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

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

const SORTABLE_FIELDS = new Set(["employee_name", "staff_unique_id"]);

export default function StaffAccessConfigList() {
  const navigate = useNavigate();
  const { encUserManagement, encStaffAccessConfiguration } = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(
    encUserManagement,
    encStaffAccessConfiguration,
  );

  const [records, setRecords] = useState<StaffAccessRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
    setLoading(true);
    try {
      const response = await adminApi.staffAccessConfiguration.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(orderingParam ? { ordering: orderingParam } : {}),
        },
      });
      const rows = getRows(response);
      setRecords(rows);
      setTotalRecords(
        typeof (response as { count?: number })?.count === "number"
          ? (response as { count: number }).count
          : rows.length,
      );
    } catch {
      Swal.fire("Error", "Failed to load staff access configurations.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
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

  return (
    <ComponentCard title="">
      <ListPageHeader
        title="Staff Access Configuration"
        subtitle="Manage staff access, permissions, and scope."
        actions={
          <Button
            label="New staff access"
            icon="pi pi-plus"
            className="p-button-success p-button-sm"
            onClick={() => navigate(newPath)}
          />
        }
        className="mb-6"
      />
      <DataTable
        value={records}
        loading={loading}
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        dataKey="unique_id"
        header={
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={setGlobalFilterValue}
            searchPlaceholder="Search staff access..."
            className="mb-4"
          />
        }
        emptyMessage="No staff access configurations found."
        responsiveLayout="scroll"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        <Column header="ID" body={idTemplate} />
        <Column field="employee_name" header="Name" body={nameTemplate} sortable />
        <Column header="Username" body={usernameTemplate} />
        <Column header="Role" body={roleTemplate} />
        <Column header="Permissions" body={permissionTemplate} />
        <Column header="Status" body={statusTemplate} />
        <Column header="Action" body={actionTemplate} style={{ width: "100px", textAlign: "center" }} />
      </DataTable>
    </ComponentCard>
  );
}
