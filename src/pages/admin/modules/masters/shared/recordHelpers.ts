/** Generic list/error helpers shared across the masters modules' functionality layers. */

export const toRecordList = <T = Record<string, unknown>>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: T[] }).results;
  }
  return [];
};

export const normalizeNullable = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object")
    return normalizeNullable(value.unique_id ?? value.id ?? value.value);
  return String(value).trim();
};

export const textOf = (row: Record<string, any>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim())
      return String(value);
  }
  return "";
};

export const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(
        ([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
      )
      .join("\n");
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

/** Sorts by the given field name directly — for modules with no field-name remapping between the UI column and the API's `ordering` param. */
export function resolveSimpleOrdering(
  sortField: string | undefined,
  sortOrder: number | null | undefined,
  sortableFields: Set<string>,
) {
  return sortField && sortableFields.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;
}
