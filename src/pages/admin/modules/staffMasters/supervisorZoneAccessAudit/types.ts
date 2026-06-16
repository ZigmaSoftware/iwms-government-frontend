import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  supervisor_id?: { value: string | null; matchMode: FilterMatchMode };
  performed_by?: { value: string | null; matchMode: FilterMatchMode };
  performed_role?: { value: string | null; matchMode: FilterMatchMode };
  remarks?: { value: string | null; matchMode: FilterMatchMode };
  old_zone_ids?: { value: string | null; matchMode: FilterMatchMode };
  new_zone_ids?: { value: string | null; matchMode: FilterMatchMode };
};

export type SupervisorZoneAccessAuditRecord = {
  unique_id: string;
  supervisor_id: string;
  performed_by: string;
  performed_role?: string | null;
  old_zone_ids?: Array<number | string> | null;
  new_zone_ids?: Array<number | string> | null;
  remarks?: string | null;
  created_at?: string | null;
};
