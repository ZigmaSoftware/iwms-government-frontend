import { LayoutDashboard, MapPin, Bell, FileText, Scale, Truck, Trash2, Users, MessageSquare, Archive, BarChart3 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getEncryptedRoute } from "@/utils/routeCache";
import { decryptSegment } from "@/utils/routeCrypto";

const {
  encDashboardOverall,
  encDashboardLiveMap,
  encDashboardVehicleManagement,
  encDashboardWasteCollection,
  encDashboardResources,
  encDashboardGrievances,
  encDashboardAlerts,
  encDashboardReports,
  encDashboardWeighBridge,
} = getEncryptedRoute();

export const menuItems = [
  { labelKey: "dashboard.nav.dashboard", url: "/dashboard", icon: LayoutDashboard, moduleName: null },
  { labelKey: "dashboard.nav.overall", url: `/dashboard/${encDashboardOverall}`, icon: BarChart3, moduleName: "dashboard-overall" },
  { labelKey: "dashboard.nav.live_map", url: `/dashboard/${encDashboardLiveMap}`, icon: MapPin, moduleName: "dashboard-map" },
  { labelKey: "dashboard.nav.vehicle", url: `/dashboard/${encDashboardVehicleManagement}`, icon: Truck, moduleName: "dashboard-vehicle" },
  { labelKey: "dashboard.nav.waste_collection", url: `/dashboard/${encDashboardWasteCollection}`, icon: Trash2, moduleName: "dashboard-waste-collection" },
  { labelKey: "dashboard.nav.resources", url: `/dashboard/${encDashboardResources}`, icon: Users, moduleName: "dashboard-resources" },
  { labelKey: "dashboard.nav.grievances", url: `/dashboard/${encDashboardGrievances}`, icon: MessageSquare, moduleName: "dashboard-grievances" },
  { labelKey: "dashboard.nav.alerts", url: `/dashboard/${encDashboardAlerts}`, icon: Bell, moduleName: "dashboard-alerts" },
  { labelKey: "dashboard.nav.reports", url: `/dashboard/${encDashboardReports}`, icon: FileText, moduleName: "dashboard-reports" },
  { labelKey: "dashboard.nav.weighbridge", url: `/dashboard/${encDashboardWeighBridge}`, icon: Scale, moduleName: "dashboard-weighbridge" },
];


export function useDashboardActiveNav() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const currentModuleName = pathSegments[0] === "dashboard" && pathSegments[1]
    ? decryptSegment(pathSegments[1])
    : null;
  const isDashboardHome = location.pathname === "/dashboard";

  return (item: (typeof menuItems)[number]) =>
    item.moduleName === null ? isDashboardHome : currentModuleName === item.moduleName;
}

export function HorizontalNav() {
  const { t } = useTranslation();
  const isItemActive = useDashboardActiveNav();

  return (
    <nav className="hidden lg:flex items-center gap-1">
      {menuItems.map((item) => {
        const isActive = isItemActive(item);

        return (
          <Link
            key={item.url}
            to={item.url}
            className={`group relative flex items-center gap-3 px-2 text-lg py-2 rounded-lg font-medium transition-all duration-300 after:absolute after:left-2 after:right-2 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary/60 after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-100 ${
              isActive
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                : "text-foreground/70 hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <item.icon
              className={`h-4 w-4 transition-transform duration-300 ${
                isActive ? "scale-110" : "group-hover:scale-110"
              }`}
            />
            <span className="text-sm">{t(item.labelKey)}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground/50 rounded-t-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
