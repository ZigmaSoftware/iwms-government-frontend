import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  getStoredColumnPermissions,
  getStoredPermissionDetails,
  getStoredPermissions,
  hasPermission as checkPermission,
  hasColumnPermission as checkColumnPermission,
  type ColumnPermissionsPayload,
  type PermissionDetailsMap,
  type PermissionsMap,
  type PermissionAction,
} from "@/utils/permissions";

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
  const [isEmptyPermissions, setIsEmptyPermissions] = useState(
    () => Object.keys(getStoredPermissions()).length === 0
  );

  const updatePermissions = useCallback((
    newPermissions: PermissionsMap,
    newColumnPermissions?: ColumnPermissionsPayload,
    newPermissionDetails?: PermissionDetailsMap
  ) => {
    setPermissions(newPermissions);
    setPermissionDetails(newPermissionDetails ?? getStoredPermissionDetails());
    setColumnPermissions(newColumnPermissions ?? getStoredColumnPermissions());
    setIsEmptyPermissions(Object.keys(newPermissions).length === 0);
  }, []);

  const hasPermission = (
    moduleName: string,
    screenName: string,
    action: PermissionAction = "view"
  ): boolean => {
    if (moduleName?.toLowerCase() === "dashboard") {
      return true;
    }

    return checkPermission(moduleName, screenName, action, permissions);
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
      value={{
        permissions,
        permissionDetails,
        hasPermission,
        updatePermissions,
        hasColumnPermission,
        isLoading: false,
        lastVersion: null,
        isEmptyPermissions,
      }}
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
 * Returns true if permissions are empty (user has no module access).
 * Used in route protection and sidebar rendering.
 */
export const useShouldRedirectToDashboard = () => {
  const { isEmptyPermissions, isLoading } = usePermission();
  return {
    shouldRedirect: isEmptyPermissions,
    isLoading,
  };
};
