import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

export type DesignationListRecord = {
  unique_id: string;
  is_active?: boolean;
  [key: string]: unknown;
};

export type { DataTablePageEvent, DataTableSortEvent, SortOrder };
