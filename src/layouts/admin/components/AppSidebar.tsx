import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermission } from "@/contexts/PermissionContext";
import { cn } from "@/lib/utils";

import { ChevronDown, Search, X } from "lucide-react";

import { useSidebar } from "@/contexts/SideBarContext";
import { isSuperAdminUser } from "@/contexts/screenPermission";
import { decryptSegment } from "@/utils/routeCrypto";
import {
  MODULE_GROUPS,
  SIDEBAR_SECTIONS,
  type NavItem,
  type SidebarPermission,
  type SidebarSectionKey,
} from "../sidebarMenu";

const menuButtonBase =
  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300";
const menuActiveClasses =
  "bg-linear-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-200/60";
const menuInactiveClasses =
  "text-gray-700 hover:bg-green-50 hover:text-green-800";
const subMenuContainerClasses =
  "mt-1 ml-2 border-l-2 border-green-100 pl-3 space-y-0.5 pb-1";
const subMenuActiveClasses =
  "block rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-600";
const subMenuInactiveClasses =
  "block rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-green-50 hover:text-green-700";

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation();
  const { hasPermission } = usePermission();
  const showFullSidebar = isExpanded || isMobileOpen;

  //  Detect if current user is superadmin
  const isSuperAdmin = useMemo(() => isSuperAdminUser(), []);

  // An entry is visible with "view" on ANY of its screens — a merged entry
  // (e.g. "Reference Data" standing in for modules/priorities/sources/
  // statuses) must not hide from someone holding only one of them.
  const canSee = useCallback(
    ({ module, screens }: SidebarPermission): boolean => {
      if (!module || !screens?.length) return true;
      return screens.some((screen) => hasPermission(module, screen, "view"));
    },
    [hasPermission]
  );

  // Filter sub-items: only show items with permission
  const filterSubItems = useCallback((
    subItems: NavItem["subItems"]
  ): NavItem["subItems"] => {
    if (!subItems) return undefined;

    // Superadmin sees all items
    if (isSuperAdmin) return subItems;

    // Regular users: only show items they have permission for
    return subItems.filter((sub) => {
      return canSee(sub);
    });
  }, [canSee, isSuperAdmin]);

  // Check if menu item should be shown
  const hasVisibleContent = useCallback((
    item: NavItem,
    filteredSubItems: NavItem["subItems"]
  ): boolean => {
    // If no subItems, check direct permission or show if no permission needed
    if (!item.subItems || item.subItems.length === 0) {
      return canSee(item);
    }

    // If has subItems, show only if filtered children exist
    return !!(filteredSubItems && filteredSubItems.length > 0);
  }, [canSee]);

  // Build sidebar sections with strict filtering
  const sidebarSections = useMemo(
    () => {
      const allSections = SIDEBAR_SECTIONS;

      // If superadmin, show ALL sections with ALL items
      if (isSuperAdmin) {
        return allSections.filter((section) => section.items.length > 0);
      }

      // For regular users: strict filtering
      return allSections
        .map((section) => {
          // Filter items within section
          const filteredItems = section.items
            .map((item) => {
              const filteredSubItems = filterSubItems(item.subItems);
              return {
                ...item,
                subItems: filteredSubItems,
              };
            })
            .filter((item) => hasVisibleContent(item, item.subItems));

          return {
            ...section,
            items: filteredItems,
          };
        })
        .filter((section) => section.items.length > 0); // Only show sections with visible items
    },
    [filterSubItems, hasVisibleContent, isSuperAdmin]
  );

  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sidebarSections;
    const q = searchQuery.toLowerCase().trim();
    return sidebarSections
      .map((section) => {
        const filteredItems = section.items
          .map((item) => {
            const parentName = t(item.nameKey).toLowerCase();
            if (parentName.includes(q)) return item;
            if (!item.subItems || item.subItems.length === 0) return null;
            const matchingSubs = item.subItems.filter((sub) =>
              t(sub.nameKey).toLowerCase().includes(q)
            );
            return matchingSubs.length > 0 ? { ...item, subItems: matchingSubs } : null;
          })
          .filter((item): item is NavItem => item !== null);
        return { ...section, items: filteredItems };
      })
      .filter((section) => section.items.length > 0);
  }, [searchQuery, sidebarSections, t]);

  // Nest the flat, permission/search-filtered sections ("main screens") under
  // their top-level "module" group, in the exact order each group expects.
  const groupedSections = useMemo(() => {
    const sectionsByKey = new Map<SidebarSectionKey, (typeof filteredSections)[number]>(
      filteredSections.map((section) => [section.key, section])
    );
    return MODULE_GROUPS.map((group) => ({
      key: group.key,
      titleKey: group.titleKey,
      accent: group.accent,
      sections: group.sectionKeys
        .map((key) => sectionsByKey.get(key))
        .filter(
          (section): section is (typeof filteredSections)[number] =>
            !!section && section.items.length > 0
        ),
    })).filter((group) => group.sections.length > 0);
  }, [filteredSections]);

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: SidebarSectionKey;
    index: number;
  } | null>(null);

  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentDecodedPath = useMemo(() => {
    const [master, module] = location.pathname.split("/").filter(Boolean);
    return {
      master: decryptSegment(master || "") ?? null,
      module: decryptSegment(module || "") ?? null,
    };
  }, [location.pathname]);

  const isActive = useCallback(
    (path: string, allowNestedRoutes = false) => {
      if (!path) return false;

      const segments = path.split("/").filter(Boolean);
      const [encMaster, encModule] = segments;
      const decodedMaster = decryptSegment(encMaster || "");
      const decodedModule = decryptSegment(encModule || "");

      if (!decodedMaster && !decodedModule) {
        if (location.pathname === path) return true;
        return (
          allowNestedRoutes &&
          location.pathname.startsWith(path.endsWith("/") ? path : `${path}/`)
        );
      }

      if (decodedMaster !== currentDecodedPath.master) return false;
      if (!decodedModule) return true;

      if (currentDecodedPath.module === decodedModule) return true;
      return (
        allowNestedRoutes &&
        currentDecodedPath.module?.startsWith(decodedModule)
      );
    },
    [currentDecodedPath, location.pathname]
  );

  useEffect(() => {
    let matched = false;
    const skipAutoOpenSubmenuKeys = new Set([
      "admin.nav.collection_monitoring",
    ]);

    sidebarSections.forEach((section) => {
      section.items.forEach((nav, index) => {
        nav.subItems?.forEach((sub) => {
          if (isActive(sub.path, true)) {
            matched = true;
            if (!skipAutoOpenSubmenuKeys.has(sub.nameKey)) {
              setOpenSubmenu({ type: section.key, index });
            }
          }
        });
      });
    });

    if (!matched) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenSubmenu(null);
    }
  }, [location, isActive, sidebarSections]);

  useEffect(() => {
    if (openSubmenu) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      const el = subMenuRefs.current[key];
      if (el) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: el.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, type: SidebarSectionKey) => {
    if (!showFullSidebar) {
      toggleSidebar();
      setOpenSubmenu({ type, index });
      return;
    }

    setOpenSubmenu((prev) =>
      prev && prev.type === type && prev.index === index
        ? null
        : { type, index }
    );
  };

  const renderMenuItems = (items: NavItem[], type: SidebarSectionKey) => (
    <ul className="flex flex-col gap-2">
      {items.map((nav, index) => {
        const isSubmenuOpen =
          (searchQuery.trim() !== "" && !!(nav.subItems && nav.subItems.length > 0)) ||
          (openSubmenu?.type === type && openSubmenu?.index === index);
        return (
          <li key={nav.path ?? nav.nameKey}>
            {nav.subItems && nav.subItems.length > 0 ? (
              <button
                onClick={() => handleSubmenuToggle(index, type)}
                className={`${menuButtonBase} ${
                  isSubmenuOpen ? menuActiveClasses : menuInactiveClasses
                }`}
              >
                <span
                  className={cn(
                    "menu-item-icon-size shrink-0",
                    !showFullSidebar && "mx-auto",
                    isSubmenuOpen ? "text-white" : "text-green-600"
                  )}
                >
                  {nav.icon}
                </span>

                {showFullSidebar && (
                  <>
                    <span
                      className={cn(
                        "truncate text-sm font-semibold",
                        isSubmenuOpen ? "text-white" : "text-gray-800"
                      )}
                    >
                      {t(nav.nameKey)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                        isSubmenuOpen ? "rotate-180 text-white" : "text-green-500"
                      )}
                    />
                  </>
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  className={`${menuButtonBase} ${
                    isActive(nav.path, true)
                      ? menuActiveClasses
                      : menuInactiveClasses
                  }`}
                >
                  <span
                    className={cn(
                      "menu-item-icon-size shrink-0",
                      !showFullSidebar && "mx-auto",
                      isActive(nav.path, true) ? "text-white" : "text-green-600"
                    )}
                  >
                    {nav.icon}
                  </span>
                  {showFullSidebar && (
                    <span
                      className={cn(
                        "truncate text-sm font-semibold",
                        isActive(nav.path, true) ? "text-white" : "text-gray-800"
                      )}
                    >
                      {t(nav.nameKey)}
                    </span>
                  )}
                </Link>
              )
            )}

            {nav.subItems && nav.subItems.length > 0 && showFullSidebar && (
              <div
                ref={(el) => {
                  subMenuRefs.current[`${type}-${index}`] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height: isSubmenuOpen
                    ? `${subMenuHeight[`${type}-${index}`]}px`
                    : "0px",
                }}
              >
                <ul className={subMenuContainerClasses}>
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.path}>
                      <Link
                        to={subItem.path}
                        className={`block px-3 py-1.5 text-sm font-medium transition-colors ${
                          isActive(subItem.path, true)
                            ? subMenuActiveClasses
                            : subMenuInactiveClasses
                        }`}
                      >
                        {t(subItem.nameKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={cn(
        "fixed left-0 top-(--admin-header-h) z-50 h-[calc(100vh-var(--admin-header-h))] transition-all duration-300 ease-out",
        "border-r border-green-100 bg-white shadow-lg shadow-green-100/40",
        showFullSidebar ? "w-[290px]" : "w-20",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      {/* Top accent bar: green → blue → orange */}
      <div className="absolute left-0 right-0 top-0 h-[3px] bg-linear-to-r from-green-500 via-blue-500 to-orange-400" />

      <div className="flex h-full flex-col px-3 pb-6 pt-5">
        {/* Search input — only when expanded */}
        {showFullSidebar && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-green-100 bg-green-50/50 py-2 pl-9 pr-8 text-sm text-gray-700 placeholder-gray-400 focus:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="no-scrollbar flex-1 overflow-y-auto pr-1">
          <nav className="flex flex-col gap-1.5">
            {groupedSections.length > 0 ? (
              groupedSections.map((group, groupIndex) => (
                <div key={group.key} className="flex flex-col gap-1">
                  {showFullSidebar ? (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 pb-1.5",
                        groupIndex === 0 ? "pt-0" : "pt-3"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", group.accent)} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        {t(group.titleKey)}
                      </span>
                    </div>
                  ) : (
                    groupIndex > 0 && (
                      <div className="mx-2 my-2 h-px bg-green-100" />
                    )
                  )}

                  {group.sections.map((section) => (
                    <div key={section.key} className="flex flex-col gap-1">
                      {renderMenuItems(section.items, section.key)}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              showFullSidebar && searchQuery.trim() && (
                <p className="px-3 py-6 text-center text-sm text-gray-400">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
              )
            )}
          </nav>
        </div>

        {/* Bottom blue accent line */}
        <div className="mt-4 h-px bg-linear-to-r from-transparent via-blue-200 to-transparent" />
      </div>
    </aside>
  );
};

export default AppSidebar;
