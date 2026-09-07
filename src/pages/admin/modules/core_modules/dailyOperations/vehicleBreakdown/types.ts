export type BreakdownStatus =
  | "REPORTED"
  | "REPLACEMENT_ARRANGED"
  | "REJECTED";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type BreakdownReason =
  | "FLAT_TYRE"
  | "ENGINE_FAILURE"
  | "ACCIDENT"
  | "ELECTRICAL"
  | "OVERHEATING"
  | "OTHER";

export interface StaffDetail {
  unique_id: string;
  name: string;
}

export interface VehicleDetail {
  unique_id: string;
  vehicle_no: string;
  capacity: string | null;
}

export interface AlternativeStaffTemplateDetail {
  unique_id: string;
  display_code: string;
  base_staff_template_id: string | null;
  driver: StaffDetail | null;
  operator: StaffDetail | null;
  change_reason: string | null;
  change_remarks: string | null;
  approval_status: string | null;
}

export interface TripAssignmentDetail {
  unique_id: string;
  trip_date: string;
  status: string;
  scheduled_time: string | null;
  location_name: string | null;
  location_level: string | null;
  trip_plan_display_code: string | null;
}

export interface PendingCollectionPoint {
  unique_id: string;
  sequence: number;
  status: string;
  collection_point_id: string | null;
  name: string | null;
  bin_id: string | null;
}

export interface PendingHousehold {
  unique_id: string;
  sequence: number;
  status: string;
  customer_id: string | null;
  name: string | null;
}

export interface PendingStopsSnapshot {
  collection_points: PendingCollectionPoint[];
  households: PendingHousehold[];
}

export interface VehicleBreakdownRecord {
  unique_id: string;

  trip_assignment_id: string;
  trip_assignment_detail: TripAssignmentDetail | null;
  new_assignment_id: string | null;
  pending_stops: PendingStopsSnapshot | null;

  breakdown_vehicle_id: string;
  breakdown_vehicle_detail: VehicleDetail | null;

  replacement_vehicle_id: string;
  replacement_vehicle_detail: VehicleDetail | null;

  replacement_driver_id: string;
  replacement_driver_detail: StaffDetail | null;

  replacement_operator_id: string;
  replacement_operator_detail: StaffDetail | null;

  original_driver_detail: StaffDetail | null;
  original_operator_detail: StaffDetail | null;

  alt_staff_template_id: string | null;
  alt_staff_template_detail: AlternativeStaffTemplateDetail | null;

  breakdown_time: string | null;
  breakdown_lat: string | null;
  breakdown_lng: string | null;
  breakdown_location: string | null;
  collected_weight_before_breakdown_kg: string | null;
  breakdown_reason: BreakdownReason;
  breakdown_remarks: string | null;

  status: BreakdownStatus;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_by_detail: StaffDetail | null;
  approved_at: string | null;
  rejection_remarks: string | null;

  created_at: string;
  updated_at: string;
}

export const BREAKDOWN_REASON_LABELS: Record<BreakdownReason, string> = {
  FLAT_TYRE: "Flat Tyre",
  ENGINE_FAILURE: "Engine Failure",
  ACCIDENT: "Accident",
  ELECTRICAL: "Electrical Fault",
  OVERHEATING: "Overheating",
  OTHER: "Other",
};
