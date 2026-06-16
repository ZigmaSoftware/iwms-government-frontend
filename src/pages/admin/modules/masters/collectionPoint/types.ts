import type { SelectOption } from "@/types";

export type WithStateIdOption = SelectOption & { stateId: string };

export type WithDistrictIdOption = SelectOption & { stateId: string; districtId: string };

export type WithCityIdOption = SelectOption & {
  stateId: string;
  districtId: string;
  cityId: string;
};

export type ZoneOption = WithCityIdOption;

export type WardOption = WithCityIdOption & { panchayatId: string; zoneId: string };

export type UnknownRecord = Record<string, unknown>;

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  cp_name: { value: string | null; matchMode: FilterMatchMode };
  company_name: { value: string | null; matchMode: FilterMatchMode };
  project_name: { value: string | null; matchMode: FilterMatchMode };
  state_name: { value: string | null; matchMode: FilterMatchMode };
  district_name: { value: string | null; matchMode: FilterMatchMode };
  city_name: { value: string | null; matchMode: FilterMatchMode };
  panchayat_name: { value: string | null; matchMode: FilterMatchMode };
  ward_name: { value: string | null; matchMode: FilterMatchMode };
};

export type CollectionPointRecord = {
  unique_id: string | number;
  is_active: boolean;
  [key: string]: unknown;
};
