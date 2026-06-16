import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AccentColor =
  | "blue"
  | "green"
  | "emerald"
  | "orange"
  | "red"
  | "purple"
  | "yellow"
  | "teal"
  | "indigo"
  | "brand-primary"
  | "brand-accent"
  | "brand-secondary";

const accentGradients: Record<AccentColor, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-green-500 to-emerald-500",
  emerald: "from-emerald-500 to-teal-500",
  orange: "from-orange-500 to-amber-500",
  red: "from-red-500 to-rose-500",
  purple: "from-purple-500 to-violet-500",
  yellow: "from-yellow-400 to-amber-500",
  teal: "from-teal-500 to-cyan-500",
  indigo: "from-indigo-500 to-blue-600",
  "brand-primary": "from-[var(--admin-primary)] to-[var(--admin-primaryHover)]",
  "brand-accent": "from-[var(--admin-accent)] to-[var(--admin-accentHover)]",
  "brand-secondary": "from-[var(--brand-secondary)] to-[var(--brand-secondary-hover)]",
};

interface DataCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  compact?: boolean;
  accent?: AccentColor;
  icon?: ReactNode;
}

export function DataCard({
  title,
  children,
  className,
  action,
  compact,
  accent,
  icon,
}: DataCardProps) {
  return (
    <div
      className={cn(
        "relative bg-white dark:bg-gray-800/95 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden",
        "shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_4px_16px_-2px_rgba(0,0,0,0.07)]",
        "dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_4px_16px_-2px_rgba(0,0,0,0.2)]",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      {accent && (
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-[3px] bg-linear-to-r",
            accentGradients[accent]
          )}
        />
      )}
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {icon && (
              <span className="shrink-0">{icon}</span>
            )}
            {title && (
              <h3
                className={cn(
                  "font-semibold text-gray-800 dark:text-gray-100 tracking-tight",
                  compact ? "text-sm" : "text-base"
                )}
              >
                {title}
              </h3>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
