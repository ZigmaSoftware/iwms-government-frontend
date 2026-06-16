import { useMemo, type ComponentType } from "react";
import { Navigate, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";

import OverallDashboard from "@/pages/dashboard/pages/OverallDashboard";
import MapView from "@/pages/dashboard/pages/MapView";
import Vehicle from "@/pages/dashboard/pages/Vehicle";
import WasteCollection from "@/pages/dashboard/pages/WasteCollection";
import ResourceManagement from "@/pages/dashboard/pages/ResourceManagement";
import Grievances from "@/pages/dashboard/pages/Grievances";
import Alerts from "@/pages/dashboard/pages/Alerts";
import Reports from "@/pages/dashboard/pages/Reports";
import Weighbridge from "@/pages/dashboard/pages/Weighbridge";
import BinMonitoring from "@/pages/dashboard/pages/BinMonitoring";

type DashboardComponent = ComponentType | undefined;

const ROUTES: Record<string, DashboardComponent> = {
  "dashboard-overall": OverallDashboard,
  "dashboard-map": MapView,
  "dashboard-vehicle": Vehicle,
  "dashboard-waste-collection": WasteCollection,
  "dashboard-resources": ResourceManagement,
  "dashboard-grievances": Grievances,
  "dashboard-alerts": Alerts,
  "dashboard-reports": Reports,
  "dashboard-weighbridge": Weighbridge,
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
