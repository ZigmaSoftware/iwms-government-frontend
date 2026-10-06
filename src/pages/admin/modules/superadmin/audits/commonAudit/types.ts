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

export type AuditFilterOption = {
  unique_id: string;
  name: string;
  level?: string;
};

// Served by the backend's `filter-options` action, drawn from the
// requester's scoped rows (districts/local bodies stand in for the private
// build's companies/projects).
export type AuditFilterOptions = {
  districts: AuditFilterOption[];
  local_bodies: AuditFilterOption[];
  modules: string[];
  methods: string[];
  users: AuditFilterOption[];
};

export type CommonAuditRecord = {
  uuid?: string | number;
  module_name?: string;
  endpoint_name?: string;
  method?: string;
  object_id?: string | number;
  createdBy?: string;
  createdAt?: string;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_by_type?: string | null;
  district_name?: string | null;
  local_body_name?: string | null;
  local_body_level?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  success?: boolean;
  reason?: string | null;
  previous_data?: CommonAuditJsonValue;
  new_data?: CommonAuditJsonValue;
  [key: string]: unknown;
};

export type DiffLine = { content: string; changed: boolean };
