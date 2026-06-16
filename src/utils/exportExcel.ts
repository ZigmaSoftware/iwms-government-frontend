import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import { decryptSegment } from "@/utils/routeCrypto";

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, unknown>;
export type ExcelTemplateColumn = {
  field: string;
  header: string;
  required?: boolean;
  sample?: ExportValue;
};

export type ExcelDownloadType = "template" | "all";

const toFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

export const getAdminScreenExcelFilename = (type: ExcelDownloadType) => {
  if (typeof window === "undefined") return `table_data_${type}.xlsx`;

  const segments = window.location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decryptSegment(segment) ?? segment);
  const userScreen = segments[1] ?? segments[0] ?? "table_data";
  const screenName = toFilenamePart(userScreen) || "table_data";

  return `${screenName}_${type}.xlsx`;
};

const toTitle = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const serialiseValue = (value: unknown): ExportValue => {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

const flattenRecord = (
  record: Record<string, unknown>,
  parentKey = "",
): Record<string, ExportValue> =>
  Object.entries(record).reduce<Record<string, ExportValue>>(
    (acc, [key, value]) => {
      const exportKey = parentKey ? `${parentKey}.${key}` : key;

      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(
          acc,
          flattenRecord(value as Record<string, unknown>, exportKey),
        );
        return acc;
      }

      acc[toTitle(exportKey)] = serialiseValue(value);
      return acc;
    },
    {},
  );

export const exportRecordsToExcel = (
  records: ExportRow[],
  filename: string,
  sheetName = "Export",
) => {
  recordExcelAudit("download_all_excel", {
    file_name: filename,
    row_count: records.length,
  });
  const rows = records.map((record) =>
    flattenRecord(record as Record<string, unknown>),
  );
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  saveAs(
    new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })]),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
};

export const exportTemplateToExcel = (
  columns: ExcelTemplateColumn[],
  filename: string,
  sheetName = "Template",
) => {
  recordExcelAudit("download_template", {
    file_name: filename,
    column_count: columns.length,
  });
  const templateRow = columns.reduce<Record<string, ExportValue>>(
    (acc, column) => {
      acc[column.header] = column.sample ?? "";
      return acc;
    },
    {},
  );

  const helpRows = columns.map((column) => ({
    Column: column.header,
    Field: column.field,
    Required: column.required ? "Yes" : "No",
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([templateRow]),
    sheetName.slice(0, 31),
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(helpRows),
    "Column Help",
  );

  saveAs(
    new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })]),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
};

export const readExcelRows = async (file: File): Promise<ExportRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<ExportRow>(worksheet, {
    defval: "",
    raw: false,
  });
};

const escapeCsvValue = (value: unknown) => {
  const text = String(serialiseValue(value) ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const excelFileToCsvFile = async (
  file: File,
  csvFilename: string,
): Promise<File> => {
  const rows = await readExcelRows(file);
  if (rows.length === 0) {
    throw new Error("The uploaded Excel file does not contain any data rows.");
  }

  const headers = Array.from(
    rows.reduce<Set<string>>((fields, row) => {
      Object.keys(row).forEach((field) => fields.add(field));
      return fields;
    }, new Set<string>()),
  );
  const csv = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\r\n");

  return new File([csv], csvFilename, { type: "text/csv;charset=utf-8" });
};
