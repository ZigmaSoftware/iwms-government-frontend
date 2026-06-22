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
    encContinents,
    encCountries,
    encDepartments,
    encDesignations,
    encStates,
    encDistricts,
    encCollectionPoints,
    encWasteTypes,
    encProperties,
    encSubProperties,
    encStaffCreation,
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
    encCitizenGrivence,
    encComplaint,
    encFeedback,
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
    encMainComplaintCategory,
    encSubComplaintCategory,
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
    encPanchayats,
    encAreaTypes,
    encCorporations,
    encMunicipalities,
    encTownPanchayats,
    encPanchayatUnions,
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
    // Common Masters
    { path: `/${encMasters}/${encContinents}`, nameKey: "admin.nav.continent", parentNameKey: "admin.nav.common_masters" },
    { path: `/${encMasters}/${encCountries}`, nameKey: "admin.nav.country", parentNameKey: "admin.nav.common_masters" },
    { path: `/${encMasters}/${encStates}`, nameKey: "admin.nav.state", parentNameKey: "admin.nav.masters" },
    // Masters — CRT hierarchy order (SWM Rules 2026)
    // Org / Department Setup
    { path: `/${encMasters}/${encDepartments}`, nameKey: "admin.nav.department", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encDesignations}`, nameKey: "admin.nav.designation", parentNameKey: "admin.nav.masters" },
    // Administrative / Geographic Hierarchy
    { path: `/${encMasters}/${encDistricts}`, nameKey: "admin.nav.district", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encAreaTypes}`, nameKey: "admin.nav.area_type", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encCorporations}`, nameKey: "admin.nav.corporation", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encMunicipalities}`, nameKey: "admin.nav.municipality", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encTownPanchayats}`, nameKey: "admin.nav.town_panchayat", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encPanchayatUnions}`, nameKey: "admin.nav.panchayat_union", parentNameKey: "admin.nav.masters" },
    { path: `/${encMasters}/${encPanchayats}`, nameKey: "admin.nav.panchayat", parentNameKey: "admin.nav.masters" },
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
    { path: `/${encStaffMasters}/${encStaffTemplate}`, nameKey: "admin.nav.staff_template", parentNameKey: "admin.nav.user_creations" },
    { path: `/${encStaffMasters}/${encAlternativeStaffTemplate}`, nameKey: "admin.nav.alternative_staff_template", parentNameKey: "admin.nav.user_creations" },
    // Process Items
    // Customer Masters
    { path: `/${encCustomerMaster}/${encCustomerCreation}`, nameKey: "admin.nav.customer_creation", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encCustomerMaster}/${encApartmentList}`, nameKey: "admin.nav.apartment_list", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encWasteManagementMaster}/${encWasteCollectedData}`, nameKey: "admin.nav.waste_collected_data", parentNameKey: "admin.nav.customer_masters" },
    { path: `/${encCitizenGrivence}/${encFeedback}`, nameKey: "admin.nav.feedback", parentNameKey: "admin.nav.customer_masters" },
    // Citizen Grievance
    { path: `/${encCitizenGrivence}/${encComplaint}`, nameKey: "admin.nav.complaints", parentNameKey: "admin.nav.citizen_grievance" },
    { path: `/${encCitizenGrivence}/${encMainComplaintCategory}`, nameKey: "admin.nav.main_category", parentNameKey: "admin.nav.citizen_grievance" },
    { path: `/${encCitizenGrivence}/${encSubComplaintCategory}`, nameKey: "admin.nav.sub_category", parentNameKey: "admin.nav.citizen_grievance" },
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
