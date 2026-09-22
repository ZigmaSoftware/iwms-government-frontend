import { Suspense, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";

import { decryptSegment } from "@/utils/routeCrypto";
import { PageLoader } from "@/components/ui/PageLoader";
import { ROUTES } from "./dashboardRoutes";

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

  return (
    <Suspense fallback={<PageLoader fullHeight />}>
      <Component />
    </Suspense>
  );
}
