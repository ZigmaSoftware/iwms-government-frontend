import {
  DataTable as PrimeDataTable,
  type DataTableProps,
} from "primereact/datatable";

// Centralized here (not per-page) so only bundles that actually render a
// PrimeReact table pay for this CSS, instead of every page in the app.
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import notify from "@/lib/notify";
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
    showExportButton?: boolean;
    exportFilename?: string;
    exportRows?: SafeTableRows;
    exportSheetName?: string;
    importApi?: CrudHelpers;
    importColumns?: ExcelTemplateColumn[];
    importDefaults?: SafeTableRow;
    importSheetName?: string;
    importTemplateFilename?: string;
    onExportRequest?: () => Promise<SafeTableRows>;
    onImportComplete?: () => void | Promise<void>;
    onImportRows?: (rows: SafeTableRows) => Promise<void>;
    onPdfRequest?: () => void | Promise<void>;
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
  bulkImportable: boolean;
  importApi: CrudHelpers | null;
  importDefaults?: SafeTableRow;
  importTemplateFilename?: string;
  importSheetName?: string;
  onExportRequest?: () => Promise<SafeTableRows>;
  onImportRows?: (rows: SafeTableRows) => Promise<void>;
  onImportComplete?: () => void | Promise<void>;
  filename?: string;
  sheetName?: string;
  showExportButton?: boolean;
  onPdfRequest?: () => void | Promise<void>;
};

const DataTableHeaderActions = ({
  header,
  rows,
  importColumns,
  bulkImportable,
  importApi,
  importDefaults,
  importTemplateFilename,
  importSheetName,
  onExportRequest,
  onImportRows,
  onImportComplete,
  filename,
  sheetName,
  showExportButton = true,
  onPdfRequest,
}: DataTableHeaderActionsProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const reportsRef = useRef<HTMLDivElement | null>(null);
  const resolvedColumns = importColumns;

  useEffect(() => {
    if (!reportsOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!reportsRef.current?.contains(event.target as Node)) {
        setReportsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [reportsOpen]);

  const handleExport = async () => {
    if (!onExportRequest) {
      exportRecordsToExcel(rows, toExportFilename(filename), sheetName || "Data");
      return;
    }

    setExporting(true);
    try {
      const allRows = await onExportRequest();
      exportRecordsToExcel(allRows, toExportFilename(filename), sheetName || "Data");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed.";
      notify.fire("Export failed", message, "error");
    } finally {
      setExporting(false);
    }
  };

  const handlePdf = async () => {
    if (!onPdfRequest) return;
    setGeneratingPdf(true);
    try {
      await onPdfRequest();
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed.";
      notify.fire("PDF generation failed", message, "error");
    } finally {
      setGeneratingPdf(false);
    }
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
        notify.fire(
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
          notify.fire({
            icon: "warning",
            title: "Upload completed with errors",
            html: `<b>Success:</b> ${payloads.length - failures.length}<br/><b>Failed:</b> ${failures.length}<hr/><div style="text-align:left;font-size:12px">${failures
              .slice(0, 5)
              .join("<br/>")}</div>`,
          });
        } else {
          await notify.fire(
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
      notify.fire("Upload failed", message, "error");
    } finally {
      event.target.value = "";
      setImporting(false);
    }
  };

  const canImport =
    bulkImportable &&
    resolvedColumns.length > 0 &&
    (Boolean(onImportRows) || Boolean(importApi));
  const canPdf = Boolean(onPdfRequest);
  const hasAnyReport = canImport || showExportButton || canPdf;

  const iconButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border text-base shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">{header}</div>
      {hasAnyReport && (
        <div className="relative shrink-0" ref={reportsRef}>
          <button
            type="button"
            onClick={() => setReportsOpen((open) => !open)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          >
            <i className="pi pi-folder-open" />
            Reports
            <i className={`pi ${reportsOpen ? "pi-chevron-up" : "pi-chevron-down"} text-xs`} />
          </button>
          {reportsOpen && (
            <div className="absolute right-0 z-20 mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              {canImport && (
                <>
                  <button
                    type="button"
                    title="Download Template"
                    aria-label="Download Template"
                    onClick={handleTemplate}
                    className={`${iconButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                  >
                    <i className="pi pi-file-excel" />
                  </button>
                  <button
                    type="button"
                    title="Upload Excel"
                    aria-label="Upload Excel"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className={`${iconButtonClass} border-blue-200 bg-blue-600 text-white hover:bg-blue-700`}
                  >
                    <i className={importing ? "pi pi-spin pi-spinner" : "pi pi-upload"} />
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
              {showExportButton && (
                <button
                  type="button"
                  title="Download Excel"
                  aria-label="Download Excel"
                  onClick={() => void handleExport()}
                  disabled={exporting || (!onExportRequest && rows.length === 0)}
                  className={`${iconButtonClass} border-green-200 bg-green-600 text-white hover:bg-green-700`}
                >
                  <i className={exporting ? "pi pi-spin pi-spinner" : "pi pi-file-excel"} />
                </button>
              )}
              {canPdf && (
                <button
                  type="button"
                  title="Download PDF"
                  aria-label="Download PDF"
                  onClick={() => void handlePdf()}
                  disabled={generatingPdf}
                  className={`${iconButtonClass} border-red-200 bg-red-600 text-white hover:bg-red-700`}
                >
                  <i className={generatingPdf ? "pi pi-spin pi-spinner" : "pi pi-file-pdf"} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DataTable = <TValue extends SafeTableRows>(
  props: SafeDataTableProps<TValue>,
) => {
  const {
    exportable = true,
    showExportButton = true,
    bulkImportable = true,
    exportFilename,
    exportRows,
    exportSheetName,
    importApi,
    importColumns,
    importDefaults,
    importSheetName,
    importTemplateFilename,
    onExportRequest,
    onImportComplete,
    onImportRows,
    onPdfRequest,
    ...tableProps
  } = props;
  const safeRows = toSafeRows(tableProps.value);
  const rowsForExport = exportRows ?? safeRows;
  const resolvedImportApi = importApi ?? getCurrentAdminBulkImportApi();
  const resolvedImportColumns = useMemo(
    () => importColumns ?? readImportColumns(tableProps.children),
    [importColumns, tableProps.children],
  );
  const header =
    exportable && typeof tableProps.header !== "function" ? (
      <DataTableHeaderActions
        header={tableProps.header as ReactNode}
        rows={rowsForExport}
        importColumns={resolvedImportColumns}
        bulkImportable={bulkImportable}
        importApi={resolvedImportApi}
        importDefaults={importDefaults}
        importTemplateFilename={importTemplateFilename}
        importSheetName={importSheetName}
        onExportRequest={onExportRequest}
        onImportRows={onImportRows}
        onImportComplete={onImportComplete}
        filename={exportFilename}
        sheetName={exportSheetName}
        showExportButton={showExportButton}
        onPdfRequest={onPdfRequest}
      />
    ) : (
      tableProps.header
    );

  return (
    <div className="min-w-0 overflow-x-auto">
      <PrimeDataTable
        responsiveLayout="stack"
        breakpoint="768px"
        {...tableProps}
        header={header}
        value={safeRows}
      />
    </div>
  );
};

export type { DataTableFilterEvent } from "primereact/datatable";
