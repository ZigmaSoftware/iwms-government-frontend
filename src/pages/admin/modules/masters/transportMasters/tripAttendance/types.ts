import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type TripAttendanceFormState = {
  daily_trip_assignment_id: string;
  staff_id: string;
  vehicle_id: string;
  attendance_time: string;
  latitude: string;
  longitude: string;
  source: string;
};

export type DailyTripAssignmentRecord = {
  unique_id: string;
  trip_no?: string;
  vehicle_id?: string;
  staff_template_id?: string;
  status?: string;
};

export type StaffTemplateRecord = {
  unique_id: string;
  driver_id?: string;
  operator_id?: string;
};

export type TripAttendanceRecord = {
  id: number;
  daily_trip_assignment_id: string;
  staff_id: string;
  vehicle_id: string;
  attendance_time: string;
  latitude: string | number;
  longitude: string | number;
  photo?: string | null;
  source: string;
  created_at?: string | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};

export type  TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  daily_trip_assignment_id?: { value: string | null; matchMode: FilterMatchMode };
  staff_id?: { value: string | null; matchMode: FilterMatchMode };
  vehicle_id?: { value: string | null; matchMode: FilterMatchMode };
  source?: { value: string | null; matchMode: FilterMatchMode };
  attendance_time?: { value: string | null; matchMode: FilterMatchMode };
};
