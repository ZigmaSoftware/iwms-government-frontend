// Response shapes of GET /dashboard/admin/ and /dashboard/superadmin/
// (iwms-government-backend app/viewsets/dashboard_admin_viewset.py,
// dashboard_superadmin_viewset.py and app/services/dashboard_metrics.py).

export type CountMap = Record<string, number>;

export type TripKpis = {
  total: number;
  completed: number;
  in_progress: number;
  scheduled: number;
  cancelled: number;
  completion_rate: number;
  approval: CountMap;
  by_collection_type: Record<string, { total: number; completed: number }>;
  vehicles_used: number;
  teams_used: number;
  avg_duration_min: number;
  on_time: number;
  late_start: number;
  on_time_rate: number;
  per_day: number;
};

export type Operations = {
  trips: TripKpis;
  trip_logs: {
    total: number;
    verified: number;
    unverified: number;
    verification_rate: number;
    bin_kg: number;
    household_kg: number;
    total_kg: number;
  };
  waste: {
    total_kg: number;
    total_tons: number;
    household_kg: number;
    bin_kg: number;
    avg_kg_per_day: number;
    avg_kg_per_trip: number;
    by_waste_type: { name: string; kg: number; share: number }[];
  };
  households: {
    weighments: number;
    customers_served: number;
    planned_stops: number;
    collected: number;
    status: CountMap;
    coverage_rate: number;
  };
  bins: {
    events: number;
    collected: number;
    distinct_bins_collected: number;
    status: CountMap;
  };
  collection_points: {
    planned: number;
    collected: number;
    status: CountMap;
    coverage_rate: number;
  };
  // The government build has no trip-delay reports.
  exceptions: {
    breakdowns: number;
    breakdown_status: CountMap;
    breakdown_reasons: CountMap;
    retrips: number;
    retrip_status: CountMap;
  };
  complaints: {
    raised: number;
    resolved: number;
    closed: number;
    open: number;
    escalated_open: number;
    overdue_open: number;
    reopened: number;
    by_status: CountMap;
  };
  attendance: {
    staff: number;
    avg_present: number;
    attendance_rate: number;
    present_last_day: number;
  };
};

export type Fleet = {
  total: number;
  active: number;
  on_trip_last_day: number;
  idle_last_day: number;
  insurance_expired: number;
  insurance_due_30d: number;
  open_breakdowns: number;
};

export type StaffSummary = {
  total: number;
  active: number;
  login_enabled: number;
  by_role: CountMap;
};

export type DailyRow = {
  date: string;
  trips: number;
  trips_completed: number;
  trip_logs: number;
  household_kg: number;
  bin_kg: number;
  total_kg: number;
  households_collected: number;
  bins_collected: number;
  breakdowns: number;
  complaints: number;
  present: number;
};

export type Ranked = {
  id: string;
  name: string;
  kg: number;
  trips?: number;
  collections?: number;
  type_label?: string;
};

/** Operations and headcount of one area (local body or district). */
export type AreaMetrics = {
  trips: number;
  trips_completed: number;
  completion_rate: number;
  trip_logs: number;
  household_kg: number;
  bin_kg: number;
  total_kg: number;
  bins_collected: number;
  breakdowns: number;
  open_complaints: number;
  staff: number;
  vehicles: number;
  customers: number;
  bins: number;
};

export type LocalBodyRow = AreaMetrics & {
  /** "" for records not linked to any local body. */
  local_body_id: string;
  local_body_name: string;
  type_label: string;
  district_id: string;
  district_name: string;
};

export type MasterRow = {
  key: string;
  label: string;
  group: string;
  level: "geo" | "global";
  total: number;
  active: number;
  inactive: number;
  /** Per local body (Admin) or per district (Superadmin). */
  breakdown: CountMap;
};

export type DateScope = { from_date: string; to_date: string; days: number };

export type LocalBodyOption = {
  id: string;
  name: string;
  /** Row column of its level: "corporation_id", "municipality_id", ... */
  type: string;
  type_label: string;
  district_id: string;
  district_name: string;
};

export type AdminDashboardData = {
  scope: DateScope & {
    state_ids: string[];
    state_name: string;
    district_ids: string[];
    district_name: string;
    local_body_ids: string[];
    local_body_name: string;
    ward_ids: string[];
    ward_name: string;
    /** "platform" for super admins, else the staff data scope's level. */
    granted_level: "platform" | "state" | "district" | "local_body" | "ward" | null;
  };
  filters: {
    can_pick_state: boolean;
    states: { id: string; name: string }[];
    can_pick_district: boolean;
    can_pick_local_body: boolean;
    can_pick_ward: boolean;
    /** The picked states' districts, or every one in scope. */
    districts: { id: string; name: string; state_id: string }[];
    /** The picked districts' local bodies, or every one in scope. */
    local_bodies: LocalBodyOption[];
    /** Too many local bodies to list: pick districts first (picked local
     * bodies are still included above). */
    local_bodies_need_district: boolean;
    /** Wards of the picked local bodies only. */
    wards: { id: string; name: string; local_body_id: string }[];
  };
  operations: Operations;
  fleet: Fleet;
  staff: StaffSummary;
  daily: DailyRow[];
  top: { vehicles: Ranked[]; drivers: Ranked[]; local_bodies: Ranked[]; wards: Ranked[] };
  local_bodies: LocalBodyRow[];
  masters: MasterRow[];
  generated_at: string;
};

export type LocalBodyPlatformRow = {
  local_body_id: string;
  local_body_name: string;
  type_label: string;
  district_id: string;
  district_name: string;
  is_active: boolean;
  wards: number;
  staff: number;
  staff_active: number;
  staff_login_enabled: number;
  staff_configured: number;
  staff_without_grants: number;
  avg_grants_per_staff: number;
  screens_enabled: number;
  modules_enabled: number;
  screen_coverage: number;
  customers: number;
  vehicles: number;
  bins: number;
  trips: number;
  trips_completed: number;
  completion_rate: number;
  trip_logs: number;
  total_kg: number;
  breakdowns: number;
  open_complaints: number;
  logins: number;
  failed_logins: number;
  last_login: string | null;
};

export type DistrictRow = AreaMetrics & {
  district_id: string;
  district_name: string;
  state_name: string;
  is_active: boolean;
  local_bodies: number;
  wards: number;
};

export type LocalBodyGrant = {
  /** "" for a district- or platform-wide grant. */
  local_body_id: string;
  local_body_type: string;
  local_body_name: string;
  screens_enabled: number;
  coverage: number;
  modules: {
    module: string;
    label: string;
    screens: { name: string; label: string; actions: string[] }[];
  }[];
};

export type SuperadminDashboardData = {
  scope: DateScope & { state_ids: string[]; state_name: string };
  filters: { states: { id: string; name: string }[] };
  platform: {
    states: number;
    districts: number;
    districts_active: number;
    area_types: number;
    local_bodies: number;
    local_bodies_active: number;
    local_bodies_by_type: Record<string, { total: number; active: number }>;
    wards: number;
    customers: number;
    vehicles: number;
    platform_admins: number;
    staff_data_scopes: number;
    staff_access_configs: number;
    modules: number;
    screens: number;
    screens_seeded: number;
    app_modules: number;
  };
  operations: Operations;
  staff: StaffSummary;
  fleet: Fleet;
  daily: DailyRow[];
  local_bodies: LocalBodyPlatformRow[];
  districts: DistrictRow[];
  staff_by_role: {
    district_id: string;
    district_name: string;
    local_body_id: string;
    local_body_name: string;
    role: string;
    staff: number;
  }[];
  permissions: {
    catalog: { module: string; label: string; screens: { name: string; label: string }[] }[];
    local_body_grants: LocalBodyGrant[];
    staff_grants: {
      local_body_id: string;
      local_body_name: string;
      module: string;
      module_label: string;
      screen: string;
      screen_label: string;
      staff_with_view: number;
    }[];
    changes: {
      total: number;
      by_source: CountMap;
      by_action: CountMap;
      by_local_body: CountMap;
      per_day: { date: string; changes: number }[];
    };
  };
  activity: {
    logins: number;
    failed_logins: number;
    active_users: number;
    per_day: { date: string; success: number; failed: number }[];
    by_local_body: {
      local_body_id: string;
      local_body_name: string;
      success: number;
      failed: number;
      users: number;
    }[];
  };
  masters: MasterRow[];
  generated_at: string;
};
