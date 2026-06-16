import type { SelectOption } from "@/types";

export type BinOption = SelectOption & {
  districtId: string;
  cityId: string;
  panchayatId: string;
  wardId: string;
  collectionPointId: string;
};

export type CollectionPointOption = SelectOption & {
  districtId: string;
  cityId: string;
  panchayatId: string;
  wardId: string;
};

export type CityOption = SelectOption & { districtId: string };

export type LocationOption = SelectOption & { districtId: string; cityId: string };

export type WardOption = LocationOption & { panchayatId: string; zoneId: string };

export type ApiObject = Record<string, unknown>;

export type TripCollectionPointRecord = {
  unique_id: string;
  trip_assignment_id?: string;
  trip_assignment?: ApiObject;
  collection_point_id?: string;
  collection_point?: ApiObject;
  bin_id?: string;
  bin?: ApiObject;
  sequence?: number;
  status?: string;
  is_collected?: boolean;
  [key: string]: unknown;
};

export type NestedRef = Record<string, unknown> | null | undefined;

export type BinCollectionEventRecord = {
  unique_id: string;
  company_id?: string;
  company_unique_id?: string;
  company_name?: string;
  project_id?: string;
  project_unique_id?: string;
  project_name?: string;
  trip_assignment_id?: string;
  trip_collection_point_id?: string;
  collection_point_id?: string;
  bin_id?: string;
  panchayat_id?: string;
  bin?: ApiObject | null;
  waste_type?: NestedRef;
  trip_plan?: NestedRef;
  vehicle?: NestedRef;
  collected_weight_kg?: string | number;
  driver_latitude?: string | number | null;
  driver_longitude?: string | number | null;
  notes?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};
