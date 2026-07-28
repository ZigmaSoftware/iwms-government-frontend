import type { SelectOption } from "@/types";

export type WithStateIdOption = SelectOption & { stateId: string };

export type WithDistrictIdOption = SelectOption & { stateId: string; districtId: string };

export type UnknownRecord = Record<string, unknown>;

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  cp_name: { value: string | null; matchMode: FilterMatchMode };
  state_name: { value: string | null; matchMode: FilterMatchMode };
  district_name: { value: string | null; matchMode: FilterMatchMode };
  ulb_name: { value: string | null; matchMode: FilterMatchMode };
  rlb_name: { value: string | null; matchMode: FilterMatchMode };
  ward_names: { value: string | null; matchMode: FilterMatchMode };
};

export type CollectionPointRecord = {
  unique_id: string | number;
  is_active: boolean;
  wards_detail?: Array<{ unique_id: string; ward_name: string }>;
  [key: string]: unknown;
};
