import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type UnassignedStaffPoolFormState = {
  operator_id: string;
  driver_id: string;
  status: string;
  daily_trip_assignment_id: string;
};

export type UnassignedStaffPoolRecord = {
  id: number;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  operator_id?: string | null;
  driver_id?: string | null;
  status: string;
  daily_trip_assignment_id?: string | null;
  created_at?: string | null;
  // Enriched name fields for filtering
  _operator_name?: string;
  _driver_name?: string;
  _daily_trip_assignment_name?: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  status: { value: string | null; matchMode: FilterMatchMode };
  _operator_name: { value: string | null; matchMode: FilterMatchMode };
  _driver_name: { value: string | null; matchMode: FilterMatchMode };
  _daily_trip_assignment_name: { value: string | null; matchMode: FilterMatchMode };
};
