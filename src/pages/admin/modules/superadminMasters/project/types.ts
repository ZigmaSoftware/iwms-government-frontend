import type { FilterMatchMode } from "primereact/api";

export type CompanyOption = {
  unique_id: string;
  name: string;
};

export type ProjectRecord = {
  unique_id: string;
  company_unique_id: string;
  name: string;
  description: string | null;
  gps_api_url: string | null;
  weighment_api_url: string | null;
  attendance_api_url: string | null;
  attendance_api_configured?: boolean;
  is_active: boolean;
};

export type ProjectCreateResponse = {
  project?: ProjectRecord;
  company_admin?: {
    unique_id: string;
    username: string;
  };
};

export type Project = {
  unique_id: string;
  company_unique_id: string;
  company_name?: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  name: { value: string | null; matchMode: FilterMatchMode };
  company_name: { value: string | null; matchMode: FilterMatchMode };
  company_unique_id: { value: string | null; matchMode: FilterMatchMode };
  description: { value: string | null; matchMode: FilterMatchMode };
};
