import type { ApiId } from "@/features/complaintTicketing/types";

export const asArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray((payload as any)?.results)) return (payload as any).results;
  if (Array.isArray((payload as any)?.data)) return (payload as any).data;
  if (Array.isArray((payload as any)?.data?.results)) return (payload as any).data.results;
  return [];
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export const yesNo = (value?: boolean | null) => (value ? "Yes" : "No");

export const idOf = (value: ApiId | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export const errorText = (error: unknown, fallback = "Request failed") => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") return JSON.stringify(data);
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/** "govt_panchayat_supervisor" -> "Panchayat Supervisor". */
export const roleLabel = (name?: string | null) =>
  (name || "")
    .replace(/^govt_/i, "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

/** Compact "2h 15m" / "3d 4h" style duration for a number of seconds. */
export const formatDuration = (totalSeconds: number) => {
  const seconds = Math.abs(Math.round(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return `${seconds % 60}s`;
};
