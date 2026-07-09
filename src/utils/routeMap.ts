/**
 * Route Map Utility
 * 
 * Maps permission module/screen names to actual application routes.
 * Used for permission-based sidebar rendering and route protection.
 * 
 * Example:
 * {
 *   "Staff": {
 *     "Staff Creation": "/staff/create",
 *     "Staff List": "/staff/list"
 *   },
 *   "Users": {
 *     "User List": "/users/list"
 *   }
 * }
 */
import { routePaths } from "@/utils/routePaths";

export type RouteMapConfig = Record<string, Record<string, string>>;

/**
 * Define your permission module/screen to route mappings here
 * Module names should match exactly what comes from the API
 */
const ROUTE_MAP: RouteMapConfig = {
  "user-creations": {
    "staff-access-configuration": routePaths.staffAccessConfiguration.listPath,
  },
  // Example: Uncomment and customize based on your actual modules
  // "Staff": {
  //   "Staff Creation": "/staff/create",
  //   "Staff List": "/staff/list",
  //   "Staff Detail": "/staff/detail"
  // },
  // "Users": {
  //   "User List": "/users/list",
  //   "User Management": "/users/management"
  // },
  // "Reports": {
  //   "Daily Report": "/reports/daily",
  //   "Weekly Report": "/reports/weekly"
  // }
};

/**
 * Get the route for a given module and screen
 * 
 * @param moduleName - The module name from permissions
 * @param screenName - The screen name from permissions
 * @returns The route path, or null if not found in mapping
 * 
 * @example
 * getRouteForScreen("Staff", "Staff List")
 * // Returns: "/staff/list"
 */
export const getRouteForScreen = (
  moduleName: string,
  screenName: string
): string | null => {
  const moduleRoutes = ROUTE_MAP[moduleName];
  if (!moduleRoutes) {
    console.warn(`[RouteMap] No routes found for module: ${moduleName}`);
    return null;
  }

  const route = moduleRoutes[screenName];
  if (!route) {
    console.warn(
      `[RouteMap] No route found for ${moduleName}/${screenName}`
    );
    return null;
  }

  return route;
};

/**
 * Get all routes for a given module
 * 
 * @param moduleName - The module name from permissions
 * @returns Object mapping screen names to routes, or empty object if not found
 * 
 * @example
 * getRoutesForModule("Staff")
 * // Returns: { "Staff Creation": "/staff/create", "Staff List": "/staff/list" }
 */
export const getRoutesForModule = (moduleName: string): Record<string, string> => {
  return ROUTE_MAP[moduleName] ?? {};
};

/**
 * Check if a route is defined for a module/screen combination
 * 
 * @param moduleName - The module name from permissions
 * @param screenName - The screen name from permissions
 * @returns true if route is defined, false otherwise
 */
export const routeExists = (moduleName: string, screenName: string): boolean => {
  return getRouteForScreen(moduleName, screenName) !== null;
};

/**
 * Get all defined routes
 * Useful for navigation utilities and route configuration
 * 
 * @returns The complete route map
 */
export const getAllRoutes = (): RouteMapConfig => {
  return { ...ROUTE_MAP };
};

/**
 * Update the route map (useful for dynamic configuration)
 * WARNING: Use with caution - typically should be set once at app initialization
 * 
 * @param newRoutes - New route mappings to merge with existing ones
 */
export const extendRouteMap = (newRoutes: Partial<RouteMapConfig>): void => {
  Object.keys(newRoutes).forEach((moduleName) => {
    if (newRoutes[moduleName]) {
      if (!ROUTE_MAP[moduleName]) {
        ROUTE_MAP[moduleName] = {};
      }
      Object.assign(ROUTE_MAP[moduleName], newRoutes[moduleName]);
    }
  });
  console.log("[RouteMap] ✅ Route map updated:", ROUTE_MAP);
};
