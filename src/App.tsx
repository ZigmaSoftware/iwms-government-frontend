import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Auth from "@/pages/Auth";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import VerifyOTP from "@/pages/auth/VerifyOTP";
import ResetPassword from "@/pages/auth/ResetPassword";
import LocalBodyAuth from "@/pages/LocalBodyAuth";
import LocalBodyDashboard from "@/pages/localbody/LocalBodyDashboard";
import DistrictAuth from "@/pages/DistrictAuth";
import DistrictDashboard from "@/pages/district/DistrictDashboard";
import StateAuth from "@/pages/StateAuth";
import StateLeaderDashboard from "@/pages/state/StateLeaderDashboard";
import StateDashboard from "@/pages/state/StateDashboard";
import Dashboard from "@/pages/dashboard/pages/Dashboard";
import NotFound from "@/pages/dashboard/pages/NotFound";
import { HomeDashboard } from "@/pages/dashboard/pages/Dashboard/HomeDashboard";
import AdminHome from "@/pages/admin/AdminHome";
import AdminEncryptedRouter from "@/layouts/admin/encryptedRouting/AdminEncryptedRouter";
import CommonAuditList from "@/pages/admin/modules/superadmin/audits/commonAudit/commonAuditList";
import StaffAuditList from "@/pages/admin/modules/audits/staffAudit/staffAuditList";
import DashboardEncryptedRouter from "@/layouts/dashboard/encryptedRouting/DashboardEncryptedRouter";
import DailyTripLogReportPage from "@/pages/admin/modules/core_modules/dailyOperations/dailyTripLog/DailyTripLogReportPage";

import { AdminLayout } from "@/layouts/admin/AdminLayout";
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
import PublicGrievance from "./pages/PublicGrievance";

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
  );
}
