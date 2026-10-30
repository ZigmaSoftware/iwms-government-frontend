import type { LoginAuditRecord } from "./types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { MultiSelect } from "@/components/ui/multi-select";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { adminApi } from "@/helpers/admin/registry";
import { normalizeList } from "@/utils/forms";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { FilterSection, type ActiveFilterChip } from "@/components/common/ListToolbar";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useOptionFilter, type FilterPart } from "@/components/filters/useOptionFilter";
import { formatModuleName } from "./format";
import { SESSION_STATE_OPTIONS } from "./sessionState";
import { renderLoginAuditColumns } from "./loginAuditColumns";
import LoginAuditDetail from "./LoginAuditDetail";

const toRecordList = (value: unknown): LoginAuditRecord[] => {
  if (Array.isArray(value)) return value as LoginAuditRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: LoginAuditRecord[] }).results;
  }
  return [];
};

const LOGIN_MODULES = [
  "staff",
  "government",
  "contractor",
  "customer",
  "platform",
  "panchayat_leader",
  "district_leader",
  "state_leader",
  "auto",
] as const;

// Backend ordering_fields (LoginAuditViewSet).
const SORTABLE_FIELDS = new Set([
  "module_name",
  "username",
  "ip_address",
  "success",
  "timestamp",
  "session_duration_seconds",
]);

const DATE_INPUT_CLASS = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** "From / To date" for the Filters panel: a draft committed on Apply. */
function useDateRangeFilter({
  section,
  fromLabel,
  toLabel,
  onAppliedChange,
}: {
  section: string;
  fromLabel: string;
  toLabel: string;
  onAppliedChange?: () => void;
}) {
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [draft, setDraft] = useState({ from: "", to: "" });

  const commit = (next: { from: string; to: string }) => {
    setDraft(next);
    if (next.from !== applied.from || next.to !== applied.to) {
      setApplied(next);
      onAppliedChange?.();
    }
  };

  const chips: ActiveFilterChip[] = [
    ...(applied.from
      ? [{ key: "date_from", label: fromLabel, value: applied.from, onRemove: () => commit({ ...applied, from: "" }) }]
      : []),
    ...(applied.to
      ? [{ key: "date_to", label: toLabel, value: applied.to, onRemove: () => commit({ ...applied, to: "" }) }]
      : []),
  ];

  return {
    from: applied.from,
    to: applied.to,
    field: (
      <FilterSection label={section}>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className={DATE_INPUT_CLASS}
            aria-label={fromLabel}
          />
          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className={DATE_INPUT_CLASS}
            aria-label={toLabel}
          />
        </div>
      </FilterSection>
    ),
    chips,
    count: chips.length,
    apply: () => commit(draft),
    reset: () => commit({ from: "", to: "" }),
  } satisfies FilterPart & Record<string, unknown>;
}

export default function LoginAuditList() {
  const { t } = useTranslation();

  const [rows, setRows] = useState<LoginAuditRecord[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<LoginAuditRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  // Module multi-select: draft in the Filters panel, applied on Apply.
  const [moduleFilter, setModuleFilter] = useState<string[]>([]);
  const [moduleDraft, setModuleDraft] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const requestIdRef = useRef(0);

  const resetPage = () => setFirst(0);
  const geo = useHierarchyFilter(resetPage);
  // Active / Manual Logout / Idle Timeout / Session Expired / Login Failed.
  const sessionState = useOptionFilter({
    param: "session_state",
    label: t("admin.login_audit.logout_type", "Logout Type"),
    options: SESSION_STATE_OPTIONS,
    onAppliedChange: resetPage,
  });
  const dates = useDateRangeFilter({
    section: t("admin.login_audit.date_range", "Date"),
    fromLabel: t("admin.login_audit.date_from", "From Date"),
    toLabel: t("admin.login_audit.date_to", "To Date"),
    onAppliedChange: resetPage,
  });

  const moduleOptions = LOGIN_MODULES.map((moduleName) => ({
    label: formatModuleName(moduleName),
    value: moduleName,
  }));
  const commitModules = (next: string[]) => {
    setModuleDraft(next);
    if (next.join(",") !== moduleFilter.join(",")) {
      setModuleFilter(next);
      resetPage();
    }
  };
  const moduleChips: ActiveFilterChip[] = moduleFilter.length
    ? [
        {
          key: "module_name",
          label: t("admin.login_audit.module", "Module"),
          value: moduleFilter.map(formatModuleName).join(", "),
          onRemove: () => commitModules([]),
        },
      ]
    : [];
  const modulePart: FilterPart = {
    field: (
      <FilterSection label={t("admin.login_audit.module", "Module")}>
        <MultiSelect
          value={moduleDraft}
          onChange={setModuleDraft}
          options={moduleOptions}
          placeholder={t("admin.login_audit.module_filter", "Filter by module")}
          aria-label={t("admin.login_audit.module_filter", "Filter by module")}
        />
      </FilterSection>
    ),
    chips: moduleChips,
    count: moduleChips.length,
    apply: () => commitModules(moduleDraft),
    reset: () => commitModules([]),
  };

  const moduleFilterKey = moduleFilter.join(",");
  const geoKey = JSON.stringify(geo.applied);

  // Every active filter as API params — shared by the paginated table and
  // the "all data" Excel export so both always cover the same rows.
  const filterParams = useMemo(
    () => ({
      ...(searchTerm ? { search: searchTerm } : {}),
      ...(JSON.parse(geoKey) as Record<string, string>),
      ...(moduleFilterKey ? { module_name: moduleFilterKey } : {}),
      ...(sessionState.value ? { session_state: sessionState.value } : {}),
      ...(dates.from ? { date_from: dates.from } : {}),
      ...(dates.to ? { date_to: dates.to } : {}),
    }),
    [searchTerm, geoKey, moduleFilterKey, sessionState.value, dates.from, dates.to],
  );

  const loadRows = useCallback(
    async (
      page: number,
      limit: number,
      params: Record<string, unknown>,
      ordering?: string,
    ) => {
      // Rapid filter changes can resolve out of order; only the latest
      // request may write to the table.
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const response = await adminApi.loginAudits.readAllwithPaginated(page, limit, {
          params: {
            ...params,
            ...(ordering ? { ordering } : {}),
          },
        });
        if (requestId !== requestIdRef.current) return;
        setRows(normalizeList(toRecordList(response)) as LoginAuditRecord[]);
        setTotalRecords(
          typeof response?.count === "number" ? response.count : toRecordList(response).length,
        );
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        notify.fire(t("common.error"), String(err), "error");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    },
    [t],
  );

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, filterParams, ordering);
  }, [first, rowsPerPage, filterParams, ordering, loadRows]);

  // Feeds the table's "Download Excel" button: re-fetches every login row
  // matching the current filters, since the table only holds one page.
  const onServerExport = useCallback(
    (filename: string, sheetName: string) =>
      adminApi.loginAudits.exportToExcel({ params: filterParams }, filename, sheetName),
    [filterParams],
  );

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const columns = useMemo(
    () => renderLoginAuditColumns({ t, onView: setSelectedAudit, first }),
    [t, first],
  );

  return (
    <div className="min-h-full bg-gray-50/60 p-3 sm:p-5">
      <ListPageHeader
        title={t("admin.nav.login_audit")}
        subtitle={t("admin.login_audit.subtitle", "Login audit records")}
        className="mb-4"
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <DataTable
          filterPanel={combineFilters(geo, modulePart, sessionState, dates)}
          onServerExport={onServerExport}
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
          loading={isLoading && rows.length === 0}
          header={
            <FilterBar
              searchValue={globalFilterValue}
              onSearchChange={setGlobalFilterValue}
              searchPlaceholder={t("admin.login_audit.search_placeholder", "Search login audits...")}
              className="mb-4"
            />
          }
          stripedRows
          showGridlines
          emptyMessage={t("common.no_records")}
          fitWidth
          className="p-datatable-sm"
        >
          {columns}
        </DataTable>
      </div>

      <LoginAuditDetail audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
    </div>
  );
}
