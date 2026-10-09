import {
  DataTable as PrimeDataTable,
  type DataTableProps,
} from "primereact/datatable";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_ROWS_PER_PAGE_OPTIONS,
  PAGE_REPORT_FALLBACK,
  PAGE_REPORT_KEY,
  PAGINATOR_TEMPLATE,
} from "@/components/common/paginatorDefaults";

// Centralized here (not per-page) so only bundles that actually render a
// PrimeReact table pay for this CSS, instead of every page in the app.
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import {
  Children,
  isValidElement,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import notify from "@/lib/notify";
import { getCurrentAdminBulkImportApi } from "@/helpers/admin/bulkImportRoutes";
import { useScreenAccess } from "@/contexts/screenPermission";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import type { CrudHelpers } from "@/helpers/admin/crudHelpers";
import {
  ActiveFilterChips,
  DocumentsMenu,
  FilterPanel,
  type ActiveFilterChip,
  type DocumentActions,
} from "@/components/common/ListToolbar";

/**
 * The table toolbar's "Filters" button + panel. `content` is the panel's
 * fields (e.g. `useHierarchyFilter().field` plus page-specific ones); the
 * page owns draft/applied state and commits on `onApply`.
 */
export type TableFilters = {
  content: ReactNode;
  activeCount: number;
  onApply: () => void;
  onReset: () => void;
  /** "State: Tamil Nadu ✕" chips shown under the toolbar */
  chips?: ActiveFilterChip[];
  width?: number;
};
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
    /** Filters button + panel in the toolbar (see TableFilters). Named
     *  filterPanel: `filters` is PrimeReact's own column-filter prop. */
    filterPanel?: TableFilters;
    /**
     * Page-specific Documents menu actions; each one given replaces the
     * built-in one (e.g. a server-side Excel export), and `downloadQr`
     * adds a "Download QR" item for lists with QR codes.
     */
    documentActions?: DocumentActions;
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
  /** false: no built-in import/export, only `documentActions` */
  builtIns: boolean;
  filters?: TableFilters;
  documentActions?: DocumentActions;
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
  builtIns,
  filters,
  documentActions,
}: DataTableHeaderActionsProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const resolvedColumns = importColumns;

  const handleExport = async () => {
    setExporting(true);
    try {
      const allRows = onExportRequest ? await onExportRequest() : rows;
      await exportRecordsToExcel(allRows, toExportFilename(filename), sheetName || "Data");
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

  const handleTemplate = async () => {
    await exportTemplateToExcel(
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
    builtIns &&
    bulkImportable &&
    resolvedColumns.length > 0 &&
    (Boolean(onImportRows) || Boolean(importApi));

  // built-in actions first; the page's own `documentActions` replace them
  const actions: DocumentActions = {
    ...(canImport
      ? {
          uploadExcel: { onClick: () => fileInputRef.current?.click(), busy: importing },
          downloadTemplate: { onClick: () => void handleTemplate() },
        }
      : {}),
    ...(builtIns && showExportButton
      ? {
          downloadExcel: {
            onClick: () => void handleExport(),
            busy: exporting,
            disabled: !onExportRequest && rows.length === 0,
          },
        }
      : {}),
    ...(builtIns && onPdfRequest ? { downloadPdf: { onClick: () => void handlePdf(), busy: generatingPdf } } : {}),
    ...(documentActions ?? {}),
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className={filters ? "min-w-0" : "min-w-0 flex-1"}>{header}</div>
        {filters && (
          <FilterPanel
            activeCount={filters.activeCount}
            onApply={filters.onApply}
            onReset={filters.onReset}
            width={filters.width}
          >
            {filters.content}
          </FilterPanel>
        )}
        <div className="ml-auto shrink-0">
          <DocumentsMenu {...actions} />
        </div>
        {canImport && (
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
        )}
      </div>
      {filters?.chips && filters.chips.length > 0 && (
        <ActiveFilterChips chips={filters.chips} onClearAll={filters.onReset} />
      )}
    </div>
  );
};

export const DataTable = <TValue extends SafeTableRows>(
  props: SafeDataTableProps<TValue>,
) => {
  const { t } = useTranslation();
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
    filterPanel,
    documentActions,
    ...tableProps
  } = props;
  // Excel import creates records, so it needs "add" on the current page.
  const { canAdd } = useScreenAccess();
  const safeRows = toSafeRows(tableProps.value);
  const rowsForExport = exportRows ?? safeRows;
  const resolvedImportApi = importApi ?? getCurrentAdminBulkImportApi();
  const resolvedImportColumns = useMemo(
    () => importColumns ?? readImportColumns(tableProps.children),
    [importColumns, tableProps.children],
  );
  const header =
    (exportable || filterPanel || documentActions) && typeof tableProps.header !== "function" ? (
      <DataTableHeaderActions
        header={tableProps.header as ReactNode}
        rows={rowsForExport}
        importColumns={resolvedImportColumns}
        bulkImportable={bulkImportable && canAdd}
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
        builtIns={exportable}
        filters={filterPanel}
        documentActions={documentActions}
      />
    ) : (
      tableProps.header
    );

  return (
    <div className="min-w-0 overflow-x-auto">
      <PrimeDataTable
        responsiveLayout="stack"
        breakpoint="768px"
        paginatorTemplate={PAGINATOR_TEMPLATE}
        currentPageReportTemplate={t(PAGE_REPORT_KEY, PAGE_REPORT_FALLBACK)}
        rowsPerPageOptions={DEFAULT_ROWS_PER_PAGE_OPTIONS}
        {...tableProps}
        header={header}
        value={safeRows}
      />
    </div>
  );
};

export type { DataTableFilterEvent } from "primereact/datatable";
