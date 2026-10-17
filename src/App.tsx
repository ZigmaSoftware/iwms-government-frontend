import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { PageLoader } from "@/components/ui/PageLoader";
import SessionIdleGuard from "@/components/auth/SessionIdleGuard";
import { AdminRoute, DashboardRoute, HomeRedirect } from "@/routes/guards";
import {
  AdminEncryptedRouter,
  AdminHome,
  AdminHomeGate,
  Auth,
  CommonAuditList,
  DailyTripLogReportPage,
  Dashboard,
  DashboardEncryptedRouter,
  DistrictAuth,
  DistrictDashboard,
  ForgotPassword,
  HomeDashboard,
  LocalBodyAuth,
  LocalBodyDashboard,
  NotFound,
  PublicGrievance,
  ResetPassword,
  StateAuth,
  StateDashboard,
  StateLeaderDashboard,
  VerifyOTP,
} from "@/routes/pages";

export default function App() {
  return (
    <Suspense fallback={<PageLoader fullHeight />}>
      <SessionIdleGuard />
      <Routes>
        {/* ---------- Public ---------- */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/verify-otp" element={<VerifyOTP />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/publicgrivence/*" element={<PublicGrievance />} />

        {/* ---------- Local body / district / state portals ---------- */}
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

        {/* ---------- Dashboard (logged in) ---------- */}
        <Route path="/dashboard" element={<DashboardRoute><HomeDashboard /></DashboardRoute>} />
        <Route path="/dashboard/overview" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
        <Route path="/dashboard/:encModule" element={<DashboardRoute><DashboardEncryptedRouter /></DashboardRoute>} />

        {/* ---------- Admin ---------- */}
        <Route path="/admin" element={<AdminRoute><AdminHomeGate><AdminHome /></AdminHomeGate></AdminRoute>} />
        <Route path="/audits/common-audit" element={<AdminRoute><CommonAuditList /></AdminRoute>} />
        {/* Old "Collection Audit" bookmark — now merged into the common audit page. */}
        <Route path="/audits/staff-audit" element={<AdminRoute><CommonAuditList /></AdminRoute>} />
        <Route path="/:encMaster/:encModule" element={<AdminRoute><AdminEncryptedRouter /></AdminRoute>} />
        <Route path="/:encMaster/:encModule/new/*" element={<AdminRoute><AdminEncryptedRouter /></AdminRoute>} />
        <Route path="/:encMaster/:encModule/:id/edit/*" element={<AdminRoute><AdminEncryptedRouter /></AdminRoute>} />
        <Route path="/:encMaster/:encModule/:id/report" element={<AdminRoute><DailyTripLogReportPage /></AdminRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
