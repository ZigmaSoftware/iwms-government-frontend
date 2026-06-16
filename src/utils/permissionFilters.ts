/**
 * Permission Filtering Utilities
 * 
 * Helper functions for permission-based rendering of menu items,
 * buttons, and other UI components.
 * 
 * Usage:
 * ```tsx
 * import { filterMenuItems, isSuperAdmin } from "@/utils/permissionFilters";
 * 
 * const visibleItems = filterMenuItems(allItems, hasPermission, isSuperAdmin());
 * ```
 */

import type { PermissionsMap } from "@/utils/permissions";

export type MenuItem = {
  nameKey: string;
  icon?: React.ReactNode;
  path?: string;
  module?: string;
  screen?: string;
  subItems?: MenuItem[];
};

export type MenuSection<T extends string = string> = {
  key: T;
  items: MenuItem[];
};

/**
 * Check if current user is superadmin
 * Reads from localStorage
 */
export const isSuperAdmin = (): boolean => {
  if (typeof window === "undefined") return false;
  const roleFromStorage = localStorage.getItem("user_role");
  return roleFromStorage === "superadmin" || roleFromStorage === "super_admin";
};

/**
 * Check permission for a module/screen/action
 * Handles null/undefined module/screen gracefully
 */
export const checkPermission = (
  module: string | undefined,
  screen: string | undefined,
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  action: string = "show"
): boolean => {
  // Items without module/screen always visible (e.g., dashboard)
  if (!module || !screen) {
    return true;
  }

  return hasPermissionFn(module, screen, action);
};

/**
 * Filter menu sub-items by permission
 * Removes items that user doesn't have "show" permission for
 */
export const filterSubItems = (
  subItems: MenuItem[] | undefined,
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  superAdmin: boolean
): MenuItem[] | undefined => {
  if (!subItems || subItems.length === 0) {
    return undefined;
  }

  // SuperAdmin sees all items
  if (superAdmin) {
    return subItems;
  }

  // Regular users: filter by permission
  const filtered = subItems.filter((sub) => {
    const allowed = checkPermission(sub.module, sub.screen, hasPermissionFn);
    if (!allowed) {
      console.log(
        `[Permission Filter] Hiding sub-item: ${sub.nameKey} (${sub.module}/${sub.screen})`
      );
    }
    return allowed;
  });

  return filtered.length > 0 ? filtered : undefined;
};

/**
 * Check if a menu item has visible content
 * Parent items are shown only if they have visible children
 */
export const hasVisibleContent = (
  item: MenuItem,
  filteredSubItems: MenuItem[] | undefined,
  hasPermissionFn: (module: string, screen: string, action: string) => boolean
): boolean => {
  // Items without subItems: check their own permission
  if (!item.subItems || item.subItems.length === 0) {
    return checkPermission(item.module, item.screen, hasPermissionFn);
  }

  // Parent items with subItems: show only if children exist
  const hasChildren = !!(filteredSubItems && filteredSubItems.length > 0);
  return hasChildren;
};

/**
 * Filter menu items within a section
 * Applies filtering recursively to sub-items
 */
export const filterMenuItems = (
  items: MenuItem[],
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  superAdmin: boolean = false
): MenuItem[] => {
  if (superAdmin) {
    // SuperAdmin sees everything
    return items;
  }

  // Filter items for regular users
  return items
    .map((item) => {
      const filteredSubItems = filterSubItems(
        item.subItems,
        hasPermissionFn,
        superAdmin
      );

      return {
        ...item,
        subItems: filteredSubItems,
      };
    })
    .filter((item) => hasVisibleContent(item, item.subItems, hasPermissionFn));
};

/**
 * Filter entire section list
 * Removes empty sections after filtering
 */
export const filterSections = <T extends string>(
  sections: MenuSection<T>[],
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  superAdmin: boolean = false
): MenuSection<T>[] => {
  if (superAdmin) {
    // Superadmin sees all non-empty sections
    return sections.filter((section) => section.items.length > 0);
  }

  // Filter sections for regular users
  return sections
    .map((section) => {
      const filteredItems = filterMenuItems(
        section.items,
        hasPermissionFn,
        superAdmin
      );

      return {
        ...section,
        items: filteredItems,
      };
    })
    .filter((section) => section.items.length > 0); // Hide empty sections
};

/**
 * Find a menu item by screen name (recursive search)
 */
export const findMenuItemByScreen = (
  items: MenuItem[],
  screenName: string
): MenuItem | undefined => {
  for (const item of items) {
    if (item.screen === screenName) {
      return item;
    }

    if (item.subItems) {
      const found = findMenuItemByScreen(item.subItems, screenName);
      if (found) return found;
    }
  }

  return undefined;
};

/**
 * Get all accessible modules for current user
 * Useful for dynamic UI generation
 */
export const getAccessibleModules = (
  items: MenuItem[],
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  superAdmin: boolean = false
): Set<string> => {
  const modules = new Set<string>();

  const collectModules = (menuItems: MenuItem[]) => {
    for (const item of menuItems) {
      if (item.module) {
        const allowed = checkPermission(item.module, item.screen, hasPermissionFn);
        if (allowed) {
          modules.add(item.module);
        }
      }

      if (item.subItems) {
        collectModules(item.subItems);
      }
    }
  };

  if (superAdmin) {
    // Collect all modules
    const allItems = flattenMenuItems(items);
    allItems.forEach((item) => {
      if (item.module) modules.add(item.module);
    });
  } else {
    collectModules(items);
  }

  return modules;
};

/**
 * Flatten nested menu items into single array
 */
export const flattenMenuItems = (items: MenuItem[]): MenuItem[] => {
  const flattened: MenuItem[] = [];

  const flatten = (menuItems: MenuItem[]) => {
    for (const item of menuItems) {
      flattened.push(item);
      if (item.subItems) {
        flatten(item.subItems);
      }
    }
  };

  flatten(items);
  return flattened;
};

/**
 * Count accessible items in menu
 * Useful for analytics or UI debugging
 */
export const countAccessibleItems = (
  items: MenuItem[],
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  superAdmin: boolean = false
): { total: number; accessible: number } => {
  const allItems = flattenMenuItems(items);
  const total = allItems.length;

  if (superAdmin) {
    return { total, accessible: total };
  }

  const accessible = allItems.filter((item) =>
    checkPermission(item.module, item.screen, hasPermissionFn)
  ).length;

  return { total, accessible };
};

/**
 * Debug helper: log permission decisions
 */
export const logPermissionDecisions = (
  items: MenuItem[],
  hasPermissionFn: (module: string, screen: string, action: string) => boolean,
  superAdmin: boolean = false
): void => {
  console.group("[Permission Debug] Item Access Report");
  console.log("SuperAdmin:", superAdmin);

  const allItems = flattenMenuItems(items);
  let visibleCount = 0;

  for (const item of allItems) {
    const allowed = checkPermission(
      item.module,
      item.screen,
      hasPermissionFn
    );

    if (allowed) {
      console.log(
        `✅ ${item.nameKey} (${item.module}/${item.screen})`
      );
      visibleCount++;
    } else {
      console.log(
        `❌ ${item.nameKey} (${item.module}/${item.screen})`
      );
    }
  }

  console.log(`\nTotal: ${visibleCount}/${allItems.length} items visible`);
  console.groupEnd();
};
