export type CountryMeta = {
  id: string;
  name: string;
  continentId: string | null;
  isActive: boolean;
};

export type StateRecord = {
  unique_id: string | number;
  name: string;
  label: string;
  is_active: boolean;
  country_id: string | number;
  continent_id: string | number;
};

export type ErrorWithResponse = {
  response?: {
    data?: unknown;
  };
};

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  country_name: { value: string | null; matchMode: FilterMatchMode };
  name: { value: string | null; matchMode: FilterMatchMode };
  label: { value: string | null; matchMode: FilterMatchMode };
};
