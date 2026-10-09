import type { StaffHierarchyRow } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import notify from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";

import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { staffHierarchyApi } from "@/helpers/admin";
import { Can } from "@/contexts/ScreenPermissionContext";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useStatusFilter } from "@/components/filters/useOptionFilter";

// Role names are resolved server-side, so only the table's own columns can
// be ordered by the backend.
const SORTABLE_FIELDS = new Set(["hierarchy_level"]);

const toRecordList = (value: unknown): StaffHierarchyRow[] => {
  if (Array.isArray(value)) return value as StaffHierarchyRow[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as StaffHierarchyRow[];
    if (Array.isArray(record.data)) return record.data as StaffHierarchyRow[];
  }
  return [];
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  return fallback;
};

export default function StaffHierarchyList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<StaffHierarchyRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const geo = useHierarchyFilter(() => setFirst(0));
  const status = useStatusFilter(() => setFirst(0));
  const filterParams = { ...geo.applied, ...status.applied };
  const filterKey = JSON.stringify(filterParams);

  const navigate = useNavigate();
  const { encRoleManagement, encStaffHierarchy } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encRoleManagement,
    encStaffHierarchy,
  );

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const response = await staffHierarchyApi.readAllwithPaginated(
        first / rowsPerPage + 1,
        rowsPerPage,
        {
          params: {
            ...(searchTerm ? { search: searchTerm } : {}),
            ...(ordering ? { ordering } : {}),
            ...filterParams,
          },
        },
      );
      const records = toRecordList(response);
      setRows(records);
      setTotalRecords(typeof response?.count === "number" ? response.count : records.length);
    } catch {
      notify.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, [first, rowsPerPage, searchTerm, ordering, filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onExportRequest = async () => toRecordList(await staffHierarchyApi.readAllForExport({ params: filterParams }));

  const updateStatus = async (row: StaffHierarchyRow, checked: boolean) => {
    setPendingStatusId(row.unique_id);
    try {
      await staffHierarchyApi.update(row.unique_id, { is_active: checked });
      await loadRecords();
    } catch (error: any) {
      console.error("Update Status Error:", error?.response?.data || error);
      notify.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.update_status_failed")),
        "error",
      );
    } finally {
      setPendingStatusId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmDelete = await notify.fire({
      title: t("common.confirm_title"),
      text: t("common.confirm_delete_text"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
    });
    if (!confirmDelete.isConfirmed) return;

    try {
      await staffHierarchyApi.delete(id);
      // Step back a page when the last row on it was deleted.
      if (rows.length === 1 && first > 0) {
        setFirst(Math.max(first - rowsPerPage, 0));
      } else {
        await loadRecords();
      }
      notify.fire({
        icon: "success",
        title: t("common.deleted_success"),
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      notify.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.delete_failed")),
        "error",
      );
    }
  };

  const roleTemplate = (row: StaffHierarchyRow) => (
    <div>
      <div>{row.governmentusertype_name ?? "—"}</div>
      {row.governmentusertype_level && (
        <div className="text-xs text-gray-500">{row.governmentusertype_level}</div>
      )}
    </div>
  );

  const reportsToTemplate = (row: StaffHierarchyRow) =>
    row.reports_to_governmentusertype_name ? (
      <div>
        <div>{row.reports_to_governmentusertype_name}</div>
        {row.reports_to_governmentusertype_level && (
          <div className="text-xs text-gray-500">{row.reports_to_governmentusertype_level}</div>
        )}
      </div>
    ) : (
      <span className="text-gray-500">{t("admin.staff_hierarchy.top_of_chain")}</span>
    );

  const scopeTemplate = (row: StaffHierarchyRow) =>
    row.scope_label ? (
      <div>
        <div>{row.scope_label}</div>
        {row.scope_level && <div className="text-xs text-gray-500">{row.scope_level}</div>}
      </div>
    ) : (
      <span className="text-gray-500">{t("admin.staff_hierarchy.all_locations")}</span>
    );

  const statusTemplate = (row: StaffHierarchyRow) => (
    <Switch
      checked={row.is_active}
      disabled={pendingStatusId === row.unique_id}
      onCheckedChange={(checked) => void updateStatus(row, checked)}
    />
  );

  const actionTemplate = (row: StaffHierarchyRow) => (
    <div className="flex justify-center">
      <RowActionsMenu
        onEdit={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        onDelete={() => void handleDelete(row.unique_id)}
      />
    </div>
  );

  const indexTemplate = (_: StaffHierarchyRow, { rowIndex }: any) => rowIndex + 1;

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.nav.staff_hierarchy")}
        subtitle={t("common.manage_item_records", {
          item: t("admin.nav.staff_hierarchy"),
        })}
        actions={
          <Can action="add">
            <Button
              label={t("common.add_item", { item: t("admin.nav.staff_hierarchy") })}
              icon="pi pi-plus"
              className="p-button-success"
              onClick={() => navigate(ENC_NEW_PATH)}
            />
          </Can>
        }
        className="mb-6"
      />

      <DataTable
        filterPanel={combineFilters(geo, status)}
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
            searchPlaceholder={t("common.search_placeholder")}
            className="mb-4"
          />
        }
        onExportRequest={onExportRequest}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", {
          item: t("admin.nav.staff_hierarchy"),
        })}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: 80 }} />
        <Column
          field="scope_label"
          header={t("admin.staff_hierarchy.location")}
          body={scopeTemplate}
          style={{ minWidth: 220 }}
        />
        <Column
          field="governmentusertype_name"
          header={t("admin.staff_hierarchy.role")}
          body={roleTemplate}
          style={{ minWidth: 180 }}
        />
        <Column
          field="reports_to_governmentusertype_name"
          header={t("admin.staff_hierarchy.reports_to")}
          body={reportsToTemplate}
          style={{ minWidth: 180 }}
        />
        <Column
          field="hierarchy_level"
          header={t("admin.staff_hierarchy.level")}
          sortable
          style={{ width: 120 }}
        />
        <Column header={t("common.status")} body={statusTemplate} style={{ width: 120 }} />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 150 }} />
      </DataTable>
    </div>
  );
}
