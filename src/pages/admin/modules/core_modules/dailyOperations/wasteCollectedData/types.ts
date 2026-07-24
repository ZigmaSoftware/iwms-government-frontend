export type Option = {
  value: string;
  label: string;
  // Only populated on trip-assignment options — the assignment's own local
  // body per level, used to filter the Trip Assignment dropdown by the
  // form's selected local body.
  localBodyByLevel?: Partial<Record<
    "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id",
    string
  >>;
  // Only populated on trip-assignment options — whether the assignment's trip
  // plan includes a household-collection stop, used to scope the Trip
  // Assignment dropdown to household-type trips only.
  hasHousehold?: boolean;
};

// A geo master row (state/district/area type/local body). Extra keys vary per
// master (corporation_name, union_name, …) so it stays index-accessible.
export type GeoRow = {
  unique_id?: string;
  id?: string | number;
  name?: string;
  [key: string]: unknown;
};

export type Customer = {
  id: number;
  unique_id?: string;
  customer_name: string;
  contact_no?: string;
  building_no?: string;
  street?: string;
  area?: string;
  // Flat geography ids (unique_id strings) as returned by the customer-creation API
  state_id?: string;
  district_id?: string;
  area_type_id?: string;
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
  ward_id?: string;
  ward?: { unique_id?: string; ward_name?: string };
  // …and their display names
  district_name?: string;
  state_name?: string;
  panchayat_name?: string;
  panchayat_union_name?: string;
  town_panchayat_name?: string;
  municipality_name?: string;
  corporation_name?: string;
};

export type WasteCollection = {
  unique_id: string;
  customer: string;
  customer_id?: string | number;
  customer_unique_id?: string;
  customer_name: string;
  contact_no?: string;
  building_no?: string;
  street?: string;
  area?: string;
  // Record-level geography (stored on the collection, inherited from household)
  state_name?: string;
  district_name?: string;
  area_type_name?: string;
  panchayat_name?: string;
  ward_id?: string;
  ward_name?: string;
  // Most-specific local body + its level (Corporation/Municipality/.../Panchayat)
  location_name?: string;
  location_level?: string;
  // Vehicle that performed the collection (resolved via the linked trip assignment).
  vehicle?: { unique_id?: string; vehicle_no?: string } | null;
  wet_waste: number;
  dry_waste: number;
  mixed_waste: number;
  sanitary_waste: number;
  total_quantity: number;
  // Same vocabulary as BinCollectionEvent.status: Collected / Not Collected / Collect Later
  status?: string;
  collection_date?: string;
  collection_time?: string;
  is_active: boolean;
  // Capture photos taken during collection (from the mobile WasteCollectionSub
  // flow), surfaced read-only by the backend serializer as absolute /media/ URLs.
  capture_images?: WasteCaptureImage[];
};

export type WasteCaptureImage = {
  url: string;
  waste_type_id?: string;
  weight?: number | string;
};
