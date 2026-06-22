// helpers/admin/index.ts
// --------------------------------------------------------------
// Consolidated Admin Services Export (Aligned with adminEndpoints)
// --------------------------------------------------------------

import { adminApi } from "./registry";
export { adminApi } from "./registry";

/* =========================
   SUPERADMIN
========================= */
export const companyApi = adminApi.companies;
export const projectApi = adminApi.projects;

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
export const staffTemplateApi = adminApi.staffTemplateCreation;
export const alternativeStaffTemplateApi = adminApi.alternativeStaffTemplate;
export const unassignedStaffPoolApi = adminApi.unassignedStaffPool;

/* =========================
   PROCESS
========================= */

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
   GRIEVANCES
========================= */
export const complaintApi = adminApi.complaints;
export const mainCategoryApi = adminApi.mainCategory;
export const subCategoryApi = adminApi.subCategory;

/* =========================
   TRANSPORT MASTERS
========================= */
export const vehicleTypeApi = adminApi.vehicleTypes;
export const vehicleCreationApi = adminApi.vehicleCreations;
export const tripPlanApi = adminApi.tripPlans;
export const tripPlanCollectionPointApi = adminApi.tripPlanCollectionPoints;
export const tripAttendanceApi = adminApi.tripAttendances;
export const fuelApi = adminApi.fuels;
export const dailyTripAssignmentApi = adminApi.dailyTripAssignment;
export const dailyTripLogApi = adminApi.dailyTripLog;
export const dailyTripCollectionPointApi = adminApi.dailyTripCollectionPoint;
export const dailyTripHouseholdCollectionApi = adminApi.dailyTripHouseholdCollection;
export const binCollectionEventApi = adminApi.binCollectionEvent;
export const dailyWasteComparisonApi = adminApi.dailyWasteComparison;

/* =========================
   AUDITS
========================= */
export const vehicleTripAuditApi = adminApi.vehicleTripAudits;
export const tripExceptionLogApi = adminApi.tripExceptionLogs;
export const binLoadLogApi = adminApi.binLoadLogs;
export const staffTemplateAuditLogApi = adminApi.staffTemplateAuditLogs;
export const commonAuditApi = adminApi.commonAudits;
export const monthlyWasteComparisonApi = adminApi.monthlyWasteComparison;

/* =========================
   UTILITIES
========================= */
export * from "./endpoints";
export * from "./crudHelpers";
