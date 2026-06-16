import {
  DataTable as PrimeDataTable,
  type DataTableProps,
} from "primereact/datatable";
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import Swal from "@/lib/notify";
import { getCurrentAdminBulkImportApi } from "@/helpers/admin/bulkImportRoutes";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import type { CrudHelpers } from "@/helpers/admin/crudHelpers";
import {
  exportRecordsToExcel,
  exportTemplateToExcel,
  getAdminScreenExcelFilename,
  readExcelRows,
  type ExcelTemplateColumn,
} from "@/utils/exportExcel";

type SafeTableRow = Record<string, unknown>;
type SafeTableRows = SafeTableRow[];
type SafeDataTableProps<TValue extends SafeTableRows> =
  DataTableProps<TValue> & {
    bulkImportable?: boolean;
    exportable?: boolean;
    exportFilename?: string;
    exportRows?: SafeTableRows;
    exportSheetName?: string;
    importApi?: CrudHelpers;
    importColumns?: ExcelTemplateColumn[];
    importDefaults?: SafeTableRow;
    importSheetName?: string;
    importTemplateFilename?: string;
    onImportComplete?: () => void | Promise<void>;
    onImportRows?: (rows: SafeTableRows) => Promise<void>;
  };

const toSafeRows = <TValue extends SafeTableRows>(
  value: DataTableProps<TValue>["value"],
): TValue => (Array.isArray(value) ? value : ([] as unknown as TValue));

const toExportFilename = (filename?: string) => {
  if (filename)
    return filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;

  return getAdminScreenExcelFilename("all");
};

const toTemplateFilename = (filename?: string) =>
  filename ?? getAdminScreenExcelFilename("template");

const toTitle = (key: string) =>
  key
    .replace(/^_+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeColumnKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const readText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(readText).join(" ").trim();
  return "";
};

const readImportColumns = (children: ReactNode): ExcelTemplateColumn[] => {
  const columns: ExcelTemplateColumn[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as {
      field?: unknown;
      header?: ReactNode;
      exportable?: boolean;
    };
    const field = typeof props.field === "string" ? props.field : "";

    if (
      !field ||
      props.exportable === false ||
      field.startsWith("_") ||
      ["id", "unique_id", "created_at", "updated_at"].includes(field)
    ) {
      return;
    }

    columns.push({
      field,
      header: readText(props.header) || toTitle(field),
    });
  });

  return columns;
};

const METADATA_EXCLUDED_FIELDS = new Set([
  "id",
  "unique_id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "is_deleted",
]);

const readMetadataImportColumns = async (
  importApi: CrudHelpers,
): Promise<ExcelTemplateColumn[] | null> => {
  const metadata = await importApi.metadata();
  const fields = metadata.actions?.POST;
  if (!fields) return null;

  return Object.entries(fields)
    .filter(
      ([field, details]) =>
        details.read_only !== true &&
        !METADATA_EXCLUDED_FIELDS.has(field) &&
        !field.startsWith("_"),
    )
    .map(([field, details]) => ({
      field,
      header: field,
      required: details.required === true,
    }));
};

const mapExcelRowsToPayloads = (
  rows: SafeTableRows,
  columns: ExcelTemplateColumn[],
  defaults?: SafeTableRow,
) => {
  const columnByHeader = columns.reduce<Record<string, ExcelTemplateColumn>>(
    (acc, column) => {
      acc[normalizeColumnKey(column.header)] = column;
      acc[normalizeColumnKey(column.field)] = column;
      return acc;
    },
    {},
  );

  return rows.map((row) => {
    const payload: SafeTableRow = { ...(defaults ?? {}) };

    Object.entries(row).forEach(([key, value]) => {
      const column = columnByHeader[normalizeColumnKey(key)];
      if (!column) return;
      if (value === "") return;
      payload[column.field] = value;
    });

    return payload;
  });
};

type DataTableHeaderActionsProps = {
  header: ReactNode;
  rows: SafeTableRows;
  importColumns: ExcelTemplateColumn[];
  discoverImportColumns: boolean;
  bulkImportable: boolean;
  importApi: CrudHelpers | null;
  importDefaults?: SafeTableRow;
  importTemplateFilename?: string;
  importSheetName?: string;
  onImportRows?: (rows: SafeTableRows) => Promise<void>;
  onImportComplete?: () => void | Promise<void>;
  filename?: string;
  sheetName?: string;
};

const DataTableHeaderActions = ({
  header,
  rows,
  importColumns,
  discoverImportColumns,
  bulkImportable,
  importApi,
  importDefaults,
  importTemplateFilename,
  importSheetName,
  onImportRows,
  onImportComplete,
  filename,
  sheetName,
}: DataTableHeaderActionsProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [resolvedColumns, setResolvedColumns] = useState(
    discoverImportColumns ? [] : importColumns,
  );

  useEffect(() => {
    if (!discoverImportColumns || !importApi) {
      setResolvedColumns(importColumns);
      return;
    }

    let cancelled = false;
    setResolvedColumns([]);
    readMetadataImportColumns(importApi)
      .then((columns) => {
        if (!cancelled) {
          setResolvedColumns(columns ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setResolvedColumns(importColumns);
      });

    return () => {
      cancelled = true;
    };
  }, [discoverImportColumns, importApi, importColumns]);

  const handleExport = () => {
    exportRecordsToExcel(rows, toExportFilename(filename), sheetName || "Data");
  };

  const handleTemplate = () => {
    exportTemplateToExcel(
      resolvedColumns,
      toTemplateFilename(importTemplateFilename),
      importSheetName || "Template",
    );
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const excelRows = await readExcelRows(file);
      const payloads = mapExcelRowsToPayloads(
        excelRows,
        resolvedColumns,
        importDefaults,
      ).filter((payload) => Object.keys(payload).length > 0);

      if (payloads.length === 0) {
        recordExcelAudit("upload_excel", {
          file_name: file.name,
          status: "rejected",
          reason: "no_rows",
        });
        Swal.fire(
          "No rows found",
          "Upload a filled Excel template.",
          "warning",
        );
        return;
      }

      if (onImportRows) {
        await onImportRows(payloads);
      } else if (importApi) {
        const failures: string[] = [];
        for (const [index, payload] of payloads.entries()) {
          try {
            await importApi.create(payload);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : JSON.stringify(error);
            failures.push(`Row ${index + 2}: ${message}`);
          }
        }

        if (failures.length > 0) {
          Swal.fire({
            icon: "warning",
            title: "Upload completed with errors",
            html: `<b>Success:</b> ${payloads.length - failures.length}<br/><b>Failed:</b> ${failures.length}<hr/><div style="text-align:left;font-size:12px">${failures
              .slice(0, 5)
              .join("<br/>")}</div>`,
          });
        } else {
          await Swal.fire(
            "Upload completed",
            `${payloads.length} rows uploaded successfully.`,
            "success",
          );
        }
      }

      if (onImportComplete) {
        await onImportComplete();
      } else if (!onImportRows) {
        await recordExcelAudit("upload_excel", {
          file_name: file.name,
          row_count: payloads.length,
          status: "completed",
        });
        window.location.reload();
        return;
      }

      recordExcelAudit("upload_excel", {
        file_name: file.name,
        row_count: payloads.length,
        status: "completed",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      recordExcelAudit("upload_excel", {
        file_name: file.name,
        status: "failed",
        error: message,
      });
      Swal.fire("Upload failed", message, "error");
    } finally {
      event.target.value = "";
      setImporting(false);
    }
  };

  const exportButton = (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <i className="pi pi-download" />
      Download All Excel
    </button>
  );
  const canImport =
    bulkImportable &&
    resolvedColumns.length > 0 &&
    (Boolean(onImportRows) || Boolean(importApi));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">{header}</div>
      <div className="flex flex-wrap items-center gap-2">
        {canImport && (
          <>
            <button
              type="button"
              onClick={handleTemplate}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <i className="pi pi-file-excel" />
              Download Template
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="pi pi-upload" />
              {importing ? "Uploading..." : "Upload Excel"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleImport}
            />
          </>
        )}
        {exportButton}
      </div>
    </div>
  );
};

export const DataTable = <TValue extends SafeTableRows>(
  props: SafeDataTableProps<TValue>,
) => {
  const {
    exportable = true,
    bulkImportable = true,
    exportFilename,
    exportRows,
    exportSheetName,
    importApi,
    importColumns,
    importDefaults,
    importSheetName,
    importTemplateFilename,
    onImportComplete,
    onImportRows,
    ...tableProps
  } = props;
  const safeRows = toSafeRows(tableProps.value);
  const rowsForExport = exportRows ?? safeRows;
  const resolvedImportApi = importApi ?? getCurrentAdminBulkImportApi();
  const resolvedImportColumns =
    importColumns ?? readImportColumns(tableProps.children);
  const header =
    exportable && typeof tableProps.header !== "function" ? (
      <DataTableHeaderActions
        header={tableProps.header as ReactNode}
        rows={rowsForExport}
        importColumns={resolvedImportColumns}
        discoverImportColumns={!importColumns}
        bulkImportable={bulkImportable}
        importApi={resolvedImportApi}
        importDefaults={importDefaults}
        importTemplateFilename={importTemplateFilename}
        importSheetName={importSheetName}
        onImportRows={onImportRows}
        onImportComplete={onImportComplete}
        filename={exportFilename}
        sheetName={exportSheetName}
      />
    ) : (
      tableProps.header
    );

  return <PrimeDataTable {...tableProps} header={header} value={safeRows} />;
};

export type { DataTableFilterEvent } from "primereact/datatable";
