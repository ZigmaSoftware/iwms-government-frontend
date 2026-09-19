import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ChevronRight } from "lucide-react";
import { buildNavRouteMap } from "../navRouteMap";
import { decryptSegment } from "@/utils/routeCrypto";

type BreadcrumbItem = {
  label: string;
  path?: string;
  isActive: boolean;
};

// AES encryption (routeCrypto.encryptSegment) uses a random salt on every
// call, so the same plaintext segment (e.g. "masters") produces a different
// ciphertext each time the app boots — including on a hard reload. Comparing
// the URL's ciphertext directly against navRouteMap's ciphertext (which is
// re-encrypted fresh on every boot too) therefore only matches by luck.
// Decrypting both sides back to plaintext first makes the match stable
// across reloads, same as the actual router does (see decryptSegment usages
// in AdminEncryptedRouter/AppSidebar/etc).
const toPlainPath = (path: string): string =>
  path
    .split("/")
    .map((segment) => (segment ? decryptSegment(segment) ?? segment : segment))
    .join("/");

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

    const plainPathname = toPlainPath(location.pathname);
    const routeMap = buildNavRouteMap();
    const matched = routeMap.find((r) => {
      if (r.path === "/admin") return false;
      const plainEntryPath = toPlainPath(r.path);
      return (
        plainPathname === plainEntryPath ||
        plainPathname.startsWith(plainEntryPath + "/")
      );
    });

    if (!matched) {
      if (import.meta.env.DEV) {
        console.warn(
          `[AdminBreadcrumb] No navRouteMap entry matches "${location.pathname}". Add an entry in navRouteMap.ts so the breadcrumb renders correctly.`
        );
      }
      return [home, { label: "...", isActive: true }];
    }

    const items: BreadcrumbItem[] = [home];

    if (matched.parentNameKey) {
      items.push({ label: t(matched.parentNameKey), isActive: false });
    }

    items.push({ label: t(matched.nameKey), isActive: true });

    if (location.pathname.endsWith("/new")) {
      items[items.length - 1] = {
        ...items[items.length - 1],
        path: matched.path,
        isActive: false,
      };
      items.push({ label: t("common.add"), isActive: true });
    } else if (location.pathname.endsWith("/edit")) {
      items[items.length - 1] = {
        ...items[items.length - 1],
        path: matched.path,
        isActive: false,
      };
      items.push({ label: t("common.edit"), isActive: true });
    } else if (location.pathname.endsWith("/report")) {
      items[items.length - 1] = {
        ...items[items.length - 1],
        path: matched.path,
        isActive: false,
      };
      items.push({ label: t("common.view"), isActive: true });
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
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
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
