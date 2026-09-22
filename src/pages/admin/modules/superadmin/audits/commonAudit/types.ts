import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
};

export type MainScreenOption = {
  label: string;
  value: string;
  unique_id: string;
};

export type SubScreenOption = {
  label: string;
  value: string;
  unique_id: string;
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
  ip_address?: string | null;
  user_agent?: string | null;
  success?: boolean;
  reason?: string | null;
  previous_data?: CommonAuditJsonValue;
  new_data?: CommonAuditJsonValue;
  [key: string]: unknown;
};

export type DiffLine = { content: string; changed: boolean };
