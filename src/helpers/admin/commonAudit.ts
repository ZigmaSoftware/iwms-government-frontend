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
