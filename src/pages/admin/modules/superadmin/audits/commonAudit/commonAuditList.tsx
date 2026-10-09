import type {
  CommonAuditJsonValue,
  CommonAuditRecord,
  DiffLine,
  MainScreenOption,
  SubScreenOption,
} from "./types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { usePermissionLabels } from "@/utils/permissionLabels";

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
import { FilterSection, type ActiveFilterChip } from "@/components/common/ListToolbar";
import { useHierarchyFilter } from "@/components/filters/useHierarchyFilter";
import { combineFilters, useOptionFilter, type FilterPart } from "@/components/filters/useOptionFilter";

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
  const { moduleLabel, screenLabel } = usePermissionLabels();

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  // Main / Sub Screen multi-selects: applied values drive the API; the
  // draft is what the Filters panel edits until "Apply filters".
  const [mainScreenFilter, setMainScreenFilter] = useState<string[]>([]);
  const [subScreenFilter, setSubScreenFilter] = useState<string[]>([]);
  const [screenDraft, setScreenDraft] = useState<{ main: string[]; sub: string[] }>({
    main: [],
    sub: [],
  });
  const requestIdRef = useRef(0);
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
    () => mainScreens.map((m) => ({ value: m.value, label: moduleLabel(m.label) })),
    [mainScreens, moduleLabel],
  );

  const subScreenOptions = useMemo(
    () => subScreens.map((s) => ({ value: s.value, label: screenLabel(s.label) })),
    [subScreens, screenLabel],
  );

  const resetPage = () => setFirst(0);
  // Location replaces the old District / Local Body dropdowns (rows here are
  // scoped by geography; the API takes the flat ?state_id=… params).
  const geo = useHierarchyFilter(resetPage);
  // "" = all, "true"/"false" = only successful / only rejected writes.
  const status = useOptionFilter({
    param: "success",
    label: t("common.status"),
    options: [
      { label: t("admin.common_audit.status_success", "Successful"), value: "true" },
      { label: t("admin.common_audit.status_failed", "Failed"), value: "false" },
    ],
    onAppliedChange: resetPage,
  });
  const approval = useOptionFilter({
    param: "approval_only",
    label: t("admin.common_audit.approval_only_filter", "Approvals only"),
    section: t("admin.common_audit.events", "Events"),
    options: [{ label: t("admin.common_audit.approval_only_filter", "Approvals only"), value: "true" }],
    allLabel: t("common.all", "All"),
    onAppliedChange: resetPage,
  });
  const dates = useDateRangeFilter({
    section: t("admin.common_audit.date_range", "Date"),
    fromLabel: t("admin.common_audit.date_from", "From Date"),
    toLabel: t("admin.common_audit.date_to", "To Date"),
    onAppliedChange: resetPage,
  });

  const commitScreens = (next: { main: string[]; sub: string[] }) => {
    setScreenDraft(next);
    if (next.main.join(",") !== mainScreenFilter.join(",") || next.sub.join(",") !== subScreenFilter.join(",")) {
      setMainScreenFilter(next.main);
      setSubScreenFilter(next.sub);
      resetPage();
    }
  };
  const labelsFor = (values: string[], options: { value: string; label: string }[]) =>
    values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");
  const screenChips: ActiveFilterChip[] = [
    ...(mainScreenFilter.length
      ? [
          {
            key: "main_screen",
            label: t("admin.common_audit.module_filter"),
            value: labelsFor(mainScreenFilter, mainScreenOptions),
            // sub screens cascade from the main screens, so they go too
            onRemove: () => commitScreens({ main: [], sub: [] }),
          },
        ]
      : []),
    ...(subScreenFilter.length
      ? [
          {
            key: "sub_screen",
            label: t("admin.common_audit.sub_screen_filter", "Sub Screen"),
            value: subScreenFilter.join(", "),
            onRemove: () => commitScreens({ main: mainScreenFilter, sub: [] }),
          },
        ]
      : []),
  ];
  const screenPart: FilterPart = {
    field: (
      <FilterSection label={t("admin.common_audit.screens", "Screens")}>
        <div className="flex flex-col gap-2">
          <MultiSelect
            value={screenDraft.main}
            onChange={(next) => setScreenDraft((d) => ({ ...d, main: next }))}
            options={mainScreenOptions}
            placeholder={t("admin.common_audit.module_filter")}
            aria-label={t("admin.common_audit.module_filter")}
          />
          <MultiSelect
            value={screenDraft.sub}
            onChange={(next) => setScreenDraft((d) => ({ ...d, sub: next }))}
            options={subScreenOptions}
            disabled={screenDraft.main.length === 0 || subScreensLoading}
            placeholder={t("admin.common_audit.sub_screen_filter", "Sub Screen")}
            aria-label={t("admin.common_audit.sub_screen_filter", "Sub Screen")}
          />
        </div>
      </FilterSection>
    ),
    chips: screenChips,
    count: screenChips.length,
    apply: () => commitScreens(screenDraft),
    reset: () => commitScreens({ main: [], sub: [] }),
  };

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

  // Every active filter as API params — shared by the paginated table and
  // the "all data" Excel export so both always cover the same rows.
  const mainScreenFilterKey = mainScreenFilter.join(",");
  const subScreenFilterKey = subScreenFilter.join(",");
  const geoKey = JSON.stringify(geo.applied);

  const filterParams = useMemo(
    () => ({
      ...(searchTerm ? { search: searchTerm } : {}),
      ...(mainScreenFilterKey ? { main_screen: mainScreenFilterKey } : {}),
      ...(subScreenFilterKey ? { sub_screen: subScreenFilterKey } : {}),
      ...(dates.from ? { date_from: dates.from } : {}),
      ...(dates.to ? { date_to: dates.to } : {}),
      ...(approval.value ? { approval_only: true } : {}),
      ...(JSON.parse(geoKey) as Record<string, string>),
      ...(status.value ? { success: status.value } : {}),
    }),
    [
      searchTerm,
      mainScreenFilterKey,
      subScreenFilterKey,
      dates.from,
      dates.to,
      approval.value,
      geoKey,
      status.value,
    ],
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
        const response = await commonAuditApi.readAllwithPaginated(
          page,
          limit,
          {
            params: {
              ...params,
              ...(ordering ? { ordering } : {}),
            },
          },
        );
        if (requestId !== requestIdRef.current) return;
        setRows(toRecordList(response));
        setTotalRecords(
          typeof response?.count === "number"
            ? response.count
            : toRecordList(response).length,
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

  const ordering =
    sortField && SORTABLE_FIELDS.has(sortField)
      ? `${sortOrder === -1 ? "-" : ""}${sortField}`
      : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, filterParams, ordering);
  }, [first, rowsPerPage, filterParams, ordering, loadRows]);

  // Feeds the table's "Download Excel" button: re-fetches every audit row
  // matching the current filters, since the table is lazily paginated and
  // only holds one page.
  const loadAllExportRows = useCallback(
    async () =>
      toRecordList(
        await commonAuditApi.readAllForExport({ params: filterParams }),
      ) as unknown as Record<string, unknown>[],
    [filterParams],
  );

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

  // Sub Screen options cascade from the Main Screen(s) picked in the panel — fetched
  // from the real UserScreen master data, scoped server-side via
  // ?mainscreen_id= (the same param UserScreen's own list page/form use),
  // so this stays searchable and accurate instead of a static list. With
  // multiple Main Screens selected, options are the union across all of
  // them.
  useEffect(() => {
    let mounted = true;

    const selectedMainScreens = mainScreens.filter((m) =>
      screenDraft.main.includes(m.value),
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
  }, [screenDraft.main.join(","), mainScreens]);

  // Drop any draft Sub Screen selections that fell out of the option list
  // once the Main Screen selection (and therefore the cascaded options)
  // changed.
  useEffect(() => {
    setScreenDraft((prev) => {
      const validValues = new Set(subScreens.map((s) => s.value));
      const sub = prev.sub.filter((v) => validValues.has(v));
      return sub.length === prev.sub.length ? prev : { ...prev, sub };
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
          <DataTable
            filterPanel={combineFilters(geo, screenPart, status, dates, approval)}
            header={
              <FilterBar
                searchValue={globalFilterValue}
                onSearchChange={setGlobalFilterValue}
                searchPlaceholder={t("admin.common_audit.search_placeholder")}
                className="mb-4"
              />
            }
            onExportRequest={loadAllExportRows}
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
              field="district_name"
              header={t("common.district")}
              body={(r: CommonAuditRecord) => r.district_name ?? "-"}
            />
            <Column
              field="local_body_name"
              header={t("admin.common_audit.local_body", "Local Body")}
              body={(r: CommonAuditRecord) =>
                r.local_body_name ? (
                  <div className="leading-tight">
                    <div>{r.local_body_name}</div>
                    {r.local_body_level ? (
                      <div className="text-xs text-gray-500">
                        {r.local_body_level}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  "-"
                )
              }
            />
            <Column
              field="createdBy"
              header={t("admin.common_audit.created_by")}
              body={(r: CommonAuditRecord) => {
                const name = r.created_by_name ?? r.createdBy;
                if (!name) return "-";
                return (
                  <div className="leading-tight">
                    <div className="font-medium text-gray-800">{name}</div>
                    {r.created_by_id ? (
                      <div className="text-xs text-gray-500">{r.created_by_id}</div>
                    ) : null}
                  </div>
                );
              }}
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
              body={(r: CommonAuditRecord) =>
                r.success === false ? (
                  <span
                    title={r.reason ?? undefined}
                    className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                  >
                    {t("admin.common_audit.status_failed", "Failed")}
                  </span>
                ) : (
                  <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {t("admin.common_audit.status_success", "Successful")}
                  </span>
                )
              }
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

          <div className="grid gap-3 rounded-md border bg-gray-50 p-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-gray-500">{t("common.status")}</div>
              <div
                className={
                  selectedRecord?.success === false
                    ? "font-medium text-red-700"
                    : "font-medium text-green-700"
                }
              >
                {selectedRecord?.success === false
                  ? t("admin.common_audit.status_failed", "Failed")
                  : t("admin.common_audit.status_success", "Successful")}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                {t("admin.common_audit.ip_address", "IP Address")}
              </div>
              <div>{selectedRecord?.ip_address || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">
                {t("admin.common_audit.created_by")}
              </div>
              <div>
                {selectedRecord?.created_by_name ?? selectedRecord?.createdBy ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{t("common.location")}</div>
              <div>
                {[selectedRecord?.local_body_name, selectedRecord?.district_name]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </div>
            </div>
            {selectedRecord?.reason ? (
              <div className="sm:col-span-2">
                <div className="text-xs text-gray-500">
                  {t("admin.common_audit.reason", "Reason")}
                </div>
                <div className="text-red-700">{selectedRecord.reason}</div>
              </div>
            ) : null}
            <div className="min-w-0 sm:col-span-2">
              <div className="text-xs text-gray-500">
                {t("admin.common_audit.user_agent", "User Agent")}
              </div>
              <div className="break-words text-xs text-gray-700">
                {selectedRecord?.user_agent || "-"}
              </div>
            </div>
          </div>

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
