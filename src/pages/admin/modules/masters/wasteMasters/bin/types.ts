import type { SelectOption } from "@/types";

export type CollectionPointOption = SelectOption & {
  districtId: string;
  panchayatId: string;
};

export type BinRecord = Record<string, unknown>;

import type { FilterMatchMode } from "primereact/api";

export type Bin = {
  unique_id: string;
  bin_name: string;
  bin_capacity: number;
  bin_qr?: string | null;
  state_name?: string;
  district_name?: string;
  area_type_name?: string;
  corporation_name?: string;
  municipality_name?: string;
  town_panchayat_name?: string;
  panchayat_union_name?: string;
  panchayat_name?: string;
  panchayat?: string;
  ward_id?: string;
  ward_name?: string;
  collection_point_name?: string;
  bin_type?: string;
  waste_type_name?: string;
  wastetype_name?: string;
  waste_type?: string;
  latitude?: number | string;
  longitude?: number | string;
  is_active: boolean;
};

export type BinApiRow = Record<string, unknown> & {
  unique_id?: string | number;
  is_active?: boolean;
  bin_status?: string | number | null;
  bin_qr?: string | null;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  bin_name: { value: string | null; matchMode: FilterMatchMode };
  bin_capacity: { value: string | null; matchMode: FilterMatchMode };
  panchayat_name: { value: string | null; matchMode: FilterMatchMode };
  ward_name: { value: string | null; matchMode: FilterMatchMode };
  waste_type_name: { value: string | null; matchMode: FilterMatchMode };
  company_name?: { value: string | null; matchMode: FilterMatchMode };
  project_name?: { value: string | null; matchMode: FilterMatchMode };
};
