export const normalizeList = <T = any>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray((payload as any)?.data)) return (payload as any).data as T[];
  if (Array.isArray((payload as any)?.results)) return (payload as any).results as T[];
  if (Array.isArray((payload as any)?.data?.results)) return (payload as any).data.results as T[];
  if (payload && typeof payload === "object") return Object.values(payload as Record<string, unknown>) as T[];
  return [];
};

/**
 * Builds a rich dropdown label for a Staff Template that surfaces its full
 * roster — display code, driver, operator and any extra operators — instead of
 * only the template code. Used wherever a Staff Template is chosen from a Select
 * (Trip Plan, Daily Trip Plan, Daily Trip Tracking, …) so the option shows who
 * is actually on the crew.
 */
export const staffTemplateLabel = (record: any): string => {
  const code = String(
    record?.display_code ?? record?.unique_id ?? "",
  ).trim();
  const corporation = String(record?.corporation_name ?? "").trim();
  const driver = String(record?.driver_name ?? record?.driver_id ?? "").trim();
  const operator = String(record?.operator_name ?? record?.operator_id ?? "").trim();
  const driverDesignation = String(record?.driver_designation ?? "").trim();
  const operatorDesignation = String(record?.operator_designation ?? "").trim();

  const extraNames: string[] = Array.isArray(record?.extra_operator_names)
    ? record.extra_operator_names.map((n: any) => String(n).trim()).filter(Boolean)
    : Array.isArray(record?.extra_operator_id)
      ? record.extra_operator_id.map((n: any) => String(n).trim()).filter(Boolean)
      : [];

  // Attach the designation in parentheses next to the person's name when known.
  const withDesignation = (name: string, designation: string): string =>
    designation ? `${name} (${designation})` : name;

  const parts: string[] = [];
  if (corporation) parts.push(`Corporation: ${corporation}`);
  if (driver) parts.push(`Driver: ${withDesignation(driver, driverDesignation)}`);
  if (operator) parts.push(`Operator: ${withDesignation(operator, operatorDesignation)}`);
  if (extraNames.length) parts.push(`Extra: ${extraNames.join(", ")}`);

  return parts.length ? `${code} — ${parts.join(" · ")}` : code;
};

/**
 * Rich dropdown label for an Alternative Staff Template — mirrors
 * {@link staffTemplateLabel} but also notes the effective date range when known.
 */
export const altStaffTemplateLabel = (record: any): string => {
  const base = staffTemplateLabel(record);
  const from = String(record?.from_date ?? "").trim();
  const to = String(record?.to_date ?? "").trim();
  if (from && to) return `${base} (${from} → ${to})`;
  return base;
};

export const formatIsoDate = (value?: string | null, fallback = "-") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().split("T")[0];
};
