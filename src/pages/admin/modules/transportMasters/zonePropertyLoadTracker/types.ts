import type { FilterMatchMode } from "primereact/api";

export type SelectOption = { value: string; label: string };

export type ZonePropertyLoadTrackerFormState = {
  zone_id: string;
  vehicle_id: string;
  property_id: string;
  sub_property_id: string;
  current_weight_kg: string;
};

export type ZonePropertyLoadTrackerApiRecord = {
  unique_id: string;

  zone_details: {
    unique_id: string;
    name: string;
  };

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

  current_weight_kg: number;
  last_updated: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  "zone_details.name": { value: string | null; matchMode: FilterMatchMode };
  "vehicle_details.vehicle_no": { value: string | null; matchMode: FilterMatchMode };
  "property_details.property_name": { value: string | null; matchMode: FilterMatchMode };
  "sub_property_details.sub_property_name": { value: string | null; matchMode: FilterMatchMode };
  current_weight_kg: { value: string | null; matchMode: FilterMatchMode };
};
