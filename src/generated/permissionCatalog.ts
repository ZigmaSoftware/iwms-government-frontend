// AUTO-GENERATED — do not edit by hand.
// Source:     iwms-government-backend/app/utils/permission_catalog.py
// Regenerate: cd iwms-government-backend && python manage.py sync_permission_catalog
//
// The one list of permission modules and screens, shared with the backend
// seeder and ModulePermissionMiddleware. Sidebar entries name their
// permission through `permissionFor`, so a module/screen that does not exist
// in the backend catalog is a TypeScript error.

export const PERMISSION_CATALOG = {
  "dashboard": {
    label: "Dashboard",
    section: "dashboard",
    screens: {
      "dashboard": { label: "Dashboard" },
    },
  },
  "screen-management": {
    label: "Screen Management",
    section: "super-admin",
    screens: {
      "mainscreen-type": { label: "MainScreen Type" },
      "mainscreen": { label: "MainScreen" },
      "user-screen": { label: "User Screen" },
      "userscreen-action": { label: "UserScreen Action" },
      "user-screen-permission": { label: "User Screen Permission" },
      "app-modules": { label: "App Modules" },
    },
  },
  "role-management": {
    label: "Role Management",
    section: "super-admin",
    screens: {
      "user-type": { label: "User Type" },
      "staff-user-type": { label: "Staff User Type" },
      "staff-hierarchy": { label: "Staff Hierarchy" },
    },
  },
  "staff-management": {
    label: "Staff Management",
    section: "super-admin",
    screens: {
      "staff-creation": { label: "Staff Creation" },
      "staff-access-configuration": { label: "Staff Access Configuration" },
      "staff-access-dashboard": { label: "Staff Access Dashboard" },
    },
  },
  "common-masters": {
    label: "Common Masters",
    section: "super-admin",
    screens: {
      "continent": { label: "Continent" },
      "country": { label: "Country" },
      "state": { label: "State" },
    },
  },
  "audits": {
    label: "Audits",
    section: "super-admin",
    screens: {
      "audit-dashboard": { label: "Audit Dashboard" },
      "common-audit": { label: "Common Audit" },
      "login-audit": { label: "Login Audit" },
      "user-access-audit": { label: "User Access Audit" },
      "complaint-audit": { label: "Complaint Audit" },
    },
  },
  "location-masters": {
    label: "Location Masters",
    section: "masters",
    screens: {
      "district": { label: "District" },
      "area-type": { label: "Area Type" },
      "corporation": { label: "Corporation" },
      "municipality": { label: "Municipality" },
      "town-panchayat": { label: "Town Panchayat" },
      "panchayat-union": { label: "Panchayat Union" },
      "plb": { label: "PLB (Participating Local Bodies)" },
      "ward": { label: "Ward" },
    },
  },
  "waste-masters": {
    label: "Waste Masters",
    section: "masters",
    screens: {
      "waste-type": { label: "Waste Type" },
      "property": { label: "Property" },
      "subproperty": { label: "SubProperty" },
      "bin-creation": { label: "Bin Creation" },
    },
  },
  "transport-masters": {
    label: "Transport Masters",
    section: "masters",
    screens: {
      "vehicle-type": { label: "Vehicle Type" },
      "vehicle-creation": { label: "Vehicle Creation" },
      "fuel": { label: "Fuel" },
    },
  },
  "customer-masters": {
    label: "Customer Masters",
    section: "masters",
    screens: {
      "customer-creation": { label: "Customer Creation" },
      "apartment-list": { label: "Apartment List" },
      "customer-access-configuration": { label: "Customer Access Configuration" },
    },
  },
  "leader-management": {
    label: "Leader Management",
    section: "masters",
    screens: {
      "plb-leader-creation": { label: "PLB Leader Creation" },
      "district-leader-creation": { label: "District Leader Creation" },
      "state-leader-creation": { label: "State Leader Creation" },
    },
  },
  "schedule-setup": {
    label: "Schedule Setup",
    section: "core-modules",
    screens: {
      "staff-template": { label: "Staff Template" },
      "alternative-staff-template": { label: "Alternative Staff Template" },
      "collection-point": { label: "Collection Point" },
      "trip-plans": { label: "Trip Plans" },
    },
  },
  "daily-operations": {
    label: "Daily Operations",
    section: "core-modules",
    screens: {
      "daily-trip-plan": { label: "Daily Trip Plan" },
      "daily-trip-tracking": { label: "Daily Trip Tracking" },
      "secondary-bin-collection-event": { label: "Secondary Bin Collection Event" },
      "household-collection-event": { label: "Household Collection Event" },
      "vehicle-breakdown": { label: "Vehicle Breakdown" },
      "re-trip-requests": { label: "Re-Trip Requests" },
      "daily-trip-logs": { label: "Daily Trip Logs" },
      "staff-notifications": { label: "Staff Notifications (Mobile App)" },
    },
  },
  "complaint-management": {
    label: "Complaint Management",
    section: "core-modules",
    screens: {
      "complaint-tickets": { label: "Complaint Tickets" },
      "my-tasks": { label: "My Tasks" },
      "reference-data": { label: "Reference Data" },
      "categories": { label: "Categories" },
      "sla-rules": { label: "SLA Rules" },
    },
  },
  "attendance": {
    label: "Attendance",
    section: "core-modules",
    screens: {
      "attendance": { label: "Attendance" },
    },
  },
  "waste-reports": {
    label: "Waste Reports",
    section: "reports",
    screens: {
      "daily-waste-comparison": { label: "Daily Waste Comparison" },
      "monthly-waste-comparison": { label: "Monthly Waste Comparison" },
    },
  },
  "complaint-reports": {
    label: "Complaint Reports",
    section: "reports",
    screens: {
      "complaints-report": { label: "Complaints Report" },
    },
  },
} as const;

// Names used before every module/screen was named after the sidebar,
// still found in older audit records: old name -> current name.
export const LEGACY_MODULE_NAMES: Record<string, string> = {
  "screen-managements": "screen-management",
  "role-assigns": "role-management",
  "user-creations": "staff-management",
  "masters": "location-masters",
  "waste-types": "waste-masters",
  "customers": "customer-masters",
  "leader-login": "leader-management",
  "schedule-operations": "daily-operations",
  "complaint-ticket": "complaint-management",
  "schedule-masters": "waste-reports",
};

export const LEGACY_SCREEN_NAMES: Record<string, string> = {
  "Dashboard": "dashboard",
  "mainscreentype": "mainscreen-type",
  "mainscreens": "mainscreen",
  "userscreens": "user-screen",
  "userscreenpermissions": "user-screen-permission",
  "staffcreation": "staff-creation",
  "continents": "continent",
  "countries": "country",
  "states": "state",
  "permission-audit": "user-access-audit",
  "districts": "district",
  "area-types": "area-type",
  "corporations": "corporation",
  "municipalities": "municipality",
  "town-panchayats": "town-panchayat",
  "panchayat-unions": "panchayat-union",
  "panchayats": "plb",
  "wards": "ward",
  "wastetypes": "waste-type",
  "properties": "property",
  "subproperties": "subproperty",
  "bins": "bin-creation",
  "fuels": "fuel",
  "customercreations": "customer-creation",
  "staff-templates": "staff-template",
  "alternative-staff-templates": "alternative-staff-template",
  "collection-points": "collection-point",
  "daily-trip-plans": "daily-trip-plan",
  "daily-trip-assignments": "daily-trip-plan",
  "daily-trip-collection-points": "daily-trip-plan",
  "secondary-bin-collection-events": "secondary-bin-collection-event",
  "householdcollection-events": "household-collection-event",
  "vehicle-breakdowns": "vehicle-breakdown",
  "retrip-requests": "re-trip-requests",
  "tickets": "complaint-tickets",
  "modules": "reference-data",
  "priorities": "reference-data",
  "sources": "reference-data",
  "statuses": "reference-data",
  "subcategories": "categories",
  "daily-waste-comparisons": "daily-waste-comparison",
  "MonthlyWasteComparison": "monthly-waste-comparison",
};

export type PermissionModule = keyof typeof PERMISSION_CATALOG;

export type PermissionScreen<M extends PermissionModule> =
  keyof (typeof PERMISSION_CATALOG)[M]["screens"] & string;

/** The permission a sidebar entry checks: one module, one or more screens. */
export const permissionFor = <M extends PermissionModule>(
  module: M,
  ...screens: [PermissionScreen<M>, ...PermissionScreen<M>[]]
): { module: M; screens: string[] } => ({ module, screens });
