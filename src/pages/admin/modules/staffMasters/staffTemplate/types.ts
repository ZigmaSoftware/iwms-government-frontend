import type { FilterMatchMode } from "primereact/api";

export type Option = {
  value: string;
  label: string;
};

export type StaffRecord = {
  unique_id?: string;
  staff_unique_id?: string;
  company_id?: string;
  company_unique_id?: string;
  project_id?: string;
  project_unique_id?: string;
  staff_name?: string;
  employee_name?: string;
  username?: string;
  user_type_name?: string;
  staffusertype_name?: string;
  contractorusertype_name?: string;
  governmentusertype_name?: string;
  governmentusertype_level?: string;
  designation?: string;
  designation_name?: string;
  designation_group?: string;
  is_active?: boolean;
  is_deleted?: boolean;
  active_status?: boolean | number | string | null;
  company_name?: string;
  project_name?: string;
  district_id?: string;
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
};

export type StaffTemplateFormData = {
  driver_id: string;
  operator_id: string;
  extra_operator_id: string[];
  status: "ACTIVE" | "INACTIVE";
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  approved_by: string;
};

export type StaffTemplate = {
  id: number;
  unique_id: string;
  display_code?: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;

  driver_id: string;
  driver_name: string;

  operator_id: string;
  operator_name: string;

  extra_operator_id?: string[];

  status: string;
  approval_status: string;

  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  unique_id: { value: string | null; matchMode: FilterMatchMode };
  driver_name: { value: string | null; matchMode: FilterMatchMode };
  operator_name: { value: string | null; matchMode: FilterMatchMode };
  approval_status: { value: string | null; matchMode: FilterMatchMode };
};
