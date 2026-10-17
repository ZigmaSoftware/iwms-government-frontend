/* /statebody/summary/ and /districtbody/summary/ payload (app/utils/leader_summary.py) */

export type SummaryPeriod = {
  weight: number;
  trips: number;
  from: string;
  to: string;
  previous_weight: number;
  /** null when there is nothing to compare against */
  change_percent: number | null;
};

export type WasteTypeShare = { waste_type_id: string; waste_type: string; weight: number; share_percent: number };

export type LeaderSummary = {
  scope: "state" | "district";
  as_of: string;
  source: string;
  periods: { today: SummaryPeriod; week: SummaryPeriod; month: SummaryPeriod };
  /** districts (state portal) / local bodies (district portal) with a trip today */
  reporting_today: number;
  trend: Array<{ date: string; weight: number; trips: number; by_type: Record<string, number> }>;
  waste_types: string[];
  today_breakdown: WasteTypeShare[];
  month_breakdown: WasteTypeShare[];
  grievances: {
    total: number;
    open: number;
    this_month: number;
    by_status: Array<{ status: string; is_final: boolean; count: number }>;
  };
  fleet: { total: number; active: number; inactive: number; on_trip_today: number; open_breakdowns: number };
};
