import { Calendar } from 'lucide-react';
import { DataCard } from "@/components/ui/DataCard";
import { useTranslation } from "react-i18next";

export function DateSelector() {
  const { i18n } = useTranslation();
  const today = new Date().toLocaleDateString(i18n.language, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="flex justify-center mb-3">
      <DataCard compact className="inline-flex items-center gap-2 px-4 py-2">
        <Calendar className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {today}
        </span>
      </DataCard>
    </div>
  );
}
