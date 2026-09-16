import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { PageLoader } from "@/components/ui/PageLoader";

const Auth = lazy(() => import("@/pages/Auth"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const VerifyOTP = lazy(() => import("@/pages/auth/VerifyOTP"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const LocalBodyAuth = lazy(() => import("@/pages/LocalBodyAuth"));
const LocalBodyDashboard = lazy(() => import("@/pages/localbody/LocalBodyDashboard"));
const DistrictAuth = lazy(() => import("@/pages/DistrictAuth"));
const DistrictDashboard = lazy(() => import("@/pages/district/DistrictDashboard"));
const StateAuth = lazy(() => import("@/pages/StateAuth"));
const StateLeaderDashboard = lazy(() => import("@/pages/state/StateLeaderDashboard"));
const StateDashboard = lazy(() => import("@/pages/state/StateDashboard"));
const Dashboard = lazy(() => import("@/pages/dashboard/pages/Dashboard"));
const NotFound = lazy(() => import("@/pages/dashboard/pages/NotFound"));
const HomeDashboard = lazy(() =>
  import("@/pages/dashboard/pages/Dashboard/HomeDashboard").then((m) => ({ default: m.HomeDashboard })),
);
const AdminHome = lazy(() => import("@/pages/admin/AdminHome"));
const AdminEncryptedRouter = lazy(() => import("@/layouts/admin/encryptedRouting/AdminEncryptedRouter"));
const CommonAuditList = lazy(() => import("@/pages/admin/modules/superadmin/audits/commonAudit/commonAuditList"));
const StaffAuditList = lazy(() => import("@/pages/admin/modules/audits/staffAudit/staffAuditList"));
const DashboardEncryptedRouter = lazy(() => import("@/layouts/dashboard/encryptedRouting/DashboardEncryptedRouter"));
const DailyTripLogReportPage = lazy(
  () => import("@/pages/admin/modules/core_modules/dailyOperations/dailyTripLog/DailyTripLogReportPage"),
);
const PublicGrievance = lazy(() => import("./pages/PublicGrievance"));
const AdminLayout = lazy(() =>
  import("@/layouts/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);

import { RoleBasedLayout } from "@/layouts/shared/RoleBasedLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { AdminViewMode, UserRole } from "@/types/roles";
import {
  ADMIN_ROLES,
  DEFAULT_ROLE,
  ADMIN_VIEW_MODE_ADMIN,
  ADMIN_VIEW_MODE_DASHBOARD,
  USER_ROLE_STORAGE_KEY,
  getAdminViewPreference,
  normalizeRole,
  isAdmin,
} from "@/types/roles";

const ADMIN_ACCESS_ROLES: UserRole[] = [DEFAULT_ROLE, ...ADMIN_ROLES];

function withDashboard(children: ReactNode) {
  return (
    <ProtectedRoute>
      <DashboardRouteGuard>
        <RoleBasedLayout>{children}</RoleBasedLayout>
      </DashboardRouteGuard>
    </ProtectedRoute>
  );
}

function withAdmin(children: ReactNode) {
  return (
    <ProtectedRoute allowedRoles={ADMIN_ACCESS_ROLES}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}

function HomeRedirect() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedRole = normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));
  const preference = getAdminViewPreference();

  if (isAdmin(storedRole)) {
    if (preference === ADMIN_VIEW_MODE_DASHBOARD) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  const resolvedRole = storedRole ?? DEFAULT_ROLE;

  if (resolvedRole === DEFAULT_ROLE) {
    if (preference === ADMIN_VIEW_MODE_ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function DashboardRouteGuard({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [adminViewPreference, setAdminViewPreferenceState] = useState<AdminViewMode | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const storedRole = normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));
      setRole(storedRole);
      setAdminViewPreferenceState(getAdminViewPreference());
    } finally {
      setChecked(true);
    }
  }, []);

  if (!checked) {
    return null;
  }

  const preference = adminViewPreference ?? ADMIN_VIEW_MODE_ADMIN;

  if (isAdmin(role) && preference === ADMIN_VIEW_MODE_ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  if (role === DEFAULT_ROLE && preference === ADMIN_VIEW_MODE_ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader fullHeight />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/verify-otp" element={<VerifyOTP />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/localbody" element={<Navigate to="/localbody" replace />} />
        <Route path="/localbody" element={<LocalBodyAuth />} />
        <Route path="/localbody/dashboard" element={<LocalBodyDashboard />} />
        <Route path="/localbody/data" element={<Navigate to="/localbody/dashboard" replace />} />
        <Route path="/auth/district" element={<Navigate to="/district" replace />} />
        <Route path="/district" element={<DistrictAuth />} />
        <Route path="/district/dashboard" element={<DistrictDashboard />} />
        <Route path="/state" element={<StateAuth />} />
        <Route path="/state/dashboard" element={<StateLeaderDashboard />} />
        <Route path="/state/preview" element={<StateDashboard />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/publicgrivence/*" element={<PublicGrievance />} />
        <Route path="/dashboard" element={withDashboard(<HomeDashboard />)} />
        <Route path="/dashboard/overview" element={withDashboard(<Dashboard />)} />
        <Route path="/dashboard/:encModule" element={withDashboard(<DashboardEncryptedRouter />)} />
        <Route path="/admin" element={withAdmin(<AdminHome />)} />
        <Route path="/audits/common-audit" element={withAdmin(<CommonAuditList />)} />
        <Route path="/audits/staff-audit" element={withAdmin(<StaffAuditList />)} />
        <Route path="/:encMaster/:encModule" element={withAdmin(<AdminEncryptedRouter />)} />
        <Route path="/:encMaster/:encModule/new/*" element={withAdmin(<AdminEncryptedRouter />)} />
        <Route path="/:encMaster/:encModule/:id/edit/*" element={withAdmin(<AdminEncryptedRouter />)} />
        <Route path="/:encMaster/:encModule/:id/report" element={withAdmin(<DailyTripLogReportPage />)} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
