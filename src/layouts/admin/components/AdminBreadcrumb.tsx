import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ChevronRight } from "lucide-react";
import { buildNavRouteMap } from "../navRouteMap";

type BreadcrumbItem = {
  label: string;
  path?: string;
  isActive: boolean;
};

const AdminBreadcrumb: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const home: BreadcrumbItem = {
      label: t("admin.nav.dashboard"),
      path: "/admin",
      isActive: false,
    };

    if (location.pathname === "/admin") {
      return [{ ...home, isActive: true }];
    }

    const routeMap = buildNavRouteMap();
    const matched = routeMap.find(
      (r) =>
        r.path !== "/admin" &&
        (location.pathname === r.path ||
          location.pathname.startsWith(r.path + "/"))
    );

    if (!matched) {
      return [home, { label: "...", isActive: true }];
    }

    const isScheduleMaster = matched.parentNameKey === "admin.nav.schedule_masters";
    const items: BreadcrumbItem[] = isScheduleMaster ? [] : [home];

    if (matched.parentNameKey) {
      items.push({ label: t(matched.parentNameKey), isActive: false });
    }

    items.push({ label: t(matched.nameKey), isActive: true });

    if (isScheduleMaster && location.pathname.endsWith("/new")) {
      items[items.length - 1].isActive = false;
      items.push({ label: t("common.add"), isActive: true });
    } else if (isScheduleMaster && location.pathname.endsWith("/edit")) {
      items[items.length - 1].isActive = false;
      items.push({ label: t("common.edit"), isActive: true });
    }

    return items;
  }, [location.pathname, t]);

  return (
    <nav
      aria-label="breadcrumb"
      className="mb-4 flex items-center gap-1 rounded-xl border border-green-100 bg-linear-to-r from-green-50 to-white px-4 py-2.5"
    >
      {breadcrumbs.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          )}
          {item.isActive ? (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-600">
              {index === 0 && <Home className="h-3.5 w-3.5" />}
              {item.label}
            </span>
          ) : item.path ? (
            <Link
              to={item.path}
              className="flex items-center gap-1.5 text-sm font-medium text-green-700 transition-colors hover:text-green-900"
            >
              {index === 0 && <Home className="h-3.5 w-3.5" />}
              {item.label}
            </Link>
          ) : (
            <span className="text-sm font-medium text-blue-600">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
};

export default AdminBreadcrumb;
