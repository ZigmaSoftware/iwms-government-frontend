export type DistrictOption = { value: string; label: string };

export type DistrictLeader = {
  unique_id: string;
  username: string;
  leader_name?: string | null;
  email?: string | null;
  district_id?: string | null;
  district_name?: string | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  is_active: boolean;
  [key: string]: unknown;
};
