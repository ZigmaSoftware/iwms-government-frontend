export type StaffChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type StaffChangeRequestValue = string | Record<string, unknown> | null;

export type StaffChangeRequestRecord = {
  unique_id: string;
  requested_by: string;
  requested_by_name?: string | null;
  approver_id?: string | null;
  field_name: string;
  old_value?: StaffChangeRequestValue;
  new_value?: StaffChangeRequestValue;
  reason?: string | null;
  status: StaffChangeRequestStatus;
  decided_by?: string | null;
  decided_by_name?: string | null;
  decided_at?: string | null;
  decision_remarks?: string | null;
  created_at?: string;
};

export const CHANGEABLE_FIELDS: { value: string; labelKey: string }[] = [
  { value: "contact_mobile", labelKey: "admin.staff_change_request.field_contact_mobile" },
  { value: "contact_email", labelKey: "admin.staff_change_request.field_contact_email" },
  { value: "present_address", labelKey: "admin.staff_change_request.field_present_address" },
  { value: "permanent_address", labelKey: "admin.staff_change_request.field_permanent_address" },
];
