import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "@/types/roles";
import { USER_ROLE_STORAGE_KEY, normalizeRole } from "@/types/roles";
import { getStoredPermissions } from "@/utils/permissions";
import { getStoredAccessToken, isAccessTokenValid } from "@/utils/authStorage";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    const role = normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));

    if (!token) {
      setIsAllowed(false);
      return;
    }

    // ✅ If allowedRoles is specified and the user's role is not in the list,
    //    still allow access if the superadmin has granted them permissions.
    //    This covers roles like "company driver" that are not "admin" by name
    //    but have been given module access by a superadmin.
    if (allowedRoles?.length && (!role || !allowedRoles.includes(role))) {
      // Allow in if the superadmin has granted ANY action on ANY screen.
      // We must not require the "view" action specifically: some roles (e.g.
      // govt_district_admin) are granted add/premview/premedit/premdelete but
      // no plain "view", and requiring "view" here bounces them back to /auth.
      const storedPerms = getStoredPermissions();
      const hasPerms = Object.values(storedPerms).some((screens) =>
        Object.values(screens).some(
          (actions) => Array.isArray(actions) && actions.length > 0,
        ),
      );

      console.log(
        "[ProtectedRoute] Role not in allowedRoles:",
        role,
        "| hasPermissions:",
        hasPerms
      );

      if (!hasPerms) {
        setIsAllowed(false);
        return;
      }
      // else: fall through — user has permissions, allow them in
    }

    setIsAllowed(isAccessTokenValid(token));
  }, [allowedRoles]);

  // Loading
  if (isAllowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Unauthorized → redirect
  if (!isAllowed) {
    return <Navigate to="/auth" replace />;
  }

  // Authorized → render children
  return <>{children}</>;
}
