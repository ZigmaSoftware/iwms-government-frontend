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
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  panchayat_name?: string;
  panchayat?: string;
  bin_type?: string;
  waste_type_name?: string;
  wastetype_name?: string;
  waste_type?: string;
  bin_status?: string;
  latitude?: number | string;
  longitude?: number | string;
  coordinates?: unknown;
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
  waste_type_name: { value: string | null; matchMode: FilterMatchMode };
  company_name?: { value: string | null; matchMode: FilterMatchMode };
  project_name?: { value: string | null; matchMode: FilterMatchMode };
};
