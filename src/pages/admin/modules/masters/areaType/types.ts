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

export type CityMeta = {
  id: string;
  name: string;
  districtId: string | null;
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
  city_id?: string | number | null;
};

export type AreaTypePayload = Record<string, unknown>;

export type AreaTypeCityMeta = CityMeta & {
  stateId?: string | null;
};

export type CityRecordWithRelations = {
  unique_id: string | number;
  name: string;
  state_id?: unknown;
  state_unique_id?: unknown;
  state?: unknown;
  district_id?: unknown;
  district_unique_id?: unknown;
  district?: unknown;
  is_active?: boolean;
};
