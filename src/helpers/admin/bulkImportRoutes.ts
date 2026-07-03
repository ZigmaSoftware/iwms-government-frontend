import { decryptSegment } from "@/utils/routeCrypto";
import { adminApi } from "./registry";
import type { AdminEntity } from "./endpoints";
import type { CrudHelpers } from "./crudHelpers";

const routeEntityBySlug: Record<string, AdminEntity> = {
  "company-creation": "companyCreation",
  "project-creation": "projectCreation",
  continents: "continents",
  countries: "countries",
  states: "states",
  districts: "districts",
  panchayats: "panchayats",
  "area-types": "areatypes",
  hierarchies: "hierarchies",
  "panchayat-leaders": "panchayatLeaders",
  departments: "departments",
  designations: "designations",
  properties: "properties",
  "sub-properties": "subProperties",
  "collection-points": "collectionPoints",
  "waste-types": "wasteTypes",
  bins: "bins",
  "mainscreen-type": "mainScreenTypes",
  mainscreens: "mainScreens",
  userscreens: "userScreens",
  "userscreen-action": "userScreenActions",
  userscreenpermissions: "userScreenPermissions",
  "user-type": "userTypes",
  "staff-user-type": "staffUserTypes",
  "staff-creation": "staffCreation",
  "staff-template": "staffTemplateCreation",
  "alternative-staff-template": "alternativeStaffTemplate",
  "customer-creation": "customerCreations",
  "apartment-list": "customerCreations",
  feedback: "feedbacks",
  complaint: "complaintTickets",
  categories: "complaintCategories",
  subcategories: "complaintSubcategories",
  priorities: "complaintPriorities",
  statuses: "complaintStatuses",
  sources: "complaintSources",
  teams: "complaintTeams",
  "vehicle-type": "vehicleTypes",
  "vehicle-creation": "vehicleCreations",
  "trip-plans": "tripPlans",
  fuel: "fuels",
  "trip-plan-collection-points": "tripPlanCollectionPoints",
  "daily-trip-assignment": "dailyTripAssignment",
  "daily-trip-collection-point": "dailyTripCollectionPoint",
  "bin-collection-event": "binCollectionEvent",
  "daily-waste-comparisons": "dailyWasteComparison",
  "waste-collected-data": "wasteCollections",
  "unassigned-staff-pool": "unassignedStaffPool",
  "trip-attendance": "tripAttendances",
  "vehicle-trip-audit": "vehicleTripAudits",
  "trip-exception-log": "tripExceptionLogs",
  "bin-load-log": "binLoadLogs",
};

const readPlainPathSegments = () => {
  if (typeof window === "undefined") return [];

  return window.location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decryptSegment(segment) ?? segment);
};

export const getCurrentAdminBulkImportApi = (): CrudHelpers | null => {
  const segments = readPlainPathSegments();
  const leaf = [...segments].reverse().find((segment) => {
    const normalized = segment.replace(/\/+$/, "");
    return Boolean(routeEntityBySlug[normalized]);
  });

  if (!leaf) return null;
  return adminApi[routeEntityBySlug[leaf.replace(/\/+$/, "")]] ?? null;
};
