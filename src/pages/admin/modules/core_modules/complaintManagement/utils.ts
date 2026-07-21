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
