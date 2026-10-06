import type {
  PermissionAuditFilterOptions,
  PermissionAuditRecord,
} from "./types";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { usePermissionLabels } from "@/utils/permissionLabels";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, KeyRound, CalendarClock } from "lucide-react";
import type {
  DataTablePageEvent,
  DataTableSortEvent,
  SortOrder,
} from "primereact/datatable";

import { permissionAuditApi } from "@/helpers/admin";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar, FilterBarSelect } from "@/components/common/FilterBar";
import PermissionAuditDetail, { MethodBadge } from "./PermissionAuditDetail";

const SORTABLE_FIELDS = new Set(["timestamp", "action_type", "http_method"]);

const ACTION_TYPES = ["CREATED", "UPDATED", "DELETED"] as const;

// A save can touch many modules; the list shows the first few and View
// shows them all.
const MODULES_SHOWN = 3;

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

const toOptions = (items?: { unique_id: string; name: string }[]) =>
  (items ?? []).map((item) => ({ label: item.name, value: item.unique_id }));

/** An access save carries granted/revoked counts; a per-grant row (older
 *  GRANT_CHANGE rows) is a single change. */
const isAccessSave = (r: PermissionAuditRecord) =>
  r.granted_count != null || r.revoked_count != null;

const StatCard = ({
  icon,
  tone,
  label,
  value,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: ReactNode;
}) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <div className={`rounded-md p-2 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </CardContent>
  </Card>
);

export default function PermissionAuditList() {
  const { t } = useTranslation();
  const { moduleLabel, screenLabel } = usePermissionLabels();

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [localBodyFilter, setLocalBodyFilter] = useState("");
  const [mainscreenFilter, setMainscreenFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [filterOptions, setFilterOptions] =
    useState<PermissionAuditFilterOptions | null>(null);

  const [selectedRecord, setSelectedRecord] =
    useState<PermissionAuditRecord | null>(null);
  const [rows, setRows] = useState<PermissionAuditRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const loading = isLoading && rows.length === 0;

  const hasActiveFilters =
    Boolean(globalFilterValue) ||
    Boolean(sourceFilter) ||
    Boolean(localBodyFilter) ||
    Boolean(mainscreenFilter) ||
    Boolean(actionTypeFilter);

  const handleClearFilters = useCallback(() => {
    setGlobalFilterValue("");
    setSourceFilter("");
    setLocalBodyFilter("");
    setMainscreenFilter("");
    setActionTypeFilter("");
    setFirst(0);
  }, []);

  const sourceOptions = useMemo(
    () => toOptions(filterOptions?.sources),
    [filterOptions],
  );
  const localBodyOptions = useMemo(
    () => toOptions(filterOptions?.local_bodies),
    [filterOptions],
  );
  const mainscreenOptions = useMemo(
    () => toOptions(filterOptions?.mainscreens),
    [filterOptions],
  );
  const actionTypeOptions = useMemo(
    () => ACTION_TYPES.map((value) => ({ label: value, value })),
    [],
  );

  const ordering = useMemo(
    () =>
      sortField && SORTABLE_FIELDS.has(sortField)
        ? `${sortOrder === -1 ? "-" : ""}${sortField}`
        : undefined,
    [sortField, sortOrder],
  );

  const queryParams = useMemo(
    () => ({
      ...(searchTerm ? { search: searchTerm } : {}),
      ...(sourceFilter ? { source: sourceFilter } : {}),
      ...(localBodyFilter ? { local_body_id: localBodyFilter } : {}),
      ...(mainscreenFilter ? { mainscreen_id: mainscreenFilter } : {}),
      ...(actionTypeFilter ? { action_type: actionTypeFilter } : {}),
    }),
    [searchTerm, sourceFilter, localBodyFilter, mainscreenFilter, actionTypeFilter],
  );

  const loadRows = useCallback(
    async (page: number, limit: number, params: Record<string, string>) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const response = await permissionAuditApi.readAllwithPaginated(
          page,
          limit,
          { params },
        );
        if (requestId !== requestIdRef.current) return;

        const list = toRecordList(response);
        setRows(list);
        setTotalRecords(
          typeof response?.count === "number" ? response.count : list.length,
        );
      } catch {
        if (requestId !== requestIdRef.current) return;
        notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, {
      ...queryParams,
      ...(ordering ? { ordering } : {}),
    });
  }, [first, rowsPerPage, queryParams, ordering, loadRows]);

  // Dropdown choices come from the backend's scoped `filter-options`
  // action, so a scoped user is only offered their own local bodies.
  useEffect(() => {
    let mounted = true;
    const loadFilterOptions = async () => {
      try {
        const data = (await permissionAuditApi.read(
          "filter-options",
        )) as unknown as PermissionAuditFilterOptions;
        if (mounted && data) setFilterOptions(data);
      } catch {
        // Non-fatal: dropdowns simply won't have options if this fails.
      }
    };
    void loadFilterOptions();
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

  const filterSelect = (
    value: string,
    setValue: (value: string) => void,
    options: { label: string; value: string }[],
    label: string,
  ) => (
    <div className="flex w-full flex-col gap-1 sm:w-56">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <FilterBarSelect
        value={value}
        onChange={(next) => {
          setFirst(0);
          setValue(next);
        }}
        options={options}
        placeholder={t("common.all", "All")}
        className="w-full"
        aria-label={label}
      />
    </div>
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

  const moduleTemplate = (r: PermissionAuditRecord) => {
    if (!r.changed_modules) return r.mainscreen_name ? moduleLabel(r.mainscreen_name) : "-";
    if (r.changed_modules.length === 0) return "-";
    const names = r.changed_modules.map((name) => moduleLabel(name));
    const shown = names.slice(0, MODULES_SHOWN).join(", ");
    const more = names.length - MODULES_SHOWN;
    return (
      <span title={names.join(", ")}>
        {shown}
        {more > 0 && (
          <span className="text-muted-foreground">
            {" "}
            {t("admin.permission_audit.more_modules", "+{{count}} more", {
              count: more,
            })}
          </span>
        )}
      </span>
    );
  };

  const permissionTemplate = (r: PermissionAuditRecord) => {
    if (isAccessSave(r)) {
      return (
        <div className="flex flex-col text-xs">
          {(r.granted_count ?? 0) > 0 && (
            <span className="text-green-700 dark:text-green-400">
              + {r.granted_count} {t("admin.permission_audit.granted", "Granted")}
            </span>
          )}
          {(r.revoked_count ?? 0) > 0 && (
            <span className="text-red-700 dark:text-red-400">
              − {r.revoked_count} {t("admin.permission_audit.revoked", "Revoked")}
            </span>
          )}
        </div>
      );
    }
    const change = r.is_active
      ? t("admin.permission_audit.granted", "Granted")
      : t("admin.permission_audit.revoked", "Revoked");
    const target =
      [
        r.userscreen_name && screenLabel(r.userscreen_name, r.mainscreen_name),
        r.userscreenaction_name,
      ]
        .filter(Boolean)
        .join(" › ") ||
      "-";
    return (
      <span>
        {target}{" "}
        <span
          className={
            r.is_active
              ? "text-xs text-green-700 dark:text-green-400"
              : "text-xs text-red-700 dark:text-red-400"
          }
        >
          ({change})
        </span>
      </span>
    );
  };

  const grantedOnPage = rows.reduce(
    (sum, r) =>
      sum + (isAccessSave(r) ? (r.granted_count ?? 0) : r.is_active ? 1 : 0),
    0,
  );
  const revokedOnPage = rows.reduce(
    (sum, r) =>
      sum + (isAccessSave(r) ? (r.revoked_count ?? 0) : r.is_active ? 0 : 1),
    0,
  );
  const thisPage = t("common.this_page", "this page");

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.permission_audit.list_title")}
        subtitle={t("admin.permission_audit.list_subtitle")}
        className="mb-6"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40"
          label={t("admin.permission_audit.stat_total", "Total Access Changes")}
          value={totalRecords.toLocaleString()}
        />
        <StatCard
          icon={<KeyRound className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-950/40"
          label={`${t("admin.permission_audit.granted", "Granted")} (${thisPage})`}
          value={grantedOnPage}
        />
        <StatCard
          icon={<KeyRound className="h-5 w-5" />}
          tone="bg-red-50 text-red-600 dark:bg-red-950/40"
          label={`${t("admin.permission_audit.revoked", "Revoked")} (${thisPage})`}
          value={revokedOnPage}
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          tone="bg-slate-100 text-slate-600 dark:bg-slate-800"
          label={t("common_audit.stat_page_size", "Rows per Page")}
          value={rowsPerPage}
        />
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
            {filterSelect(
              sourceFilter,
              setSourceFilter,
              sourceOptions,
              t("admin.permission_audit.source_filter_label", "Granted From"),
            )}
            {filterSelect(
              localBodyFilter,
              setLocalBodyFilter,
              localBodyOptions,
              t("admin.permission_audit.local_body_filter_label", "Local Body"),
            )}
            {filterSelect(
              mainscreenFilter,
              setMainscreenFilter,
              mainscreenOptions,
              t("admin.permission_audit.main_screen_filter_label", "Main Screen"),
            )}
            {filterSelect(
              actionTypeFilter,
              setActionTypeFilter,
              actionTypeOptions,
              t("admin.permission_audit.change_type_filter_label", "Change Type"),
            )}
          </FilterBar>

          <DataTable
            value={rows}
            dataKey="id"
            lazy
            paginator
            first={first}
            rows={rowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
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
              field="source_label"
              header={t("admin.permission_audit.source", "Granted From")}
              body={(r: PermissionAuditRecord) => r.source_label ?? "-"}
            />
            <Column
              field="target_name"
              header={t("admin.permission_audit.granted_to", "Granted To")}
              body={(r: PermissionAuditRecord) =>
                r.target_name ?? r.role_display ?? "-"
              }
            />
            <Column
              field="local_body_name"
              header={t("admin.permission_audit.local_body", "Local Body")}
              body={(r: PermissionAuditRecord) => r.local_body_name ?? "-"}
            />
            <Column
              header={t("admin.permission_audit.module", "Module")}
              body={moduleTemplate}
            />
            <Column
              header={t("admin.permission_audit.permissions", "Permissions")}
              body={permissionTemplate}
            />
            <Column
              field="http_method"
              header={t("admin.permission_audit.http_method", "Method")}
              body={(r: PermissionAuditRecord) => (
                <MethodBadge method={r.http_method} />
              )}
              sortable
            />
            <Column
              field="action_type"
              header={t("admin.permission_audit.action_type")}
              body={actionTypeTemplate}
              sortable
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
              body={(row: PermissionAuditRecord) => (
                <div className="flex justify-center">
                  <button
                    title={t("common.view")}
                    onClick={() => setSelectedRecord(row)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {t("common.view")}
                  </button>
                </div>
              )}
              style={{ width: 120 }}
            />
          </DataTable>
        </CardContent>
      </Card>

      <PermissionAuditDetail
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}
