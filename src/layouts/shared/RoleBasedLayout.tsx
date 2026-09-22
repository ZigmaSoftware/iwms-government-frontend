import { lazy, Suspense } from "react";
import { PageLoader } from "@/components/ui/PageLoader";
import type { RoleBasedLayoutProps, UserRole } from "@/types/roles";
import {
  ADMIN_VIEW_MODE_DASHBOARD,
  DEFAULT_ROLE,
  USER_ROLE_STORAGE_KEY,
  getAdminViewPreference,
  normalizeRole,
} from "@/types/roles";

const AdminLayout = lazy(() =>
  import("@/layouts/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const DashboardLayout = lazy(() =>
  import("@/layouts/dashboard/DashboardLayout").then((m) => ({ default: m.DashboardLayout })),
);

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
      return (
        <Suspense fallback={<PageLoader fullHeight />}>
          <DashboardLayout>{children}</DashboardLayout>
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<PageLoader fullHeight />}>
        <AdminLayout>{children}</AdminLayout>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader fullHeight />}>
      <DashboardLayout>{children}</DashboardLayout>
    </Suspense>
  );
}
