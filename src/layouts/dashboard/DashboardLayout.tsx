import { useEffect, useState } from "react";
import { Crown, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { HorizontalNav } from "@/layouts/dashboard/components/HorizontalNav";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/PageLoader";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import ZigmaLogo from "@/images/logo.png";
import {
  DEFAULT_ROLE,
  ADMIN_VIEW_MODE_ADMIN,
  USER_ROLE_STORAGE_KEY,
  isAdmin,
  normalizeRole,
  setAdminViewPreference,
  type DashboardLayoutProps,
  type UserRole,
} from "@/types/roles";
import { clearAuthSession } from "@/utils/authStorage";

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { setUser } = useUser();
  const [role] = useState<UserRole | null>(() => {
    if (typeof window === "undefined") return null;
    return normalizeRole(localStorage.getItem(USER_ROLE_STORAGE_KEY));
  });
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(true);
    const timer = window.setTimeout(() => setIsNavigating(false), 450);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  const handleSignOut = () => {
    try {
      clearAuthSession();
      setUser(null);

      navigate("/auth", { replace: true });
    } catch {
      toast({
        title: t("common.logout_failed_title"),
        description: t("common.logout_failed_desc"),
        variant: "destructive",
      });
    }
  };

  const handleSwitchToAdmin = () => {
    setAdminViewPreference(ADMIN_VIEW_MODE_ADMIN);
    navigate("/admin", { replace: true });
  };

  const canSwitchToAdmin = role === DEFAULT_ROLE || isAdmin(role);
  const AdminViewIcon = role === "superadmin" ? Crown : ShieldCheck;

  return (
    <div className="flex min-h-screen w-full   flex-col bg-gray-50 dark:bg-gray-900">

      {/* TOPBAR */}
      <header
        className="
          sticky top-0 z-20 
          border-b border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-900
          shadow-sm
        "
      >
        <div className="flex h-16 items-center justify-between px-2 md:px-4 lg:px-6">

          {/* LOGO */}
          <div className="flex items-center gap-3">
            <img
              src={ZigmaLogo}
              alt="Zigma Logo"
              className="h-12 w-12 object-contain"
            />
            {/* <h1 className="hidden md:block text-lg font-semibold text-gray-700 dark:text-gray-200">
              IWMS Dashboard
            </h1> */}
          </div>

          {/* NAVIGATION + ACTIONS */}
          <div className="flex items-center gap-2">

            {/* NAVIGATION */}
            <HorizontalNav />

            {canSwitchToAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchToAdmin}
                className="rainbow-border flex h-9 w-9 items-center justify-center p-0"
                title={t("common.admin_view")}
                aria-label={t("common.admin_view")}
              >
                <AdminViewIcon className="h-4 w-4" />
                <span className="sr-only">{t("common.admin_view")}</span>
              </Button>
            )}

            <LanguageSwitcher variant="select" className="w-[140px]" />

            {/* THEME TOGGLE */}
            <button
              onClick={toggleTheme}
              className="rainbow-border rounded-md border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Toggle color theme"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>

            {/* LOGOUT BUTTON */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="
                rainbow-border
                flex items-center gap-1 
                rounded-md 
                border-gray-300 dark:border-gray-600
                hover:bg-gray-100 dark:hover:bg-gray-800
                transition-all
              "
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-2 md:p-4 lg:p-6">
        {isNavigating ? (
          <PageLoader fullHeight message={t("common.loading_dashboard")} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
