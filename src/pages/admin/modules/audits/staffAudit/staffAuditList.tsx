import type { StaffAuditJsonValue, StaffAuditRecord, DiffLine, ModuleFilterOption } from "./types";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { staffAuditApi } from "@/helpers/admin";

const ALL_MODULES = "__all__";

const SORTABLE_FIELDS = new Set(["module_name", "createdAt"]);

const toRecordList = (value: unknown): StaffAuditRecord[] => {
  if (Array.isArray(value)) return value as StaffAuditRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: StaffAuditRecord[] }).results;
  }
  return [];
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const formatJson = (value?: StaffAuditJsonValue) => {
  if (value === undefined || value === null) return "-";
  return JSON.stringify(value, null, 2);
};

const JsonViewer = ({
  title,
  value,
}: {
  title: string;
  value?: StaffAuditJsonValue;
}) => (
  <div className="min-w-0">
    <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
    <pre className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
      {formatJson(value)}
    </pre>
  </div>
);

function getChangedPaths(
  prev: StaffAuditJsonValue,
  next: StaffAuditJsonValue,
  prefix = ""
): Set<string> {
  const changed = new Set<string>();
  const isLeaf = (v: StaffAuditJsonValue) =>
    v === null || typeof v !== "object" || Array.isArray(v);

  if (isLeaf(prev) || isLeaf(next)) {
    if (JSON.stringify(prev) !== JSON.stringify(next)) changed.add(prefix);
    return changed;
  }

  const p = prev as Record<string, StaffAuditJsonValue>;
  const n = next as Record<string, StaffAuditJsonValue>;
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
  value: StaffAuditJsonValue,
  changedPaths: Set<string>,
  currentPath: string,
  indent: number,
  isLast: boolean
): DiffLine[] {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);
  const suffix = isLast ? "" : ",";

  if (value === null || typeof value !== "object") {
    return [{ content: pad + JSON.stringify(value) + suffix, changed: changedPaths.has(currentPath) }];
  }

  if (Array.isArray(value)) {
    const isChanged = changedPaths.has(currentPath);
    const formatted = JSON.stringify(value, null, 2).split("\n");
    const result: DiffLine[] = formatted.map((line) => ({ content: pad + line, changed: isChanged }));
    if (result.length > 0) {
      result[result.length - 1] = { ...result[result.length - 1], content: result[result.length - 1].content + suffix };
    }
    return result;
  }

  const obj = value as Record<string, StaffAuditJsonValue>;
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
        lines.push({ content: `${childPad}"${key}": ${formatted[0]}${isChildLast ? "" : ","}`, changed: isChanged });
      } else {
        lines.push({ content: `${childPad}"${key}": ${formatted[0]}`, changed: isChanged });
        for (let j = 1; j < formatted.length - 1; j++) {
          lines.push({ content: childPad + formatted[j], changed: isChanged });
        }
        lines.push({ content: `${childPad}${formatted[formatted.length - 1]}${isChildLast ? "" : ","}`, changed: isChanged });
      }
    } else {
      const childLines = buildDiffLines(val, changedPaths, childPath, indent + 1, isChildLast);
      if (childLines.length > 0) {
        childLines[0] = { ...childLines[0], content: `${childPad}"${key}": ${childLines[0].content.trimStart()}` };
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
  newData?: StaffAuditJsonValue;
  previousData?: StaffAuditJsonValue;
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
        <pre className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">-</pre>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-md border bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 font-mono whitespace-pre">
          {lines.map((line, i) => (
            <div key={i} className={line.changed ? "bg-green-200 rounded" : ""}>
              {line.content || " "}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function StaffAuditList() {
  const { t } = useTranslation();

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});
  const [selectedRecord, setSelectedRecord] = useState<StaffAuditRecord | null>(null);
  const [rows, setRows] = useState<StaffAuditRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [moduleNameOptions, setModuleNameOptions] = useState<string[]>([]);

  const moduleOptions = useMemo<ModuleFilterOption[]>(() => {
    return [
      { label: t("common.all"), value: ALL_MODULES },
      ...moduleNameOptions.map((moduleName) => ({
        label: moduleName,
        value: moduleName,
      })),
    ];
  }, [moduleNameOptions, t]);

  const loading = isLoading && rows.length === 0;

  const onGlobalFilterChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  }, []);

  const openDetails = useCallback((record: StaffAuditRecord) => {
    setSelectedRecord(record);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedRecord(null);
  }, []);

  const actionTemplate = useCallback(
    (row: StaffAuditRecord) => (
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

  const methodTemplate = useCallback(
    (row: StaffAuditRecord) => row.method ?? "-",
    []
  );

  const loadRows = useCallback(
    async (page: number, limit: number, search: string, ordering?: string, moduleFilterValue?: string) => {
      setIsLoading(true);
      try {
        const response = await staffAuditApi.readAllwithPaginated(page, limit, {
          params: {
            ...hierarchyParams,
            ...(search ? { search } : {}),
            ...(ordering ? { ordering } : {}),
            ...(moduleFilterValue && moduleFilterValue !== ALL_MODULES
              ? { module_name: moduleFilterValue }
              : {}),
          },
        });
        setRows(toRecordList(response));
        setTotalRecords(
          typeof response?.count === "number" ? response.count : toRecordList(response).length,
        );
      } catch {
        Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        setIsLoading(false);
      }
    },
    [hierarchyParams, t]
  );

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering, moduleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, moduleFilter, hierarchyParams]);

  // Fetch the full set of module names once on mount purely to populate the
  // dropdown options, independent of the paginated `rows` used for the table.
  // This avoids the dropdown only showing modules present on the current page.
  useEffect(() => {
    let mounted = true;

    const loadModuleNames = async () => {
      try {
        const data = await staffAuditApi.readAllForExport();
        if (!mounted) return;
        const modules = Array.from(
          new Set(
            toRecordList(data)
              .map((record) => record.module_name)
              .filter((moduleName): moduleName is string => Boolean(moduleName))
          )
        ).sort((a, b) => a.localeCompare(b));
        setModuleNameOptions(modules);
      } catch {
        // Non-fatal: dropdown simply won't have options if this fails.
      }
    };

    void loadModuleNames();

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

  useEffect(() => {
    setFirst(0);
  }, [moduleFilter, hierarchyParams]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {t("admin.staff_audit.list_title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.staff_audit.list_subtitle")}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <HierarchyFilterBar onChange={setHierarchyParams} />
      </div>

      <div className="mb-4 flex flex-col justify-end gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:w-64">
          <Dropdown
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.value)}
            options={moduleOptions}
            optionLabel="label"
            optionValue="value"
            placeholder={t("admin.staff_audit.module_filter")}
            className="w-full text-sm"
          />
        </div>

        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
          <i className="pi pi-search text-gray-500" />
          <InputText
            value={globalFilterValue}
            onChange={onGlobalFilterChange}
            placeholder={t("admin.staff_audit.search_placeholder")}
            className="border-none text-sm"
          />
        </div>
      </div>

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
        emptyMessage={t("admin.staff_audit.empty_message")}
      >
        <Column
          header={t("common.s_no")}
          body={(_, { rowIndex }) => rowIndex + 1}
          style={{ width: 70 }}
        />
        <Column
          field="module_name"
          header={t("admin.staff_audit.module_name")}
          sortable
        />
        <Column
          field="endpoint_name"
          header={t("admin.staff_audit.endpoint_name")}
        />
        <Column
          field="method"
          header={t("admin.staff_audit.method")}
          body={methodTemplate}
        />
        <Column
          field="object_id"
          header={t("admin.staff_audit.object_id")}
          body={(r: StaffAuditRecord) => r.object_id ?? "-"}
        />
        <Column
          field="createdBy"
          header={t("admin.staff_audit.created_by")}
          body={(r: StaffAuditRecord) => r.createdBy ?? "-"}
        />
        <Column
          field="createdAt"
          header={t("admin.staff_audit.created_at")}
          body={(r: StaffAuditRecord) => formatDateTime(r.createdAt)}
          sortable
        />
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: 120 }} />
      </DataTable>

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.staff_audit.detail_title")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <JsonViewer
              title={t("admin.staff_audit.previous_data")}
              value={selectedRecord?.previous_data}
            />
            <DiffJsonViewer
              title={t("admin.staff_audit.new_data")}
              newData={selectedRecord?.new_data}
              previousData={selectedRecord?.previous_data}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
