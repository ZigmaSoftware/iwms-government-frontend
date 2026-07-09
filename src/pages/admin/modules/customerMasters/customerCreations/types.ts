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
  waste_type_ids: string[];
  id_proof_type: string;
  id_no: string;
  country_id: string;
  state_id: string;
  district_id: string;
  area_type_id: string;
  location_node_id: string;
  corporation_id: string;
  municipality_id: string;
  town_panchayat_id: string;
  panchayat_union_id: string;
  panchayat_id: string;
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
  location_node_id?: string;
  location_name?: string;
  location_level?: string;
  property_name: string;
  sub_property_name: string;
  waste_types?: Array<{ unique_id: string; waste_type_name: string }>;
  waste_type_ids?: string[];
  id_proof_type: string;
  id_no: string;
  is_active: boolean;
  qr_code?: string;
  apartment_name?: string;
  block_no?: string;
  flat_no?: string;
};

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  customer_name?: { value: string | null; matchMode: FilterMatchMode };
  contact_no?: { value: string | null; matchMode: FilterMatchMode };
  location_name?: { value: string | null; matchMode: FilterMatchMode };
};
