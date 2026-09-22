import type {
  CommonAuditJsonValue,
  CommonAuditRecord,
  DiffLine,
  MainScreenOption,
  SubScreenOption,
} from "./types";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Lock,
  ListChecks,
  CalendarClock,
  XCircle,
} from "lucide-react";
import type {
  DataTablePageEvent,
  DataTableSortEvent,
  SortOrder,
} from "primereact/datatable";

import { commonAuditApi, mainScreenApi, userScreenApi } from "@/helpers/admin";
import { ListPageHeader } from "@/components/common/ListPageHeader";
import { FilterBar } from "@/components/common/FilterBar";

type RawMainScreen = {
  unique_id?: string;
  mainscreen_name?: string;
};

type RawUserScreen = {
  unique_id?: string;
  userscreen_name?: string;
  mainscreen_id?: string;
};

const SORTABLE_FIELDS = new Set(["module_name", "createdAt"]);

const toRecordList = (value: unknown): CommonAuditRecord[] => {
  if (Array.isArray(value)) return value as CommonAuditRecord[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: CommonAuditRecord[] }).results;
  }
  return [];
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const formatJson = (value?: CommonAuditJsonValue) => {
  if (value === undefined || value === null) return "-";
  return JSON.stringify(value, null, 2);
};

const JsonViewer = ({
  title,
  value,
}: {
  title: string;
  value?: CommonAuditJsonValue;
}) => (
  <div className="min-w-0">
    <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
    <pre className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
      {formatJson(value)}
    </pre>
  </div>
);

function getChangedPaths(
  prev: CommonAuditJsonValue,
  next: CommonAuditJsonValue,
  prefix = "",
): Set<string> {
  const changed = new Set<string>();
  const isLeaf = (v: CommonAuditJsonValue) =>
    v === null || typeof v !== "object" || Array.isArray(v);

  if (isLeaf(prev) || isLeaf(next)) {
    if (JSON.stringify(prev) !== JSON.stringify(next)) changed.add(prefix);
    return changed;
  }

  const p = prev as Record<string, CommonAuditJsonValue>;
  const n = next as Record<string, CommonAuditJsonValue>;
  for (const key of Object.keys(n)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in p)) {
      changed.add(path);
    } else {
      getChangedPaths(p[key], n[key], path).forEach((cp) => changed.add(cp));
    }
  }
  return changed;
}

function buildDiffLines(
  value: CommonAuditJsonValue,
  changedPaths: Set<string>,
  currentPath: string,
  indent: number,
  isLast: boolean,
): DiffLine[] {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);
  const suffix = isLast ? "" : ",";

  if (value === null || typeof value !== "object") {
    return [
      {
        content: pad + JSON.stringify(value) + suffix,
        changed: changedPaths.has(currentPath),
      },
    ];
  }

  if (Array.isArray(value)) {
    const isChanged = changedPaths.has(currentPath);
    const formatted = JSON.stringify(value, null, 2).split("\n");
    const result: DiffLine[] = formatted.map((line) => ({
      content: pad + line,
      changed: isChanged,
    }));
    if (result.length > 0) {
      result[result.length - 1] = {
        ...result[result.length - 1],
        content: result[result.length - 1].content + suffix,
      };
    }
    return result;
  }

  const obj = value as Record<string, CommonAuditJsonValue>;
  const entries = Object.entries(obj);
  const lines: DiffLine[] = [{ content: pad + "{", changed: false }];

  entries.forEach(([key, val], i) => {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    const isChildLast = i === entries.length - 1;

    if (val === null || typeof val !== "object") {
      lines.push({
        content: `${childPad}"${key}": ${JSON.stringify(val)}${isChildLast ? "" : ","}`,
        changed: changedPaths.has(childPath),
      });
    } else if (Array.isArray(val)) {
      const isChanged = changedPaths.has(childPath);
      const formatted = JSON.stringify(val, null, 2).split("\n");
      if (formatted.length === 1) {
        lines.push({
          content: `${childPad}"${key}": ${formatted[0]}${isChildLast ? "" : ","}`,
          changed: isChanged,
        });
      } else {
        lines.push({
          content: `${childPad}"${key}": ${formatted[0]}`,
          changed: isChanged,
        });
        for (let j = 1; j < formatted.length - 1; j++) {
          lines.push({ content: childPad + formatted[j], changed: isChanged });
        }
        lines.push({
          content: `${childPad}${formatted[formatted.length - 1]}${isChildLast ? "" : ","}`,
          changed: isChanged,
        });
      }
    } else {
      const childLines = buildDiffLines(
        val,
        changedPaths,
        childPath,
        indent + 1,
        isChildLast,
      );
      if (childLines.length > 0) {
        childLines[0] = {
          ...childLines[0],
          content: `${childPad}"${key}": ${childLines[0].content.trimStart()}`,
        };
      }
      lines.push(...childLines);
    }
  });

  lines.push({ content: pad + "}" + suffix, changed: false });
  return lines;
}

const DiffJsonViewer = ({
  title,
  newData,
  previousData,
}: {
  title: string;
  newData?: CommonAuditJsonValue;
  previousData?: CommonAuditJsonValue;
}) => {
  const lines = useMemo(() => {
    if (newData === undefined || newData === null) return null;
    const changedPaths =
      previousData !== undefined && previousData !== null
        ? getChangedPaths(previousData, newData)
        : new Set<string>();
    return buildDiffLines(newData, changedPaths, "", 0, true);
  }, [newData, previousData]);

  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
      {lines === null ? (
        <pre className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
          -
        </pre>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 font-mono whitespace-pre">
          {lines.map((line, i) => (
            <div key={i} className={line.changed ? "bg-green-200 rounded" : ""}>
              {line.content || " "}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function CommonAuditList() {
  const { t } = useTranslation();

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [mainScreenFilter, setMainScreenFilter] = useState<string[]>([]);
  const [subScreenFilter, setSubScreenFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [approvalOnly, setApprovalOnly] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<CommonAuditRecord | null>(null);
  const [rows, setRows] = useState<CommonAuditRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [mainScreens, setMainScreens] = useState<MainScreenOption[]>([]);
  const [subScreens, setSubScreens] = useState<SubScreenOption[]>([]);
  const [subScreensLoading, setSubScreensLoading] = useState(false);

  const mainScreenOptions = useMemo(
    () => mainScreens.map((m) => ({ value: m.value, label: m.label })),
    [mainScreens],
  );

  const subScreenOptions = useMemo(
    () => subScreens.map((s) => ({ value: s.value, label: s.label })),
    [subScreens],
  );

  const loading = isLoading && rows.length === 0;

  const openDetails = useCallback((record: CommonAuditRecord) => {
    setSelectedRecord(record);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedRecord(null);
  }, []);

  const actionTemplate = useCallback(
    (row: CommonAuditRecord) => (
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

  const methodTemplate = useCallback(
    (row: CommonAuditRecord) => row.method ?? "-",
    [],
  );

  const loadRows = useCallback(
    async (
      page: number,
      limit: number,
      search: string,
      ordering?: string,
      mainScreenValues?: string[],
      subScreenValues?: string[],
      dateFromValue?: string,
      dateToValue?: string,
      approvalOnlyValue?: boolean,
    ) => {
      setIsLoading(true);
      try {
        const response = await commonAuditApi.readAllwithPaginated(
          page,
          limit,
          {
            params: {
              ...(search ? { search } : {}),
              ...(ordering ? { ordering } : {}),
              ...(mainScreenValues && mainScreenValues.length
                ? { main_screen: mainScreenValues.join(",") }
                : {}),
              ...(subScreenValues && subScreenValues.length
                ? { sub_screen: subScreenValues.join(",") }
                : {}),
              ...(dateFromValue ? { date_from: dateFromValue } : {}),
              ...(dateToValue ? { date_to: dateToValue } : {}),
              ...(approvalOnlyValue ? { approval_only: true } : {}),
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

  const ordering =
    sortField && SORTABLE_FIELDS.has(sortField)
      ? `${sortOrder === -1 ? "-" : ""}${sortField}`
      : undefined;

  const mainScreenFilterKey = mainScreenFilter.join(",");
  const subScreenFilterKey = subScreenFilter.join(",");

  useEffect(() => {
    void loadRows(
      first / rowsPerPage + 1,
      rowsPerPage,
      searchTerm,
      ordering,
      mainScreenFilter,
      subScreenFilter,
      dateFrom,
      dateTo,
      approvalOnly,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    first,
    rowsPerPage,
    searchTerm,
    ordering,
    mainScreenFilterKey,
    subScreenFilterKey,
    dateFrom,
    dateTo,
    approvalOnly,
  ]);

  // Main Screen options come from the real MainScreen master data (the same
  // records that build the admin sidebar), not from whatever module names
  // happen to already appear in audit rows — so a screen with zero audit
  // activity yet still shows up as a filterable option. Fetched once on
  // mount, independent of the paginated `rows` used for the table.
  useEffect(() => {
    let mounted = true;

    const loadMainScreens = async () => {
      try {
        const data = await mainScreenApi.readAllForExport();
        if (!mounted) return;
        const options = (data as RawMainScreen[])
          .filter((screen) => screen.unique_id && screen.mainscreen_name)
          .map((screen) => ({
            label: screen.mainscreen_name as string,
            value: screen.mainscreen_name as string,
            unique_id: screen.unique_id as string,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setMainScreens(options);
      } catch {
        // Non-fatal: dropdown simply won't have options if this fails.
      }
    };

    void loadMainScreens();

    return () => {
      mounted = false;
    };
  }, []);

  // Sub Screen options cascade from the selected Main Screen(s) — fetched
  // from the real UserScreen master data, scoped server-side via
  // ?mainscreen_id= (the same param UserScreen's own list page/form use),
  // so this stays searchable and accurate instead of a static list. With
  // multiple Main Screens selected, options are the union across all of
  // them.
  useEffect(() => {
    let mounted = true;

    const selectedMainScreens = mainScreens.filter((m) =>
      mainScreenFilter.includes(m.value),
    );
    if (selectedMainScreens.length === 0) {
      setSubScreens([]);
      return;
    }

    const loadSubScreens = async () => {
      setSubScreensLoading(true);
      try {
        const results = await Promise.all(
          selectedMainScreens.map((screen) =>
            userScreenApi.readAllForExport({
              params: { mainscreen_id: screen.unique_id },
            }),
          ),
        );
        if (!mounted) return;
        const seen = new Set<string>();
        const options = results
          .flatMap((data) => data as RawUserScreen[])
          .filter((screen) => screen.unique_id && screen.userscreen_name)
          .filter((screen) => {
            if (seen.has(screen.unique_id as string)) return false;
            seen.add(screen.unique_id as string);
            return true;
          })
          .map((screen) => ({
            label: screen.userscreen_name as string,
            value: screen.userscreen_name as string,
            unique_id: screen.unique_id as string,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setSubScreens(options);
      } catch {
        if (mounted) setSubScreens([]);
      } finally {
        if (mounted) setSubScreensLoading(false);
      }
    };

    void loadSubScreens();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainScreenFilterKey, mainScreens]);

  // Drop any Sub Screen selections that fell out of the option list once the
  // Main Screen selection (and therefore the cascaded options) changed.
  useEffect(() => {
    setSubScreenFilter((prev) => {
      const validValues = new Set(subScreens.map((s) => s.value));
      const next = prev.filter((v) => validValues.has(v));
      return next.length === prev.length ? prev : next;
    });
  }, [subScreens]);

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

  // Computed from the currently loaded page only (this view is lazily
  // paginated, so a true dataset-wide count would need a dedicated
  // aggregate endpoint the API doesn't expose yet).
  const failedOnPage = rows.filter((r) => r.success === false).length;
  const successOnPage = rows.length - failedOnPage;

  return (
    <div className="p-3">
      <ListPageHeader
        title={t("admin.common_audit.list_title")}
        subtitle={t("admin.common_audit.list_subtitle")}
        className="mb-6"
      />

      <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>
            {t(
              "admin.common_audit.readonly_title",
              "Audit records are read-only.",
            )}
          </strong>{" "}
          {t(
            "admin.common_audit.readonly_note",
            "Audit history cannot be edited or deleted from this screen.",
          )}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("admin.common_audit.stat_total", "Total Audit Events")}
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
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("admin.common_audit.stat_success", "Successful (this page)")}
              </div>
              <div className="text-xl font-semibold">
                {successOnPage.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-red-50 p-2 text-red-600 dark:bg-red-950/40">
              <XCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {t("admin.common_audit.stat_failed", "Failed (this page)")}
              </div>
              <div className="text-xl font-semibold">
                {failedOnPage.toLocaleString()}
              </div>
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
                {t("admin.common_audit.stat_page_size", "Rows per Page")}
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
            searchPlaceholder={t("admin.common_audit.search_placeholder")}
            className="mb-4"
          >
            <div className="w-full sm:w-64">
              <MultiSelect
                value={mainScreenFilter}
                onChange={(next) => {
                  setMainScreenFilter(next);
                  setFirst(0);
                }}
                options={mainScreenOptions}
                placeholder={t("admin.common_audit.module_filter")}
                aria-label={t("admin.common_audit.module_filter")}
              />
            </div>
            <div className="w-full sm:w-64">
              <MultiSelect
                value={subScreenFilter}
                onChange={(next) => {
                  setSubScreenFilter(next);
                  setFirst(0);
                }}
                options={subScreenOptions}
                disabled={mainScreenFilter.length === 0 || subScreensLoading}
                placeholder={t(
                  "admin.common_audit.sub_screen_filter",
                  "Sub Screen",
                )}
                aria-label={t(
                  "admin.common_audit.sub_screen_filter",
                  "Sub Screen",
                )}
              />
            </div>
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">
                {t("admin.common_audit.date_from", "From Date")}
              </span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setFirst(0);
                }}
                className="h-10 rounded-md border px-3"
                aria-label={t("admin.common_audit.date_from", "From Date")}
              />
            </label>
            <label className="text-sm text-gray-700">
              <span className="mb-1 block">
                {t("admin.common_audit.date_to", "To Date")}
              </span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setFirst(0);
                }}
                className="h-10 rounded-md border px-3"
                aria-label={t("admin.common_audit.date_to", "To Date")}
              />
            </label>
            <label className="flex h-10 items-center gap-2 text-sm text-gray-700">
              <Switch
                checked={approvalOnly}
                onCheckedChange={(checked) => {
                  setApprovalOnly(checked);
                  setFirst(0);
                }}
                aria-label={t(
                  "admin.common_audit.approval_only_filter",
                  "Approvals only",
                )}
              />
              <Label className="cursor-pointer font-normal">
                {t("admin.common_audit.approval_only_filter", "Approvals only")}
              </Label>
            </label>
          </FilterBar>

          <DataTable
            value={rows}
            dataKey="uuid"
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
            emptyMessage={t("admin.common_audit.empty_message")}
          >
            <Column
              header={t("common.s_no")}
              body={(_, { rowIndex }) => rowIndex + 1}
              style={{ width: 70 }}
            />
            <Column
              field="module_name"
              header={t("admin.common_audit.module_name")}
              sortable
            />
            <Column
              field="endpoint_name"
              header={t("admin.common_audit.endpoint_name")}
            />
            <Column
              field="method"
              header={t("admin.common_audit.method")}
              body={methodTemplate}
            />
            <Column
              field="object_id"
              header={t("admin.common_audit.object_id")}
              body={(r: CommonAuditRecord) => r.object_id ?? "-"}
            />
            <Column
              field="createdBy"
              header={t("admin.common_audit.created_by")}
              body={(r: CommonAuditRecord) => r.createdBy ?? "-"}
            />
            <Column
              field="ip_address"
              header={t("admin.common_audit.ip_address", "IP Address")}
              body={(r: CommonAuditRecord) => r.ip_address ?? "-"}
            />
            <Column
              field="user_agent"
              header={t("admin.common_audit.user_agent", "User Agent")}
              body={(r: CommonAuditRecord) => (
                <span
                  className="block max-w-[220px] truncate"
                  title={r.user_agent ?? undefined}
                >
                  {r.user_agent ?? "-"}
                </span>
              )}
            />
            <Column
              field="success"
              header={t("admin.common_audit.success", "Success")}
              body={(r: CommonAuditRecord) => (
                <span
                  className={
                    r.success === false
                      ? "font-medium text-red-600"
                      : "font-medium text-green-600"
                  }
                >
                  {r.success === false ? t("common.no") : t("common.yes")}
                </span>
              )}
            />
            <Column
              field="reason"
              header={t("admin.common_audit.reason", "Reason")}
              body={(r: CommonAuditRecord) => (
                <span
                  className="block max-w-[260px] truncate"
                  title={r.reason ?? undefined}
                >
                  {r.reason ?? "-"}
                </span>
              )}
            />
            <Column
              field="createdAt"
              header={t("admin.common_audit.created_at")}
              body={(r: CommonAuditRecord) => formatDateTime(r.createdAt)}
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
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.common_audit.detail_title")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <JsonViewer
              title={t("admin.common_audit.previous_data")}
              value={selectedRecord?.previous_data}
            />
            <DiffJsonViewer
              title={t("admin.common_audit.new_data")}
              newData={selectedRecord?.new_data}
              previousData={selectedRecord?.previous_data}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
