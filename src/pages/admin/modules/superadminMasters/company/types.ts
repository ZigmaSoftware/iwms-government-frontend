import type { FilterMatchMode } from "primereact/api";

export type ApiError = {
  response?: {
    data?: unknown;
  };
};

export type Company = {
  unique_id: string;
  name: string;
  description: string;
  is_active: boolean;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  name: { value: string | null; matchMode: FilterMatchMode };
};
