export type Row = {
  unique_id: string;
  sequence: number;
  status: string;
  collected_at?: string | null;
  trip_assignment?: { unique_id?: string; scheduled_time?: string };
  collection_point?: {
    cp_name?: string;
    latitude?: number | string;
    longitude?: number | string;
    panchayat_name?: string;
    ward_name?: string;
    zone_name?: string;
  };
};

export type TrackingResponse = {
  count: number;
  page: number;
  summary: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    missed: number;
    completion_percentage: number;
  };
  results: Row[];
  route_results?: Row[];
  vehicle_tracking?: {
    vehicle_no?: string | null;
    remaining_collection_points?: number;
    current_location?: {
      latitude: number | string;
      longitude: number | string;
      recorded_at?: string;
      collection_point?: string;
    } | null;
    next_collection_point?: {
      cp_name?: string;
      latitude?: number | string;
      longitude?: number | string;
    } | null;
  };
};

export type OptimizationResult = {
  distance_meters: number;
  duration_seconds: number;
  optimized_order?: string[];
  route_geojson?: GeoJSON.GeoJsonObject;
  vehicle_no?: string | null;
  vehicle_start?: [number, number] | null;
  optimized_stop_count?: number;
  completed_stop_count?: number;
  vehicle_start_source?: "request" | "latest_gps" | "first_collection_point";
  route_legs?: Array<{
    destination_id: string;
    distance: number;
    duration: number;
    geometry: GeoJSON.Feature<GeoJSON.LineString>;
  }>;
};

export type VehicleLocation = NonNullable<
  NonNullable<TrackingResponse["vehicle_tracking"]>["current_location"]
>;

export type OverviewTrip = {
  assignment_id: string;
  trip_date: string;
  status: string;
  vehicle_no?: string | null;
  summary: TrackingResponse["summary"];
  distance_meters: number;
  duration_seconds: number;
  route_geojson?: GeoJSON.GeoJsonObject | null;
  vehicle_start?: [number, number] | null;
  collection_points: Row[];
};

export type OverviewResponse = {
  summary: TrackingResponse["summary"];
  trips: OverviewTrip[];
};

export type Tab = "All" | "On Process" | "Completed" | "Pending" | "Missed";
