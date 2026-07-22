export type NamedRef = Record<string, unknown> | null | undefined;

export type DailyTripHouseholdCollectionRecord = {
  unique_id: string;
  trip_assignment_id?: string;
  trip_assignment?: NamedRef;
  customer_id?: string;
  customer?: NamedRef;
  hierarchy?: { location_name?: string; location_level?: string } | null;
  collection_type?: string;
  waste_collection_id?: string | null;
  panchayat?: { unique_id?: string; panchayat_name?: string } | null;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  status?: string;
  status_reason?: string | null;
  created_at?: string;
  [key: string]: unknown;
};
