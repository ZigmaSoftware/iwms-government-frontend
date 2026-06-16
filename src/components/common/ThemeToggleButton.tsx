import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemeToggleButtonProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggleButton({
  className,
  showLabel = true,
}: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { t } = useTranslation();
  const modeLabel = isDark ? t("common.theme_dark") : t("common.theme_light");

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title={!showLabel ? modeLabel : undefined}
      onClick={toggleTheme}
      className={cn(
        "rainbow-border flex items-center rounded-full border py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2",
        showLabel ? "gap-2 px-3" : "h-11 w-11 justify-center px-0",
        isDark
          ? "border-white/15 bg-white/5 text-white focus-visible:ring-white/30"
          : "border-[var(--admin-border)] bg-white/90 text-[var(--admin-text)] shadow-[0_10px_24px_rgba(9,74,141,0.08)] focus-visible:ring-[var(--admin-primarySoft)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full transition",
          showLabel ? "h-8 w-8" : "h-9 w-9",
          isDark
            ? "bg-white/10 text-white"
            : "bg-[var(--admin-primarySoft)]/80 text-[var(--admin-primary)]",
        )}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
      {showLabel && (
        <span className="flex flex-col text-left leading-none">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--admin-mutedText)]">
            {t("common.theme_mode_label")}
          </span>
          <span>{modeLabel}</span>
        </span>
      )}
    </button>
  );
}
