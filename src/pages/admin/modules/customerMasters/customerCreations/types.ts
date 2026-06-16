export type CustomerCreationRecord = {
  unique_id: string | number;
  is_active: boolean;
  [key: string]: unknown;
};

export type ApartmentRow = {
  apartment_name: string;
  total_users: number;
  total_blocks: number;
  total_flats: number;
  qr_code?: string;
};

export type BlockRow = {
  block: string;
  flat_count: number;
};

export type FlatRow = {
  flat_no: string;
  user_count: number;
};

export type UserRow = {
  customer_name: string;
  contact_no: string;
  flat_no: string;
};

export type ViewLevel = "apartment" | "block" | "flat" | "user";

export type Option = { value: string; label: string };

export interface FormDataType {
  customer_name: string;
  contact_no: string;
  username: string;
  email: string;
  password : string;
  building_no: string;
  street: string;
  area: string;
  pincode: string;
  latitude: string;
  longitude: string;
  sqft: string;
  property_id: string;
  sub_property_id: string;
  id_proof_type: string;
  id_no: string;
  country_id: string;
  state_id: string;
  district_id: string;
  city_id: string;
  zone_id: string;
  ward_id: string;
  panchayat_id: string;
  company_id: string;
  project_id: string;
  is_active: boolean;
  is_bulkwaste_generator: boolean;

  // Apartment fields
  apartment_name: string;
  block_no: string;
  flat_no: string;
  // Villa fields
  villa_no: string;
  // Industry fields
  industry_name: string;
  industry_type: string;
}

export type Customer = {
  unique_id: string;
  customer_name: string;
  contact_no: string;
  building_no: string;
  street: string;
  area: string;
  pincode: string;
  panchayat_name: string;
  ward_name: string;
  zone_name: string;
  city_name: string;
  district_name: string;
  state_name: string;
  country_name: string;
  property_name: string;
  sub_property_name: string;
  id_proof_type: string;
  id_no: string;
  is_active: boolean;
  qr_code?: string;
  apartment_name?: string;
  block_no?: string;
  flat_no?: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  customer_name?: { value: string | null; matchMode: FilterMatchMode };
  contact_no?: { value: string | null; matchMode: FilterMatchMode };
  ward_name?: { value: string | null; matchMode: FilterMatchMode };
  zone_name?: { value: string | null; matchMode: FilterMatchMode };
  city_name?: { value: string | null; matchMode: FilterMatchMode };
  state_name?: { value: string | null; matchMode: FilterMatchMode };
  panchayat_name?: { value: string | null; matchMode: FilterMatchMode };
};
