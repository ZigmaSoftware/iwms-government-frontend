import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type FormState = {
  trip_assignment_id: string;
  trip_collection_point_id: string;
  bin_id: string;
  collection_date: string;
  collected_weight_kg: string;
  driver_latitude: string;
  driver_longitude: string;
  notes: string;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  _trip_plan: { value: string | null; matchMode: FilterMatchMode };
  _collection_point: { value: string | null; matchMode: FilterMatchMode };
  _bin: { value: string | null; matchMode: FilterMatchMode };
  _waste_type: { value: string | null; matchMode: FilterMatchMode };
  _panchayat: { value: string | null; matchMode: FilterMatchMode };
  collection_date: { value: string | null; matchMode: FilterMatchMode };
};

export type BinCERecord = {
  unique_id?: string;
  trip_assignment_id?: string;
  trip_collection_point_id?: string | null;
  bin_id?: string | null;
  collection_point_id?: string | null;
  panchayat_id?: string | null;
  trip_plan?: { display_code?: string };
  collection_point?: { cp_name?: string } | null;
  bin?: { bin_name?: string; bin_capacity?: number; bin_type?: string };
  waste_type?: { waste_type_name?: string };
  vehicle?: { vehicle_no?: string };
  effective_staff_template?: unknown;
  collected_weight_kg?: string | number;
  collection_date?: string;
  driver_latitude?: string | number | null;
  driver_longitude?: string | number | null;
  notes?: string | null;
  created_at?: string;
  panchayat_name?: string | null;
  [key: string]: unknown;
};
