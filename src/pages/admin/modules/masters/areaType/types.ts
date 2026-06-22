export type StateMeta = {
  id: string;
  name: string;
  isActive: boolean;
};

export type DistrictMeta = {
  id: string;
  name: string;
  stateId: string | null;
  isActive: boolean;
};

export type AreaTypeRecord = {
  unique_id?: string | number;
  name?: string;
  area_type_name?: string;
  is_active?: boolean;
  company_unique_id?: string | number | null;
  company_id?: string | number | null;
  project_id?: string | number | null;
  project_unique_id?: string | number | null;
  state_id?: string | number | null;
  district_id?: string | number | null;
};

export type AreaTypePayload = Record<string, unknown>;
