export type TripLogData = {
  actual_weight_kg: number;
  total_trips: number;
  collection_points_covered: number;
  average_weight_per_trip?: number;
};

export type DailyReportRow = {
  unique_id: string;
  collection_date: string;
  local_body_field: string;
  local_body_type: string;
  local_body_id: string;
  local_body_name: string;
  waste_type_id: string;
  waste_type: string;
  actual_weight_kg: number;
  total_trips: number;
  collection_points_covered: number;
  average_weight_per_trip?: number;
};

export type LocationComparisonRow = {
  local_body_field: string;
  local_body_type: string;
  local_body_id: string;
  local_body_name: string;
  actual_weight_kg: number;
  total_trips: number;
  collection_points_covered: number;
  average_weight_per_trip?: number;
};

export type WasteTypeBreakdownRow = {
  waste_type_id: string;
  waste_type: string;
  actual_weight_kg: number;
  total_trips: number;
  collection_points_covered: number;
  share_percent: number;
};

export type DailyReportResponse = {
  results: DailyReportRow[];
  date_trends: Array<Record<string, number | string>>;
  location_comparison: LocationComparisonRow[];
  waste_type_breakdown: WasteTypeBreakdownRow[];
  kpis: {
    total_actual_weight_kg: number;
    average_weight_per_trip?: number;
    total_trips: number;
    collection_points_covered: number;
    waste_type_count?: number;
    local_body_count?: number;
  };
};
