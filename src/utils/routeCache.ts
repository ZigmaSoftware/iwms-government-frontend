import { encryptSegment } from "./routeCrypto";

export type EncryptedRoutes = {
  encAttendance: string;
  encAdmins: string;
  encAudits: string;
  encComplaintTicket: string;
  encCollectionMonitoring: string;
  encPanchayatBaseCollection: string;
  encComplaint: string;
  encComplaintModules: string;
  encComplaintCategories: string;
  encComplaintSubcategories: string;
  encComplaintFeedback: string;
  encComplaintMasters: string;
  encComplaintPriorities: string;
  encComplaintStatuses: string;
  encComplaintSources: string;
  encComplaintTeams: string;
  encComplaintSlaRules: string;
  encContinents: string;
  encCountries: string;
  encBins: string;
  encDepartments: string;
  encDesignations: string;
  encCustomerCreation: string;
  encApartmentList: string;
  encCustomerMaster: string;
  encDistricts: string;
  encFeedback: string;
  encFuel: string;
  encMasters: string;
  encStaffMasters: string;
  encScheduleMasters: string;
  encStaffTemplate: string;
  encAlternativeStaffTemplate: string;
  encStaffTemplateAudit: string;
  encMonthlyDistance: string;
  encProperties: string;
  encReport: string;
  encStaffCreation: string;
  encStaffUserType: string;
  encStates: string;
  encSubProperties: string;
  encTripSummary: string;
  encUserCreation: string;
  encUserScreenPermission: string;

  encUserType: string;
  encVehicleCreation: string;
  encVehicleHistory: string;
  encVehicleTrack: string;
  encVehicleTracking: string;
  encVehicleType: string;
  encWasteCollectedData: string;
  encWasteCollectedSummary: string;
  encMonthlyWasteComparison: string;
  encWasteManagementMaster: string;
  encCollectionPoints: string;
  encWasteTypes: string;
  encDateReport: string;
  encDayReport: string;
  encWorkforceManagement: string;
  encTransportMaster: string;
  encMainScreenType: string;
  encUserScreenAction: string;
  encMainScreen: string;
  encUserScreen: string;
  encTripPlans: string;
  encTripPlanCollectionPoints: string;
  encDailyTripAssignment: string;
  encDailyTripCollectionPoint: string;
  encDailyTripHouseholdCollection: string;
  encDailyTripTracking: string;
  encDailyTripLog: string;
  encBinCollectionEvent: string;
  encDailyWasteComparison: string;
  encBinLoadLog: string;
  encCustomerTag: string;
  encHouseholdPickupEvent: string;
  encUnassignedStaffPool: string;
  encTripAttendance: string;
  encVehicleTripAudit: string;
  encTripExceptionLog: string;

  // dashboard
  encDashboardOverall: string;
  encDashboardLiveMap: string;
  encDashboardVehicleManagement: string;
  encDashboardWasteCollection: string;
  encDashboardResources: string;
  encDashboardGrievances: string;
  encDashboardAlerts: string;
  encDashboardReports: string;
  encDashboardWeighBridge: string;
  encDashboardBins: string;

  encCompanyCreation: string;
  encCommonAudit: string;
  encLoginAudits: string;
  encProjectCreation: string;
  encSuperAdminMaster: string;


  encPanchayats: string;
  encAreaTypes: string;
  encHierarchies: string;
  encHierarchyLevels: string;
  encHierarchyTree: string;
  encHierarchyNode: string;
  encHierarchyAssign: string;
  encPanchayatLeaders: string;
  encLeaderLogin: string;
  encPlbLeaderCreation: string;
  encCorporations: string;
  encMunicipalities: string;
  encTownPanchayats: string;
  encPanchayatUnions: string;
};

const plainRoutes: EncryptedRoutes = {
  encAttendance: "attendance",
  encAdmins: "admins",
  encAudits: "audits",
  encComplaintTicket: "complaint-ticket",
  encCollectionMonitoring: "collection-monitoring",
  encPanchayatBaseCollection: "panchayat-base-collection",
  encComplaint: "complaint",
  encComplaintModules: "modules",
  encComplaintCategories: "categories",
  encComplaintSubcategories: "subcategories",
  encComplaintFeedback: "feedback",
  encComplaintMasters: "masters",
  encComplaintPriorities: "priorities",
  encComplaintStatuses: "statuses",
  encComplaintSources: "sources",
  encComplaintTeams: "teams",
  encComplaintSlaRules: "sla-rules",
  encContinents: "continents",
  encCountries: "countries",
  encBins: "bins",
  encDepartments: "departments",
  encDesignations: "designations",
  encCustomerCreation: "customer-creation",
  encApartmentList: "apartment-list",
  encCustomerMaster: "customer-master",
  encSuperAdminMaster: "superadmin-masters",
  encCompanyCreation: "company-creation",
  encCommonAudit: "common-audit",
  encLoginAudits: "login-audits",
  encProjectCreation: "project-creation",
  encDistricts: "districts",
  encFeedback: "feedback",
  encFuel: "fuel",
  encMasters: "masters",
  encStaffMasters: "staff-masters",
  encScheduleMasters: "schedule-masters",
  encStaffTemplate: "staff-template",
  encAlternativeStaffTemplate: "alternative-staff-template",
  encStaffTemplateAudit: "staff-template-audit",
  encMonthlyDistance: "monthly-distance",
  encProperties: "properties",
  encReport: "reports",
  encStaffCreation: "staff-creation",
  encStaffUserType: "staff-user-type",
  encStates: "states",
  encSubProperties: "sub-properties",
  encTripSummary: "trip-summary",
  encUserCreation: "user-creation",

  encUserType: "user-type",
  encVehicleCreation: "vehicle-creation",
  encVehicleHistory: "vehicle-history",
  encVehicleTrack: "vehicle-track",
  encVehicleTracking: "vehicle-tracking",
  encVehicleType: "vehicle-type",
  encWasteCollectedData: "waste-collected-data",
  encWasteCollectedSummary: "waste-collected-summary",
  encMonthlyWasteComparison: "monthly-waste-comparison",
  encWasteManagementMaster: "waste-management",
  encCollectionPoints: "collection-points",
  encWasteTypes: "waste-types",
  encDateReport: "date-report",
  encDayReport: "day-report",
  encWorkforceManagement: "workforce-management",
  encTransportMaster: "transport-master",
  encMainScreenType: "mainscreen-type",
  encUserScreenAction: "userscreen-action",
  encMainScreen: "mainscreens",
  encUserScreen: "userscreens",
  encUserScreenPermission: "userscreenpermissions",
  encTripPlans: "trip-plans",
  encTripPlanCollectionPoints: "trip-plan-collection-points",
  encDailyTripAssignment: "daily-trip-assignment",
  encDailyTripCollectionPoint: "daily-trip-collection-point",
  encDailyTripHouseholdCollection: "daily-trip-household-collection",
  encDailyTripTracking: "daily-trip-tracking",
  encDailyTripLog: "daily-trip-log",
  encBinCollectionEvent: "bin-collection-event",
  encDailyWasteComparison: "daily-waste-comparisons",
  encBinLoadLog: "bin-load-log",
  encCustomerTag: "customer-tag",
  encHouseholdPickupEvent: "household-pickup-event",
  encUnassignedStaffPool: "unassigned-staff-pool",
  encTripAttendance: "trip-attendance",
  encVehicleTripAudit: "vehicle-trip-audit",
  encTripExceptionLog: "trip-exception-log",

  // palakkad

  encPanchayats: "panchayats",
  encAreaTypes: "area-types",
  encHierarchies: "hierarchies",
  encHierarchyLevels: "hierarchy-levels",
  encHierarchyTree: "hierarchy-tree",
  encHierarchyNode: "hierarchy-node",
  encHierarchyAssign: "hierarchy-assign",
  encPanchayatLeaders: "panchayat-leaders",
  encLeaderLogin: "leader-login",
  encPlbLeaderCreation: "plb-leader-creation",
  encCorporations: "corporations",
  encMunicipalities: "municipalities",
  encTownPanchayats: "town-panchayats",
  encPanchayatUnions: "panchayat-unions",

  //dashboard

  encDashboardOverall: "dashboard-overall",
  encDashboardLiveMap: "dashboard-map",
  encDashboardVehicleManagement: "dashboard-vehicle",
  encDashboardWasteCollection: "dashboard-waste-collection",
  encDashboardResources: "dashboard-resources",
  encDashboardGrievances: "dashboard-grievances",
  encDashboardAlerts: "dashboard-alerts",
  encDashboardReports: "dashboard-reports",
  encDashboardWeighBridge: "dashboard-weighbridge",
  encDashboardBins: "dashboard-bins"

  
};

const encryptRoutes = (routes: EncryptedRoutes): EncryptedRoutes => {
  return Object.fromEntries(
    Object.entries(routes).map(([key, value]) => [key, encryptSegment(value)]),
  ) as EncryptedRoutes;
};

const encryptedDefaults = encryptRoutes(plainRoutes);

export function getEncryptedRoute(
  overrides?: Partial<EncryptedRoutes>,
): EncryptedRoutes {
  if (!overrides || Object.keys(overrides).length === 0) {
    return encryptedDefaults;
  }

  const merged = {
    ...plainRoutes,
    ...overrides,
  };

  return encryptRoutes(merged as EncryptedRoutes);
}
