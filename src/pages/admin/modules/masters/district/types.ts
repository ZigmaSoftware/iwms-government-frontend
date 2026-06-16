import type { CompanyProjectFields } from "@/types/admin";

export type DistrictListRecord = CompanyProjectFields & {
  unique_id: string;
  countryName: string;
  stateName: string;
  name: string;
  is_active: boolean;
};

export type DistrictFormRecord = {
  name?: string;
  is_active?: boolean;
  continent_id?: string | number | null;
  country_id?: string | number | null;
  state_id?: string | number | null;
};

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

export type DistrictWithProject = Omit<
  DistrictFormRecord,
  "continent_id" | "country_id" | "state_id"
> & {
  company?: { unique_id?: string | number; id?: string | number } | string | number | null;
  project?: { unique_id?: string | number; id?: string | number } | string | number | null;
  continent?: { unique_id?: string | number; id?: string | number } | string | number | null;
  country?: { unique_id?: string | number; id?: string | number } | string | number | null;
  state?: { unique_id?: string | number; id?: string | number } | string | number | null;
  company_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  project_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  continent_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  country_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  state_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  company_unique_id?: string | number | null;
  project_unique_id?: string | number | null;
  continent_unique_id?: string | number | null;
  country_unique_id?: string | number | null;
  state_unique_id?: string | number | null;
  company_name?: string | null;
  project_name?: string | null;
  continent_name?: string | null;
  country_name?: string | null;
  state_name?: string | null;
};

export type DistrictRouteState = {
  district?: Partial<DistrictListRecord>;
  companyUniqueId?: string | number | null;
  projectId?: string | number | null;
};

export type DistrictApiRow = DistrictListRecord & {
  country_name?: unknown;
  state_name?: unknown;
  company_name?: unknown;
  project_name?: unknown;
};
