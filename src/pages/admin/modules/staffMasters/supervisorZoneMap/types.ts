import type { FilterMatchMode } from "primereact/api";

import type { SelectOption } from "@/components/form/Select";

export type SupervisorZoneMapPayload = {
  supervisor_id: string;
  district_id: string;
  city_id: string;
  status: "ACTIVE" | "INACTIVE";
};

export type RawZone = {
  unique_id: string;
  zone_name?: string;
  district_id?: string | number | null;
  district_unique_id?: string | number | null;
  city_id?: string | number | null;
  city_unique_id?: string | number | null;
};

export type RawDistrict = {
  unique_id: string;
  name?: string;
  company_id?: string | number | null;
  company_unique_id?: string | number | null;
  project_id?: string | number | null;
  project_unique_id?: string | number | null;
};

export type RawCity = {
  unique_id: string;
  name?: string;
  district_id?: string | number | null;
  district_unique_id?: string | number | null;
};

export type StaffRecord = {
  unique_id?: string;
  company_id?: string;
  project_id?: string;
  staff_name?: string;
  employee_name?: string;
  username?: string;
  user_type_name?: string;
  staffusertype_name?: string;
  designation?: string;
  is_active?: boolean;
  is_deleted?: boolean;
  active_status?: boolean | number | string | null;
  company_name?: string;
  project_name?: string;
};

export interface ZoneMultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  zoneLabels: Record<string, string>;
}

export type SupervisorZoneMapRecord = {
  id: number;
  unique_id: string;
  supervisor_id: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  employee_name?: string;
  district_id?: string | null;
  city_id?: string | null;
  zone_ids?: string[];
  status?: string | null;
  created_at?: string | null;
  // Enriched name fields for filtering
  _supervisor_name?: string;
  _district_name?: string;
  _city_name?: string;
  _zone_names?: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  unique_id: { value: string | null; matchMode: FilterMatchMode };
  _supervisor_name: { value: string | null; matchMode: FilterMatchMode };
  _district_name: { value: string | null; matchMode: FilterMatchMode };
  _city_name: { value: string | null; matchMode: FilterMatchMode };
  _zone_names: { value: string | null; matchMode: FilterMatchMode };
};
