export type PanchayatOption = { value: string; label: string };

export type PanchayatLeader = {
  unique_id: string;
  username: string;
  leader_name?: string | null;
  email?: string | null;
  panchayat_id?: string | null;
  panchayat_name?: string | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  is_active: boolean;
  [key: string]: unknown;
};
