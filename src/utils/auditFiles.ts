import { API_ROOT } from "@/config/configApi";
import type { CommonAuditJsonValue } from "@/pages/admin/modules/superadmin/audits/commonAudit/types";

export type AuditFileKind = "image" | "file";

export type AuditFileRef = {
  /** dotted field path inside previous_data/new_data (e.g. "rc_upload") */
  field: string;
  name: string;
  url: string;
  kind: AuditFileKind;
  source: "previous" | "new";
};

const API_ORIGIN = (() => {
  try {
    return new URL(API_ROOT).origin;
  } catch {
    return "";
  }
})();

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"]);
const FILE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "svg",
  "pdf", "xls", "xlsx", "csv", "doc", "docx", "txt",
]);

const FILE_KEY_HINTS =
  /(upload|_file$|_image$|_photo$|_picture$|_document$|_doc$|qr|attachment|logo|scan|receipt|certificate|_path$|file_url$|attachment_url$)/i;

const fileNameFromUrl = (url: string): string => {
  const cleaned = url.split("?")[0].replace(/\/+$/, "");
  return decodeURIComponent(cleaned.substring(cleaned.lastIndexOf("/") + 1)) || "document";
};

/** Turn a stored audit value (media path or URL) into an absolute URL. */
export const resolveAuditFileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:/i.test(trimmed)) return "";
  if (trimmed.startsWith("/media/")) return `${API_ORIGIN}${encodeURI(trimmed)}`;
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  if (withoutLeadingSlash.startsWith("media/")) {
    return `${API_ORIGIN}/${encodeURI(withoutLeadingSlash)}`;
  }
  // Backend stores FieldFile paths relative to MEDIA_ROOT ("qr/x.png").
  if (/^[\w\-. ]+\/[\w\-. /]*$/i.test(trimmed) && /\.[a-z0-9]{2,5}$/i.test(trimmed)) {
    return `${API_ORIGIN}/media/${encodeURI(withoutLeadingSlash)}`;
  }
  return "";
};

const extensionOf = (value: string): string => {
  const match = value.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return (match?.[1] ?? "").toLowerCase();
};

const isFileValue = (key: string, value: string): boolean => {
  if (!value || value.length > 500) return false;
  const ext = extensionOf(value);
  if (!ext || !FILE_EXTENSIONS.has(ext)) return false;
  if (/^https?:\/\//i.test(value.trim())) return true;
  // Relative storage paths only count when the field name looks like a file
  // field — otherwise ids like "wst-2026abcd01" or versions ("1.2") match.
  if (FILE_KEY_HINTS.test(key)) return true;
  return value.trim().startsWith("media/") || value.trim().startsWith("/media/");
};

const siblingName = (node: Record<string, unknown>, url: string): string => {
  for (const key of ["file_name", "attachment_name", "original_name", "name"]) {
    const candidate = node[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fileNameFromUrl(url);
};

const walk = (
  node: CommonAuditJsonValue,
  source: "previous" | "new",
  path: string,
  out: AuditFileRef[],
  depth: number,
) => {
  if (depth > 4 || node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, source, `${path}[${index}]`, out, depth + 1));
    return;
  }
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      const childPath = path ? `${path}.${key}` : key;
      if (typeof value === "string" && isFileValue(key, value)) {
        const url = resolveAuditFileUrl(value);
        if (url) {
          out.push({
            field: childPath,
            name: key.toLowerCase().endsWith("_url") ? siblingName(record, url) : fileNameFromUrl(url),
            url,
            kind: IMAGE_EXTENSIONS.has(extensionOf(value)) ? "image" : "file",
            source,
          });
        }
      } else {
        walk(value as CommonAuditJsonValue, source, childPath, out, depth + 1);
      }
    }
  }
};

/** Every document/image referenced by an audit record's data payloads. */
export const collectAuditFiles = (record: {
  previous_data?: CommonAuditJsonValue;
  new_data?: CommonAuditJsonValue;
}): AuditFileRef[] => {
  const out: AuditFileRef[] = [];
  walk(record.previous_data ?? null, "previous", "", out, 0);
  walk(record.new_data ?? null, "new", "", out, 0);
  const seen = new Set<string>();
  return out.filter((ref) => {
    const key = `${ref.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Cheap count for the list's paperclip indicator. */
export const countAuditFiles = (record: {
  previous_data?: CommonAuditJsonValue;
  new_data?: CommonAuditJsonValue;
}): number => collectAuditFiles(record).length;
