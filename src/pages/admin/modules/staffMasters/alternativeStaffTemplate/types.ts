import type { FilterMatchMode } from "primereact/api";

export type Option = { value: string; label: string };

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
};

export type StaffTemplateRaw = {
  unique_id: string;
  display_code?: string;
  company_id?: string;
  project_id?: string;
  company_unique_id?: string;
  project_unique_id?: string;
  driver_id?: string;
  operator_id?: string;
  extra_operator_id?: string[];
};

export type FormState = {
  staff_template: string;
  effective_date: string;
  from_date: string;
  to_date: string;
  driver: string;
  operator: string;
  extra_operator: string[];
  change_reason: string;
  change_remarks: string;
  approval_status?: string;
  display_code?: string;
};

export type AlternativeStaffTemplate = {
  id: number;
  unique_id: string;
  display_code?: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  staff_template: string;
  staff_template_display_code?: string;
  effective_date: string;
  driver: string;
  driver_name?: string;
  operator: string;
  operator_name?: string;
  extra_operator?: string[] | null;
  extra_operator_names?: string[] | null;
  change_reason: string;
  change_remarks?: string;
  approval_status: string;
  created_at: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  effective_date: { value: string | null; matchMode: FilterMatchMode };
  driver_name: { value: string | null; matchMode: FilterMatchMode };
  operator_name: { value: string | null; matchMode: FilterMatchMode };
  change_reason: { value: string | null; matchMode: FilterMatchMode };
  approval_status: { value: string | null; matchMode: FilterMatchMode };
};
