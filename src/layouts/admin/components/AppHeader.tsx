import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Zap } from "lucide-react";

import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import UserDropdown from "@/components/header/UserDropdown";
import { useTheme } from "@/contexts/ThemeContext";
import { useSidebar } from "@/contexts/SideBarContext";
import { cn } from "@/lib/utils";
import {
  ADMIN_VIEW_MODE_DASHBOARD,
  setAdminViewPreference,
} from "@/types/roles";
import ZigmaLogo from "@/images/logo.png";
import { getStoredProfile } from "@/utils/authStorage";
import { api } from "@/api";

/** Resolve company logo URL from stored profile, prepending the backend origin.
 *
 * Rules:
 *  - Platform super-admin (user_type === "platform") → always ZigmaLogo
 *  - Company user (staff / customer / contractor) with a logo → their company logo
 *  - Anything else (no logo, missing profile) → ZigmaLogo fallback
 */
function useCompanyLogo(): string {
  const profile = getStoredProfile() as Record<string, unknown> | null;

  // Platform super-admin always shows the Zigma logo
  if (!profile || profile.user_type === "platform") return ZigmaLogo;

  const relativePath = profile.company_logo as string | null | undefined;
  if (!relativePath) return ZigmaLogo;

  // Strip /api/v1 suffix from baseURL to get the backend origin (e.g. http://127.0.0.1:8000)
  const origin = (api.defaults.baseURL ?? "")
    .replace(/\/api\/v1\/?$/, "")
    .replace(/\/api\/desktop\/?$/, "");
  return `${origin}${relativePath}`;
}

const PRIMARY = "#22a855";
const SECONDARY = "#f97316";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const companyLogo = useCompanyLogo();
  const { theme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSidebarToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  const handleDashboardView = () => {
    setAdminViewPreference(ADMIN_VIEW_MODE_DASHBOARD);
    navigate("/", { replace: true });
  };

  const isDark = theme === "dark";

  return (
    <header
      className={cn(
        "sticky top-0 z-60 w-full transition-all duration-300",
        isDark
          ? "bg-slate-950/95 backdrop-blur-xl"
          : "bg-white",
        scrolled && (isDark ? "shadow-xl shadow-black/30" : "shadow-md shadow-green-900/8")
      )}
    >
      {/* ── Bottom accent bar ─────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] overflow-hidden">
        <motion.div
          className="h-full w-[200%]"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${PRIMARY} 20%, ${SECONDARY} 50%, ${PRIMARY} 80%, transparent 100%)`,
          }}
          animate={{ x: ["-50%", "0%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* ── Left green accent border ──────────────────────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: `linear-gradient(to bottom, ${PRIMARY}, ${SECONDARY}, ${PRIMARY})` }}
      />

      <div
        className={cn(
          "relative h-(--admin-header-h) pl-5 pr-4 lg:pl-7 lg:pr-6 transition-all duration-300"
        )}
      >
        <div className="flex h-full items-center justify-between gap-4">
          {/* ── Left Group ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleSidebarToggle}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200",
                isDark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-white"
                  : "text-gray-500 hover:bg-green-50 hover:text-[#22a855]"
              )}
            >
              <motion.div animate={{ rotate: isMobileOpen ? 90 : 0 }} transition={{ duration: 0.25 }}>
                {isMobileOpen ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M6.22 7.28a.75.75 0 0 1 1.06-1.06L12 10.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L13.06 12l4.72 4.72a.75.75 0 1 1-1.06 1.06L12 13.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L10.94 12 6.22 7.28Z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="18" height="13" viewBox="0 0 16 12" fill="none">
                    <path d="M1.33.25h13.33a.75.75 0 0 1 0 1.5H1.33a.75.75 0 0 1 0-1.5Zm0 10h13.33a.75.75 0 0 1 0 1.5H1.33a.75.75 0 0 1 0-1.5Zm0-5h6.67a.75.75 0 0 1 0 1.5H1.33a.75.75 0 0 1 0-1.5Z" fill="currentColor" />
                  </svg>
                )}
              </motion.div>
            </motion.button>

            {/* Brand — desktop */}
            <motion.div
              className="hidden lg:flex items-center gap-3 select-none"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.15 }}
            >
              {/* Logo box */}
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
                style={{ background: '#ffff', boxShadow: `0 4px 14px ${PRIMARY}40` }}
              >
                <img src={companyLogo} className="h-6 w-6 object-contain" alt="Logo" onError={(e) => { (e.currentTarget as HTMLImageElement).src = ZigmaLogo; }} />
              </div>

              {/* Text stack */}
              <div className="flex flex-col leading-none">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: PRIMARY }}
                >
                  IWMS
                </span>
                <span
                  className={cn(
                    "text-base font-bold tracking-tight mt-0.5",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  {t("admin.panel_title")}
                </span>
              </div>

              {/* LIVE pill */}
              <div
                className="hidden xl:flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
                style={{ borderColor: `${PRIMARY}30`, backgroundColor: `${PRIMARY}10` }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: PRIMARY }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: PRIMARY }}>
                  Live
                </span>
              </div>
            </motion.div>

            {/* Brand — mobile */}
            <Link to="/admin" className="lg:hidden">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `linear-gradient(135deg, ${PRIMARY}, #16a34a)` }}
              >
                <img src={companyLogo} className="h-5 w-5 object-contain" alt="Logo" onError={(e) => { (e.currentTarget as HTMLImageElement).src = ZigmaLogo; }} />
              </div>
            </Link>
          </div>

          {/* ── Mobile quick actions toggle ──────────────────────────────── */}
          <div className="flex items-center gap-2 lg:hidden">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setApplicationMenuOpen((p) => !p)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "bg-green-50 text-[#22a855] hover:bg-green-100"
              )}
            >
              <motion.div animate={{ rotate: isApplicationMenuOpen ? 90 : 0 }} transition={{ duration: 0.25 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm12 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill="currentColor" />
                </svg>
              </motion.div>
            </motion.button>
          </div>

          {/* ── Right Group ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "flex w-full flex-row items-center justify-end gap-2 pt-2 lg:w-auto lg:pt-0",
              isApplicationMenuOpen ? "flex" : "hidden lg:flex",
              isDark
                ? "border-t border-slate-800 lg:border-none"
                : "border-t border-gray-100 lg:border-none"
            )}
          >
            {/* Dashboard view button */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleDashboardView}
              title={t("common.dashboard_view")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 h-9 text-xs font-semibold transition-all duration-200",
                isDark
                  ? "border border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white"
                  : "border text-[#22a855] hover:text-white hover:shadow-md"
              )}
              style={
                isDark
                  ? {}
                  : {
                      borderColor: `${PRIMARY}30`,
                      backgroundColor: `${PRIMARY}08`,
                    }
              }
              onMouseEnter={(e) => {
                if (!isDark) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = PRIMARY;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = PRIMARY;
                  (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                }
              }}
              onMouseLeave={(e) => {
                if (!isDark) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${PRIMARY}08`;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${PRIMARY}30`;
                  (e.currentTarget as HTMLButtonElement).style.color = PRIMARY;
                }
              }}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("common.dashboard_view")}</span>
            </motion.button>

            {/* Secondary CTA badge */}
            <div
              className="hidden xl:flex items-center gap-1.5 rounded-xl px-3 h-9"
              style={{ backgroundColor: `${SECONDARY}12`, borderColor: `${SECONDARY}30` }}
            >
              <Zap className="h-3.5 w-3.5" style={{ color: SECONDARY }} />
              <span className="text-xs font-semibold" style={{ color: SECONDARY }}>
                Admin
              </span>
            </div>

            {/* Divider */}
            <div className={cn("hidden lg:block h-5 w-px mx-1", isDark ? "bg-slate-700" : "bg-gray-200")} />

            <LanguageSwitcher
              variant="select"
              className="w-[140px]"
              triggerClassName={cn(
                "h-9 rounded-xl px-3 text-xs font-semibold border",
                isDark
                  ? "border-slate-700 bg-slate-800/70 text-slate-300 focus-visible:ring-slate-600"
                  : "border-gray-200 bg-white text-gray-700 shadow-sm hover:border-green-300 focus-visible:ring-green-300"
              )}
            />

            <ThemeToggleButton showLabel={false} />

            <div className={cn("hidden lg:block h-12 w-px mx-1", isDark ? "bg-slate-700" : "bg-gray-200")} />

            <UserDropdown />
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
