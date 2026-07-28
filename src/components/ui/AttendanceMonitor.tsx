import { Link } from "react-router-dom";
import { DataCard } from "./DataCard";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";

type AttendanceStats = {
  total: number;
  present: number;
  absent: number;
  leave: number;
};

export function AttendanceMonitor({ stats }: { stats?: AttendanceStats }) {
  const { t } = useTranslation();
  const displayStats = stats ?? {
    total: 182,
    present: 158,
    absent: 24,
    leave: 12,
  };
  const { encDashboardResources } = getEncryptedRoute();
  const resourcesPath = `/dashboard/${encDashboardResources}`;

  const presentPct = displayStats.total > 0 ? (displayStats.present / displayStats.total) * 100 : 0;
  const absentPct = displayStats.total > 0 ? (displayStats.absent / displayStats.total) * 100 : 0;
  const leavePct = displayStats.total > 0 ? (displayStats.leave / displayStats.total) * 100 : 0;

  return (
    <DataCard
      title={t("dashboard.home.attendance_monitor_title")}
      compact
      accent="brand-primary"
      icon={<Users className="w-3.5 h-3.5 text-(--admin-primary)" />}
      action={
        <Link
          to={resourcesPath}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t("common.view_all")}
        </Link>
      }
    >
      {/* Stacked attendance progress bar */}
      <div className="h-2 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700 mb-3">
        <div
          className="bg-green-500 transition-all duration-700"
          style={{ width: `${presentPct}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-700"
          style={{ width: `${absentPct}%` }}
        />
        <div
          className="bg-blue-400 transition-all duration-700"
          style={{ width: `${leavePct}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t("common.total")}
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
            {displayStats.total}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
          <div className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
            {t("common.present")}
          </div>
          <div className="text-xl font-bold text-green-700 dark:text-green-400 mt-0.5">
            {displayStats.present}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          <div className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
            {t("common.absent")}
          </div>
          <div className="text-xl font-bold text-red-700 dark:text-red-400 mt-0.5">
            {displayStats.absent}
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
          <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            {t("common.leave")}
          </div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-0.5">
            {displayStats.leave}
          </div>
        </div>
      </div>
    </DataCard>
  );
}
