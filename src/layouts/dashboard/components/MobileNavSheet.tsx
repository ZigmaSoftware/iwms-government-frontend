import { useState } from "react";
import { Crown, LogOut, Menu, Moon, ShieldCheck, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { menuItems, useDashboardActiveNav } from "@/layouts/dashboard/components/HorizontalNav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTheme } from "@/contexts/ThemeContext";

type MobileNavSheetProps = {
  canSwitchToAdmin: boolean;
  onSwitchToAdmin: () => void;
  onSignOut: () => void;
  adminViewIcon: typeof Crown;
};

export function MobileNavSheet({
  canSwitchToAdmin,
  onSwitchToAdmin,
  onSignOut,
  adminViewIcon: AdminViewIcon,
}: MobileNavSheetProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isItemActive = useDashboardActiveNav();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-green-50 hover:text-[#22a855] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="flex w-3/4 flex-col overflow-y-auto sm:max-w-xs">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav className="mt-4 flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = isItemActive(item);
            return (
              <SheetClose asChild key={item.url}>
                <Link
                  to={item.url}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-linear-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-foreground/70 hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              </SheetClose>
            );
          })}
        </nav>

        <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <LanguageSwitcher variant="select" className="w-full" />

          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {t("common.toggle_theme", { defaultValue: "Toggle theme" })}
          </button>

          {canSwitchToAdmin && (
            <Button variant="outline" size="sm" onClick={onSwitchToAdmin} className="justify-start gap-2">
              <AdminViewIcon className="h-4 w-4" />
              {t("common.admin_view")}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={onSignOut} className="justify-start gap-2">
            <LogOut className="h-4 w-4" />
            {t("common.logout", { defaultValue: "Logout" })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
