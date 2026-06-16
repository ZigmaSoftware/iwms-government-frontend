import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePermission, useShouldRedirectToDashboard } from "@/contexts/PermissionContext";
import type { PermissionAction } from "@/utils/permissions";

interface PermissionProtectedRouteProps {
  moduleName: string;
  screenName: string;
  action?: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
  onAccessDenied?: () => void;
}

/**
 * 🔹 Check if access to route should be allowed
 * 
 * Logic:
 * 1. If loading → show loading UI
 * 2. If dashboard route → ALWAYS allow (all users have access)
 * 3. If empty permissions → redirect to dashboard
 * 4. If user has permission → allow
 * 5. Otherwise → redirect to dashboard
 */
function shouldAllowAccess(
  hasPermission: boolean,
  isEmptyPermissions: boolean,
  isLoading: boolean,
  routePath?: string
): "loading" | "allowed" | "redirect" {
  // ⏳ Loading state
  if (isLoading) {
    return "loading";
  }

  // ✅ ALWAYS allow dashboard and admin routes (accessible to all users)
  if (routePath === "/dashboard" || routePath === "/admin") {
    return "allowed";
  }

  // ⚠️ If no permissions → fallback to dashboard
  if (isEmptyPermissions) {
    return "redirect";
  }

  // ✅ If user has permission → allow
  if (hasPermission) {
    return "allowed";
  }

  // ❌ Otherwise → redirect to dashboard
  return "redirect";
}

/**
 * ✅ Permission-Protected Route Component
 * 
 * Usage:
 * ```jsx
 * <PermissionProtectedRoute
 *   moduleName="common-masters"
 *   screenName="continents"
 *   action="view"
 * >
 *   <ContinentsPage />
 * </PermissionProtectedRoute>
 * ```
 */
export function PermissionProtectedRoute({
  moduleName,
  screenName,
  action = "view",
  children,
  fallback,
  onAccessDenied,
}: PermissionProtectedRouteProps) {
  const { hasPermission, isLoading } = usePermission();
  const { shouldRedirect: isEmptyPermissions } = useShouldRedirectToDashboard();
  const location = useLocation();

  const [accessStatus, setAccessStatus] = useState<
    "loading" | "allowed" | "redirect"
  >("loading");

  useEffect(() => {
    const userHasPermission = hasPermission(moduleName, screenName, action);

    const status = shouldAllowAccess(
      userHasPermission,
      isEmptyPermissions,
      isLoading,
      location.pathname
    );

    console.log(
      `[PermissionProtectedRoute] ${moduleName}/${screenName} (${action}) → ${status} | path=${location.pathname}`
    );

    if (status === "redirect") {
      onAccessDenied?.();
    }

    setAccessStatus(status);
  }, [
    moduleName,
    screenName,
    action,
    hasPermission,
    isEmptyPermissions,
    isLoading,
    location.pathname,
    onAccessDenied,
  ]);

  // ⏳ Loading UI
  if (accessStatus === "loading") {
    return (
      fallback ?? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      )
    );
  }

  // ❌ Redirect if no access
  if (accessStatus === "redirect") {
    console.log(
      `[PermissionProtectedRoute] 🚫 Access denied to ${moduleName}/${screenName} - Redirecting to /dashboard`
    );
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Allow access
  return <>{children}</>;
}

/**
 * ✅ HOC wrapper for class components or functions
 */
export function withPermissionProtection<P extends object>(
  Component: React.ComponentType<P>,
  {
    moduleName,
    screenName,
    action = "view",
    fallback,
  }: {
    moduleName: string;
    screenName: string;
    action?: PermissionAction;
    fallback?: ReactNode;
  }
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionProtectedRoute
        moduleName={moduleName}
        screenName={screenName}
        action={action}
        fallback={fallback}
      >
        <Component {...props} />
      </PermissionProtectedRoute>
    );
  };
}

/**
 * ✅ Hook for conditional rendering based on permissions
 * 
 * Usage:
 * ```jsx
 * const canView = useCanAccess("common-masters", "continents", "view");
 * if (!canView) return null;
 * return <ContinentsPage />;
 * ```
 */
export function useCanAccess(
  moduleName: string,
  screenName: string,
  action: PermissionAction = "view"
): boolean {
  const { hasPermission, isLoading } = usePermission();
  const { shouldRedirect: isEmptyPermissions } = useShouldRedirectToDashboard();

  const [canAccess, setCanAccess] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setCanAccess(false);
      return;
    }

    // ❗ Allow dashboard always
    if (moduleName.toLowerCase() === "dashboard") {
      setCanAccess(true);
      return;
    }

    if (isEmptyPermissions) {
      setCanAccess(false);
      return;
    }

    const userHasPermission = hasPermission(moduleName, screenName, action);
    setCanAccess(userHasPermission);
  }, [
    moduleName,
    screenName,
    action,
    hasPermission,
    isLoading,
    isEmptyPermissions,
  ]);

  return canAccess;
}