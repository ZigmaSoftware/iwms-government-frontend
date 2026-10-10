export type BulkUploadError = {
  row: number;
  error: string | Record<string, unknown> | unknown;
  data?: Record<string, unknown>;
};

export type BulkUploadResult = {
  fileName: string;
  successCount: number;
  errors: BulkUploadError[];
  /** Original Excel rows in file order (index 0 === CSV data row 1). */
  originalRows: Record<string, unknown>[];
};

export const formatBulkError = (error: BulkUploadError["error"]): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    try {
      const parts: string[] = [];
      for (const [field, messages] of Object.entries(error as Record<string, unknown>)) {
        const text = Array.isArray(messages)
          ? messages.map(String).join(", ")
          : typeof messages === "object"
            ? JSON.stringify(messages)
            : String(messages);
        parts.push(`${field}: ${text}`);
      }
      return parts.join("; ") || JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? "Upload failed");
};

/** Merge backend errors with the original Excel rows so the dialog can show full rejected data. */
export const normalizeBulkErrors = (
  rawErrors: unknown,
  originalRows: Record<string, unknown>[],
): BulkUploadError[] => {
  if (!Array.isArray(rawErrors)) return [];
  return rawErrors.map((entry) => {
    const row = Number((entry as { row?: unknown })?.row ?? 0);
    const error = (entry as { error?: unknown })?.error ?? "Upload failed";
    const data =
      (entry as { data?: Record<string, unknown> })?.data ??
      (row > 0 ? (originalRows[row - 1] as Record<string, unknown>) : undefined);
    return { row, error, data };
  });
};

const STORAGE_PREFIX = "bulk-upload-rejected:";

export const bulkResultStorageKey = (moduleKey: string) =>
  `${STORAGE_PREFIX}${moduleKey}`;

/** Persist the last upload result so rejected rows survive table refetch / page reload. */
export const saveBulkResult = (moduleKey: string, result: BulkUploadResult | null) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (!result) {
      window.localStorage.removeItem(bulkResultStorageKey(moduleKey));
      return;
    }
    window.localStorage.setItem(
      bulkResultStorageKey(moduleKey),
      JSON.stringify(result),
    );
  } catch {
    /* storage full / private mode — dialog still works for this session */
  }
};

export const loadBulkResult = (moduleKey: string): BulkUploadResult | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(bulkResultStorageKey(moduleKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BulkUploadResult;
    if (!parsed || !Array.isArray(parsed.errors)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearBulkResult = (moduleKey: string) => saveBulkResult(moduleKey, null);
