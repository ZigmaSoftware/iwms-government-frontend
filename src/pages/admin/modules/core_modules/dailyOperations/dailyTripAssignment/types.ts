export type SelectOption = { value: string; label: string };

export type FormState = {
  trip_plan_id: string;
  staff_template_id: string;
  alt_staff_template_id: string;
  panchayat_id: string;
  waste_type_ids: string[];
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

// The most recent TripRetripRequest for this assignment (there's usually at
// most one, but a trip can be requested/rejected more than once). Unrelated
// to BreakdownInfo — a breakdown swaps the vehicle/crew mid-trip, a Re-Trip
// closes the trip early and carries leftover stops to a continuation.
export type RetripInfo = {
  unique_id?: string;
  status?: "Pending" | "Approved" | "Rejected" | string;
  reason?: string | null;
  review_remarks?: string | null;
  new_assignment_id?: string | null;
  pending_bin_count?: number;
  pending_household_count?: number;
};

export type DailyTripCollectionPointInline = {
  unique_id?: string;
  collection_point_id?: string;
  collection_point?: { unique_id?: string; cp_name?: string; latitude?: string; longitude?: string } | null;
  wards?: { unique_id?: string; ward_name?: string }[];
  bin_id?: string;
  bin?: { unique_id?: string; bin_name?: string } | null;
  waste_type_name?: string | null;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  status?: string;
  status_reason?: string | null;
  // Set once this stop is carried over to a Re-Trip continuation — the
  // continuation's DailyTripAssignment.unique_id. `status` stays whatever it
  // was (usually Pending); this is purely a "where did it go" pointer.
  carried_to_assignment?: string | null;
};

export type DailyTripHouseholdCollectionInline = {
  unique_id?: string;
  customer_id?: string;
  customer?: { unique_id?: string; customer_name?: string; building_no?: string; street?: string; ward_id?: string; ward_name?: string } | null;
  collection_type?: string;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  wet_waste?: number | null;
  dry_waste?: number | null;
  mixed_waste?: number | null;
  sanitary_waste?: number | null;
  status?: string;
  status_reason?: string | null;
  // Set once this stop is carried over to a Re-Trip continuation — the
  // continuation's DailyTripAssignment.unique_id. `status` stays whatever it
  // was (usually Pending); this is purely a "where did it go" pointer.
  carried_to_assignment?: string | null;
};

export type DailyTripAssignmentRecord = {
  unique_id: string;
  trip_plan_id?: string;
  staff_template_id?: string;
  panchayat_id?: string;
  waste_types_detail?: { unique_id?: string; waste_type_name?: string }[];
  waste_type_breakdown?: { waste_type_name?: string; collected_weight_kg?: number | string }[];
  collection_points?: DailyTripCollectionPointInline[];
  household_collection_points?: DailyTripHouseholdCollectionInline[];
  breakdown_info?: BreakdownInfo | null;
  retrip_info?: RetripInfo | null;
  alt_staff_template?: { unique_id?: string; display_code?: string } | null;
  trip_plan?: {
    unique_id?: string;
    display_code?: string;
    scheduled_time?: string;
    panchayat?: NamedRef & { panchayat_name?: string };
    waste_type_names?: string[];
    has_bin?: boolean;
    has_household?: boolean;
    has_bulk?: boolean;
  };
  household_waste_types?: { unique_id?: string; waste_type_name?: string }[];
  collection_types?: { has_bin: boolean; has_household: boolean; has_bulk?: boolean };
  staff_template?: { unique_id?: string; display_code?: string; driver?: string | null; operator?: string | null };
  effective_staff?: {
    unique_id?: string;
    display_code?: string;
    driver?: string | null;
    operator?: string | null;
    source?: string;
    from_date?: string;
    to_date?: string;
  } | null;
  vehicle?: { unique_id?: string; vehicle_no?: string } | null;
  panchayat?: NamedRef & { panchayat_name?: string };
  trip_date?: string;
  scheduled_time?: string;
  status?: string;
  approval_status?: string;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  // Duration actual_start_at -> actual_end_at (or -> now while In Progress),
  // whole seconds. Null until the trip has been started.
  total_trip_time_seconds?: number | null;
  // This assignment's 1-based position among today's assignments for the
  // same trip plan: 1 normally, 2+ for a Re-Trip continuation.
  trip_count?: number;
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
