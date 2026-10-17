import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { useMemo } from "react";
import { exportRecordsToExcel } from "@/utils/exportExcel";
import { formatBulkError, type BulkUploadResult } from "@/utils/bulkUpload";

const toCellText = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() === "" ? "-" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  result: BulkUploadResult | null;
  downloadFilename?: string;
};

export default function BulkUploadResultDialog({
  visible,
  onClose,
  title,
  result,
  downloadFilename,
}: Props) {
  const errors = useMemo(() => result?.errors ?? [], [result]);
  const successCount = result?.successCount ?? 0;
  const totalCount = successCount + errors.length;

  // Columns for the rejected table: union of keys from rejected rows (max 6 + reason).
  const dataColumns = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const entry of errors) {
      const data = entry.data;
      if (!data || typeof data !== "object") continue;
      for (const key of Object.keys(data)) {
        if (key === "upload_error" || key === "__row") continue;
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
        if (keys.length >= 6) break;
      }
      if (keys.length >= 6) break;
    }
    return keys;
  }, [errors]);

  const handleDownloadRejected = async () => {
    if (!result || errors.length === 0) return;
    const rejectedRows = errors.map((entry) => ({
      excel_row: entry.row + 1,
      upload_error: formatBulkError(entry.error),
      ...(entry.data ?? {}),
    }));
    const filename =
      downloadFilename ??
      `rejected_${(result.fileName || "upload").replace(/\.[^.]+$/, "")}.xlsx`;
    await exportRecordsToExcel(
      rejectedRows as Record<string, unknown>[],
      filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
      "Rejected",
    );
  };

  return (
    <Dialog
      visible={visible}
      onHide={onClose}
      header={
        <div>
          <p className="text-lg font-semibold text-gray-800">{title}</p>
          <p className="mt-0.5 text-xs font-normal text-gray-500">
            {result?.fileName ? `File: ${result.fileName} · ` : ""}
            Total: {totalCount} · Success: {successCount} · Rejected: {errors.length}
          </p>
        </div>
      }
      style={{ width: "min(1020px, 94vw)" }}
      modal
      draggable={false}
      resizable={false}
    >
      {!result ? null : errors.length === 0 ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-green-800">
            All {successCount} record{successCount === 1 ? "" : "s"} uploaded successfully.
          </p>
          <p className="mt-1 text-xs text-green-700">
            Nothing was rejected — the list below already includes the new records.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <span className="font-semibold text-amber-900">
              {errors.length} record{errors.length === 1 ? "" : "s"} not uploaded
            </span>
            <span className="text-amber-800">
              — fix the reason below, then re-upload the corrected file.
            </span>
            <span className="ml-auto flex gap-2">
              <Button
                label="Download rejected Excel"
                icon="pi pi-download"
                size="small"
                severity="warning"
                onClick={() => void handleDownloadRejected()}
              />
            </span>
          </div>

          <div className="max-h-[55vh] overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">Excel row</th>
                  {dataColumns.map((col) => (
                    <th key={col} className="px-3 py-2 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-3 py-2">Reject reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {errors.map((entry, idx) => (
                  <tr key={`${entry.row}-${idx}`} className="align-top">
                    <td className="px-3 py-2 font-medium text-gray-800">{entry.row + 1}</td>
                    {dataColumns.map((col) => (
                      <td key={col} className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={toCellText(entry.data?.[col])}>
                        {toCellText(entry.data?.[col])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-red-700">{formatBulkError(entry.error)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Tip: use “Download rejected Excel”, correct the rows in that file, and upload it
            again from Documents → Upload Excel. Successfully uploaded rows are already in the list.
          </p>
        </div>
      )}

    </Dialog>
  );
}
