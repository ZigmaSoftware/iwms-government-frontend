import type { CompanyProjectFields } from "@/types";

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

export type CityMeta = {
  id: string;
  name: string;
  districtId: string | null;
  isActive: boolean;
};

export type ZoneRecord = {
  zone_name?: string;
  is_active?: boolean;
  description?: string;
  continent_id?: string | number | null;
  country_id?: string | number | null;
  state_id?: string | number | null;
  district_id?: string | number | null;
  city_id?: string | number | null;
  continent?: string | number | null;
  country?: string | number | null;
  state?: string | number | null;
  district?: string | number | null;
  city?: string | number | null;
};

export type ZoneListRecord = CompanyProjectFields & {
  unique_id: string;
  zone_name: string;
  city_name: string;
  district_name: string;
  state_name: string;
  is_active: boolean;
};


export type ZoneRouteState = {
  companyUniqueId?: string | number | null;
  projectId?: string | number | null;
};

export type ZoneWithRelations = {
  zone_name?: string | null;
  description?: string | null;
  remarks?: string | null;
  notes?: string | null;
  is_active?: boolean;
  continent_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  country_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  state_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  district_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  city_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  continent_unique_id?: string | number | null;
  country_unique_id?: string | number | null;
  state_unique_id?: string | number | null;
  district_unique_id?: string | number | null;
  city_unique_id?: string | number | null;
  continent?: string | number | { unique_id?: string | number; id?: string | number } | null;
  country?: string | number | { unique_id?: string | number; id?: string | number } | null;
  state?: string | number | { unique_id?: string | number; id?: string | number } | null;
  district?: string | number | { unique_id?: string | number; id?: string | number } | null;
  city?: string | number | { unique_id?: string | number; id?: string | number } | null;
  continent_name?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  district_name?: string | null;
  city_name?: string | null;
};

export type ZoneCityMeta = CityMeta & {
  continentId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  districtName?: string | null;
  stateName?: string | null;
  countryName?: string | null;
  continentName?: string | null;
};

export type ZoneDistrictMeta = DistrictMeta & {
  countryId?: string | null;
  continentId?: string | null;
};
