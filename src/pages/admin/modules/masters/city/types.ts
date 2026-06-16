export type CountryMeta = {
  id: string;
  name: string;
  continentId: string | null;
  isActive: boolean;
};

export type StateMeta = {
  id: string;
  name: string;
  countryId: string | null;
  isActive: boolean;
};

export type DistrictMeta = {
  id: string;
  name: string;
  stateId: string | null;
  isActive: boolean;
};

export type CityRecord = {
  unique_id: string | number;
  name?: string;
  is_active?: boolean;
  company_id?: string | number | null;
  company_unique_id?: string | number | null;
  company_name?: string | null;
  project_id?: string | number | null;
  project_unique_id?: string | number | null;
  project_name?: string | null;
  continent_id?: string | number | null;
  continent?: string | number | null;
  country_id?: string | number | null;
  country?: string | number | null;
  state_id?: string | number | null;
  state?: string | number | null;
  district_id?: string | number | null;
  district?: string | number | null;
};

export type CityQueryRecord = {
  unique_id: string | number;
  name?: string | null;
  city_name?: string | null;
  is_active?: boolean;
  company_id?: string | number | null;
  company_unique_id?: string | number | null;
  company_name?: string | null;
  project_id?: string | number | null;
  project_unique_id?: string | number | null;
  project_name?: string | null;
};

export type CityWithRelations = CityRecord & {
  company?: { unique_id?: string | number; id?: string | number } | string | number | null;
  project?: { unique_id?: string | number; id?: string | number } | string | number | null;
  company_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  project_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  continent_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  country_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  state_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  district_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  company_unique_id?: string | number | null;
  project_unique_id?: string | number | null;
  continent_unique_id?: string | number | null;
  country_unique_id?: string | number | null;
  state_unique_id?: string | number | null;
  district_unique_id?: string | number | null;
  company_name?: string | null;
  project_name?: string | null;
  continent_name?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  district_name?: string | null;
};

export type CityRouteState = {
  city?: Partial<CityQueryRecord & CityWithRelations>;
  companyUniqueId?: string | number | null;
  projectId?: string | number | null;
};
