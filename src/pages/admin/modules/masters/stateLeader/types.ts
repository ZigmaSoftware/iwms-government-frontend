export type StateOption = { value: string; label: string };

export type StateLeader = {
  unique_id: string;
  username: string;
  leader_name?: string | null;
  email?: string | null;
  state_id?: string | null;
  state_name?: string | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  is_active: boolean;
  [key: string]: unknown;
};
