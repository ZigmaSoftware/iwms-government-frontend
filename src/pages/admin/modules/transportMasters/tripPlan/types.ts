import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type StopRow = { collection_point_id: string; bin_id: string; sequence: number; is_active: boolean };

export type FormState = {
  district_id: string;
  panchayat_id: string;
  staff_template_id: string;
  vehicle_id: string;
  supervisor_id: string;
  property_id: string;
  sub_property_id: string;
  waste_type_id: string;
  trip_trigger_weight_kg: string;
  max_vehicle_capacity_kg: string;
  scheduled_time: string;
  approval_status: string;
  status: string;
};

export type TripPlanRecord = {
  unique_id: string;
  display_code?: string;
  company_id?: string | null;
  project_id?: string | null;
  district?: { name?: string };
  panchayat?: { panchayat_name?: string };
  staff_template?: { display_code?: string };
  vehicle?: { vehicle_no?: string };
  waste_type?: { waste_type_name?: string };
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
