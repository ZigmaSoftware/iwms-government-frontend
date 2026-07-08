export type ReportRow = {
  unique_id?: string;
  company_id?: string;
  company_name?: string;
  project_id?: string;
  project_name?: string;
  month: string;
  location_node_id: string;
  location_node_name?: string;
  waste_type: string;
  total_agreed_weight: number;
  total_actual_weight: number;
  variance_kg: number;
  variance_percent: number;
  report_status: string;
  total_trips: number;
  collection_points_covered: number;
  collection_efficiency_percent: number;
  coverage_efficiency_percent?: number;
  average_weight_per_trip: number;
};

export type ReportResponse = {
  results: ReportRow[];
  monthly_trends: Array<Record<string, number | string>>;
  location_comparison: Array<Record<string, number | string>>;
  kpis: {
    total_agreed_weight: number;
    total_actual_weight: number;
    variance_kg: number;
    collection_efficiency_percent: number;
    average_weight_per_trip: number;
    coverage_efficiency_percent: number;
    total_trips: number;
    collection_points_covered: number;
    report_status: string;
  };
};
