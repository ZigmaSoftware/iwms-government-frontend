// helpers/admin/index.ts
// --------------------------------------------------------------
// Consolidated Admin Services Export (Aligned with adminEndpoints)
// --------------------------------------------------------------

import { adminApi } from "./registry";
export { adminApi } from "./registry";

/* =========================
   COMMON MASTERS
========================= */
export const continentApi = adminApi.continents;
export const countryApi = adminApi.countries;
export const stateApi = adminApi.states;

/* =========================
   MASTERS
========================= */
export const districtApi = adminApi.districts;
export const departmentApi = adminApi.departments;
export const designationApi = adminApi.designations;
export const collectionPointApi = adminApi.collectionPoints;
export const wasteTypeApi = adminApi.wasteTypes;
export const panchayatApi = adminApi.panchayats;
export const panchayatLeaderApi = adminApi.panchayatLeaders;
export const districtLeaderApi = adminApi.districtLeaders;
export const stateLeaderApi = adminApi.stateLeaders;
export const areaTypeApi = adminApi.areatypes;
export const hierarchyApi = adminApi.hierarchies;
export const corporationApi = adminApi.corporations;
export const municipalityApi = adminApi.municipalities;
export const townPanchayatApi = adminApi.townPanchayats;
export const panchayatUnionApi = adminApi.panchayatUnions;

/* =========================
   WASTE TYPES
========================= */
export const propertiesApi = adminApi.properties;
export const subPropertiesApi = adminApi.subProperties;

/* =========================
   ASSETS
========================= */
export const binApi = adminApi.bins;

/* =========================
   SCREEN MANAGEMENT
========================= */
export const mainScreenTypeApi = adminApi.mainScreenTypes;
export const mainScreenApi = adminApi.mainScreens;
export const userScreenApi = adminApi.userScreens;
export const userScreenActionApi = adminApi.userScreenActions;
export const userScreenPermissionApi = adminApi.userScreenPermissions;
export const columnPermissionApi = adminApi.columnPermissions;

/* =========================
   ROLE ASSIGNMENT
========================= */
export const userTypeApi = adminApi.userTypes;
export const staffUserTypeApi = adminApi.staffUserTypes;
export const roleTypesApi = adminApi.roleTypes;
export const contractorUserTypeApi = adminApi.contractorUserTypes;
export const contractorRoleTypesApi = adminApi.contractorRoleTypes;
export const governmentUserTypeApi = adminApi.governmentUserTypes;
export const governmentRoleTypesApi = adminApi.governmentRoleTypes;
export const governmentLevelTypesApi = adminApi.governmentLevelTypes;

/* =========================
   USER CREATION
========================= */
export const userCreationApi = adminApi.usersCreation;
export const staffCreationApi = adminApi.staffCreation;
export const staffAccessConfigurationApi = adminApi.staffAccessConfiguration;
export const staffTemplateApi = adminApi.staffTemplateCreation;
export const alternativeStaffTemplateApi = adminApi.alternativeStaffTemplate;
export const unassignedStaffPoolApi = adminApi.unassignedStaffPool;

/* =========================
   AUTHENTICATION
========================= */
export const loginApi = adminApi.loginUser;

/* =========================
   CUSTOMERS
========================= */
export const customerCreationApi = adminApi.customerCreations;
// NOTE: householdPickupEvents removed — not defined in adminEndpoints
export const wasteCollectionApi = adminApi.wasteCollections;
export const panchayatWiseCollectionApi = adminApi.panchayatWiseCollections;
export const feedbackApi = adminApi.feedbacks;
// export const collectionMonitoringApi = adminApi.pointCollections;

/* =========================
   COMPLAINT TICKETING
========================= */
export const complaintTicketApi = adminApi.complaintTickets;
export const complaintModuleApi = adminApi.complaintModules;
export const complaintCategoryApi = adminApi.complaintCategories;
export const complaintSubcategoryApi = adminApi.complaintSubcategories;
export const complaintPriorityApi = adminApi.complaintPriorities;
export const complaintStatusApi = adminApi.complaintStatuses;
export const complaintSourceApi = adminApi.complaintSources;
export const complaintLanguageApi = adminApi.complaintLanguages;
export const complaintTeamApi = adminApi.complaintTeams;
export const complaintSlaRuleApi = adminApi.complaintSlaRules;
export const complaintRoutingRuleApi = adminApi.complaintRoutingRules;
export const complaintFeedbackApi = adminApi.complaintFeedback;

/* =========================
   TRANSPORT MASTERS
========================= */
export const vehicleTypeApi = adminApi.vehicleTypes;
export const vehicleCreationApi = adminApi.vehicleCreations;
export const tripPlanApi = adminApi.tripPlans;
export const tripAttendanceApi = adminApi.tripAttendances;
export const fuelApi = adminApi.fuels;
export const dailyTripAssignmentApi = adminApi.dailyTripAssignment;
export const dailyTripLogApi = adminApi.dailyTripLog;
export const dailyTripCollectionPointApi = adminApi.dailyTripCollectionPoint;
export const dailyTripHouseholdCollectionApi = adminApi.dailyTripHouseholdCollection;
export const binCollectionEventApi = adminApi.binCollectionEvent;
export const vehicleBreakdownApi = adminApi.vehicleBreakdown;
export const dailyWasteComparisonApi = adminApi.dailyWasteComparison;

/* =========================
   AUDITS
========================= */
export const vehicleTripAuditApi = adminApi.vehicleTripAudits;
export const tripExceptionLogApi = adminApi.tripExceptionLogs;
export const binLoadLogApi = adminApi.binLoadLogs;
export const staffTemplateAuditLogApi = adminApi.staffTemplateAuditLogs;
export const commonAuditApi = adminApi.commonAudits;
export const staffAuditApi = adminApi.staffAudits;
export const monthlyWasteComparisonApi = adminApi.monthlyWasteComparison;

/* =========================
   UTILITIES
========================= */
export * from "./endpoints";
export * from "./crudHelpers";
