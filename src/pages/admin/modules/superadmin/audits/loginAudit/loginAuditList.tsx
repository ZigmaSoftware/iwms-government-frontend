import type { LoginAuditRecord } from "./types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { MultiSelect } from "@/components/ui/multi-select";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi } from "@/helpers/admin/registry";
import { normalizeList } from "@/utils/forms";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { FilterSection, type ActiveFilterChip } from "@/components/common/ListToolbar";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useOptionFilter, type FilterPart } from "@/components/filters/useOptionFilter";

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

const SORTABLE_FIELDS = new Set([
  "module_name",
  "username",
  "ip_address",
  "success",
  "timestamp",
]);

const formatModuleName = (value?: string | null) => {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const formatAuditValue = (value?: string | boolean | null) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

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

const JsonViewer = ({ title, value }: { title: string; value?: Record<string, unknown> }) => (
  <div className="min-w-0">
    <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
    <pre className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
      {value ? JSON.stringify(value, null, 2) : "-"}
    </pre>
  </div>
);

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
  // "" = all, "true"/"false" = only successful logins / only failed attempts.
  const status = useOptionFilter({
    param: "success",
    label: t("common.status"),
    options: [
      { label: t("admin.login_audit.status_success", "Successful"), value: "true" },
      { label: t("admin.login_audit.status_failed", "Failed"), value: "false" },
    ],
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
      ...(status.value ? { success: status.value } : {}),
      ...(dates.from ? { date_from: dates.from } : {}),
      ...(dates.to ? { date_to: dates.to } : {}),
    }),
    [searchTerm, geoKey, moduleFilterKey, status.value, dates.from, dates.to],
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
  const loadAllExportRows = useCallback(
    async () =>
      normalizeList(
        toRecordList(await adminApi.loginAudits.readAllForExport({ params: filterParams })),
      ) as Record<string, unknown>[],
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

  const openDetails = useCallback((record: LoginAuditRecord) => {
    setSelectedAudit(record);
  }, []);

  const closeDetails = useCallback(() => setSelectedAudit(null), []);

  const actionTemplate = useCallback(
    (row: LoginAuditRecord) => (
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
    [openDetails, t]
  );

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.nav.login_audit")}
        subtitle={t("admin.login_audit.subtitle", "Login audit records by module")}
        className="mb-6"
      />

      <DataTable
        filterPanel={combineFilters(geo, modulePart, status, dates)}
        onExportRequest={loadAllExportRows}
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
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={(_: LoginAuditRecord, { rowIndex }: { rowIndex: number }) => rowIndex + 1}
          style={{ width: 70 }}
        />
        <Column field="unique_id" header="ID" />
        <Column
          field="module_name"
          header={t("admin.login_audit.module", "Module")}
          body={(row: LoginAuditRecord) => formatModuleName(row.module_name)}
          sortable
        />
        <Column field="username" header="Username" sortable />
        <Column
          field="user_name"
          header={t("admin.login_audit.user", "User")}
          body={(row: LoginAuditRecord) =>
            row.user_name ? (
              <div className="leading-tight">
                <div className="font-medium text-gray-800">{row.user_name}</div>
                {row.user_unique_id ? (
                  <div className="text-xs text-gray-500">{row.user_unique_id}</div>
                ) : null}
              </div>
            ) : (
              row.user_unique_id ?? "-"
            )
          }
        />
        <Column field="ip_address" header="IP Address" sortable />
        <Column field="user_agent" header="User Agent" />
        <Column
          field="success"
          header="Success"
          body={(row: LoginAuditRecord) => formatAuditValue(row.success)}
          sortable
        />
        <Column field="reason" header="Reason" />
        <Column
          field="timestamp"
          header="Timestamp"
          body={(row: LoginAuditRecord) => formatDateTime(row.timestamp)}
          sortable
        />
        <Column
          field="district_name"
          header={t("common.district")}
          body={(row: LoginAuditRecord) => row.district_name ?? "-"}
        />
        <Column
          field="local_body_name"
          header={t("admin.login_audit.local_body", "Local Body")}
          body={(row: LoginAuditRecord) =>
            row.local_body_name ? (
              <div className="leading-tight">
                <div>{row.local_body_name}</div>
                {row.local_body_level ? (
                  <div className="text-xs text-gray-500">{row.local_body_level}</div>
                ) : null}
              </div>
            ) : (
              "-"
            )
          }
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ minWidth: 120 }} />
      </DataTable>

      <Dialog open={Boolean(selectedAudit)} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.login_audit.detail_title", "Login Audit Details")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <JsonViewer title="Audit Record" value={selectedAudit ?? undefined} />
            <div className="space-y-2">
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {t("admin.login_audit.module", "Module")}
                </p>
                <p className="font-semibold text-gray-900">
                  {formatModuleName(selectedAudit?.module_name)}
                </p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">Username</p>
                <p className="font-semibold text-gray-900">{selectedAudit?.username ?? "-"}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {t("admin.login_audit.user", "User")}
                </p>
                <p className="font-semibold text-gray-900">
                  {selectedAudit?.user_name ?? selectedAudit?.user_unique_id ?? "-"}
                </p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {t("common.location")}
                </p>
                <p className="font-semibold text-gray-900">
                  {[selectedAudit?.local_body_name, selectedAudit?.district_name]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">IP Address</p>
                <p className="font-semibold text-gray-900">{selectedAudit?.ip_address ?? "-"}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">User Agent</p>
                <p className="font-semibold text-gray-900">{selectedAudit?.user_agent ?? "-"}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">Success</p>
                <p className="font-semibold text-gray-900">{formatAuditValue(selectedAudit?.success)}</p>
              </div>
              <div className="rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500">Timestamp</p>
                <p className="font-semibold text-gray-900">{formatDateTime(selectedAudit?.timestamp)}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
