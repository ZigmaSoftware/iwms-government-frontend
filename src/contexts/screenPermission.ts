import { createContext, useCallback, useContext } from "react";

import { usePermission } from "@/contexts/PermissionContext";
import type { PermissionAction } from "@/utils/permissions";

/**
 * The permission of the admin page being shown, as the sidebar names it
 * (layouts/admin/sidebarMenu.tsx). AdminEncryptedRouter provides it; the
 * shared list widgets (RowActionsMenu, SafeDataTable, `<Can>`) read it to
 * hide the actions the user may not take. The backend middleware refuses
 * them regardless — this keeps the UI from offering them.
 */
export type ScreenPermission = { module: string; screens: string[] };

export const ScreenPermissionContext = createContext<ScreenPermission | null>(null);

export const isSuperAdminUser = (): boolean => {
  const role = localStorage.getItem("user_role");
  return role === "superadmin" || role === "super_admin";
};

/** Whether `permission` grants `action` on any of its screens. */
export function useHasScreenPermission() {
  const { hasPermission } = usePermission();
  return useCallback(
    (permission: ScreenPermission | null, action: PermissionAction): boolean =>
      !permission ||
      isSuperAdminUser() ||
      permission.screens.some((screen) =>
        hasPermission(permission.module, screen, action),
      ),
    [hasPermission],
  );
}

/**
 * Actions allowed on the current admin page. Outside a page the sidebar
 * knows (no provider), everything is allowed and the backend decides.
 */
export function useScreenAccess() {
  const permission = useContext(ScreenPermissionContext);
  const check = useHasScreenPermission();
  const can = useCallback(
    (action: PermissionAction) => check(permission, action),
    [check, permission],
  );
  return {
    can,
    canView: can("view"),
    canAdd: can("add"),
    canEdit: can("edit"),
    canDelete: can("delete"),
  };
}
