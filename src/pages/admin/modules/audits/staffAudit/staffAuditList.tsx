import type { StaffAuditJsonValue, StaffAuditRecord, DiffLine, ModuleFilterOption, TableFilters } from "./types";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";
import { staffAuditApi } from "@/helpers/admin";
import { normalizeList } from "@/utils/forms";


const ALL_MODULES = "__all__";

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
  const [auditRows, setAuditRows] = useState<StaffAuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const records = useMemo(
    () => normalizeList<StaffAuditRecord>(auditRows),
    [auditRows]
  );

  const moduleOptions = useMemo<ModuleFilterOption[]>(() => {
    const modules = Array.from(
      new Set(
        records
          .map((record) => record.module_name)
          .filter((moduleName): moduleName is string => Boolean(moduleName))
      )
    ).sort((a, b) => a.localeCompare(b));

    return [
      { label: t("common.all"), value: ALL_MODULES },
      ...modules.map((moduleName) => ({
        label: moduleName,
        value: moduleName,
      })),
    ];
  }, [records, t]);

  const filteredRecords = useMemo(() => {
    if (moduleFilter === ALL_MODULES) {
      return records;
    }

    return records.filter((record) => record.module_name === moduleFilter);
  }, [moduleFilter, records]);

  const loading = isLoading && records.length === 0;

  const onGlobalFilterChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    });
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

  useEffect(() => {
    let mounted = true;

    const loadAudits = async () => {
      setIsLoading(true);
      try {
        const data = await staffAuditApi.readAll({ params: hierarchyParams });
        if (mounted) setAuditRows(data as StaffAuditRecord[]);
      } catch {
        if (mounted) Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadAudits();

    return () => {
      mounted = false;
    };
  }, [hierarchyParams, t]);

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
        value={filteredRecords}
        dataKey="uuid"
        paginator
        rows={10}
        loading={loading}
        filters={filters}
        globalFilterFields={[
          "module_name",
          "endpoint_name",
          "method",
          "object_id",
          "createdBy",
        ]}
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
          sortable
        />
        <Column
          field="method"
          header={t("admin.staff_audit.method")}
          body={methodTemplate}
          sortable
        />
        <Column
          field="object_id"
          header={t("admin.staff_audit.object_id")}
          body={(r: StaffAuditRecord) => r.object_id ?? "-"}
          sortable
        />
        <Column
          field="createdBy"
          header={t("admin.staff_audit.created_by")}
          body={(r: StaffAuditRecord) => r.createdBy ?? "-"}
          sortable
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
