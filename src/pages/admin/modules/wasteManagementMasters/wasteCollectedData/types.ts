export type Customer = {
  id: number;
  unique_id?: string;
  customer_name: string;
  building_no?: string;
  street?: string;
  area?: string;
  zone_name?: string;
  ward_name?: string;
  panchayat_name?: string;
  city_name?: string;
  district_name?: string;
  state_name?: string;
  country_name?: string;
};

export type WasteCollection = {
  unique_id: string;
  customer: string;
  customer_id?: string | number;
  customer_unique_id?: string;
  customer_name: string;
  contact_no?: string;
  building_no?: string;
  zone_name?: string;
  ward_name?: string;
  panchayat_name?: string;
  city_name?: string;
  street?: string;
  area?: string;
  wet_waste: number;
  dry_waste: number;
  mixed_waste: number;
  total_quantity: number;
  collection_date?: string;
  collection_time?: string;
  is_active: boolean;
};
