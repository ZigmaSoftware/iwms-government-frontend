import { Button } from "primereact/button";
import { exportRecordsToExcel } from "@/utils/exportExcel";
import { formatBulkError, type BulkUploadResult } from "@/utils/bulkUpload";

type Props = {
  result: BulkUploadResult;
  onClear: () => void;
  onReupload?: () => void;
  onViewAll?: () => void;
  downloadFilename?: string;
};

/**
 * Persistent inline section rendered above the list table. Unlike the result
 * dialog (which closes), this stays visible across table refetches and full
 * page reloads until the user clears it or a clean upload replaces it.
 */
export default function BulkRejectedPanel({
  result,
  onClear,
  onReupload,
  onViewAll,
  downloadFilename,
}: Props) {
  const errors = result.errors;
  if (errors.length === 0) return null;

  const handleDownload = async () => {
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
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="pi pi-exclamation-triangle text-amber-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-amber-900">
          {errors.length} record{errors.length === 1 ? " was" : "s were"} not uploaded
          {result.fileName ? ` from ${result.fileName}` : ""}
        </p>
        <p className="text-xs text-amber-800">
          · {result.successCount} uploaded successfully. Fix and re-upload.
        </p>
        <span className="ml-auto flex flex-wrap gap-2">
          {onViewAll && (
            <Button label="View all" size="small" outlined onClick={onViewAll} />
          )}
          <Button
            label="Download rejected Excel"
            icon="pi pi-download"
            size="small"
            severity="warning"
            onClick={() => void handleDownload()}
          />
          {onReupload && (
            <Button label="Re-upload" icon="pi pi-upload" size="small" onClick={onReupload} />
          )}
          <Button label="Dismiss" size="small" text onClick={onClear} />
        </span>
      </div>

      <div className="mt-3 max-h-[40vh] overflow-auto rounded-md border border-amber-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 whitespace-nowrap">Excel row</th>
              <th className="px-3 py-2">Reject reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {errors.map((entry, idx) => (
              <tr key={`${entry.row}-${idx}`} className="align-top">
                <td className="px-3 py-2 font-medium text-gray-800">{entry.row + 1}</td>
                <td className="px-3 py-2 text-red-700">{formatBulkError(entry.error)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
