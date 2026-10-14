import { saveAs } from "file-saver";
import { api } from "@/api";
import { API_ROOT } from "@/config/configApi";
import { recordExcelAudit } from "@/helpers/admin/commonAudit";
import type { CrudHelpers } from "@/helpers/admin/crudHelpers";

/**
 * Bulk uploads and Excel exports run on the backend's Celery worker
 * (app/services/background_jobs.py). Uploads answer 202 with a job id and
 * `waitForJob` polls GET jobs/<job_id>/ until it finishes. Exports are one
 * request: the server waits for the worker and returns the file (only a
 * very large export falls back to 202 + polling).
 */

export type BackgroundJob = {
  job_id: string;
  kind: "bulk_upload" | "export";
  status: "queued" | "processing" | "completed" | "failed";
  file_name?: string;
  error_message?: string | null;
  [key: string]: unknown;
};

type ActionApi = Pick<CrudHelpers, "action">;

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

const isBackgroundJob = (value: unknown): value is BackgroundJob =>
  !!value && typeof value === "object" && typeof (value as BackgroundJob).job_id === "string";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll until the job is completed; throws with the job's error if it failed. */
export const waitForJob = async (job: BackgroundJob): Promise<BackgroundJob> => {
  const startedAt = Date.now();
  let current = job;
  while (current.status === "queued" || current.status === "processing") {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error("This is taking longer than expected. Check the list again in a few minutes.");
    }
    await sleep(POLL_INTERVAL_MS);
    const { data } = await api.get<BackgroundJob>(`/jobs/${current.job_id}/`);
    current = data;
  }
  if (current.status === "failed") {
    throw new Error(current.error_message || "The job failed.");
  }
  return current;
};

/**
 * POST <resource>/bulk-upload/ and wait for the background import. Resolves
 * with the usual upload result (message, success_count, errors, file_url...).
 */
export const runBulkUpload = async <R = Record<string, unknown>>(
  resourceApi: ActionApi,
  formData: FormData,
): Promise<R> => {
  const res = await resourceApi.action("bulk-upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  // A backend without background jobs still answers with the result itself.
  return (isBackgroundJob(res) ? await waitForJob(res) : res) as R;
};

export type ExportColumn = { header: string; field: string };

const readBlobError = async (error: unknown): Promise<string> => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text()) as Record<string, unknown>;
      const message = body.detail ?? body.error ?? Object.values(body)[0];
      if (message) return String(message);
    } catch {
      /* not JSON */
    }
  }
  return error instanceof Error ? error.message : "Export failed.";
};

/**
 * Export every row of a list endpoint to Excel in ONE request: the Celery
 * worker fetches all rows (same filters, permissions and scoping as the
 * list) and builds the .xlsx; the server waits for it and returns the file.
 * `resourcePath` is the list endpoint relative to the API root
 * (e.g. "/masters/fuels/").
 */
export const runServerExport = async ({
  resourcePath,
  params,
  columns,
  filename,
  sheetName = "Export",
}: {
  resourcePath: string;
  params?: Record<string, unknown>;
  /** Pick and name columns (dotted fields); default: every field. */
  columns?: ExportColumn[];
  filename: string;
  sheetName?: string;
}) => {
  const fileName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  let response;
  try {
    response = await api.post<Blob>(
      "/exports/excel/",
      {
        path: resourcePath,
        params: params ?? {},
        columns: columns ?? null,
        file_name: fileName,
        sheet_name: sheetName,
      },
      { responseType: "blob" },
    );
  } catch (error) {
    throw new Error(await readBlobError(error));
  }

  let file: Blob = response.data;
  let rowCount = Number(response.headers["x-row-count"] ?? 0);
  let archivedUrl: string | undefined = response.headers["x-archived-file-url"];

  if (response.status === 202) {
    // Still building after the server's wait: poll the job, then fetch the
    // file the worker saved.
    const job = await waitForJob(JSON.parse(await file.text()) as BackgroundJob);
    rowCount = Number(job.row_count ?? 0);
    archivedUrl = job.file_url ? String(job.file_url) : undefined;
    if (rowCount > 0 && archivedUrl) {
      const download = await fetch(new URL(archivedUrl, API_ROOT).href);
      if (!download.ok) throw new Error("The exported file could not be downloaded.");
      file = await download.blob();
    }
  }

  if (rowCount === 0) throw new Error("There is no data to export.");
  // The worker's copy is also the audit-trail attachment.
  recordExcelAudit("download_all_excel", {
    file_name: fileName,
    row_count: rowCount,
    ...(archivedUrl ? { attachment_url: archivedUrl, attachment_name: fileName } : {}),
  });
  saveAs(file, fileName);
};
