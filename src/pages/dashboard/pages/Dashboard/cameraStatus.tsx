import { Camera, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CameraStatusProps {
  active: number;
  inactive: number;
}

export function CameraStatus({ active, inactive }: CameraStatusProps) {
  const { t } = useTranslation();
  const total = active + inactive;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <div
      className="relative bg-white dark:bg-gray-800/95 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden p-3
        shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_4px_16px_-2px_rgba(0,0,0,0.07)]
        dark:shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_4px_16px_-2px_rgba(0,0,0,0.2)]"
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-linear-to-r from-(--admin-accent) to-(--admin-accentHover)" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-(--admin-accent)" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
            {t("dashboard.home.cameras_title")}
          </h3>
        </div>
        <span className="text-[10px] font-semibold text-(--admin-accent) bg-(--admin-accentSoft) border border-(--admin-accent)/30 px-2 py-0.5 rounded-full">
          {activePct}% Online
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-medium">
        <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
            <CheckCircle2 className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wide">
              {t("common.active")}
            </span>
          </div>
          <div className="text-xl font-bold text-green-700 dark:text-green-400">
            {active}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400 mb-1">
            <XCircle className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wide">
              {t("common.inactive")}
            </span>
          </div>
          <div className="text-xl font-bold text-red-700 dark:text-red-400">
            {inactive}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 mb-1">
            <Camera className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-wide">
              {t("common.total")}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
            {total}
          </div>
        </div>
      </div>
    </div>
  );
}
