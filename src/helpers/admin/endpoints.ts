/* --------------------------------------------------------
   Admin endpoint registry (Grouped)
-------------------------------------------------------- */
export const adminEndpoints = {

  /* =========================
     SUPERADMIN
  ========================= */
  companies: "superadmin/company",
  projects: "superadmin/project",

  /* =========================
     AUTHENTICATION
  ========================= */
  loginUser: "login/login-user",
  userpermission: "login/my-permissions",

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
  cities: "masters/cities",
  zones: "masters/zones",
  wards: "masters/wards",
  departments: "masters/departments",
  designations: "masters/designations",
  panchayats: "masters/panchayat",
  panchayatLeaders: "masters/panchayat-leaders",
  areatypes: "masters/areatypes",
  hierarchies: "masters/hierarchy",
  municipalities: "masters/municipalities",
  townPanchayats: "masters/town-panchayats",
  blockPanchayatUnions: "masters/block-panchayat-unions",

  /* =========================
     WASTE TYPES
  ========================= */
  properties: "waste-types/properties",
  subProperties: "waste-types/subproperties",

  /* =========================
     ASSETS
  ========================= */
  wasteTypes: "assets/waste-types",
  bins: "assets/bins",

  /* =========================
     SCHEDULE MASTERS
  ========================= */
  collectionPoints: "schedule-masters/collection-points",
  staffTemplateCreation: "schedule-masters/staff-templates",
  alternativeStaffTemplate: "schedule-masters/alternative-staff-templates",
  tripPlans: "schedule-masters/trip-plans",
  tripPlanCollectionPoints: "schedule-masters/trip-plan-collection-points",
  dailyTripAssignment: "schedule-masters/daily-trip-assignments",
  dailyTripLog: "schedule-masters/daily-trip-logs",
  dailyTripCollectionPoint: "schedule-masters/daily-trip-collection-points",
  dailyTripHouseholdCollection: "schedule-masters/daily-trip-household-collections",
  binCollectionEvent: "schedule-masters/bin-collection-events",
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

  /* =========================
     ROLE ASSIGNMENT
  ========================= */
  userTypes: "role-assigns/user-type",
  staffUserTypes: "role-assigns/staffusertypes",
  roleTypes: "role-assigns/staffusertypes/role-choices",
  contractorUserTypes: "role-assigns/contractorusertypes",
  contractorRoleTypes: "role-assigns/contractorusertypes/role-choices",

  /* =========================
     USER CREATION
  ========================= */
  usersCreation: "user-creations/users-creation",
  staffCreation: "user-creations/staffcreation",
  supervisorZoneMap: "user-creations/supervisor-zone-map",
  unassignedStaffPool: "user-creations/unassigned-staff-pool",

  /* =========================
     PROCESS
  ========================= */
  zonePropertyLoadTrackers: "process-items/zone-property-load-tracker",

  /* =========================
     CUSTOMERS
  ========================= */
  customerCreations: "customer-masters/customercreations",
  wasteCollections: "customer-masters/wastecollections",
  feedbacks: "customer-masters/feedbacks",

  /* =========================
     COLLECTIONS
  ========================= */
  panchayatWiseCollections: "collections/panchayat-wise",
  wardWiseCollections: "collections/ward-wise",

  /* =========================
     GRIEVANCES
  ========================= */
  complaints: "grivences/complaints",
  mainCategory: "grivences/main-category",
  subCategory: "grivences/sub-category",

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
  supervisorZoneAccessAudits: "audits/supervisor-zone-access-audit",
  staffTemplateAuditLogs: "audits/stafftemplate-audit-log",
   loginAudits: "audits/login-audit",
   commonAudits: "audits/common-audit",
} as const;

export type AdminEntity = keyof typeof adminEndpoints;

export const getAdminEndpointPath = (
  entity: AdminEntity
): string => {
  const path = adminEndpoints[entity];
  return path.startsWith("/") ? path : `/${path}`;
};
