import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type FormState = {
  trip_plan_id: string;
  collection_type: string;
  collection_point_id: string;
  bin_id: string;
  customer_id: string;
  sequence: string;
  is_active: boolean;
};

export type TripPlanCPRecord = {
  unique_id: string;
  trip_plan_id?: string;
  trip_plan?: { display_code?: string; unique_id?: string };
  collection_type?: string;
  // bin collection
  collection_point_id?: string;
  collection_point?: { cp_name?: string; latitude?: number; longitude?: number };
  bin_id?: string;
  bin?: { bin_name?: string; bin_capacity?: number; bin_type?: string };
  // household
  customer_id?: string;
  customer?: { customer_name?: string };
  sequence?: number;
  is_active?: boolean;
  company_id?: string;
  project_id?: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  _trip_plan: { value: string | null; matchMode: FilterMatchMode };
  _identifier: { value: string | null; matchMode: FilterMatchMode };
  _detail: { value: string | null; matchMode: FilterMatchMode };
};
