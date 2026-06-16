import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type TripExceptionLogFormState = {
  daily_trip_assignment_id: string;
  exception_type: string;
  remarks: string;
  detected_by: string;
};

export type DailyTripAssignmentRecord = {
  unique_id: string;
  trip_no?: string;
  status?: string;
};

export type TripExceptionLogRecord = {
  id: number;
  daily_trip_assignment_id: string;
  exception_type: string;
  remarks?: string | null;
  detected_by: string;
  created_at?: string | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  daily_trip_assignment_id?: { value: string | null; matchMode: FilterMatchMode };
  exception_type?: { value: string | null; matchMode: FilterMatchMode };
  detected_by?: { value: string | null; matchMode: FilterMatchMode };
  remarks?: { value: string | null; matchMode: FilterMatchMode };
};
