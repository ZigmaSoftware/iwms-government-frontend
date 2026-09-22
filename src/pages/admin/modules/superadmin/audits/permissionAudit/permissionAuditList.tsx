import type { PermissionAuditRecord } from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Column } from "primereact/column";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, KeyRound, CalendarClock } from "lucide-react";
import type {
  DataTablePageEvent,
  DataTableSortEvent,
  SortOrder,
} from "primereact/datatable";

import { permissionAuditApi, staffUserTypeApi } from "@/helpers/admin";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

const SORTABLE_FIELDS = new Set(["timestamp", "action_type"]);

type RawStaffUserType = {
  unique_id?: string;
  name?: string;
};

const toRecordList = (value: unknown): PermissionAuditRecord[] => {
  if (Array.isArray(value)) return value as PermissionAuditRecord[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: PermissionAuditRecord[] }).results;
  }
  return [];
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const stateLabel = (active?: boolean | null) => {
  if (active === true) return "Active";
  if (active === false) return "Inactive";
  return "-";
};

export default function PermissionAuditList() {
  const { t } = useTranslation();

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] =
    useState<PermissionAuditRecord | null>(null);
  const [rows, setRows] = useState<PermissionAuditRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [roleOptions, setRoleOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const loading = isLoading && rows.length === 0;

  const hasActiveFilters = Boolean(globalFilterValue) || roleFilter.length > 0;

  const handleClearFilters = useCallback(() => {
    setGlobalFilterValue("");
    setRoleFilter([]);
    setFirst(0);
  }, []);

  const openDetails = useCallback((record: PermissionAuditRecord) => {
    setSelectedRecord(record);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedRecord(null);
  }, []);

  const actionTemplate = useCallback(
    (row: PermissionAuditRecord) => (
      <div className="flex justify-center">
        <button
          title={t("common.view")}
          onClick={() => openDetails(row)}
          className="text-blue-600 hover:text-blue-800"
        >
          {t("common.view")}
        </button>
      </div>
    ),
    [openDetails, t],
  );

  const actionTypeTemplate = useCallback((row: PermissionAuditRecord) => {
    const color =
      row.action_type === "DELETED"
        ? "text-red-600"
        : row.action_type === "CREATED"
          ? "text-green-600"
          : "text-amber-600";
    return <span className={`font-medium ${color}`}>{row.action_type ?? "-"}</span>;
  }, []);

  const loadRows = useCallback(
    async (
      page: number,
      limit: number,
      search: string,
      ordering?: string,
      roleValues?: string[],
    ) => {
      setIsLoading(true);
      try {
        const response = await permissionAuditApi.readAllwithPaginated(
          page,
          limit,
          {
            params: {
              ...(search ? { search } : {}),
              ...(ordering ? { ordering } : {}),
              ...(roleValues && roleValues.length
                ? { staffusertype_id: roleValues.join(",") }
                : {}),
            },
          },
        );
        setRows(toRecordList(response));
        setTotalRecords(
          typeof response?.count === "number"
            ? response.count
            : toRecordList(response).length,
        );
      } catch {
        notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  const ordering = useMemo(
    () =>
      sortField && SORTABLE_FIELDS.has(sortField)
        ? `${sortOrder === -1 ? "-" : ""}${sortField}`
        : undefined,
    [sortField, sortOrder],
  );

  const roleFilterKey = roleFilter.join(",");

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering, roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, roleFilterKey]);

  useEffect(() => {
    let mounted = true;
    const loadRoles = async () => {
      try {
        const data = await staffUserTypeApi.readAllForExport();
        if (!mounted) return;
        const options = (data as RawStaffUserType[])
          .filter((role) => role.unique_id && role.name)
          .map((role) => ({ label: role.name as string, value: role.unique_id as string }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setRoleOptions(options);
      } catch {
        // Non-fatal: dropdown simply won't have options if this fails.
      }
    };
    void loadRoles();
    return () => {
      mounted = false;
    };
  }, []);

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

  const grantedOnPage = rows.filter((r) => r.is_active === true).length;
  const revokedOnPage = rows.length - grantedOnPage;

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.permission_audit.list_title")}
        subtitle={t("admin.permission_audit.list_subtitle")}
        className="mb-6"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("admin.permission_audit.stat_total", "Total Access Changes")}
              </div>
              <div className="text-xl font-semibold">
                {totalRecords.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-green-50 p-2 text-green-600 dark:bg-green-950/40">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("admin.permission_audit.granted", "Granted")} ({t("common.this_page", "this page")})
              </div>
              <div className="text-xl font-semibold">{grantedOnPage}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-red-50 p-2 text-red-600 dark:bg-red-950/40">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("admin.permission_audit.revoked", "Revoked")} ({t("common.this_page", "this page")})
              </div>
              <div className="text-xl font-semibold">{revokedOnPage}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-slate-100 p-2 text-slate-600 dark:bg-slate-800">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("common_audit.stat_page_size", "Rows per Page")}
              </div>
              <div className="text-xl font-semibold">{rowsPerPage}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <FilterBar
            searchValue={globalFilterValue}
            onSearchChange={setGlobalFilterValue}
            searchPlaceholder={t("admin.permission_audit.search_placeholder")}
            className="mb-4"
            trailing={
              <button
                type="button"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <i className="pi pi-filter-slash text-xs" />
                {t("common.clear_all_filters", "Clear All Filters")}
              </button>
            }
          >
            <div className="w-full sm:w-64">
              <MultiSelect
                value={roleFilter}
                onChange={(next) => {
                  setRoleFilter(next);
                  setFirst(0);
                }}
                options={roleOptions}
                placeholder={t("admin.permission_audit.role_filter")}
                aria-label={t("admin.permission_audit.role_filter")}
              />
            </div>
          </FilterBar>

          <DataTable
            value={rows}
            dataKey="id"
            lazy
            paginator
            first={first}
            rows={rowsPerPage}
            totalRecords={totalRecords}
            onPage={onPage}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
            loading={loading}
            stripedRows
            showGridlines
            className="p-datatable-sm"
            emptyMessage={t("admin.permission_audit.empty_message")}
          >
            <Column
              header={t("common.s_no")}
              body={(_, { rowIndex }) => rowIndex + 1}
              style={{ width: 70 }}
            />
            <Column
              field="role_display"
              header={t("admin.permission_audit.role")}
              body={(r: PermissionAuditRecord) => r.role_display ?? "-"}
            />
            <Column
              field="mainscreen_name"
              header={t("admin.permission_audit.main_screen")}
              body={(r: PermissionAuditRecord) => r.mainscreen_name ?? "-"}
            />
            <Column
              field="userscreen_name"
              header={t("admin.permission_audit.sub_screen")}
              body={(r: PermissionAuditRecord) => r.userscreen_name ?? "-"}
            />
            <Column
              field="userscreenaction_name"
              header={t("admin.permission_audit.action")}
              body={(r: PermissionAuditRecord) => r.userscreenaction_name ?? "-"}
            />
            <Column
              field="action_type"
              header={t("admin.permission_audit.action_type")}
              body={actionTypeTemplate}
              sortable
            />
            <Column
              header={t("admin.permission_audit.previous_state")}
              body={(r: PermissionAuditRecord) => stateLabel(r.previous_is_active)}
            />
            <Column
              header={t("admin.permission_audit.new_state")}
              body={(r: PermissionAuditRecord) => stateLabel(r.is_active)}
            />
            <Column
              field="updated_by_name"
              header={t("admin.permission_audit.updated_by")}
              body={(r: PermissionAuditRecord) => r.updated_by_name ?? "-"}
            />
            <Column
              field="timestamp"
              header={t("admin.permission_audit.timestamp")}
              body={(r: PermissionAuditRecord) => formatDateTime(r.timestamp)}
              sortable
            />
            <Column
              header={t("common.actions")}
              body={actionTemplate}
              style={{ width: 120 }}
            />
          </DataTable>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => !open && closeDetails()}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.permission_audit.detail_title")}</DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.permission_audit.role")}
                  </div>
                  <div>{selectedRecord.role_display ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.permission_audit.main_screen")}
                  </div>
                  <div>{selectedRecord.mainscreen_name ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.permission_audit.sub_screen")}
                  </div>
                  <div>{selectedRecord.userscreen_name ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.permission_audit.action")}
                  </div>
                  <div>{selectedRecord.userscreenaction_name ?? "-"}</div>
                </div>
              </div>

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="p-2 text-left font-medium">Field</th>
                      <th className="p-2 text-left font-medium">Old Value</th>
                      <th className="p-2 text-left font-medium">New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2">Active</td>
                      <td className="p-2">{stateLabel(selectedRecord.previous_is_active)}</td>
                      <td className="p-2">{stateLabel(selectedRecord.is_active)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.permission_audit.updated_by")}
                  </div>
                  <div>{selectedRecord.updated_by_name ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("admin.permission_audit.timestamp")}
                  </div>
                  <div>{formatDateTime(selectedRecord.timestamp)}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
