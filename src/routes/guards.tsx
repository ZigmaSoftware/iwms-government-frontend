import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBasedLayout } from "@/layouts/shared/RoleBasedLayout";
import type { UserRole } from "@/types/roles";
import {
  ADMIN_VIEW_MODE_ADMIN,
  DEFAULT_ROLE,
  USER_ROLE_STORAGE_KEY,
  canOpenAdmin,
  getAdminViewPreference,
  normalizeRole,
} from "@/types/roles";
import { AdminLayout } from "./pages";

const getStoredRole = () => normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));

/** Admins and company users belong on /admin unless they switched to the dashboard view. */
function prefersAdminView(role: UserRole | null): boolean {
  return canOpenAdmin(role) && getAdminViewPreference() === ADMIN_VIEW_MODE_ADMIN;
}

/** "/" → /admin or /dashboard. A missing role is treated as the default company user. */
export function HomeRedirect() {
  const role = getStoredRole() ?? DEFAULT_ROLE;
  return <Navigate to={prefersAdminView(role) ? "/admin" : "/dashboard"} replace />;
}

/** Logged-in users; admin-view users are bounced to /admin. */
export function DashboardRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      {prefersAdminView(getStoredRole()) ? (
        <Navigate to="/admin" replace />
      ) : (
        <RoleBasedLayout>{children}</RoleBasedLayout>
      )}
    </ProtectedRoute>
  );
}

/** Admin roles, company users, or anyone holding at least one screen permission. */
export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute adminOnly>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}
