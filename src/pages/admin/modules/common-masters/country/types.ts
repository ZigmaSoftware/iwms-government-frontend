export type ContinentRecord = {
  unique_id: string | number;
  name: string;
  is_active: boolean;
};

export type CountryRecord = {
  unique_id: string | number;
  name: string;
  mob_code: string;
  currency: string;
  continent_id?: string | number | null;
  continent?: string | number | null;
  coordinates?: unknown;
  is_active: boolean;
};

export type ErrorWithResponse = {
  response?: {
    data?: unknown;
  };
};

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  continent_name: { value: string | null; matchMode: FilterMatchMode };
  name: { value: string | null; matchMode: FilterMatchMode };
  currency: { value: string | null; matchMode: FilterMatchMode };
  mob_code: { value: string | null; matchMode: FilterMatchMode };
};
