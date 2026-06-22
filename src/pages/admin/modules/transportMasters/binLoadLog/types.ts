import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type BinLoadLogFormState = {
  vehicle_id: string;
  property_id: string;
  sub_property_id: string;
  weight_kg: string;
  source_type: string;
  event_time: string;
};

export type BinLoadLogApiRecord = {
  unique_id: string;

  vehicle_details: {
    unique_id: string;
    vehicle_no: string;
  };

  property_details: {
    unique_id: string;
    property_name: string;
  };

  sub_property_details: {
    unique_id: string;
    sub_property_name: string;
  };

  bin_details: {
    unique_id: string;
    bin_code: string | null;
  } | null;

  weight_kg: number;
  source_type: "MANUAL" | string;
  event_time: string; // ISO datetime
  processed: boolean;
  created_at: string; // ISO datetime
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  vehicle_id?: { value: string | null; matchMode: FilterMatchMode };
  property_id?: { value: string | null; matchMode: FilterMatchMode };
  sub_property_id?: { value: string | null; matchMode: FilterMatchMode };
  source_type?: { value: string | null; matchMode: FilterMatchMode };
  processed?: { value: string | null; matchMode: FilterMatchMode };
};
