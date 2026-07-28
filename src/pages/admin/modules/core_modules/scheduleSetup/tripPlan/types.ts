import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type StopRow = { collection_point_id: string; bin_id: string; sequence: number; is_active: boolean };

export type TripPlanRecord = {
  unique_id: string;
  display_code?: string;
  collection_type?: string;
  district?: { name?: string };
  corporation?: { name?: string; corporation_name?: string };
  municipality?: { name?: string; municipality_name?: string };
  town_panchayat?: { name?: string; town_panchayat_name?: string };
  panchayat_union?: { name?: string; union_name?: string };
  panchayat?: { name?: string; panchayat_name?: string };
  staff_template?: { display_code?: string };
  vehicle?: { vehicle_no?: string };
  waste_types_detail?: { unique_id?: string; waste_type_name?: string }[];
  scheduled_time?: string;
  approval_status?: string;
  status?: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  display_code: { value: string | null; matchMode: FilterMatchMode };
  _location: { value: string | null; matchMode: FilterMatchMode };
  _staff: { value: string | null; matchMode: FilterMatchMode };
  _vehicle: { value: string | null; matchMode: FilterMatchMode };
  _waste_type: { value: string | null; matchMode: FilterMatchMode };
  status: { value: string | null; matchMode: FilterMatchMode };
};
