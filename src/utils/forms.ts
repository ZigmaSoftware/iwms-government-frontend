export const normalizeList = <T = any>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray((payload as any)?.data)) return (payload as any).data as T[];
  if (Array.isArray((payload as any)?.results)) return (payload as any).results as T[];
  if (Array.isArray((payload as any)?.data?.results)) return (payload as any).data.results as T[];
  if (payload && typeof payload === "object") return Object.values(payload as Record<string, unknown>) as T[];
  return [];
};

export const formatIsoDate = (value?: string | null, fallback = "-") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().split("T")[0];
};
