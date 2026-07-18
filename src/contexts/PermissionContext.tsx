import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import {
  getStoredColumnPermissions,
  getStoredPermissionDetails,
  getStoredPermissions,
  // getStoredPermissionDetails,
  hasPermission as checkPermission,
  hasColumnPermission as checkColumnPermission,
  type ColumnPermissionsPayload,
  type PermissionDetailsMap,
  type PermissionsMap,
  // type PermissionDetailsMap,
  type PermissionAction,
  fetchPermissionsFromAPI,
  PermissionAuthError,
} from "@/utils/permissions";
import { clearAuthSession, scheduleProactiveRefresh } from "@/utils/authStorage";

// Routes with their own independent login/token (leader portals) or no auth
// at all (public grievance form) must never be bounced to /auth just because
// a stale admin `access_token` happens to still be sitting in localStorage.
const isAuthExemptPath = (pathname: string) =>
  pathname.startsWith("/publicgrivence") ||
  pathname.startsWith("/auth") ||
  pathname.startsWith("/district") ||
  pathname.startsWith("/localbody") ||
  pathname.startsWith("/state");

type PermissionContextValue = {
  permissions: PermissionsMap;
  permissionDetails: PermissionDetailsMap;
  hasPermission: (moduleName: string, screenName: string, action?: PermissionAction) => boolean;
  hasColumnPermission: (moduleName: string, screenName: string, fieldName: string) => boolean;
  updatePermissions: (
    permissions: PermissionsMap,
    columnPermissions?: ColumnPermissionsPayload,
    permissionDetails?: PermissionDetailsMap
  ) => void;
  isLoading: boolean;
  lastVersion: number | null;
  /**
   * 🔹 TRUE if permissions are empty - indicates user has no module access
   * Show "No modules assigned" message, only dashboard accessible
   */
  isEmptyPermissions: boolean;
};

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

export const PermissionProvider = ({ children }: { children: ReactNode }) => {
  const [permissions, setPermissions] = useState<PermissionsMap>(() =>
    getStoredPermissions()
  );
  const [permissionDetails, setPermissionDetails] = useState<PermissionDetailsMap>(() =>
    getStoredPermissionDetails()
  );
  const [columnPermissions, setColumnPermissions] = useState<ColumnPermissionsPayload>(
  () => getStoredColumnPermissions()
);
  const [isLoading, setIsLoading] = useState(false);
  const [lastVersion] = useState<number | null>(null);
  const [isEmptyPermissions, setIsEmptyPermissions] = useState(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  /**
   * 🔹 Fetch and update permissions from API
   * All users follow the same flow - no role-based special cases
   */
  const fetchAndUpdatePermissions = useCallback(async () => {
    // Fully public routes (e.g. public grievance form) need no auth at all.
    if (window.location.pathname.startsWith("/publicgrivence")) {
      return;
    }
    try {
      // console.log("[PermissionContext] 📡 Fetching permissions from API...");
      const apiPermissions = await fetchPermissionsFromAPI();
      
      if (!isMountedRef.current) return;

      if (apiPermissions && Object.keys(apiPermissions).length > 0) {
        setPermissions(apiPermissions);
        setPermissionDetails(getStoredPermissionDetails());
        setColumnPermissions(getStoredColumnPermissions());
        setIsEmptyPermissions(false);
      } else {
        const storedPerms = getStoredPermissions();
        setPermissions(storedPerms);
        setPermissionDetails(getStoredPermissionDetails());
        setColumnPermissions(getStoredColumnPermissions());
        setIsEmptyPermissions(Object.keys(storedPerms).length === 0);
        // console.log(
        //   `[PermissionContext] ℹ️ Using stored permissions (isEmpty: ${Object.keys(storedPerms).length === 0})`
        // );
      }
    } catch (error) {
      if (error instanceof PermissionAuthError) {
        // The admin access_token is dead — stop hammering the API every 10s
        // and clear it so stale state doesn't linger. Only force a redirect
        // when we're actually on an admin/dashboard route; leader portals
        // (district/localbody/state) authenticate with their own separate
        // tokens and must not be interrupted by this.
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        clearAuthSession();
        if (isMountedRef.current) {
          setPermissions({});
          setPermissionDetails({});
          setColumnPermissions(getStoredColumnPermissions());
          setIsEmptyPermissions(true);
        }
        if (!isAuthExemptPath(window.location.pathname)) {
          window.location.assign("/auth");
        }
        return;
      }
      if (isMountedRef.current) {
        const storedPerms = getStoredPermissions();
        setPermissions(storedPerms);
        setPermissionDetails(getStoredPermissionDetails());
        setColumnPermissions(getStoredColumnPermissions());
        setIsEmptyPermissions(Object.keys(storedPerms).length === 0);
      }
    }
  }, []);

  /**
   * 🔹 Initialize permissions on mount
   */
  useEffect(() => {
    const initializePermissions = async () => {
      try {
        // console.log("[PermissionContext] 🚀 Initializing permissions");
        setIsLoading(true);
        await fetchAndUpdatePermissions();
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializePermissions();
    // Covers a page refresh where a still-valid access_token from an
    // earlier login already sits in localStorage — persistLoginSession
    // only schedules the proactive refresh at login time, so a fresh
    // page load needs to (re)arm it here too.
    scheduleProactiveRefresh();
  }, [fetchAndUpdatePermissions]);

  /**
   * 🔹 Setup polling interval (10 seconds) for permission updates
   * All users poll - no role-based exceptions
   */
  useEffect(() => {
    // console.log("[PermissionContext] ⏱️ Starting permission polling (10s interval)");

    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        // console.log("[PermissionContext] 🔄 Polling permissions...");
        fetchAndUpdatePermissions();
      }
    }, 10000); // 10 seconds

    return () => {
      if (pollingIntervalRef.current) {
        // console.log("[PermissionContext] ⏱️ Stopping permission polling");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchAndUpdatePermissions]);

  /**
   * 🔹 Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      // console.log("[PermissionContext] 🧹 Cleanup: component unmounted");
    };
  }, []);

  /**
   * 🔹 Sync permissions when localStorage changes (multi-tab scenarios)
   */
  const handleStorageChange = useCallback(() => {
    const updated = getStoredPermissions();
    setPermissions(updated);
    setPermissionDetails(getStoredPermissionDetails());
    setColumnPermissions(getStoredColumnPermissions());
    setIsEmptyPermissions(Object.keys(updated).length === 0);
  }, []);

  useEffect(() => {
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [handleStorageChange]);

  /**
   * 🔹 Allow explicit permission updates (useful for same-tab updates)
   */
  const updatePermissions = useCallback((
    newPermissions: PermissionsMap,
    newColumnPermissions?: ColumnPermissionsPayload,
    newPermissionDetails?: PermissionDetailsMap
  ) => {
    // console.log("[PermissionContext] 🔄 Explicit permission update");
    setPermissions(newPermissions);
    setPermissionDetails(newPermissionDetails ?? getStoredPermissionDetails());
    setColumnPermissions(newColumnPermissions ?? getStoredColumnPermissions());
    setIsEmptyPermissions(Object.keys(newPermissions).length === 0);
  }, []);

  /**
   * 🔹 Check if user has permission
   * Dashboard always accessible, all other access based on permissions
   */
  const hasPermission = (
    moduleName: string,
    screenName: string,
    action: PermissionAction = "view"
  ): boolean => {
    // ✅ Dashboard always accessible
    if (moduleName?.toLowerCase() === "dashboard") {
      return true;
    }

    // Check permission against the stored permissions map
    const result = checkPermission(moduleName, screenName, action, permissions);
    // console.log(
    //   `[PermissionContext] hasPermission(${moduleName}/${screenName}/${action}): ${result}`
    // );
    return result;
  };

  const hasColumnPermission = (
    moduleName: string,
    screenName: string,
    fieldName: string
  ): boolean => {
    return checkColumnPermission(
      moduleName,
      screenName,
      fieldName,
      columnPermissions
    );
  };

  return (
    <PermissionContext.Provider
      value={{ permissions, permissionDetails, hasPermission, updatePermissions, hasColumnPermission, isLoading, lastVersion, isEmptyPermissions }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermission must be used within PermissionProvider");
  }
  return ctx;
};

/**
 * 🔹 Hook to check if user should be redirected to dashboard
 * Returns true if permissions are empty (user has no module access)
 * Used in route protection and sidebar rendering
 */
export const useShouldRedirectToDashboard = () => {
  const { isEmptyPermissions, isLoading } = usePermission();
  return {
    shouldRedirect: isEmptyPermissions,
    isLoading,
  };
};
