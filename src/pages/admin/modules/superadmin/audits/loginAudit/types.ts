export type LoginAuditRecord = {
  unique_id?: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  user_unique_id?: string | null;
  username?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  success?: boolean;
  reason?: string | null;
  timestamp?: string | null;
  [key: string]: unknown;
};
