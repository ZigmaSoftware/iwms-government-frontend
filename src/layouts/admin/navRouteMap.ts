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
    encCollectionPoints,
    encWasteTypes,
    encProperties,
    encSubProperties,
    encStaffCreation,
    encStaffAccessConfiguration,
    encAdmins,
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
    encTripPlans,
    encVehicleTripAudit,
    encTripExceptionLog,
    encCompanyCreation,
    encProjectCreation,
    encSuperAdminMaster,
    encHierarchyTree,
    encHierarchyLevels,
    encHierarchyNode,
    encHierarchyAssign,
    encBins,
    encScheduleMasters,
    encTripPlanCollectionPoints,
    encDailyTripAssignment,
    encDailyTripCollectionPoint,
    encDailyTripTracking,
    encBinCollectionEvent,
    encDailyTripLog,
    encDailyWasteComparison,
  } = getEncryptedRoute();

  _cache = [
    { path: "/admin", nameKey: "admin.nav.dashboard" },
    { path: `/${encAttendance}/${encAttendance}`, nameKey: "admin.nav.attendance" },
    // SuperAdmin Masters
    { path: `/${encSuperAdminMaster}/${encCompanyCreation}`, nameKey: "admin.nav.company", parentNameKey: "admin.nav.superAdmin_masters" },
    { path: `/${encSuperAdminMaster}/${encProjectCreation}`, nameKey: "admin.nav.project", parentNameKey: "admin.nav.superAdmin_masters" },
    // Masters — CRT hierarchy order (SWM Rules 2026)
    // Org / Department Setup
    { path: `/${encMasters}/${encDepartments}`, nameKey: "admin.nav.department", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encDesignations}`, nameKey: "admin.nav.designation", parentNameKey: "admin.nav.masters" },
    // Administrative / Geographic Hierarchy
    { path: `/${encMasters}/${encHierarchyLevels}`, nameKey: "admin.nav.hierarchy_levels", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encHierarchyTree}`, nameKey: "admin.nav.hierarchy_tree", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encHierarchyNode}`, nameKey: "admin.nav.hierarchy_node", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encHierarchyAssign}`, nameKey: "admin.nav.hierarchy_assign", parentNameKey: "admin.nav.masters" },
    // Waste Types
    { path: `/${encMasters}/${encProperties}`, nameKey: "admin.nav.property", parentNameKey: "admin.nav.wastetype" },
    { path: `/${encMasters}/${encSubProperties}`, nameKey: "admin.nav.sub_property", parentNameKey: "admin.nav.wastetype" },
    // Assets
    { path: `/${encMasters}/${encCollectionPoints}`, nameKey: "admin.nav.collection_point", parentNameKey: "admin.nav.assets" },
    { path: `/${encMasters}/${encWasteTypes}`, nameKey: "common.waste_type", parentNameKey: "admin.nav.assets" },
    { path: `/${encMasters}/${encBins}`, nameKey: "common.bins", parentNameKey: "admin.nav.assets" },
    // Screen Managements
    { path: `/${encAdmins}/${encMainScreenType}`, nameKey: "admin.nav.main_screen_type", parentNameKey: "admin.nav.screenManagements" },
    { path: `/${encAdmins}/${encMainScreen}`, nameKey: "admin.nav.main_screen", parentNameKey: "admin.nav.screenManagements" },
    { path: `/${encAdmins}/${encUserScreen}`, nameKey: "admin.nav.user_screen", parentNameKey: "admin.nav.screenManagements" },
    { path: `/${encAdmins}/${encUserScreenAction}`, nameKey: "admin.nav.user_screen_action", parentNameKey: "admin.nav.screenManagements" },
    { path: `/${encAdmins}/${encUserScreenPermission}`, nameKey: "admin.nav.user_screen_permission", parentNameKey: "admin.nav.screenManagements" },
    // Role Assigns
    { path: `/${encAdmins}/${encUserType}`, nameKey: "admin.nav.user_type", parentNameKey: "admin.nav.roleAssigns" },
    { path: `/${encAdmins}/${encStaffUserType}`, nameKey: "admin.nav.staff_user_type", parentNameKey: "admin.nav.roleAssigns" },
    // User Creations
    { path: `/${encStaffMasters}/${encStaffCreation}`, nameKey: "admin.nav.staff_creation", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encStaffAccessConfiguration}`, nameKey: "admin.nav.staff_access_configuration", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encStaffTemplate}`, nameKey: "admin.nav.staff_template", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encAlternativeStaffTemplate}`, nameKey: "admin.nav.alternative_staff_template", parentNameKey: "admin.nav.user_creations" },
    // Process Items
    // Customer Masters
    { path: `/${encCustomerMaster}/${encCustomerCreation}`, nameKey: "admin.nav.customer_creation", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encCustomerMaster}/${encApartmentList}`, nameKey: "admin.nav.apartment_list", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encScheduleMasters}/${encWasteCollectedData}`, nameKey: "admin.nav.waste_collected_data", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encComplaintTicket}/${encFeedback}`, nameKey: "admin.nav.feedback", parentNameKey: "admin.nav.complaint_ticket" },
    // Complaint Ticketing
    { path: `/${encComplaintTicket}/${encComplaint}`, nameKey: "admin.nav.complaint_tickets", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintModules}`, nameKey: "admin.nav.modules", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintCategories}`, nameKey: "admin.nav.categories", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintSubcategories}`, nameKey: "admin.nav.subcategories", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintPriorities}`, nameKey: "admin.nav.priorities", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintStatuses}`, nameKey: "admin.nav.statuses", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintSources}`, nameKey: "admin.nav.sources", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintTeams}`, nameKey: "admin.nav.teams", parentNameKey: "admin.nav.complaint_ticket" },
    { path: `/${encComplaintTicket}/${encComplaintSlaRules}`, nameKey: "admin.nav.sla_rules", parentNameKey: "admin.nav.complaint_ticket" },
    // Transport Masters
    { path: `/${encTransportMaster}/${encVehicleType}`, nameKey: "admin.nav.vehicle_type", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encVehicleCreation}`, nameKey: "admin.nav.vehicle_creation", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encTripPlans}`, nameKey: "admin.nav.trip_plans", parentNameKey: "admin.nav.transport_masters" },
    { path: `/${encTransportMaster}/${encFuel}`, nameKey: "admin.nav.fuel", parentNameKey: "admin.nav.transport_masters" },
    // Schedule Masters
    { path: `/${encScheduleMasters}/${encStaffTemplate}`, nameKey: "admin.nav.staff_template", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encAlternativeStaffTemplate}`, nameKey: "admin.nav.alternative_staff_template", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encCollectionPoints}`, nameKey: "admin.nav.collection_point", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encTripPlans}`, nameKey: "admin.nav.trip_plans", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encTripPlanCollectionPoints}`, nameKey: "admin.nav.trip_plan_collection_points", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encDailyTripAssignment}`, nameKey: "admin.nav.daily_trip_assignment", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encDailyTripCollectionPoint}`, nameKey: "admin.nav.daily_trip_collection_point", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encDailyTripTracking}`, nameKey: "admin.nav.daily_trip_tracking", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encBinCollectionEvent}`, nameKey: "admin.nav.bin_collection_event", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encDailyTripLog}`, nameKey: "admin.nav.daily_trip_log", parentNameKey: "admin.nav.schedule_masters" },
    { path: `/${encScheduleMasters}/${encDailyWasteComparison}`, nameKey: "Daily Waste Comparison", parentNameKey: "admin.nav.schedule_masters" },
    // Audits
    { path: `/${encAudits}/${encCommonAudit}`, nameKey: "admin.nav.common_audit", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encTransportMaster}/${encVehicleTripAudit}`, nameKey: "admin.nav.vehicle_trip_audit", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encTransportMaster}/${encTripExceptionLog}`, nameKey: "admin.nav.trip_exception_log", parentNameKey: "admin.nav.audit_items" },
    { path: `/${encStaffMasters}/${encStaffTemplateAudit}`, nameKey: "admin.nav.staff_template_audit", parentNameKey: "admin.nav.audit_items" },
    // Vehicle Tracking
    { path: `/${encVehicleTracking}/${encVehicleTrack}`, nameKey: "admin.nav.vehicle_tracking", parentNameKey: "admin.nav.vehicle_tracking" },
    { path: `/${encVehicleTracking}/${encVehicleHistory}`, nameKey: "admin.nav.vehicle_history", parentNameKey: "admin.nav.vehicle_tracking" },
    // Waste Management
    { path: `/${encWasteManagementMaster}/${encCollectionMonitoring}`, nameKey: "admin.nav.collection_monitoring", parentNameKey: "admin.nav.waste_management" },
    { path: `/${encWasteManagementMaster}/${encPanchayatBaseCollection}`, nameKey: "admin.nav.panchayat_base_collection", parentNameKey: "admin.nav.waste_management" },
    // Workforce Management
    { path: `/${encWorkforceManagement}/${encWorkforceManagement}`, nameKey: "admin.nav.workforce_management", parentNameKey: "admin.nav.workforce_management" },
    // Reports
    { path: `/${encReport}/${encTripSummary}`, nameKey: "admin.nav.trip_summary", parentNameKey: "admin.nav.reports" },
    { path: `/${encReport}/${encMonthlyDistance}`, nameKey: "admin.nav.monthly_distance", parentNameKey: "admin.nav.reports" },
    { path: `/${encReport}/${encWasteCollectedSummary}`, nameKey: "admin.nav.waste_collected_summary", parentNameKey: "admin.nav.reports" },
    { path: `/${encReport}/${encMonthlyWasteComparison}`, nameKey: "admin.nav.monthly_waste_comparison", parentNameKey: "admin.nav.reports" },
  ];

  return _cache;
}
