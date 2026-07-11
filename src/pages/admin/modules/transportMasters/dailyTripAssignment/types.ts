export type SelectOption = { value: string; label: string };

export type FormState = {
  trip_plan_id: string;
  staff_template_id: string;
  alt_staff_template_id: string;
  panchayat_id: string;
  waste_type_id: string;
  household_waste_type_ids: string[];
  trip_date: string;
  scheduled_time: string;
  status: string;
  remarks: string;
};

export type CollectionTypeKey = "bin" | "household" | "bulk" | "mixed" | "unknown";

export type NamedRef = {
  unique_id?: string;
  name?: string;
  [key: string]: unknown;
};

export type BreakdownInfo = {
  unique_id?: string;
  status?: string;
  approval_status?: string;
  breakdown_reason?: string | null;
  breakdown_time?: string | null;
  breakdown_location?: string | null;
  breakdown_vehicle_no?: string | null;
  replacement_vehicle_no?: string | null;
  replacement_driver?: string | null;
  replacement_operator?: string | null;
};

export type DailyTripCollectionPointInline = {
  unique_id?: string;
  collection_point_id?: string;
  collection_point?: { unique_id?: string; cp_name?: string; latitude?: string; longitude?: string } | null;
  bin_id?: string;
  bin?: { unique_id?: string; bin_name?: string } | null;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  status?: string;
};

export type DailyTripHouseholdCollectionInline = {
  unique_id?: string;
  customer_id?: string;
  customer?: { unique_id?: string; customer_name?: string; building_no?: string; street?: string } | null;
  collection_type?: string;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  status?: string;
};

export type DailyTripAssignmentRecord = {
  unique_id: string;
  trip_plan_id?: string;
  staff_template_id?: string;
  panchayat_id?: string;
  waste_type_id?: string;
  collection_points?: DailyTripCollectionPointInline[];
  household_collection_points?: DailyTripHouseholdCollectionInline[];
  breakdown_info?: BreakdownInfo | null;
  alt_staff_template?: { unique_id?: string; display_code?: string } | null;
  trip_plan?: {
    unique_id?: string;
    display_code?: string;
    scheduled_time?: string;
    panchayat?: NamedRef & { panchayat_name?: string };
    has_bin?: boolean;
    has_household?: boolean;
    has_bulk?: boolean;
  };
  household_waste_types?: { unique_id?: string; waste_type_name?: string }[];
  collection_types?: { has_bin: boolean; has_household: boolean; has_bulk?: boolean };
  staff_template?: { unique_id?: string; display_code?: string };
  effective_staff?: { unique_id?: string; display_code?: string } | null;
  panchayat?: NamedRef & { panchayat_name?: string };
  waste_type?: NamedRef & { waste_type_name?: string };
  trip_date?: string;
  scheduled_time?: string;
  status?: string;
  remarks?: string | null;
  [key: string]: unknown;
};

export type TripPlanRecord = {
  unique_id?: string;
  id?: string;
  panchayat_id?: unknown;
  panchayat?: NamedRef & { panchayat_name?: string };
  [key: string]: unknown;
};
