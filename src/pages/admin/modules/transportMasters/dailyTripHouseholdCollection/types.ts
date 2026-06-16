export type NamedRef = Record<string, unknown> | null | undefined;

export type DailyTripHouseholdCollectionRecord = {
  unique_id: string;
  trip_assignment_id?: string;
  trip_assignment?: NamedRef;
  customer_id?: string;
  customer?: NamedRef;
  waste_collection_id?: string | null;
  panchayat?: { unique_id?: string; panchayat_name?: string } | null;
  ward?: { unique_id?: string; ward_name?: string } | null;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  status?: string;
  company_id?: string | null;
  company_unique_id?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  [key: string]: unknown;
};
