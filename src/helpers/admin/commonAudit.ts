import { decryptSegment } from "@/utils/routeCrypto";
import { commonAuditApi } from ".";

export type ExcelAuditAction =
  | "download_template"
  | "upload_excel"
  | "download_all_excel";

type ExcelAuditDetails = Record<string, unknown>;

const readCurrentScreenNames = () => {
  if (typeof window === "undefined") {
    return { moduleName: "unknown", endpointName: "unknown" };
  }

  const segments = window.location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decryptSegment(segment) ?? segment);

  return {
    moduleName: segments[0] ?? "unknown",
    endpointName: segments[1] ?? segments[0] ?? "unknown",
  };
};

export const recordExcelAudit = (
  action: ExcelAuditAction,
  details: ExcelAuditDetails = {},
) => {
  const { moduleName, endpointName } = readCurrentScreenNames();
  const method = action === "upload_excel" ? "UPLOAD" : "DOWNLOAD";

  return commonAuditApi
    .create({
      module_name: moduleName,
      endpoint_name: endpointName,
      method,
      new_data: {
        action,
        ...details,
      },
    })
    .catch((error: unknown) => {
      console.error(`Failed to record ${action} audit:`, error);
    });
};

export type AuditAttachment = {
  file_url: string;
  file_name: string;
  size?: number;
};

/**
 * Archive a client-generated file (export/template) under the audit trail
 * so the entry can show and offer it for download later. Fail-soft: returns
 * null when the backend cannot keep a copy — the audit is still recorded.
 */
export const archiveAuditAttachment = async (
  blob: Blob,
  filename: string,
): Promise<AuditAttachment | null> => {
  try {
    const formData = new FormData();
    formData.append("file", blob, filename);
    const res = await commonAuditApi.action<
      AuditAttachment & { archived?: boolean }
    >("attachments", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    if (!res?.file_url) return null;
    return {
      file_url: String(res.file_url),
      file_name: String(res.file_name ?? filename),
      size: typeof res.size === "number" ? res.size : undefined,
    };
  } catch (error: unknown) {
    console.error("Failed to archive audit attachment:", error);
    return null;
  }
};
