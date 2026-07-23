/* --------------------------------------------------------
   Admin endpoint registry (Grouped)
-------------------------------------------------------- */
export const adminEndpoints = {

  /* =========================
     AUTHENTICATION
  ========================= */
  loginUser: "login/login-user",
  userpermission: "login/my-permissions",

  /* =========================
     SUPERADMIN
  ========================= */
  companyCreation: "superadmin-masters/company-creation",
  projectCreation: "superadmin-masters/project-creation",

  /* =========================
     COMMON MASTERS
  ========================= */
  continents: "common-masters/continents",
  countries: "common-masters/countries",
  states: "common-masters/states",

  /* =========================
     MASTERS
  ========================= */
  districts: "masters/districts",
  departments: "masters/departments",
  designations: "masters/designations",
  panchayats: "masters/panchayat",
  panchayatLeaders: "masters/panchayat-leaders",
  districtLeaders: "masters/district-leaders",
  stateLeaders: "masters/state-leaders",
  areatypes: "masters/areatypes",
  hierarchies: "masters/hierarchy",
  corporations: "masters/corporations",
  municipalities: "masters/municipalities",
  townPanchayats: "masters/town-panchayats",
  panchayatUnions: "masters/panchayat-unions",
  wards: "masters/wards",

  /* =========================
     WASTE TYPES
  ========================= */
  properties: "waste-types/properties",
  subProperties: "waste-types/subproperties",

  /* =========================
     ASSETS
  ========================= */
  wasteTypes: "waste-types/wastetypes",
  bins: "waste-types/bins",

  /* =========================
     SCHEDULE MASTERS
  ========================= */
  collectionPoints: "schedule-setup/collection-points",
  staffTemplateCreation: "schedule-setup/staff-templates",
  alternativeStaffTemplate: "schedule-setup/alternative-staff-templates",
  tripPlans: "schedule-setup/trip-plans",
  dailyTripAssignment: "schedule-operations/daily-trip-assignments",
  dailyTripLog: "schedule-operations/daily-trip-logs",
  dailyTripCollectionPoint: "schedule-operations/daily-trip-collection-points",
  dailyTripHouseholdCollection: "schedule-operations/daily-trip-household-collections",
  binCollectionEvent: "schedule-operations/bin-collection-events",
  vehicleBreakdown: "schedule-operations/vehicle-breakdowns",
  schedulerConfig: "schedule-operations/daily-trip-assignments/scheduler-config/",
  dailyWasteComparison: "schedule-masters/daily-waste-comparisons",
  monthlyWasteComparison: "schedule-masters/monthly-waste-comparison",

  /* =========================
     SCREEN MANAGEMENT
  ========================= */
  mainScreenTypes: "screen-managements/mainscreentype",
  mainScreens: "screen-managements/mainscreens",
  userScreens: "screen-managements/userscreens",
  userScreenActions: "screen-managements/userscreen-action",
  userScreenPermissions: "screen-managements/userscreenpermissions",
  companyWiseScreenPermissions: "screen-managements/userscreenpermissions",
  columnPermissions: "screen-managements/column-permissions",
  dashboardWidgetPermissions: "screen-managements/dashboard-widget-permissions",

  /* =========================
     ROLE ASSIGNMENT
  ========================= */
  userTypes: "role-assigns/user-type",
  staffUserTypes: "role-assigns/staffusertypes",
  roleTypes: "role-assigns/staffusertypes/role-choices",
  contractorUserTypes: "role-assigns/contractorusertypes",
  contractorRoleTypes: "role-assigns/contractorusertypes/role-choices",
  governmentUserTypes: "role-assigns/governmentusertypes",
  governmentRoleTypes: "role-assigns/governmentusertypes/role-choices",
  governmentLevelTypes: "role-assigns/governmentusertypes/level-choices",

  /* =========================
     USER CREATION
  ========================= */
  usersCreation: "user-creations/users-creation",
  staffCreation: "user-creations/staffcreation",
  staffAccessConfiguration: "user-creations/staff-access-configuration",
  unassignedStaffPool: "user-creations/unassigned-staff-pool",

  /* =========================
     CUSTOMERS
  ========================= */
  customerCreations: "customer-masters/customercreations",
  wasteCollections: "schedule-operations/wastecollections",
  feedbacks: "customer-masters/feedbacks",

  /* =========================
     COLLECTIONS
  ========================= */
  panchayatWiseCollections: "collections/panchayat-wise",

  /* =========================
     COMPLAINT TICKETING
  ========================= */
  complaintTickets: "complaint-ticket/tickets",
  complaintModules: "complaint-ticket/modules",
  complaintCategories: "complaint-ticket/categories",
  complaintSubcategories: "complaint-ticket/subcategories",
  complaintPriorities: "complaint-ticket/priorities",
  complaintStatuses: "complaint-ticket/statuses",
  complaintSources: "complaint-ticket/sources",
  complaintLanguages: "complaint-ticket/languages",
  complaintTeams: "complaint-ticket/teams",
  complaintSlaRules: "complaint-ticket/sla-rules",
  complaintRoutingRules: "complaint-ticket/routing-rules",
  complaintFeedback: "complaint-ticket/feedback",
  complaintReopenHistory: "complaint-ticket/reopen-history",
  complaintAddressChange: "complaint-ticket/address-change",
  complaintNotifications: "complaint-ticket/notifications",

  /* =========================
     TRANSPORT MASTERS
  ========================= */
  vehicleTypes: "transport-masters/vehicle-type",
  vehicleCreations: "transport-masters/vehicle-creation",
  tripAttendances: "transport-masters/trip-attendance",
  fuels: "transport-masters/fuels",

  /* =========================
     AUDITS
  ========================= */
  vehicleTripAudits: "audits/vehicle-trip-audit",
  tripExceptionLogs: "audits/trip-exception-log",
  binLoadLogs: "audits/bin-load-log",
  staffTemplateAuditLogs: "audits/stafftemplate-audit-log",
   loginAudits: "audits/login-audit",
   commonAudits: "audits/common-audit",
   staffAudits: "audits/staff-audit",
} as const;

export type AdminEntity = keyof typeof adminEndpoints;

export const getAdminEndpointPath = (
  entity: AdminEntity
): string => {
  const path = adminEndpoints[entity];
  return path.startsWith("/") ? path : `/${path}`;
};
