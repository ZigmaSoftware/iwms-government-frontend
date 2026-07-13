import {
  BarChart3,
  CalendarCheck,
  FileBarChart,
  MapPinned,
  MessageSquareWarning,
  Scale,
} from "lucide-react";

import type { DashboardWidget } from "./types";

type DashboardWidgetPanelProps = {
  widgets: DashboardWidget[];
  onChange: (widgets: DashboardWidget[]) => void;
};

const ICONS = {
  trip_summary: BarChart3,
  live_vehicle_map: MapPinned,
  staff_attendance: CalendarCheck,
  complaint_queue: MessageSquareWarning,
  weighbridge_log: Scale,
  monthly_report: FileBarChart,
};

const labelFor = (widgetName: string) =>
  widgetName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function DashboardWidgetPanel({
  widgets,
  onChange,
}: DashboardWidgetPanelProps) {
  if (!widgets.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Super Admin has not enabled any dashboard widgets for this Local Body.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {widgets.map((widget) => {
        const Icon = ICONS[widget.widgetName as keyof typeof ICONS] ?? BarChart3;
        return (
          <div
            key={widget.widgetName}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">
              {labelFor(widget.widgetName)}
            </span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={widget.isEnabled}
                onChange={(event) =>
                  onChange(
                    widgets.map((item) =>
                      item.widgetName === widget.widgetName
                        ? { ...item, isEnabled: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              <span className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-blue-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
            </label>
          </div>
        );
      })}
    </div>
  );
}
