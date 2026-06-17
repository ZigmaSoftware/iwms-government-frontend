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

export type ZoneMeta = {
  id: string;
  name: string;
  cityId: string | null;
  isActive: boolean;
};

export type GeoCoordinate = {
  latitude?: string | number | null;
  longitude?: string | number | null;
};

export type WardRecord = {
  name?: string;
  is_active?: boolean;
  description?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  geofencing_type?: string | null;
  coordinates?: GeoCoordinate[] | null;
  continent_id?: string | number | null;
  country_id?: string | number | null;
  state_id?: string | number | null;
  district_id?: string | number | null;
  city_id?: string | number | null;
  zone_id?: string | number | null;
  continent?: string | number | null;
  country?: string | number | null;
  state?: string | number | null;
  district?: string | number | null;
  city?: string | number | null;
  zone?: string | number | null;
};

export type WardListRecord = CompanyProjectFields & {
  unique_id: string;
  ward_name: string;
  is_active: boolean;
  zone_name: string;
  city_name: string;
  district_name: string;
  state_name: string;
  country_name: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  geofencing_type?: string | null;
  coordinates?: GeoCoordinate[] | null;
};

export type WardRouteState = {
  companyUniqueId?: string | number | null;
  projectId?: string | number | null;
};

export type WardWithRelations = {
  ward_name?: string | null;
  name?: string | null;
  description?: string | null;
  remarks?: string | null;
  notes?: string | null;
  is_active?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  geofencing_type?: string | null;
  coordinates?: GeoCoordinate[] | null;
  company_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  project_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  company_unique_id?: string | number | null;
  project_unique_id?: string | number | null;
  company?: string | number | { unique_id?: string | number; id?: string | number } | null;
  project?: string | number | { unique_id?: string | number; id?: string | number } | null;
  company_name?: string | null;
  project_name?: string | null;
  continent_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  country_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  state_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  district_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  city_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  zone_id?: string | number | { unique_id?: string | number; id?: string | number } | null;
  continent_unique_id?: string | number | null;
  country_unique_id?: string | number | null;
  state_unique_id?: string | number | null;
  district_unique_id?: string | number | null;
  city_unique_id?: string | number | null;
  zone_unique_id?: string | number | null;
  continent?: string | number | { unique_id?: string | number; id?: string | number } | null;
  country?: string | number | { unique_id?: string | number; id?: string | number } | null;
  state?: string | number | { unique_id?: string | number; id?: string | number } | null;
  district?: string | number | { unique_id?: string | number; id?: string | number } | null;
  city?: string | number | { unique_id?: string | number; id?: string | number } | null;
  zone?: string | number | { unique_id?: string | number; id?: string | number } | null;
  continent_name?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  district_name?: string | null;
  city_name?: string | null;
  zone_name?: string | null;
};

export type WardCityMeta = CityMeta & {
  continentId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  continentName?: string | null;
  countryName?: string | null;
  stateName?: string | null;
  districtName?: string | null;
};

export type WardZoneMeta = ZoneMeta & {
  continentId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  districtId?: string | null;
  cityName?: string | null;
  districtName?: string | null;
  stateName?: string | null;
};

export type WardStateMeta = StateMeta & {
  continentId?: string | null;
  countryName?: string | null;
};

export type WardDistrictMeta = DistrictMeta & {
  continentId?: string | null;
  countryId?: string | null;
  stateName?: string | null;
  countryName?: string | null;
  continentName?: string | null;
};

export type ErrorWithResponse = {
  response?: {
    data?: unknown;
  };
};
