export type TripLogData = {
  actual_weight_kg: number;
  agreed_weight_kg: number;
  total_trips: number;
  collection_points_covered: number;
  variance_kg: number;
  variance_percent: number;
  report_status: string;
  collection_efficiency_percent: number;
};

export type DailyReportRow = {
  unique_id: string;
  company_id: string;
  company_name?: string;
  project_id: string;
  project_name?: string;
  collection_date: string;
  panchayat_id: string;
  panchayat_name?: string;
  waste_type: string;
  agreed_weight_kg: number;
  actual_weight_kg: number;
  variance_kg: number;
  variance_percent: number;
  report_status: string;
  total_trips: number;
  collection_points_covered: number;
  collection_efficiency_percent?: number;
  coverage_efficiency_percent?: number;
  average_weight_per_trip?: number;
};

export type DailyReportResponse = {
  results: DailyReportRow[];
  date_trends: Array<Record<string, number | string>>;
  panchayat_comparison: Array<Record<string, number | string>>;
  kpis: {
    total_agreed_weight_kg: number;
    total_actual_weight_kg: number;
    variance_kg: number;
    collection_efficiency_percent: number;
    average_weight_per_trip?: number;
    coverage_efficiency_percent?: number;
    total_trips: number;
    collection_points_covered: number;
    report_status?: string;
  };
};
