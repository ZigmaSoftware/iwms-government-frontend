/** Shapes served by audits/audit-dashboard — app/services/audit_dashboard.py. */

export type AuditModuleKey = "common" | "login" | "access" | "complaint";

export type AuditDashboardSummary = {
  date_from: string;
  date_to: string;
  days: number;
  /** Keyed per trail, e.g. common: total / updates / deletions / active_users. */
  kpis: Record<string, number | null>;
  previous_total: number;
  trend: { date: string; count: number }[];
  breakdown: { key: string; label: string; count: number }[];
};

/**
 * One table row, flattened per trail; the column definitions pick fields.
 * Every trail carries `district` and `local_body` (display names), the
 * government counterpart of the private dashboard's project column.
 */
export type AuditDashboardRow = {
  id: string | number;
  date: string | null;
  district?: string | null;
  local_body?: string | null;
  [field: string]: string | number | boolean | null | undefined;
};

export type AuditDashboardPage = {
  count: number;
  page: number;
  total_pages: number;
  results: AuditDashboardRow[];
};

/** A district or local body choice; `level` is e.g. "District", "Corporation". */
export type AuditDashboardGeoOption = {
  unique_id: string;
  name: string;
  level: string;
};

/** Drawn from the selected trail's rows the requester may see. */
export type AuditDashboardFilterOptions = {
  districts: AuditDashboardGeoOption[];
  local_bodies: AuditDashboardGeoOption[];
};
