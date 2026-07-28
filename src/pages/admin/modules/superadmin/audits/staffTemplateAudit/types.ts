import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  entity_type?: { value: string | null; matchMode: FilterMatchMode };
  entity_id?: { value: string | null; matchMode: FilterMatchMode };
  action?: { value: string | null; matchMode: FilterMatchMode };
  performed_by?: { value: string | null; matchMode: FilterMatchMode };
  performed_role?: { value: string | null; matchMode: FilterMatchMode };
  change_remarks?: { value: string | null; matchMode: FilterMatchMode };
};

export type StaffTemplateAuditRecord = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by?: string | null;
  performed_by_name?: string | null;
  performed_role?: string | null;
  change_remarks?: string | null;
  performed_at?: string | null;
};
