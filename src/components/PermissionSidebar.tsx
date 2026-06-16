/**
 * Dynamic Permission-Based Sidebar
 * 
 * Renders sidebar menu items based on user permissions from the permission context.
 * Features:
 * - Shows only modules/screens user has "view" permission for
 * - Dashboard always available (no permission required)
 * - Falls back to Dashboard only if permissions are empty
 * - Uses routeMap for module/screen to route mapping
 * - Responsive with mobile drawer support
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  LayoutDashboard,
  X,
  Menu as MenuIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermission } from "@/contexts/PermissionContext";
import { getRouteForScreen } from "@/utils/routeMap";

interface PermissionSidebarProps {
  /**
   * Optional class name to apply to the sidebar container
   */
  className?: string;

  /**
   * Optional callback when a menu item is clicked (useful for closing mobile drawer)
   */
  onItemClick?: () => void;
}

/**
 * Dynamic Menu Item Component
 * Handles nested screens within a module
 */
function MenuItem({
  moduleName,
  screens,
  onItemClick,
}: {
  moduleName: string;
  screens: Record<string, string[]>;
  onItemClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { hasPermission } = usePermission();

  // Filter screens that user has "show" permission for
  const visibleScreens = Object.entries(screens).filter(([screenName]) =>
    hasPermission(moduleName, screenName, "show")
  );

  // If no visible screens, don't render this module
  if (visibleScreens.length === 0) {
    return null;
  }

  const hasMultipleScreens = visibleScreens.length > 1;
  const isModuleActive = visibleScreens.some(([screenName]) => {
    const route = getRouteForScreen(moduleName, screenName);
    return route && location.pathname === route;
  });

  return (
    <div className="mb-2">
      {/* Module Header / First Screen Link */}
      {hasMultipleScreens ? (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all",
            "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
            isModuleActive && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium"
          )}
        >
          <span className="truncate">{moduleName}</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform flex-shrink-0",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      ) : (
        // Single screen - render as direct link
        visibleScreens[0] && (
          <ScreenLink
            moduleName={moduleName}
            screenName={visibleScreens[0][0]}
            onItemClick={onItemClick}
          />
        )
      )}

      {/* Sub-screens (only show if module is expanded and has multiple screens) */}
      {hasMultipleScreens && isExpanded && (
        <div className="ml-2 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
          {visibleScreens.map(([screenName]) => (
            <ScreenLink
              key={screenName}
              moduleName={moduleName}
              screenName={screenName}
              isSubItem
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Screen Link Component
 * Renders a single screen as a navigable link
 */
function ScreenLink({
  moduleName,
  screenName,
  isSubItem = false,
  onItemClick,
}: {
  moduleName: string;
  screenName: string;
  isSubItem?: boolean;
  onItemClick?: () => void;
}) {
  const location = useLocation();
  const route = getRouteForScreen(moduleName, screenName);

  // If no route found in mapping, skip rendering
  if (!route) {
    return null;
  }

  const isActive = location.pathname === route;

  const handleClick = () => {
    onItemClick?.();
  };

  return (
    <Link
      to={route}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all",
        "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
        isActive &&
          "bg-blue-500 text-white dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 font-medium",
        isSubItem && "text-sm"
      )}
    >
      <span className="truncate">{screenName}</span>
    </Link>
  );
}

/**
 * Dynamic Permission-Based Sidebar Component
 */
export function PermissionSidebar({
  className,
  onItemClick,
}: PermissionSidebarProps) {
  const { permissions, isEmptyPermissions, isLoading } = usePermission();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("bg-white dark:bg-gray-900 w-64 border-r border-gray-200 dark:border-gray-700 p-4", className)}>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Dashboard fallback: empty permissions
  if (isEmptyPermissions) {
    return <DashboardOnlySidebar className={className} onItemClick={onItemClick} />;
  }

  // Desktop sidebar with permission-based menu
  const desktopContent = (
    <div className={cn("p-4", className)}>
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-3 mb-4">
        Menu
      </h2>

      {/* Dashboard Link */}
      <DashboardLink onItemClick={onItemClick} />

      {/* Permission-based Modules */}
      {Object.keys(permissions).length > 0 ? (
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-3 mb-3">
            Modules
          </h3>
          {Object.entries(permissions).map(([moduleName, screens]) => (
            <MenuItem
              key={moduleName}
              moduleName={moduleName}
              screens={screens}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 italic">
          No modules available
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn("hidden lg:block bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto")}>
        {desktopContent}
      </aside>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className={cn(
            "p-3 rounded-full shadow-lg transition-all",
            "bg-blue-500 text-white hover:bg-blue-600",
            "dark:bg-blue-600 dark:hover:bg-blue-700"
          )}
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 z-40 overflow-y-auto shadow-xl">
            {desktopContent}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Dashboard Only Sidebar
 * Shown when permissions are empty (dashboard fallback scenario)
 */
function DashboardOnlySidebar({
  className,
  onItemClick,
}: {
  className?: string;
  onItemClick?: () => void;
}) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-64">
        <div className={cn("p-4", className)}>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-3 mb-4">
            Menu
          </h2>
          <DashboardLink onItemClick={onItemClick} />
          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 italic">
            Only Dashboard available
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <DashboardLink onItemClick={onItemClick} />
      </div>
    </>
  );
}

/**
 * Dashboard Link Component
 * Always accessible link to dashboard
 */
function DashboardLink({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();
  const isDashboardActive = location.pathname === "/dashboard";

  return (
    <Link
      to="/dashboard"
      onClick={onItemClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all w-full",
        isDashboardActive
          ? "bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-md font-medium"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium">Dashboard</span>
    </Link>
  );
}
