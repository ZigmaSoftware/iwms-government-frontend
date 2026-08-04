export type RetripStatus = "Pending" | "Approved" | "Rejected";

export interface RetripPendingBin {
  unique_id: string;
  sequence: number | null;
  status: string;
  collection_point_id: string | null;
  name: string | null;
  bin_id: string | null;
}

export interface RetripPendingHousehold {
  unique_id: string;
  sequence: number | null;
  status: string;
  customer_id: string | null;
  name: string | null;
}

export interface RetripPendingSnapshot {
  collection_points: RetripPendingBin[];
  households: RetripPendingHousehold[];
}

export interface TripRetripRequestRecord {
  unique_id: string;
  assignment: string;
  assignment_unique_id: string;
  trip_date: string;
  scheduled_time: string | null;
  assignment_status: string;
  collection_type: "bin" | "household" | "bulk" | null;
  vehicle_no: string | null;
  area_name: string | null;

  reason: string;
  status: RetripStatus;

  pending_bin_count: number;
  pending_household_count: number;
  pending_snapshot: RetripPendingSnapshot;
  live_pending: RetripPendingSnapshot;

  requested_by: string | null;
  requested_by_name: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;

  new_assignment: string | null;

  created_at: string;
  updated_at: string;
}

export const RETRIP_STATUS_LABELS: Record<RetripStatus, string> = {
  Pending: "Pending",
  Approved: "Approved",
  Rejected: "Rejected",
};
