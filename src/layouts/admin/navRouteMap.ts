import { getEncryptedRoute } from "@/utils/routeCache";

export type RouteEntry = {
  path: string;
  nameKey: string;
  parentNameKey?: string;
};

let _cache: RouteEntry[] | null = null;

export function buildNavRouteMap(): RouteEntry[] {
  if (_cache) return _cache;

  const {
    encAttendance,
    encMasters,
    encAudits,
    encDepartments,
    encDesignations,
    encHierarchies,
    encCollectionPoints,
    encStaffCreation,
    encStaffAccessConfiguration,
    encUserScreen,
    encUserType,
    encCustomerMaster,
    encCustomerCreation,
    encApartmentList,
    encReport,
    encMonthlyDistance,
    encTripSummary,
    encWasteCollectedSummary,
    encMonthlyWasteComparison,
    encComplaint,
    encFeedback,
    encComplaintTicket,
    encComplaintModules,
    encComplaintCategories,
    encComplaintSubcategories,
    encComplaintPriorities,
    encComplaintStatuses,
    encComplaintSources,
    encComplaintTeams,
    encComplaintSlaRules,
    encTransportMaster,
    encFuel,
    encVehicleCreation,
    encVehicleHistory,
    encVehicleTrack,
    encVehicleTracking,
    encVehicleType,
    encCollectionMonitoring,
    encPanchayatBaseCollection,
    encWasteCollectedData,
    encWasteManagementMaster,
    encWorkforceManagement,
    encStaffUserType,
    encMainScreenType,
    encUserScreenAction,
    encMainScreen,
    encUserScreenPermission,
    encStaffMasters,
    encStaffTemplate,
    encAlternativeStaffTemplate,
    encStaffTemplateAudit,
    encCommonAudit,
    encStaffAudit,
    encLoginAudits,
    encUnassignedStaffPool,
    encTripAttendance,
    encHouseholdPickupEvent,
    encTripPlans,
    encVehicleTripAudit,
    encTripExceptionLog,
    encSuperAdminMaster,
    encCommonMasters,
    encContinents,
    encCountries,
    encStates,
    encBins,
    encDistricts,
    encAreaTypes,
    encCorporations,
    encMunicipalities,
    encTownPanchayats,
    encPanchayatUnions,
    encPanchayats,
    encWards,
    encScheduleMasters,
    encScheduleSetup,
    encScheduleOperations,
    encWasteMasters,
    encLocationMasters,
    encSuperAdmin,
    encLeaderLogin,
    encPlbLeaderCreation,
    encDistrictLeaderCreation,
    encStateLeaderCreation,
    encDailyTripAssignment,
    encDailyTripHouseholdCollection,
    encDailyTripTracking,
    encBinCollectionEvent,
    encVehicleBreakdown,
    encSchedulerConfig,
    encDailyTripLog,
    encDailyWasteComparison,
    encWasteTypes,
    encProperties,
    encSubProperties
  } = getEncryptedRoute();

  _cache = [
    // ── Dashboard ──
    { path: "/admin", nameKey: "admin.nav.dashboard" },

    // ── Attendance ──
    { path: `/${encAttendance}/${encAttendance}`, nameKey: "admin.nav.attendance" },

    // ── Super Admin > Screen Management ──
    { path: `/${encSuperAdmin}/${encMainScreenType}`, nameKey: "admin.nav.main_screen_type", parentNameKey: "admin.nav.screen_management" },
    { path: `/${encSuperAdmin}/${encMainScreen}`, nameKey: "admin.nav.main_screen", parentNameKey: "admin.nav.screen_management" },
    { path: `/${encSuperAdmin}/${encUserScreen}`, nameKey: "admin.nav.user_screen", parentNameKey: "admin.nav.screen_management" },
    { path: `/${encSuperAdmin}/${encUserScreenAction}`, nameKey: "admin.nav.user_screen_action", parentNameKey: "admin.nav.screen_management" },
    { path: `/${encSuperAdmin}/${encUserScreenPermission}`, nameKey: "admin.nav.user_screen_permission", parentNameKey: "admin.nav.screen_management" },

    // ── Super Admin > Role Management ──
    { path: `/${encSuperAdmin}/${encUserType}`, nameKey: "admin.nav.user_type", parentNameKey: "admin.nav.role_management" },
    { path: `/${encSuperAdmin}/${encStaffUserType}`, nameKey: "admin.nav.staff_user_type", parentNameKey: "admin.nav.role_management" },

    // ── Super Admin > User Management ──
    { path: `/${encStaffMasters}/${encStaffCreation}`, nameKey: "admin.nav.staff_creation", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encStaffAccessConfiguration}`, nameKey: "admin.nav.staff_access_configuration", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encStaffTemplate}`, nameKey: "admin.nav.staff_template", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encAlternativeStaffTemplate}`, nameKey: "admin.nav.alternative_staff_template", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encUnassignedStaffPool}`, nameKey: "admin.nav.unassigned_staff_pool", parentNameKey: "admin.nav.user_creations" },

    // ── Super Admin > Common Masters ──
    { path: `/${encCommonMasters}/${encContinents}`, nameKey: "admin.nav.continent", parentNameKey: "admin.nav.common_masters" },
    { path: `/${encCommonMasters}/${encCountries}`, nameKey: "admin.nav.country", parentNameKey: "admin.nav.common_masters" },
    { path: `/${encCommonMasters}/${encStates}`, nameKey: "admin.nav.state", parentNameKey: "admin.nav.common_masters" },

    // ── Super Admin > Audits ──
    { path: `/${encAudits}/${encLoginAudits}`, nameKey: "admin.nav.login_audit", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encAudits}/${encCommonAudit}`, nameKey: "admin.nav.common_audit", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encAudits}/${encStaffAudit}`, nameKey: "admin.nav.staff_audit", parentNameKey: "admin.nav.audit_items" },


    // ── Masters > (general) ──
    { path: `/${encMasters}/${encDepartments}`, nameKey: "admin.nav.department", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encDesignations}`, nameKey: "admin.nav.designation", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encHierarchies}`, nameKey: "admin.nav.hierarchy", parentNameKey: "admin.nav.masters" },

    // ── Masters > Location Masters ──
    { path: `/${encLocationMasters}/${encDistricts}`, nameKey: "admin.nav.district", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encAreaTypes}`, nameKey: "admin.nav.area_type", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encCorporations}`, nameKey: "admin.nav.corporation", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encMunicipalities}`, nameKey: "admin.nav.municipality", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encTownPanchayats}`, nameKey: "admin.nav.town_panchayat", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encPanchayatUnions}`, nameKey: "admin.nav.panchayat_union", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encPanchayats}`, nameKey: "admin.nav.panchayat", parentNameKey: "admin.nav.location_masters" },
    { path: `/${encLocationMasters}/${encWards}`, nameKey: "admin.nav.ward", parentNameKey: "admin.nav.location_masters" },

    // ── Masters > Waste Masters ──
    { path: `/${encMasters}/${encWasteTypes}`, nameKey: "common.waste_type", parentNameKey: "admin.nav.waste_masters" },
    { path: `/${encMasters}/${encProperties}`, nameKey: "admin.nav.property", parentNameKey: "admin.nav.waste_masters" },
    { path: `/${encMasters}/${encSubProperties}`, nameKey: "admin.nav.sub_property", parentNameKey: "admin.nav.waste_masters" },
    { path: `/${encMasters}/${encBins}`, nameKey: "common.bins", parentNameKey: "admin.nav.waste_masters" },

    // ── Masters > Transport Masters ──
    { path: `/${encTransportMaster}/${encVehicleType}`, nameKey: "admin.nav.vehicle_type", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encVehicleCreation}`, nameKey: "admin.nav.vehicle_creation", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encTripPlans}`, nameKey: "admin.nav.trip_plans", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encFuel}`, nameKey: "admin.nav.fuel", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encTripAttendance}`, nameKey: "admin.nav.trip_attendance", parentNameKey: "admin.nav.transport_masters" },

    // ── Masters > Customer Masters ──
    { path: `/${encCustomerMaster}/${encCustomerCreation}`, nameKey: "admin.nav.customer_creation", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encCustomerMaster}/${encApartmentList}`, nameKey: "admin.nav.apartment_list", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encCustomerMaster}/${encHouseholdPickupEvent}`, nameKey: "admin.nav.household_pickup_event", parentNameKey: "admin.nav.customer_masters" },

    // ── Masters > Leader Management ──
    { path: `/${encLeaderLogin}/${encPlbLeaderCreation}`, nameKey: "admin.nav.plb_leader_creation", parentNameKey: "admin.nav.leader_management" },
    { path: `/${encLeaderLogin}/${encDistrictLeaderCreation}`, nameKey: "admin.nav.district_leader_creation", parentNameKey: "admin.nav.leader_management" },
    { path: `/${encLeaderLogin}/${encStateLeaderCreation}`, nameKey: "admin.nav.state_leader_creation", parentNameKey: "admin.nav.leader_management" },

    // ── Core Modules > Complaint Management ──
    { path: `/${encComplaintTicket}/${encComplaint}`, nameKey: "admin.nav.complaint_tickets", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintModules}`, nameKey: "admin.nav.modules", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintCategories}`, nameKey: "admin.nav.categories", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintSubcategories}`, nameKey: "admin.nav.subcategories", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintPriorities}`, nameKey: "admin.nav.priorities", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintStatuses}`, nameKey: "admin.nav.statuses", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintSources}`, nameKey: "admin.nav.sources", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintTeams}`, nameKey: "admin.nav.teams", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintSlaRules}`, nameKey: "admin.nav.sla_rules", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encFeedback}`, nameKey: "admin.nav.feedback", parentNameKey: "admin.nav.complaint_ticket" },

    // ── Core Modules > Schedule Setup ──
    { path: `/${encScheduleMasters}/${encStaffTemplate}`, nameKey: "admin.nav.staff_template", parentNameKey: "admin.nav.schedule_setup" },
    { path: `/${encScheduleMasters}/${encAlternativeStaffTemplate}`, nameKey: "admin.nav.alternative_staff_template", parentNameKey: "admin.nav.schedule_setup" },
    { path: `/${encScheduleMasters}/${encCollectionPoints}`, nameKey: "admin.nav.collection_point", parentNameKey: "admin.nav.schedule_setup" },
    { path: `/${encScheduleMasters}/${encTripPlans}`, nameKey: "admin.nav.trip_plans", parentNameKey: "admin.nav.schedule_setup" },

    // ── Core Modules > Daily Operations ──
    { path: `/${encScheduleMasters}/${encDailyTripAssignment}`, nameKey: "admin.nav.daily_trip_assignment", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encDailyTripTracking}`, nameKey: "admin.nav.daily_trip_tracking", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encDailyTripHouseholdCollection}`, nameKey: "admin.nav.daily_trip_household_collection", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encBinCollectionEvent}`, nameKey: "admin.nav.secondary_bin_collection_event", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encWasteCollectedData}`, nameKey: "admin.nav.household_collection_event", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encVehicleBreakdown}`, nameKey: "admin.nav.vehicle_breakdown", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encSchedulerConfig}`, nameKey: "admin.nav.scheduler_config", parentNameKey: "admin.nav.schedule_operations" },
    { path: `/${encScheduleMasters}/${encDailyTripLog}`, nameKey: "admin.nav.daily_trip_log", parentNameKey: "admin.nav.schedule_operations" },

    // ── Reports > Schedule Reports ──
    { path: `/${encScheduleMasters}/${encDailyWasteComparison}`, nameKey: "Daily Waste Comparison", parentNameKey: "admin.nav.schedule_reports" },
    { path: `/${encScheduleMasters}/${encMonthlyWasteComparison}`, nameKey: "admin.nav.monthly_waste_comparison", parentNameKey: "admin.nav.schedule_reports" },

    // ── Additional audit items (not in sidebar) ──
    { path: `/${encTransportMaster}/${encVehicleTripAudit}`, nameKey: "admin.nav.vehicle_trip_audit", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encTransportMaster}/${encTripExceptionLog}`, nameKey: "admin.nav.trip_exception_log", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encStaffMasters}/${encStaffTemplateAudit}`, nameKey: "admin.nav.staff_template_audit", parentNameKey: "admin.nav.audit_items" },

    // ── Vehicle Tracking (not in sidebar) ──
    { path: `/${encVehicleTracking}/${encVehicleTrack}`, nameKey: "admin.nav.vehicle_tracking", parentNameKey: "admin.nav.vehicle_tracking" },
    { path: `/${encVehicleTracking}/${encVehicleHistory}`, nameKey: "admin.nav.vehicle_history", parentNameKey: "admin.nav.vehicle_tracking" },

    // ── Waste Management (not in sidebar) ──
    { path: `/${encWasteManagementMaster}/${encCollectionMonitoring}`, nameKey: "admin.nav.collection_monitoring", parentNameKey: "admin.nav.waste_management" },
    { path: `/${encWasteManagementMaster}/${encPanchayatBaseCollection}`, nameKey: "admin.nav.panchayat_base_collection", parentNameKey: "admin.nav.waste_management" },

    // ── Workforce Management (not in sidebar) ──
    { path: `/${encWorkforceManagement}/${encWorkforceManagement}`, nameKey: "admin.nav.workforce_management", parentNameKey: "admin.nav.workforce_management" },

    // ── Reports (legacy, not in sidebar) ──
    { path: `/${encReport}/${encTripSummary}`, nameKey: "admin.nav.trip_summary", parentNameKey: "admin.nav.reports" },
    { path: `/${encReport}/${encMonthlyDistance}`, nameKey: "admin.nav.monthly_distance", parentNameKey: "admin.nav.reports" },
    { path: `/${encReport}/${encWasteCollectedSummary}`, nameKey: "admin.nav.waste_collected_summary", parentNameKey: "admin.nav.reports" },
    { path: `/${encReport}/${encMonthlyWasteComparison}`, nameKey: "admin.nav.monthly_waste_comparison", parentNameKey: "admin.nav.reports" },
  ];

  return _cache;
}
