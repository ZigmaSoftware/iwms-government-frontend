import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
};

export type ModuleFilterOption = {
  label: string;
  value: string;
};

export type StaffAuditJsonValue =
  | string
  | number
  | boolean
  | null
  | StaffAuditJsonValue[]
  | { [key: string]: StaffAuditJsonValue };

export type StaffAuditRecord = {
  uuid?: string | number;
  module_name?: string;
  endpoint_name?: string;
  method?: string;
  object_id?: string | number;
  createdBy?: string;
  createdAt?: string;
  previous_data?: StaffAuditJsonValue;
  new_data?: StaffAuditJsonValue;
  [key: string]: unknown;
};

export type DiffLine = { content: string; changed: boolean };
