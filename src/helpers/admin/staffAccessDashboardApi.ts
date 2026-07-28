import { api } from "@/api";
import type { DailyReportResponse } from "@/pages/admin/modules/reports/wasteReports/dailyWasteComparison/types";
import type { ReportResponse as MonthlyReportResponse } from "@/pages/admin/modules/reports/wasteReports/monthlyWasteComparison/types";

export type ScopeType =
  | "district"
  | "corporation"
  | "panchayat_union"
  | "panchayat";

export type DashboardFilters = {
  admin_id?: string;
  scope_type: ScopeType;
  scope_id?: string;
  state_id?: string;
  district_id?: string;
  status?: Array<"active" | "inactive">;
  role_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  assignment_role?: Array<"driver" | "operator" | "additional_operator">;
  trip_status?: string[];
  page?: number;
  page_size?: number;
  ordering?: string;
};

export type FilterOption = { id: string; name: string };

export type AdminAccessOwner = {
  id: string;
  name: string;
  username: string;
  role: string;
  role_level: string;
  hierarchy: Array<{ level: string; id: string; name: string }>;
  hierarchy_label: string;
  default_scope: {
    scope_type: ScopeType;
    scope_id: string;
  } | null;
};

export type StaffSummary = {
  total_scopes?: number;
  total_staff: number;
  active_staff: number;
  inactive_staff: number;
  login_enabled: number;
  login_disabled?: number;
  with_permissions: number;
  without_permissions: number;
  fully_configured?: number;
  partially_configured?: number;
  main_screen_permissions?: number;
  user_screen_permissions?: number;
  action_permissions?: number;
};

export type ScopeRow = StaffSummary & {
  id: string;
  name: string;
  scope_type: ScopeType;
  scope_type_label: string;
  district_name: string;
  state_name: string;
  distinct_roles: number;
  last_updated: string | null;
};

export type SelectedScope = {
  id: string;
  name: string;
  scope_type: ScopeType;
  scope_type_label: string;
  state_id: string;
  state_name: string;
  district_id: string;
  district_name: string;
};

export type StaffRow = {
  staff_id: string;
  emp_id: string | null;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  login_enabled: boolean;
  main_screens: number;
  user_screens: number;
  actions: number;
  hierarchy_level: string;
  hierarchy_level_label: string;
  hierarchy_names: string[];
};

export type AssignmentKpis = {
  staff_assigned: number;
  staff_unassigned: number;
  trip_assignments: number;
  scheduled_trips: number;
  in_progress_trips: number;
  completed_trips: number;
  cancelled_trips: number;
  vehicles_total: number;
  vehicles_assigned: number;
  vehicles_unassigned: number;
  teams: number;
};

export type AssignmentRow = {
  staff_id: string;
  emp_id: string | null;
  staff_name: string;
  assignment_role: string;
  staff_active: boolean;
  attendance_status: string;
  team_id: string;
  team_code: string;
  effective_team_code: string;
  is_substitute: boolean;
  trip_assignment_id: string;
  trip_plan_code: string;
  trip_date: string;
  scheduled_time: string;
  actual_start_time: string | null;
  actual_end_time: string | null;
  trip_status: string;
  approval_status: string;
  vehicle_id: string | null;
  vehicle_no: string | null;
  vehicle_type: string | null;
  vehicle_capacity: number | null;
  vehicle_active: boolean | null;
  wards: string[];
  waste_types: string[];
};

export type StaffAccessDashboardResponse = {
  access_context: {
    locked: boolean;
    admin_id: string | null;
    scope_type: ScopeType | null;
    scope_id: string | null;
    hierarchy_label: string;
  };
  filters: {
    admins: AdminAccessOwner[];
    states: FilterOption[];
    districts: FilterOption[];
    scope_types: FilterOption[];
    scopes: Array<FilterOption & { scope_type: ScopeType; district_name: string }>;
    roles: FilterOption[];
  };
  summary: StaffSummary;
  scope_rows: ScopeRow[];
  selected_admin: AdminAccessOwner | null;
  selected_scope: SelectedScope | null;
  kpis: StaffSummary | null;
  staff_rows: {
    results: StaffRow[];
    pagination: { count: number; page: number; page_size: number; total_pages: number };
  };
  assignment_kpis: AssignmentKpis;
  assignment_rows: AssignmentRow[];
  vehicle_performance: Array<{
    vehicle_id: string;
    registration_no: string;
    vehicle_type: string;
    capacity: number;
    trips: number;
    status: string;
  }>;
  trip_performance: Array<{
    trip_id: string;
    trip_plan_code: string;
    vehicle_no: string;
    team_code: string;
    trip_date: string;
    start_time: string;
    wards: string[];
    status: string;
  }>;
  team_performance: Array<{
    team_id: string;
    team_name: string;
    staff_count: number;
    trips: number;
  }>;
  as_of: string;
};

const cleanParams = (filters: DashboardFilters) =>
  Object.fromEntries(
    Object.entries(filters)
      .filter(
        ([, value]) =>
          value !== "" &&
          value != null &&
          (!Array.isArray(value) || value.length > 0),
      )
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join(",") : value,
      ]),
  );

export async function fetchStaffAccessDashboard(filters: DashboardFilters) {
  const { data } = await api.get<StaffAccessDashboardResponse>(
    "/user-creations/staff-access-dashboard/",
    { params: cleanParams(filters) },
  );
  return data;
}

const wasteParams = (filters: DashboardFilters) => {
  const params: Record<string, string> = {};
  if (filters.state_id) params.state_id = filters.state_id;
  if (filters.district_id) params.district_id = filters.district_id;
  if (filters.scope_id) params[`${filters.scope_type}_id`] = filters.scope_id;
  return params;
};

export async function fetchScopedDailyWaste(filters: DashboardFilters) {
  const params = wasteParams(filters);
  if (filters.date_from) params.date = filters.date_from;
  const { data } = await api.get<DailyReportResponse>(
    "/schedule-masters/daily-waste-comparisons/",
    { params },
  );
  return data;
}

export async function fetchScopedMonthlyWaste(
  filters: DashboardFilters,
  month: string,
) {
  const params = { ...wasteParams(filters), month };
  const { data } = await api.get<MonthlyReportResponse>(
    "/reports/monthly-waste-comparison/",
    { params },
  );
  return data;
}
