import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
};

export type ModuleFilterOption = {
  label: string;
  value: string;
};

export type CommonAuditJsonValue =
  | string
  | number
  | boolean
  | null
  | CommonAuditJsonValue[]
  | { [key: string]: CommonAuditJsonValue };

export type CommonAuditRecord = {
  uuid?: string | number;
  module_name?: string;
  endpoint_name?: string;
  method?: string;
  object_id?: string | number;
  createdBy?: string;
  createdAt?: string;
  previous_data?: CommonAuditJsonValue;
  new_data?: CommonAuditJsonValue;
  [key: string]: unknown;
};

export type DiffLine = { content: string; changed: boolean };
