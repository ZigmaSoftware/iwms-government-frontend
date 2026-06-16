import { AdminLayout } from "@/layouts/admin/AdminLayout";
import { DashboardLayout } from "@/layouts/dashboard/DashboardLayout";
import type { RoleBasedLayoutProps, UserRole } from "@/types/roles";
import {
  ADMIN_VIEW_MODE_DASHBOARD,
  DEFAULT_ROLE,
  USER_ROLE_STORAGE_KEY,
  getAdminViewPreference,
  normalizeRole,
} from "@/types/roles";

const getStoredRole = (): UserRole | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));
};

export function RoleBasedLayout({
  children,
  roleOverride,
}: RoleBasedLayoutProps) {
  const resolvedRole = roleOverride ?? getStoredRole() ?? DEFAULT_ROLE;

  if (resolvedRole === DEFAULT_ROLE) {
    const adminPreference = getAdminViewPreference();
    if (adminPreference === ADMIN_VIEW_MODE_DASHBOARD) {
      return <DashboardLayout>{children}</DashboardLayout>;
    }

    return <AdminLayout>{children}</AdminLayout>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
