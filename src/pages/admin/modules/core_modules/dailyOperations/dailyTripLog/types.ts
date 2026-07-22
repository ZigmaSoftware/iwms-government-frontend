export type StaffRef = { unique_id?: string; staff_unique_id?: string; employee_name?: string };

export type NamedRef = { unique_id?: string; name?: string; [key: string]: unknown };

export type WasteTypeBreakdownItem = {
  waste_type_id?: string | null;
  waste_type_name?: string | null;
  collected_weight_kg?: string | number | null;
};

export type StaffTemplateDetail = {
  unique_id?: string;
  display_code?: string;
  driver?: StaffRef | null;
  operator?: StaffRef | null;
};

export type StaffTemplateInfo = {
  effective_display_code?: string;
  is_alt?: boolean;
  base?: StaffTemplateDetail | null;
  alt?: StaffTemplateDetail | null;
};

export type LocationDetail = {
  state?: string | null;
  district?: string | null;
  // "Urban Local Body" / "Rural Local Body" — from the AreaType master
  classification?: string | null;
  local_body_name?: string | null;
  local_body_level?: string | null;
};

export type DailyTripLogRecord = {
  unique_id: string;
  location?: LocationDetail | null;
  location_name?: string | null;
  location_level?: string | null;
  trip_assignment_id?: string;
  trip_assignment?: NamedRef & { display_code?: string };
  staff_template?: StaffTemplateInfo | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
  panchayat?: { unique_id?: string; panchayat_name?: string } | null;
  collection_points?: {
    unique_id?: string;
    cp_name?: string;
    sequence?: number;
    is_collected?: boolean;
    status?: string;
    collected_at?: string | null;
    collected_weight_kg?: string | number | null;
    waste_type_name?: string | null;
    waste_type_breakdown?: WasteTypeBreakdownItem[];
  }[];
  waste_types_detail?: { unique_id?: string; waste_type_name?: string }[];
  waste_type_breakdown?: WasteTypeBreakdownItem[];
  trip_date?: string;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  driver?: StaffRef;
  operator?: StaffRef;
  extra_operators?: StaffRef[];
  collected_weight_kg?: string | number;
  household_collected_weight_kg?: string | number | null;
  household_collections?: {
    unique_id?: string;
    sequence?: number;
    customer_name?: string | null;
    customer_unique_id?: string | null;
    is_collected?: boolean;
    collected_weight_kg?: string | number | null;
    waste_type_breakdown?: WasteTypeBreakdownItem[];
    collected_at?: string | null;
    status?: string;
  }[];
  vehicle?: NamedRef & { vehicle_no?: string };
  bin_ids?: string[];
  bins?: (NamedRef & { bin_name?: string })[];
  remarks?: string | null;
  log_status?: string;
  collection_status?: string;
  verified_by_name?: string | null;
  verified_at?: string | null;
  // Capture photos taken during the trip (from the mobile capture flow),
  // aggregated by the backend as absolute /media/ URLs.
  capture_images?: TripLogCaptureImage[];
  [key: string]: unknown;
};

export type TripLogCaptureImage = {
  url: string;
  waste_type_id?: string;
  weight?: number | string;
};
