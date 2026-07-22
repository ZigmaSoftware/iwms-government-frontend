export type SelectOption = { value: string; label: string };

export type ApiObject = Record<string, unknown>;

export type NamedRef = Record<string, unknown> | null | undefined;

export type DailyTripCollectionPointRecord = {
  unique_id: string;
  trip_assignment_id?: string;
  trip_assignment?: NamedRef;
  collection_point_id?: string;
  collection_point?: NamedRef;
  bin_id?: string;
  bin?: NamedRef;
  collected_by?: string | null;
  sequence?: number;
  is_collected?: boolean;
  collected_at?: string | null;
  collected_weight_kg?: string | number | null;
  status?: string;
  is_active?: boolean;
  [key: string]: unknown;
};
