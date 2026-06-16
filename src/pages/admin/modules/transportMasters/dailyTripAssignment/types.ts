export type SelectOption = { value: string; label: string };

export type FormState = {
  trip_plan_id: string;
  staff_template_id: string;
  alt_staff_template_id: string;
  zone_id: string;
  panchayat_id: string;
  ward_id: string;
  waste_type_id: string;
  household_waste_type_ids: string[];
  trip_date: string;
  scheduled_time: string;
  status: string;
  remarks: string;
};

export type CollectionTypeKey = "bin" | "household" | "both" | "unknown";

export type NamedRef = {
  unique_id?: string;
  name?: string;
  [key: string]: unknown;
};

export type DailyTripAssignmentRecord = {
  unique_id: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  trip_plan_id?: string;
  staff_template_id?: string;
  panchayat_id?: string;
  ward_id?: string;
  waste_type_id?: string;
  trip_plan?: {
    unique_id?: string;
    display_code?: string;
    scheduled_time?: string;
    zone?: NamedRef & { zone_name?: string };
    panchayat?: NamedRef & { panchayat_name?: string };
    ward?: NamedRef & { ward_name?: string; zone_id?: string; zone_name?: string };
    has_bin?: boolean;
    has_household?: boolean;
  };
  household_waste_types?: { unique_id?: string; waste_type_name?: string }[];
  collection_types?: { has_bin: boolean; has_household: boolean };
  staff_template?: { unique_id?: string; display_code?: string };
  effective_staff?: { unique_id?: string; display_code?: string } | null;
  panchayat?: NamedRef & { panchayat_name?: string };
  ward?: NamedRef & { ward_name?: string; zone_id?: string; zone_name?: string };
  zone?: NamedRef & { zone_name?: string };
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
  zone_id?: unknown;
  ward_id?: unknown;
  panchayat_id?: unknown;
  zone?: NamedRef & { zone_name?: string };
  ward?: NamedRef & { ward_name?: string; zone_id?: string; zone_name?: string };
  panchayat?: NamedRef & { panchayat_name?: string };
  [key: string]: unknown;
};
