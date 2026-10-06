/**
 * The admin sidebar's menu: every entry, its route and the permission that
 * shows it. Kept out of AppSidebar.tsx so the router's permission guard
 * (encryptedRouting/AdminEncryptedRouter.tsx) reads the very same list.
 *
 * Each entry names its permission with permissionFor(module, ...screens),
 * typed against the backend permission catalog
 * (src/generated/permissionCatalog.ts <- iwms-government-backend/app/utils/
 * permission_catalog.py), so a module/screen the backend does not know is a
 * TypeScript error.
 */
import {
  LayoutGrid,
  Settings,
  Layers3,
  Users,
  UserCircle,
  Truck,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  MessageSquareWarning,
} from "lucide-react";

import { permissionFor } from "@/generated/permissionCatalog";
import { getEncryptedRoute } from "@/utils/routeCache";

const {
  encSuperAdmin,
  encRoleManagement,
  encMasters,
  encAttendance,
  encAudits,
  encCollectionPoints,
  encWasteTypes,
  encProperties,
  encSubProperties,
  encStaffCreation,
  encStaffAccessConfiguration,
  encStaffAccessDashboard,
  encUserScreen,
  encUserType,
  encCustomerMaster,
  encCustomerCreation,
  encApartmentList,
  encMonthlyWasteComparison,
  encComplaintTicket,
  encComplaint,
  encComplaintModules,
  encComplaintCategories,
  encMyTasks,
  encComplaintsReport,
  encComplaintSlaRules,
  encTransportMaster,
  encScheduleMasters,
  encScheduleSetup,
  encDailyOperations,
  encWasteMasters,
  encFuel,
  encVehicleCreation,
  encVehicleType,
  encWasteCollectedData,
  encStaffUserType,
  encStaffHierarchy,
  encMainScreenType,
  encUserScreenAction,
  encMainScreen,
  encUserScreenPermission,
  encAppModules,
  encCustomerAccessConfiguration,
  encUserManagement,
  encStaffTemplate,
  encAlternativeStaffTemplate,
  encCommonAudit,
  encPermissionAudit,
  encComplaintAudit,
  encAuditDashboard,
  encTripPlans,
  encVehicleBreakdown,
  encTripRetripRequest,
  encCommonMasters,
  encContinents,
  encCountries,
  encStates,
  encDistricts,
  encAreaTypes,
  encCorporations,
  encMunicipalities,
  encTownPanchayats,
  encPanchayatUnions,
  encPanchayats,
  encWards,
  encBins,
  encDailyTripAssignment,
  encDailyTripLog,
  encDailyTripTracking,
  encBinCollectionEvent,
  encLoginAudits,
  encDailyWasteComparison,
  encLeaderLogin,
  encPlbLeaderCreation,
  encDistrictLeaderCreation,
  encStateLeaderCreation,
} = getEncryptedRoute();

export type SidebarPermission = {
  /** Permission module (MainScreen) the entry is gated by. */
  module?: string;
  /**
   * Screens (UserScreens) that open the entry — any one with "view" will
   * do. Always built with `permissionFor(...)`, so each name is checked
   * against the backend catalog (src/generated/permissionCatalog.ts).
   */
  screens?: string[];
};

export type NavSubItem = SidebarPermission & {
  nameKey: string;
  path: string;
};

export type NavItem = SidebarPermission & {
  nameKey: string;
  icon: React.ReactNode;
  path?: string;
  // A heading with sub-items has no permission of its own: it shows when
  // any of its sub-items does.
  subItems?: NavSubItem[];
};

export type SidebarSectionKey =
  | "main"
  | "attendance"
  | "superadminMaster"
  | "commonMaster"
  | "master"
  | "wasteType"
  | "assets"
  | "screenManagement"
  | "roleAssigns"
  | "userCreations"
  | "processItems"
  | "customerMasters"
  | "complaintTicket"
  | "transportMasters"
  | "scheduleSetup"
  | "scheduleOperations"
  | "scheduleReports"
  | "complaintReports"
  | "auditItems"
  | "wasteManagement"
  | "workforceManagement"
  | "fleetReports"
  | "leaderLogin";

export const MODULE_GROUPS: {
  key: string;
  titleKey: string;
  accent: string;
  sectionKeys: SidebarSectionKey[];
}[] = [
  {
    key: "dashboard",
    titleKey: "admin.nav.group_dashboard",
    accent: "bg-green-500",
    sectionKeys: ["main"],
  },
  {
    key: "super-admin",
    titleKey: "admin.nav.group_super_admin",
    accent: "bg-blue-500",
    sectionKeys: [
      "screenManagement",
      "roleAssigns",
      "userCreations",
      "commonMaster",
      "auditItems",
    ],
  },
  {
    key: "masters",
    titleKey: "admin.nav.group_masters",
    accent: "bg-orange-400",
    sectionKeys: [
      "master",
      "assets",
      "wasteType",
      "transportMasters",
      "customerMasters",
      "leaderLogin",
    ],
  },
  {
    key: "core-modules",
    titleKey: "admin.nav.group_core_modules",
    accent: "bg-green-500",
    sectionKeys: [
      "scheduleSetup",
      "scheduleOperations",
      "complaintTicket",
      "attendance",
    ],
  },
  {
    key: "reports",
    titleKey: "admin.nav.group_reports",
    accent: "bg-blue-500",
    sectionKeys: ["scheduleReports", "complaintReports"],
  },
];

/* =====================
   MENU DEFINITIONS
===================== */

export const navItems: NavItem[] = [
  {
    nameKey: "admin.nav.dashboard",
    icon: <LayoutGrid size={18} />,
    path: "/admin",
    ...permissionFor("dashboard", "dashboard"),
  },
];

export const attendanceItems: NavItem[] = [
  {
    nameKey: "admin.nav.attendance",
    icon: <CalendarCheck size={18} />,
    path: `/${encAttendance}/${encAttendance}`,
    ...permissionFor("attendance", "attendance"),
  },
];



export const masterItems: NavItem[] = [
  {
    nameKey: "admin.nav.location_masters",
    icon: <Layers3 size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.district",
        path: `/${encMasters}/${encDistricts}`,
        ...permissionFor("location-masters", "district"),
      },
      {
        nameKey: "admin.nav.area_type",
        path: `/${encMasters}/${encAreaTypes}`,
        ...permissionFor("location-masters", "area-type"),
      },
      {
        nameKey: "admin.nav.corporation",
        path: `/${encMasters}/${encCorporations}`,
        ...permissionFor("location-masters", "corporation"),
      },
      {
        nameKey: "admin.nav.municipality",
        path: `/${encMasters}/${encMunicipalities}`,
        ...permissionFor("location-masters", "municipality"),
      },
      {
        nameKey: "admin.nav.town_panchayat",
        path: `/${encMasters}/${encTownPanchayats}`,
        ...permissionFor("location-masters", "town-panchayat"),
      },
      {
        nameKey: "admin.nav.panchayat_union",
        path: `/${encMasters}/${encPanchayatUnions}`,
        ...permissionFor("location-masters", "panchayat-union"),
      },
      {
        nameKey: "admin.nav.panchayat",
        path: `/${encMasters}/${encPanchayats}`,
        ...permissionFor("location-masters", "plb"),
      },
      {
        nameKey: "admin.nav.ward",
        path: `/${encMasters}/${encWards}`,
        ...permissionFor("location-masters", "ward"),
      },
    ],
  },
];

export const commonMasterItems: NavItem[] = [
  {
    nameKey: "admin.nav.common_masters",
    icon: <Layers3 size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.continent",
        path: `/${encCommonMasters}/${encContinents}`,
        ...permissionFor("common-masters", "continent"),
      },
      {
        nameKey: "admin.nav.country",
        path: `/${encCommonMasters}/${encCountries}`,
        ...permissionFor("common-masters", "country"),
      },
      {
        nameKey: "admin.nav.state",
        path: `/${encCommonMasters}/${encStates}`,
        ...permissionFor("common-masters", "state"),
      },
    ],
  },
];

export const wasteTypeItems: NavItem[] = [
  {
    nameKey: "admin.nav.waste_masters",
    icon: <Layers3 size={18} />,
    subItems: [
      {
        nameKey: "common.waste_type",
        path: `/${encWasteMasters}/${encWasteTypes}`,
        ...permissionFor("waste-masters", "waste-type"),
      },
      {
        nameKey: "admin.nav.property",
        path: `/${encWasteMasters}/${encProperties}`,
        ...permissionFor("waste-masters", "property"),
      },
      {
        nameKey: "admin.nav.sub_property",
        path: `/${encWasteMasters}/${encSubProperties}`,
        ...permissionFor("waste-masters", "subproperty"),
      },
      {
        nameKey: "admin.nav.bin_creation",
        path: `/${encWasteMasters}/${encBins}`,
        ...permissionFor("waste-masters", "bin-creation"),
      },
    ],
  },
];


export const screenManagementItems: NavItem[] = [
  {
    nameKey: "admin.nav.screen_management",
    icon: <Settings size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.main_screen_type",
        path: `/${encSuperAdmin}/${encMainScreenType}`,
        ...permissionFor("screen-management", "mainscreen-type"),
      },
      {
        nameKey: "admin.nav.main_screen",
        path: `/${encSuperAdmin}/${encMainScreen}`,
        ...permissionFor("screen-management", "mainscreen"),
      },
      {
        nameKey: "admin.nav.user_screen",
        path: `/${encSuperAdmin}/${encUserScreen}`,
        ...permissionFor("screen-management", "user-screen"),
      },
      {
        nameKey: "admin.nav.user_screen_action",
        path: `/${encSuperAdmin}/${encUserScreenAction}`,
        ...permissionFor("screen-management", "userscreen-action"),
      },
      {
        nameKey: "admin.nav.user_screen_permission",
        path: `/${encSuperAdmin}/${encUserScreenPermission}`,
        ...permissionFor("screen-management", "user-screen-permission"),
      },
      {
        nameKey: "admin.nav.app_modules",
        path: `/${encSuperAdmin}/${encAppModules}`,
        ...permissionFor("screen-management", "app-modules"),
      },
    ],
  },
];

export const roleAssignsItems: NavItem[] = [
  {
    nameKey: "admin.nav.role_management",
    icon: <Settings size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.user_type",
        path: `/${encRoleManagement}/${encUserType}`,
        ...permissionFor("role-management", "user-type"),
      },
      {
        nameKey: "admin.nav.staff_user_type",
        path: `/${encRoleManagement}/${encStaffUserType}`,
        ...permissionFor("role-management", "staff-user-type"),
      },
      {
        nameKey: "admin.nav.staff_hierarchy",
        path: `/${encRoleManagement}/${encStaffHierarchy}`,
        ...permissionFor("role-management", "staff-hierarchy"),
      },
    ],
  },
];

export const userCreationMasters: NavItem[] = [
  {
    nameKey: "admin.nav.staff_management",
    icon: <Users size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.staff_creation",
        path: `/${encUserManagement}/${encStaffCreation}`,
        ...permissionFor("staff-management", "staff-creation"),
      },
      {
        nameKey: "admin.nav.staff_access_configuration",
        path: `/${encUserManagement}/${encStaffAccessConfiguration}`,
        ...permissionFor("staff-management", "staff-access-configuration"),
      },
      {
        nameKey: "admin.nav.staff_access_dashboard",
        path: `/${encUserManagement}/${encStaffAccessDashboard}`,
        ...permissionFor("staff-management", "staff-access-dashboard"),
      },
    ],
  },
];

export const customerMasters: NavItem[] = [
  {
    nameKey: "admin.nav.customer_masters",
    icon: <UserCircle size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.customer_creation",
        path: `/${encCustomerMaster}/${encCustomerCreation}`,
        ...permissionFor("customer-masters", "customer-creation"),
      },
      {
        nameKey: "admin.nav.apartment_list",
        path: `/${encCustomerMaster}/${encApartmentList}`,
        ...permissionFor("customer-masters", "apartment-list"),
      },
      {
        nameKey: "admin.nav.customer_access_configuration",
        path: `/${encCustomerMaster}/${encCustomerAccessConfiguration}`,
        ...permissionFor("customer-masters", "customer-access-configuration"),
      },
    ],
  },
];

export const complaintTicketItems: NavItem[] = [
  {
    nameKey: "admin.nav.complaint_management",
    icon: <AlertTriangle size={18} />,
    // 10 sub-items collapsed to 5: Modules/Priorities/Sources/Statuses are now
    // tabs on one "Reference Data" screen, Categories/Subcategories are one
    // master-detail screen, and Feedback (read-only, ticket-scoped) moved
    // into Tickets as a column/filter — see ReferenceDataScreen.tsx,
    // CategoryManagementScreen.tsx and TicketList.tsx. The 10 underlying
    // routes/permissions are unchanged, so `screens` lists every merged
    // screen a staff member might individually hold permission for.
    subItems: [
      {
        nameKey: "admin.nav.complaint_tickets",
        path: `/${encComplaintTicket}/${encComplaint}`,
        ...permissionFor("complaint-management", "complaint-tickets"),
      },
      {
        nameKey: "admin.nav.my_tasks",
        path: `/${encComplaintTicket}/${encMyTasks}`,
        ...permissionFor("complaint-management", "my-tasks"),
      },
      {
        nameKey: "admin.nav.reference_data",
        path: `/${encComplaintTicket}/${encComplaintModules}`,
        ...permissionFor("complaint-management", "reference-data"),
      },
      {
        nameKey: "admin.nav.categories",
        path: `/${encComplaintTicket}/${encComplaintCategories}`,
        ...permissionFor("complaint-management", "categories"),
      },
      {
        nameKey: "admin.nav.sla_rules",
        path: `/${encComplaintTicket}/${encComplaintSlaRules}`,
        ...permissionFor("complaint-management", "sla-rules"),
      },
    ],
  },
];

export const transportMastersItems: NavItem[] = [
  {
    nameKey: "admin.nav.transport_masters",
    icon: <Truck size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.vehicle_type",
        path: `/${encTransportMaster}/${encVehicleType}`,
        ...permissionFor("transport-masters", "vehicle-type"),
      },
      {
        nameKey: "admin.nav.vehicle_creation",
        path: `/${encTransportMaster}/${encVehicleCreation}`,
        ...permissionFor("transport-masters", "vehicle-creation"),
      },
      {
        nameKey: "admin.nav.fuel",
        path: `/${encTransportMaster}/${encFuel}`,
        ...permissionFor("transport-masters", "fuel"),
      },
    ],
  },
];

// ── Schedule Setup: planning / configuration ────────────────────────────────
export const scheduleSetupItems: NavItem[] = [
  {
    nameKey: "admin.nav.schedule_setup",
    icon: <LayoutGrid size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.staff_template",
        path: `/${encScheduleSetup}/${encStaffTemplate}`,
        ...permissionFor("schedule-setup", "staff-template"),
      },
      {
        nameKey: "admin.nav.alternative_staff_template",
        path: `/${encScheduleSetup}/${encAlternativeStaffTemplate}`,
        ...permissionFor("schedule-setup", "alternative-staff-template"),
      },
      {
        nameKey: "admin.nav.collection_point",
        path: `/${encScheduleSetup}/${encCollectionPoints}`,
        ...permissionFor("schedule-setup", "collection-point"),
      },
      {
        nameKey: "admin.nav.trip_plans",
        path: `/${encScheduleSetup}/${encTripPlans}`,
        ...permissionFor("schedule-setup", "trip-plans"),
      }
    ],
  },
];

// ── Daily Operations: daily tracking & assignments ──────────────────────────
export const scheduleOperationsItems: NavItem[] = [
  {
    nameKey: "admin.nav.schedule_operations",
    icon: <CalendarCheck size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.daily_trip_assignment",
        path: `/${encDailyOperations}/${encDailyTripAssignment}`,
        ...permissionFor("daily-operations", "daily-trip-plan"),
      },
      {
        nameKey: "admin.nav.daily_trip_tracking",
        path: `/${encDailyOperations}/${encDailyTripTracking}`,
        ...permissionFor("daily-operations", "daily-trip-tracking"),
      },
      {
        nameKey: "admin.nav.secondary_bin_collection_event",
        path: `/${encDailyOperations}/${encBinCollectionEvent}`,
        ...permissionFor("daily-operations", "secondary-bin-collection-event"),
      },
      {
        nameKey: "admin.nav.household_collection_event",
        path: `/${encDailyOperations}/${encWasteCollectedData}`,
        ...permissionFor("daily-operations", "household-collection-event"),
      },
      {
        nameKey: "admin.nav.vehicle_breakdown",
        path: `/${encDailyOperations}/${encVehicleBreakdown}`,
        ...permissionFor("daily-operations", "vehicle-breakdown"),
      },
      {
        nameKey: "admin.nav.trip_retrip_request",
        path: `/${encDailyOperations}/${encTripRetripRequest}`,
        ...permissionFor("daily-operations", "re-trip-requests"),
      },
      {
        nameKey: "admin.nav.daily_trip_log",
        path: `/${encDailyOperations}/${encDailyTripLog}`,
        ...permissionFor("daily-operations", "daily-trip-logs"),
      },

    ],
  },
];

// ── Waste Reports: waste analytics ──────────────────────────────────────────
export const scheduleReportsItems: NavItem[] = [
  {
    nameKey: "admin.nav.schedule_reports",
    icon: <BarChart3 size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.daily_waste_comparison",
        path: `/${encScheduleMasters}/${encDailyWasteComparison}`,
        ...permissionFor("waste-reports", "daily-waste-comparison"),
      },
      {
        nameKey: "admin.nav.monthly_waste_comparison",
        path: `/${encScheduleMasters}/${encMonthlyWasteComparison}`,
        ...permissionFor("waste-reports", "monthly-waste-comparison"),
      },
    ],
  },
];

// ── Complaint Reports: grievance analytics ─────────────────────────────────
export const complaintReportsItems: NavItem[] = [
  {
    nameKey: "admin.nav.complaint_reports",
    icon: <MessageSquareWarning size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.complaints_report",
        path: `/${encComplaintTicket}/${encComplaintsReport}`,
        ...permissionFor("complaint-reports", "complaints-report"),
      },
    ],
  },
];

export const auditItems: NavItem[] = [
  {
    nameKey: "admin.nav.audits",
    icon: <Truck size={18} />,
    // Same screens, in the same order, as iwms-private's audits menu.
    subItems: [
      {
        nameKey: "admin.nav.audit_dashboard",
        path: `/${encAudits}/${encAuditDashboard}`,
        ...permissionFor("audits", "audit-dashboard"),
      },
      {
        nameKey: "admin.nav.common_audit",
        path: `/${encAudits}/${encCommonAudit}`,
                // Visible to anyone holding a view grant on either screen — this
        // page absorbed the former separate "Collection Audit" screen
        // (staff-audit), so a grant on that old screen still unlocks it.
        // "staff-audit" is the retired Collection Audit screen; grants still
        // stored on it keep opening this page.
        screens: [...permissionFor("audits", "common-audit").screens, "staff-audit"],
      },
      {
        nameKey: "admin.nav.login_audit",
        path: `/${encAudits}/${encLoginAudits}`,
        ...permissionFor("audits", "login-audit"),
      },
      {
        nameKey: "admin.nav.user_access_audit",
        path: `/${encAudits}/${encPermissionAudit}`,
        ...permissionFor("audits", "user-access-audit"),
      },
      {
        nameKey: "admin.nav.complaint_audit",
        path: `/${encAudits}/${encComplaintAudit}`,
        ...permissionFor("audits", "complaint-audit"),
      },
    ],
  },
];

export const leaderLoginItems: NavItem[] = [
  {
    nameKey: "admin.nav.leader_management",
    icon: <Users size={18} />,
    subItems: [
      {
        nameKey: "admin.nav.plb_leader_creation",
        path: `/${encLeaderLogin}/${encPlbLeaderCreation}`,
        ...permissionFor("leader-management", "plb-leader-creation"),
      },
      {
        nameKey: "admin.nav.district_leader_creation",
        path: `/${encLeaderLogin}/${encDistrictLeaderCreation}`,
        ...permissionFor("leader-management", "district-leader-creation"),
      },
      {
        nameKey: "admin.nav.state_leader_creation",
        path: `/${encLeaderLogin}/${encStateLeaderCreation}`,
        ...permissionFor("leader-management", "state-leader-creation"),
      },
    ],
  },
];

/** Sidebar sections ("main screens") in render order. */
export const SIDEBAR_SECTIONS: { key: SidebarSectionKey; items: NavItem[] }[] = [
  { key: "main", items: navItems },
  { key: "attendance", items: attendanceItems },
  { key: "commonMaster", items: commonMasterItems },
  { key: "master", items: masterItems },
  { key: "wasteType", items: wasteTypeItems },
  { key: "screenManagement", items: screenManagementItems },
  { key: "roleAssigns", items: roleAssignsItems },
  { key: "userCreations", items: userCreationMasters },
  { key: "customerMasters", items: customerMasters },
  { key: "complaintTicket", items: complaintTicketItems },
  { key: "transportMasters", items: transportMastersItems },
  { key: "scheduleSetup", items: scheduleSetupItems },
  { key: "scheduleOperations", items: scheduleOperationsItems },
  { key: "scheduleReports", items: scheduleReportsItems },
  { key: "complaintReports", items: complaintReportsItems },
  { key: "auditItems", items: auditItems },
  { key: "leaderLogin", items: leaderLoginItems },
];

/**
 * Every page the sidebar opens, with the permission that opens it. The
 * router's guard uses this to refuse a page (or its add/edit form) that the
 * sidebar would not have offered.
 */
export const SIDEBAR_PAGES: Array<Required<SidebarPermission> & { path: string }> =
  SIDEBAR_SECTIONS.flatMap(({ items }) =>
    items.flatMap((item): Array<SidebarPermission & { path?: string }> =>
      item.subItems?.length ? item.subItems : [item],
    ),
  ).flatMap((entry) =>
    entry.path && entry.module && entry.screens?.length
      ? [{ path: entry.path, module: entry.module, screens: entry.screens }]
      : [],
  );

