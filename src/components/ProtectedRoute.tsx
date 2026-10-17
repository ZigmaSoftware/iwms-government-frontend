import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { USER_ROLE_STORAGE_KEY, canOpenAdmin, normalizeRole } from "@/types/roles";
import { getStoredPermissions } from "@/utils/permissions";
import { getStoredAccessToken, isAccessTokenValid } from "@/utils/authStorage";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

function hasAnyPermission(): boolean {
  return Object.values(getStoredPermissions()).some((screens) =>
    Object.values(screens).some((actions) => Array.isArray(actions) && actions.length > 0),
  );
}

function canAccess(adminOnly: boolean): boolean {
  if (!isAccessTokenValid(getStoredAccessToken())) return false;
  if (!adminOnly) return true;

  const role = normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));
  // A non-admin is still let in if it holds any screen permission.
  return canOpenAdmin(role) || hasAnyPermission();
}

/** Renders children for a valid session (admin-capable when adminOnly), otherwise redirects to /auth. */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  return canAccess(adminOnly) ? <>{children}</> : <Navigate to="/auth" replace />;
}
