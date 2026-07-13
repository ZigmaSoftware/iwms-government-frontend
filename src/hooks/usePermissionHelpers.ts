/**
 * EXAMPLE 1: useModulePermissions - Custom Hook for Module Access
 * 
 * A reusable hook that checks all standard CRUD permissions for a module.
 * Use this pattern for any module that needs permission checks.
 */

import { usePermission } from "@/contexts/PermissionContext";

export interface ModulePermissions {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  hasAnyPermission: boolean;
}

/**
 * Hook to get all CRUD permissions for a module
 * @param moduleName - The module to check (e.g., "users", "customers")
 * @param screenName - Optional screen name (defaults to moduleName)
 */
export function useModulePermissions(
  moduleName: string,
  screenName?: string
): ModulePermissions {
  const { hasPermission } = usePermission();
  const screen = screenName || moduleName;

  const canView = hasPermission(moduleName, screen, "view");
  const canAdd = hasPermission(moduleName, screen, "add");
  const canEdit = hasPermission(moduleName, screen, "edit");
  const canDelete = hasPermission(moduleName, screen, "delete");

  return {
    canView,
    canAdd,
    canEdit,
    canDelete,
    hasAnyPermission: canView || canAdd || canEdit || canDelete,
  };
}

/**
 * EXAMPLE 2: useActionPermission - Check Single Action
 */
export function useActionPermission(
  moduleName: string,
  screenName: string,
  action = "view"
): boolean {
  const { hasPermission } = usePermission();
  return hasPermission(moduleName, screenName, action);
}

/**
 * EXAMPLE 3: Access Control Component - Show only if granted
 */
import type { ReactNode } from "react";

interface PermissionGateProps {
  moduleName: string;
  screenName?: string;
  action?: "view" | "add" | "edit" | "delete";
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  moduleName,
  screenName,
  action = "view",
  fallback = null,
  children,
}: PermissionGateProps) {
  const allowed = useActionPermission(moduleName, screenName || moduleName, action);
  return allowed ? children : fallback;
}

/**
 * EXAMPLE 4: Dynamic Menu Builder
 */
export interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  path: string;
  moduleName: string;
  action?: "view" | "add" | "edit" | "delete";
}

export interface MenuConfig {
  label: string;
  items: MenuItem[];
}

export function useDynamicMenu(menuConfig: MenuConfig[]): MenuConfig[] {
  const { hasPermission } = usePermission();

  return menuConfig
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        hasPermission(item.moduleName, item.id, item.action || "view")
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * EXAMPLE 5: Form Field Permissions
 */
interface FormFieldPermission {
  readable: boolean;
  editable: boolean;
  deletable: boolean;
}

export function useFormFieldPermissions(
  moduleName: string,
  screenName: string,
  fieldName: string
): FormFieldPermission {
  const { hasColumnPermission } = usePermission();
  const readable = hasColumnPermission(moduleName, screenName, fieldName);

  return {
    readable,
    editable: readable,
    deletable: readable,
  };
}

/**
 * EXAMPLE 6: Table Column Visibility Hook
 */
interface TableColumn {
  id: string;
  label: string;
  accessorKey: string;
}

export function useTableColumns(
  moduleName: string,
  screenName: string,
  columns: TableColumn[]
): TableColumn[] {
  const { hasColumnPermission } = usePermission();

  return columns.filter((column) =>
    hasColumnPermission(moduleName, screenName, column.accessorKey || column.id)
  );
}

/**
 * EXAMPLE 7: Action Availability Checker
 */
export interface ActionAvailability {
  canPerform: boolean;
  reason?: string; // Why the action is not available
}

export function useActionAvailability(
  moduleName: string,
  screenName: string,
  action: "view" | "add" | "edit" | "delete"
): ActionAvailability {
  const { hasPermission, permissions } = usePermission();
  const canPerform = hasPermission(moduleName, screenName, action);

  return {
    canPerform,
    reason: !canPerform ? `No ${action} permission for ${moduleName}/${screenName}` : undefined,
  };
}

/**
 * EXAMPLE 8: Batch Permission Checker
 */
export function useMultiplePermissions(
  checks: Array<{
    module: string;
    screen: string;
    action?: "view" | "add" | "edit" | "delete";
  }>
): Record<string, boolean> {
  const { hasPermission } = usePermission();

  return Object.fromEntries(
    checks.map((check) => [
      `${check.module}:${check.screen}:${check.action || "view"}`,
      hasPermission(check.module, check.screen, check.action || "view"),
    ])
  );
}
