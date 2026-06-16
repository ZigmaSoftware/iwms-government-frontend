import { useTranslation } from "react-i18next";

interface InnerStatusCardProps {
  title: string;
  icon: React.ReactNode;
  active: number;
  inactive: number;
}

export function InnerStatusCard({ title, icon, active, inactive }: InnerStatusCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border p-4 bg-white dark:bg-gray-900 dark:border-gray-700 flex flex-col gap-4">

      {/* Top title + icon */}
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>

      {/* Two small boxes */}
      <div className="grid grid-cols-2 gap-3">

        <div className="rounded-lg border p-3 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700">
          <div className="text-xs text-green-700 dark:text-green-400 font-medium">
            {t("common.active")}
          </div>
          <div className="text-xl font-bold text-green-700 dark:text-green-400">{active}</div>
        </div>

        <div className="rounded-lg border p-3 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700">
          <div className="text-xs text-red-700 dark:text-red-400 font-medium">
            {t("common.inactive")}
          </div>
          <div className="text-xl font-bold text-red-700 dark:text-red-400">{inactive}</div>
        </div>

      </div>

    </div>
  );
}
