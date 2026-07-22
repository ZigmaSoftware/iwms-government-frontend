import { useMemo, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";

import OverallDashboard from "@/pages/dashboard/pages/OverallDashboard";

import Vehicle from "@/pages/dashboard/pages/Vehicle";
import ResourceManagement from "@/pages/dashboard/pages/ResourceManagement";
import Grievances from "@/pages/dashboard/pages/Grievances";
import Reports from "@/pages/dashboard/pages/Reports";
import BinMonitoring from "@/pages/dashboard/pages/BinMonitoring";

type DashboardComponent = ComponentType | undefined;

const ROUTES: Record<string, DashboardComponent> = {
  "dashboard-overall": OverallDashboard,

  "dashboard-vehicle": Vehicle,

  "dashboard-resources": ResourceManagement,
  "dashboard-grievances": Grievances,

  "dashboard-reports": Reports,

  // "dashboard-bins": BinMonitoring,
};

export default function DashboardEncryptedRouter() {
  const { encModule } = useParams();

  const moduleName = useMemo(
    () => decryptSegment(encModule ?? ""),
    [encModule],
  );

  if (!moduleName) {
    return <Navigate to="/dashboard" replace />;
  }

  const Component = ROUTES[moduleName];

  if (!Component) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Component />;
}
