import type { ReactNode } from "react";

export type ApiId = string | number;

export type ComplaintTicketStatusCode =
  | "SUBMITTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "REJECTED"
  | "CANCELLED"
  | string;

export type ComplaintTicket = {
  unique_id: string;
  ticket_no?: string;
  source?: ApiId | null;
  source_code?: string | null;
  module?: ApiId | null;
  module_code?: string | null;
  module_name?: string | null;
  customer?: ApiId | null;
  customer_name?: string | null;
  wa_phone?: string | null;
  profile_name?: string | null;
  language?: ApiId | null;
  category: ApiId;
  category_name?: string | null;
  category_code?: string | null;
  waste_types?: ApiId[] | null;
  waste_type_names?: string[] | null;
  waste_type_name?: string | null;
  subcategory?: ApiId | null;
  subcategory_name?: string | null;
  priority: ApiId;
  priority_code?: string | null;
  status: ApiId;
  status_code?: ComplaintTicketStatusCode | null;
  status_name?: string | null;
  title?: string | null;
  description?: string | null;
  location_text?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  state?: ApiId | null;
  state_id?: ApiId | null;
  state_name?: string | null;
  district?: ApiId | null;
  district_id?: ApiId | null;
  district_name?: string | null;
  corporation?: ApiId | null;
  municipality?: ApiId | null;
  town_panchayat?: ApiId | null;
  panchayat_union?: ApiId | null;
  panchayat?: ApiId | null;
  city_id?: ApiId | null;
  city_name?: string | null;
  city_type?: LocalBodyType | string | null;
  assigned_team?: ApiId | null;
  assigned_team_name?: string | null;
  assigned_staff?: ApiId | null;
  assigned_staff_name?: string | null;
  assigned_department_name?: string | null;
  escalation_level?: number | null;
  sla_due_at?: string | null;
  first_response_due_at?: string | null;
  sla_time_remaining_seconds?: number | null;
  sla_breached?: boolean;
  sla_breached_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  reopened_count?: number;
  is_sensitive?: boolean;
  is_active?: boolean;
  created?: string;
  updated?: string;
  status_history?: ComplaintStatusHistory[];
  escalation_history?: ComplaintEscalationHistory[];
  assignment_history?: ComplaintAssignmentHistory[];
  comments?: ComplaintComment[];
  attachments?: ComplaintAttachment[];
  public_timeline?: ComplaintTimelineItem[];
};

export type ComplaintCategory = {
  unique_id: string;
  category_code: string;
  category_name: string;
  module?: ApiId | null;
  module_code?: string | null;
  module_name?: string | null;
  description?: string | null;
  default_priority?: ApiId | null;
  default_priority_code?: string | null;
  default_team?: ApiId | null;
  default_team_name?: string | null;
  requires_location?: boolean;
  requires_media?: boolean;
  requires_address_change_detail?: boolean;
  is_sensitive?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export type ComplaintModule = {
  unique_id: string;
  module_code: string;
  module_name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type ComplaintSubcategory = {
  unique_id: string;
  category: ApiId;
  category_code?: string | null;
  category_name?: string | null;
  subcategory_code: string;
  subcategory_name: string;
  default_priority?: ApiId | null;
  sort_order?: number;
  is_active?: boolean;
};

export type ComplaintPriority = {
  unique_id: string;
  priority_code: string;
  priority_name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type ComplaintStatus = {
  unique_id: string;
  status_code: ComplaintTicketStatusCode;
  status_name: string;
  is_final?: boolean;
  allow_reopen?: boolean;
  sort_order?: number;
  is_active?: boolean;
};

export type ComplaintSource = {
  unique_id: string;
  source_code: string;
  source_name: string;
  is_active?: boolean;
};

export type ComplaintLanguage = {
  unique_id: string;
  language_code: string;
  language_name: string;
  is_default?: boolean;
  is_active?: boolean;
};

export type ComplaintTeam = {
  unique_id: string;
  team_code: string;
  team_name: string;
  department?: ApiId | null;
  department_name?: string | null;
  lead_staff?: ApiId | null;
  lead_staff_name?: string | null;
  escalates_to?: ApiId | null;
  escalates_to_name?: string | null;
  escalates_to_code?: string | null;
  escalation_level?: number;
  is_field_team?: boolean;
  is_active?: boolean;
};

export type ComplaintSlaRule = {
  unique_id: string;
  category: ApiId;
  category_code?: string | null;
  subcategory?: ApiId | null;
  priority: ApiId;
  priority_code?: string | null;
  source?: ApiId | null;
  assign_within_minutes?: number | null;
  resolve_within_minutes?: number | null;
  working_hours_only?: boolean;
  escalation_after_minutes?: number | null;
  escalation_team?: ApiId | null;
  is_active?: boolean;
};

export type ComplaintFeedback = {
  unique_id: string;
  ticket: ApiId;
  ticket_no?: string | null;
  customer?: ApiId | null;
  customer_name?: string | null;
  rating?: number | null;
  feedback_text?: string | null;
  is_issue_solved?: boolean;
  submitted_at?: string;
  is_active?: boolean;
};

export type ComplaintStatusHistory = {
  unique_id: string;
  from_status?: ApiId | null;
  from_status_code?: string | null;
  to_status?: ApiId | null;
  to_status_code?: string | null;
  to_status_name?: string | null;
  remarks?: string | null;
  changed_at?: string;
  visible_to_citizen?: boolean;
};

export type ComplaintAssignmentHistory = {
  unique_id: string;
  from_team_name?: string | null;
  to_team_name?: string | null;
  from_staff_name?: string | null;
  to_staff_name?: string | null;
  assignment_reason?: string | null;
  assigned_at?: string;
};

export type ComplaintEscalationHistory = {
  unique_id: string;
  escalation_level?: number;
  escalated_from_team_name?: string | null;
  escalated_to_team_name?: string | null;
  escalated_to_staff_name?: string | null;
  reason?: string | null;
  escalated_at?: string;
};

export type ComplaintComment = {
  unique_id: string;
  comment_text: string;
  is_internal?: boolean;
  is_sensitive?: boolean;
  created?: string;
};

export type ComplaintAttachment = {
  unique_id: string;
  file?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  created?: string;
};

export type PublicGrievanceWasteType = {
  unique_id: string;
  waste_type_name: string;
};

/* Flat geo masters (State / District / local body) used instead of the
   old hierarchy-node tree. */
export type LocalBodyType =
  | "corporation"
  | "municipality"
  | "town_panchayat"
  | "panchayat_union"
  | "panchayat";

export type GeoOption = {
  unique_id: string;
  name: string;
  state_id?: string | null;
  district_id?: string | null;
};

export type LocalBodyOption = {
  unique_id: string;
  name: string;
  type: LocalBodyType;
};

export type PublicGrievanceLocationOption = {
  unique_id: string;
  name: string;
  state_id?: string | null;
  type?: LocalBodyType;
};

export type PublicGrievanceCategory = {
  unique_id: string;
  category_name: string;
};

export type PublicGrievanceSubcategory = {
  unique_id: string;
  category: string;
  subcategory_name: string;
};

export type PublicGrievanceMeta = {
  waste_types: PublicGrievanceWasteType[];
  categories: PublicGrievanceCategory[];
  subcategories: PublicGrievanceSubcategory[];
};

export type PublicGrievanceResponse = {
  message: string;
  ticket_no: string;
  unique_id: string;
};

export type PublicGrievanceStatusResult = {
  ticket_no: string;
  status: string | null;
  status_code?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  location_text?: string | null;
  created?: string;
  timeline?: {
    status: string | null;
    status_code?: string | null;
    at?: string;
    remarks?: string | null;
  }[];
};

export type ComplaintTimelineItem = {
  status_code?: string | null;
  status_name?: string | null;
  at?: string;
  remarks?: string | null;
};

export type GrievanceStatus =
  | "open"
  | "processing"
  | "progressing"
  | "in-progress"
  | "resolved"
  | "closed"
  | string;

export interface Grievance {
  id: number;
  unique_id: string;
  title?: string;
  category?: string;
  zone_id?: string;
  zone_name?: string;
  ward_id?: string;
  ward_name?: string;
  description?: string;
  details?: string;
  status?: GrievanceStatus;
  status_code?: string;
  status_name?: string;
  created?: string;
  complaint_closed_at?: string;
  closed_at?: string;
  contact_no?: string;
  wa_phone?: string;
  address?: string;
  location_text?: string;
  image_url?: string;
  close_image_url?: string;
  action_remarks?: string;
  main_category?: string;
  category_name?: string;
  sub_category?: string;
  subcategory_name?: string;
}

export interface InfoFieldProps {
  label: string;
  value?: ReactNode;
}

export interface AttachmentPreviewProps {
  label: string;
  fileUrl?: string | null;
}

export type AssignableStaffOption = {
  staff_unique_id: string;
  employee_name: string;
  department_name?: string | null;
  district_name?: string | null;
  local_body_name?: string | null;
  location_level_name?: string | null;
};

export type AssignableStaffResponse = {
  district_id?: string | null;
  district_name?: string | null;
  city_id?: string | null;
  city_name?: string | null;
  count: number;
  staff: AssignableStaffOption[];
};

export type ComplaintNotificationEventType =
  | "ASSIGNED"
  | "ESCALATED"
  | "ESCALATED_TO"
  | "RESOLVED"
  | "REOPENED"
  | string;

export type ComplaintNotification = {
  unique_id: string;
  ticket?: ApiId | null;
  ticket_no?: string | null;
  ticket_status_code?: string | null;
  event_type: ComplaintNotificationEventType;
  event_type_display?: string;
  title: string;
  message?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};
