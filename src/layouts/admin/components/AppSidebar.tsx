import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermission } from "@/contexts/PermissionContext";
import { cn } from "@/lib/utils";

import {
  ChevronDown,
  LayoutGrid,
  Settings,
  Layers3,
  Users,
  UserCircle,
  Truck,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Search,
  X,
} from "lucide-react";

import { useSidebar } from "@/contexts/SideBarContext";
import { getEncryptedRoute } from "@/utils/routeCache";
import { decryptSegment } from "@/utils/routeCrypto";

const {
  encAttendance,
  encMasters,
  encAudits,
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
  encScheduleMasters,
  encFuel,
  encVehicleCreation,
  encVehicleHistory,
  encVehicleTrack,
  encVehicleTracking,
  encVehicleType,
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
  encCommonAudit,
  encTripPlans,
  encTripPlanCollectionPoints,
  encHierarchyTree,
  encHierarchyAssign,
  encBins,
  encDailyTripAssignment,
  encDailyTripLog,
  encDailyTripCollectionPoint,
  encDailyTripHouseholdCollection,
  encDailyTripTracking,
  encBinCollectionEvent,
  encLoginAudits,
  encDailyWasteComparison
} = getEncryptedRoute();

type NavItem = {
  nameKey: string;
  icon: React.ReactNode;
  path?: string;
  module?: string;
  screen?: string;
  subItems?: Array<{
    nameKey: string;
    path: string;
    module?: string;
    screen?: string;
  }>;
};

type SidebarSectionKey =
  | "main"
  | "attendance"
  | "superadminMaster"
  | "master"
  | "wasteType"
  | "assets"
  | "screenManagement"
  | "roleAssigns"
  | "userCreations"
  | "processItems"
  | "customerMasters"
  | "citizenGrievance"
  | "transportMasters"
  | "scheduleMasters"
  | "auditItems"
  | "wasteManagement"
  | "workforceManagement"
  | "fleetReports";

/* =====================
   MENU DEFINITIONS
===================== */

const navItems: NavItem[] = [
  {
    nameKey: "admin.nav.dashboard",
    icon: <LayoutGrid size={18} />,
    path: "/admin",
    module: "dashboard",
    screen: "Dashboard",
  },
];

const attendanceItems: NavItem[] = [
  {
    nameKey: "admin.nav.attendance",
    icon: <CalendarCheck size={18} />,
    path: `/${encAttendance}/${encAttendance}`,
  },
];


const masterItems: NavItem[] = [
  { 
    nameKey: "admin.nav.masters",
    icon: <Layers3 size={18} />,
    module: "masters",
    screen: "masters",
    subItems: [
      {
        nameKey: "admin.nav.hierarchy_tree",
        path: `/${encMasters}/${encHierarchyTree}`,
        module: "masters",
        screen: "hierarchy-nodes",
      },
      {
        nameKey: "admin.nav.hierarchy_assign",
        path: `/${encMasters}/${encHierarchyAssign}`,
        module: "masters",
        screen: "hierarchy-assignments",
      },
    ],
  },
];

const wasteTypeItems: NavItem[] = [
  {
    nameKey: "admin.nav.wastetype",
    icon: <Users size={18} />,
    module: "waste-types",
    screen: "waste-types",
    subItems: [
      {
        nameKey: "admin.nav.property",
        path: `/${encMasters}/${encProperties}`,
        module: "waste-types",
        screen: "properties",
      },
      {
        nameKey: "admin.nav.sub_property",
        path: `/${encMasters}/${encSubProperties}`,
        module: "waste-types",
        screen: "subproperties",
      },
    ],
  },
];

const assetItems: NavItem[] = [
  {
    nameKey: "admin.nav.assets",
    icon: <Users size={18} />,
    module: "assets",
    screen: "assets",
    subItems: [
      {
        nameKey: "admin.nav.bin_creation", 
        path: `/${encMasters}/${encBins}`,
        module: "assets",
        screen: "bins",
      },
      {
        nameKey: "common.waste_type", 
        path: `/${encMasters}/${encWasteTypes}`,
        module: "assets",
        screen: "wastetypes",
      }
    ],
  },
];

const screenManagementItems: NavItem[] = [
  {
    nameKey: "admin.nav.screenManagements",
    icon: <Settings size={18} />,
    module: "screen-managements",
    screen: "screen-managements",
    subItems: [
      {
        nameKey: "admin.nav.main_screen_type",
        path: `/${encAdmins}/${encMainScreenType}`,
        module: "screen-managements",
        screen: "mainscreentype",
      },
      {
        nameKey: "admin.nav.main_screen",
        path: `/${encAdmins}/${encMainScreen}`,
        module: "screen-managements",
        screen: "mainscreens",
      },
      {
        nameKey: "admin.nav.user_screen",
        path: `/${encAdmins}/${encUserScreen}`,
        module: "screen-managements",
        screen: "userscreens",
      },
      {
        nameKey: "admin.nav.user_screen_action",
        path: `/${encAdmins}/${encUserScreenAction}`,
        module: "screen-managements",
        screen: "userscreen-action",
      },
      {
        nameKey: "admin.nav.user_screen_permission",
        path: `/${encAdmins}/${encUserScreenPermission}`,
        module: "screen-managements",
        screen: "userscreenpermissions",
      },
    ],
  },
];

const roleAssignsItems: NavItem[] = [
  {
    nameKey: "admin.nav.roleAssigns",
    icon: <Settings size={18} />,
    module: "role-assigns",
    screen: "role-assigns",
    subItems: [
      {
        nameKey: "admin.nav.user_type",
        path: `/${encAdmins}/${encUserType}`,
        module: "role-assigns",
        screen: "user-type",
      },
      {
        nameKey: "admin.nav.staff_user_type",
        path: `/${encAdmins}/${encStaffUserType}`,
        module: "role-assigns",
        screen: "staff-user-type",
      },
    ],
  },
];

const userCreationMasters: NavItem[] = [
  {
    nameKey: "admin.nav.user_creations",
    icon: <Users size={18} />,
    module: "user-creations",
    screen: "user-creations",
    subItems: [
      {
        nameKey: "admin.nav.staff_creation",
        path: `/${encStaffMasters}/${encStaffCreation}`,
        module: "user-creations",
        screen: "staffcreation",
      },
    ],
  },
];


const customerMasters: NavItem[] = [
  {
    nameKey: "admin.nav.customer_masters",
    icon: <UserCircle size={18} />,
    module: "customers",
    screen: "customers",
    subItems: [
      {
        nameKey: "admin.nav.customer_creation",
        path: `/${encCustomerMaster}/${encCustomerCreation}`,
        module: "customers",
        screen: "customercreations",
      },
      {
        nameKey: "admin.nav.apartment_list",
        path: `/${encCustomerMaster}/${encApartmentList}`,
        module: "customers",
        screen: "customercreations",
      },
      {
        nameKey: "admin.nav.waste_collected_data",
        path: `/${encWasteManagementMaster}/${encWasteCollectedData}`,
        module: "customers",
        screen: "wastecollections",
      },
      {
        nameKey: "admin.nav.feedback",
        path: `/${encCitizenGrivence}/${encFeedback}`,
        module: "customers",
        screen: "feedbacks",
      },
    ],
  },
];

const citizenGrievanceItems: NavItem[] = [
  {
    nameKey: "admin.nav.citizen_grievance",
    icon: <AlertTriangle size={18} />,
    module: "grivences",
    screen: "grivences",
    subItems: [
      {
        nameKey: "admin.nav.complaints",
        path: `/${encCitizenGrivence}/${encComplaint}`,
        module: "grivences",
        screen: "complaints",
      },
      {
        nameKey: "admin.nav.main_category",
        path: `/${encCitizenGrivence}/${encMainComplaintCategory}`,
        module: "grivences",
        screen: "main-category",
      },
      {
        nameKey: "admin.nav.sub_category",
        path: `/${encCitizenGrivence}/${encSubComplaintCategory}`,
        module: "grivences",
        screen: "sub-category",
      },
    ],
  },
];

const transportMastersItems: NavItem[] = [
  {
    nameKey: "admin.nav.transport_masters",
    icon: <Truck size={18} />,
    module: "transport-masters",
    screen: "transport-masters",
    subItems: [
      {
        nameKey: "admin.nav.vehicle_type",
        path: `/${encTransportMaster}/${encVehicleType}`,
        module: "transport-masters",
        screen: "vehicle-type",
      },
      {
        nameKey: "admin.nav.vehicle_creation",
        path: `/${encTransportMaster}/${encVehicleCreation}`,
        module: "transport-masters",
        screen: "vehicle-creation",
      },
      {
        nameKey: "admin.nav.fuel",
        path: `/${encTransportMaster}/${encFuel}`,
        module: "transport-masters",
        screen: "fuels",
      },
    ],
  },
];

const scheduleMastersItems: NavItem[] = [
  {
    nameKey: "admin.nav.schedule_masters",
    icon: <LayoutGrid size={18} />,
    module: "schedule-masters",
    screen: "schedule-masters",
    subItems: [
      {
        nameKey: "admin.nav.staff_template",
        path: `/${encScheduleMasters}/${encStaffTemplate}`,
        module: "schedule-masters",
        screen: "staff-templates",
      },
      {
        nameKey: "admin.nav.alternative_staff_template",
        path: `/${encScheduleMasters}/${encAlternativeStaffTemplate}`,
        module: "schedule-masters",
        screen: "alternative-staff-templates",
      },
      {
        nameKey: "admin.nav.collection_point",
        path: `/${encScheduleMasters}/${encCollectionPoints}`,
        module: "schedule-masters",
        screen: "collection-points",
      },
      {
        nameKey: "admin.nav.trip_plans",
        path: `/${encScheduleMasters}/${encTripPlans}`,
        module: "schedule-masters",
        screen: "trip-plans",
      },
      {
        nameKey: "admin.nav.trip_plan_collection_points",
        path: `/${encScheduleMasters}/${encTripPlanCollectionPoints}`,
        module: "schedule-masters",
        screen: "trip-plan-collection-points",
      },
      {
        nameKey: "admin.nav.daily_trip_assignment",
        path: `/${encScheduleMasters}/${encDailyTripAssignment}`,
        module: "schedule-masters",
        screen: "daily-trip-assignments",
      },
      {
        nameKey: "admin.nav.daily_trip_collection_point",
        path: `/${encScheduleMasters}/${encDailyTripCollectionPoint}`,
        module: "schedule-masters",
        screen: "daily-trip-collection-points",
      },
      {
        nameKey: "admin.nav.daily_trip_household_collection",
        path: `/${encScheduleMasters}/${encDailyTripHouseholdCollection}`,
        module: "schedule-masters",
        screen: "daily-trip-household-collections",
      },
      {
        nameKey: "admin.nav.daily_trip_tracking",
        path: `/${encScheduleMasters}/${encDailyTripTracking}`,
        module: "schedule-masters",
        screen: "daily-trip-collection-points",
      },
      {
        nameKey: "admin.nav.bin_collection_event",
        path: `/${encScheduleMasters}/${encBinCollectionEvent}`,
        module: "schedule-masters",
        screen: "bin-collection-events",
      },
      {
        nameKey: "admin.nav.daily_trip_log",
        path: `/${encScheduleMasters}/${encDailyTripLog}`,
        module: "schedule-masters",
        screen: "daily-trip-logs",
      },
      {
        nameKey: "Daily Waste Comparison",
        path: `/${encScheduleMasters}/${encDailyWasteComparison}`,
        module: "schedule-masters",
        screen: "daily-waste-comparisons",
      },
      {
        nameKey: "admin.nav.monthly_waste_comparison",
        path: `/${encScheduleMasters}/${encMonthlyWasteComparison}`,
        module: "schedule-masters",
        screen: "MonthlyWasteComparison",
      },
    ],
  },
];

const auditItems: NavItem[] = [
  {
    nameKey: "admin.nav.audit_items",
    icon: <Truck size={18} />,
    module: "audits",
    screen: "audits",
    subItems: [
      {
        nameKey: "admin.nav.common_audit",
        path: `/${encAudits}/${encCommonAudit}`,
        module: "audits",
        screen: "common-audit",
      },
      {
        nameKey: "admin.nav.login_audit",
        path: `/${encAudits}/${encLoginAudits}`,
        module: "audits",
        screen: "login-audit",
      },
    ],
  },
];

const fleetReportItems: NavItem[] = [
  {
    nameKey: "admin.nav.fleet_reports",
    icon: <BarChart3 size={18} />,
    module: "fleet-reports",
    screen: "FleetReports",
    subItems: [
      {
        nameKey: "admin.nav.vehicle_tracking",
        path: `/${encVehicleTracking}/${encVehicleTrack}`,
        module: "vehicle-tracking",
        screen: "VehicleTrack",
      },
      {
        nameKey: "admin.nav.vehicle_history",
        path: `/${encVehicleTracking}/${encVehicleHistory}`,
        module: "vehicle-tracking",
        screen: "VehicleHistory",
      },
      {
        nameKey: "admin.nav.trip_summary",
        path: `/${encReport}/${encTripSummary}`,
        module: "reports",
        screen: "TripSummary",
      },
      {
        nameKey: "admin.nav.monthly_distance",
        path: `/${encReport}/${encMonthlyDistance}`,
        module: "reports",
        screen: "MonthlyDistance",
      },
      {
        nameKey: "admin.nav.waste_collected_summary",
        path: `/${encReport}/${encWasteCollectedSummary}`,
        module: "reports",
        screen: "WasteCollectedSummary",
      },
      {
        nameKey: "admin.nav.workforce_management",
        path: `/${encWorkforceManagement}/${encWorkforceManagement}`,
        module: "workforce",
        screen: "WorkforceManagement",
      },
    ],
  },
];

const menuButtonBase =
  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300";
const menuActiveClasses =
  "bg-linear-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-200/60";
const menuInactiveClasses =
  "text-gray-700 hover:bg-green-50 hover:text-green-800";
const subMenuContainerClasses =
  "mt-1 ml-2 border-l-2 border-green-100 pl-3 space-y-0.5 pb-1";
const subMenuActiveClasses =
  "block rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-600";
const subMenuInactiveClasses =
  "block rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-green-50 hover:text-green-700";

// Helper: Check if user is superadmin
const isSuperAdminUser = (): boolean => {
  const roleFromStorage = localStorage.getItem("user_role");
  return roleFromStorage === "superadmin" || roleFromStorage === "super_admin";
};

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation();
  const { hasPermission } = usePermission();
  const showFullSidebar = isExpanded || isMobileOpen;

  //  Detect if current user is superadmin
  const isSuperAdmin = useMemo(() => isSuperAdminUser(), []);

  // Check permission with proper logging
  const checkPermission = useCallback(
    (module: string | undefined, screen: string | undefined): boolean => {
      if (!module || !screen) return true;
      const allowed = hasPermission(module, screen, "show");
      return allowed;
    },
    [hasPermission]
  );

  // Filter sub-items: only show items with permission
  const filterSubItems = (
    subItems: NavItem["subItems"]
  ): NavItem["subItems"] => {
    if (!subItems) return undefined;

    // Superadmin sees all items
    if (isSuperAdmin) return subItems;

    // Regular users: only show items they have permission for
    return subItems.filter((sub) => {
      const allowed = checkPermission(sub.module, sub.screen);
      console.log(
        `[Filter SubItem] ${sub.nameKey} (${sub.module}/${sub.screen}) = ${allowed}`
      );
      return allowed;
    });
  };

  // Check if menu item should be shown
  const hasVisibleContent = (
    item: NavItem,
    filteredSubItems: NavItem["subItems"]
  ): boolean => {

    if (item.nameKey === "admin.nav.dashboard") {
    return true;
  }
    // If no subItems, check direct permission or show if no permission needed
    if (!item.subItems || item.subItems.length === 0) {
      if (!item.module || !item.screen) return true;
      const allowed = checkPermission(item.module, item.screen);
      console.log(
        `[Show Item] ${item.nameKey} (no children, ${item.module}/${item.screen}) = ${allowed}`
      );
      return allowed;
    }

    // If has subItems, show only if filtered children exist
    const hasChildren = !!(filteredSubItems && filteredSubItems.length > 0);
    console.log(
      `[Show Item] ${item.nameKey} (parent, has ${filteredSubItems?.length || 0} children) = ${hasChildren}`
    );
    return hasChildren;
  };

  // Build sidebar sections with strict filtering
  const sidebarSections = useMemo(
    () => {
      const allSections = [
        { key: "main" as const, items: navItems },
        { key: "attendance" as const, items: attendanceItems },
        { key: "master" as const, items: masterItems },
        { key: "wasteType" as const, items: wasteTypeItems },
        { key: "assets" as const, items: assetItems },
        { key: "screenManagement" as const, items: screenManagementItems },
        { key: "roleAssigns" as const, items: roleAssignsItems },
        { key: "userCreations" as const, items: userCreationMasters },
        { key: "customerMasters" as const, items: customerMasters },
        { key: "citizenGrievance" as const, items: citizenGrievanceItems },
        { key: "transportMasters" as const, items: transportMastersItems },
        { key: "scheduleMasters" as const, items: scheduleMastersItems },
        { key: "auditItems" as const, items: auditItems },
        { key: "fleetReports" as const, items: fleetReportItems },
      ];

      // If superadmin, show ALL sections with ALL items
      if (isSuperAdmin) {
        // console.log("[Sidebar] SuperAdmin detected - showing all sections");
        return allSections.filter((section) => section.items.length > 0);
      }

      // For regular users: strict filtering
      console.log("[Sidebar] Regular user - applying permission filters");
      return allSections
        .map((section) => {
          // Filter items within section
          const filteredItems = section.items
            .map((item) => {
              const filteredSubItems = filterSubItems(item.subItems);
              return {
                ...item,
                subItems: filteredSubItems,
              };
            })
            .filter((item) => hasVisibleContent(item, item.subItems));

          return {
            ...section,
            items: filteredItems,
          };
        })
        .filter((section) => section.items.length > 0); // Only show sections with visible items
    },
    [hasPermission, isSuperAdmin, checkPermission]
  );

  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sidebarSections;
    const q = searchQuery.toLowerCase().trim();
    return sidebarSections
      .map((section) => {
        const filteredItems = section.items
          .map((item) => {
            const parentName = t(item.nameKey).toLowerCase();
            if (parentName.includes(q)) return item;
            if (!item.subItems || item.subItems.length === 0) return null;
            const matchingSubs = item.subItems.filter((sub) =>
              t(sub.nameKey).toLowerCase().includes(q)
            );
            return matchingSubs.length > 0 ? { ...item, subItems: matchingSubs } : null;
          })
          .filter((item): item is NavItem => item !== null);
        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  }, [searchQuery, sidebarSections, t]);

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: SidebarSectionKey;
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentDecodedPath = useMemo(() => {
    const [master, module] = location.pathname.split("/").filter(Boolean);
    return {
      master: decryptSegment(master || "") ?? null,
      module: decryptSegment(module || "") ?? null,
    };
  }, [location.pathname]);

  const isActive = useCallback(
    (path: string, allowNestedRoutes = false) => {
      if (!path) return false;

      const segments = path.split("/").filter(Boolean);
      const [encMaster, encModule] = segments;
      const decodedMaster = decryptSegment(encMaster || "");
      const decodedModule = decryptSegment(encModule || "");

      if (!decodedMaster && !decodedModule) {
        if (location.pathname === path) return true;
        return (
          allowNestedRoutes &&
          location.pathname.startsWith(path.endsWith("/") ? path : `${path}/`)
        );
      }

      if (decodedMaster !== currentDecodedPath.master) return false;
      if (!decodedModule) return true;

      if (currentDecodedPath.module === decodedModule) return true;
      return (
        allowNestedRoutes &&
        currentDecodedPath.module?.startsWith(decodedModule)
      );
    },
    [currentDecodedPath, location.pathname]
  );

  useEffect(() => {
    let matched = false;
    const skipAutoOpenSubmenuKeys = new Set([
      "admin.nav.collection_monitoring",
    ]);

    sidebarSections.forEach((section) => {
      section.items.forEach((nav, index) => {
        nav.subItems?.forEach((sub) => {
          if (isActive(sub.path, true)) {
            matched = true;
            if (!skipAutoOpenSubmenuKeys.has(sub.nameKey)) {
              setOpenSubmenu({ type: section.key, index });
            }
          }
        });
      });
    });

    if (!matched) setOpenSubmenu(null);
  }, [location, isActive, sidebarSections]);

  useEffect(() => {
    if (openSubmenu) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      const el = subMenuRefs.current[key];
      if (el) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: el.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, type: SidebarSectionKey) => {
    if (!showFullSidebar) {
      toggleSidebar();
      setOpenSubmenu({ type, index });
      return;
    }

    setOpenSubmenu((prev) =>
      prev && prev.type === type && prev.index === index
        ? null
        : { type, index }
    );
  };

  const renderMenuItems = (items: NavItem[], type: SidebarSectionKey) => (
    <ul className="flex flex-col gap-2">
      {items.map((nav, index) => {
        const isSubmenuOpen =
          (searchQuery.trim() !== "" && !!(nav.subItems && nav.subItems.length > 0)) ||
          (openSubmenu?.type === type && openSubmenu?.index === index);
        return (
          <li key={nav.path ?? nav.nameKey}>
            {nav.subItems && nav.subItems.length > 0 ? (
              <button
                onClick={() => handleSubmenuToggle(index, type)}
                className={`${menuButtonBase} ${
                  isSubmenuOpen ? menuActiveClasses : menuInactiveClasses
                }`}
              >
                <span
                  className={cn(
                    "menu-item-icon-size shrink-0",
                    !showFullSidebar && "mx-auto",
                    isSubmenuOpen ? "text-white" : "text-green-600"
                  )}
                >
                  {nav.icon}
                </span>

                {showFullSidebar && (
                  <>
                    <span
                      className={cn(
                        "truncate text-sm font-semibold",
                        isSubmenuOpen ? "text-white" : "text-gray-800"
                      )}
                    >
                      {t(nav.nameKey)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                        isSubmenuOpen ? "rotate-180 text-white" : "text-green-500"
                      )}
                    />
                  </>
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  className={`${menuButtonBase} ${
                    isActive(nav.path, true)
                      ? menuActiveClasses
                      : menuInactiveClasses
                  }`}
                >
                  <span
                    className={cn(
                      "menu-item-icon-size shrink-0",
                      !showFullSidebar && "mx-auto",
                      isActive(nav.path, true) ? "text-white" : "text-green-600"
                    )}
                  >
                    {nav.icon}
                  </span>
                  {showFullSidebar && (
                    <span
                      className={cn(
                        "truncate text-sm font-semibold",
                        isActive(nav.path, true) ? "text-white" : "text-gray-800"
                      )}
                    >
                      {t(nav.nameKey)}
                    </span>
                  )}
                </Link>
              )
            )}

            {nav.subItems && nav.subItems.length > 0 && showFullSidebar && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`${type}-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height: isSubmenuOpen
                    ? `${subMenuHeight[`${type}-${index}`]}px`
                    : "0px",
                }}
              >
                <ul className={subMenuContainerClasses}>
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.path}>
                      <Link
                        to={subItem.path}
                        className={`block px-3 py-1.5 text-sm font-medium transition-colors ${
                          isActive(subItem.path, true)
                            ? subMenuActiveClasses
                            : subMenuInactiveClasses
                        }`}
                      >
                        {t(subItem.nameKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-(--admin-header-h) z-50 h-[calc(100vh-var(--admin-header-h))] transition-all duration-300 ease-out",
        "border-r border-green-100 bg-white shadow-lg shadow-green-100/40",
        showFullSidebar ? "w-[290px]" : "w-20",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      {/* Top accent bar: green → blue → orange */}
      <div className="absolute left-0 right-0 top-0 h-[3px] bg-linear-to-r from-green-500 via-blue-500 to-orange-400" />

      <div className="flex h-full flex-col px-3 pb-6 pt-5">
        {/* Search input — only when expanded */}
        {showFullSidebar && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-green-100 bg-green-50/50 py-2 pl-9 pr-8 text-sm text-gray-700 placeholder-gray-400 focus:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="no-scrollbar flex-1 overflow-y-auto pr-1">
          <nav className="flex flex-col gap-1.5">
            {filteredSections.length > 0 ? (
              filteredSections.map((section) => (
                <div key={section.key} className="flex flex-col gap-1">
                  {renderMenuItems(section.items, section.key)}
                </div>
              ))
            ) : (
              showFullSidebar && searchQuery.trim() && (
                <p className="px-3 py-6 text-center text-sm text-gray-400">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
              )
            )}
          </nav>
        </div>

        {/* Bottom blue accent line */}
        <div className="mt-4 h-px bg-linear-to-r from-transparent via-blue-200 to-transparent" />
      </div>
    </aside>
  );
};

export default AppSidebar;
