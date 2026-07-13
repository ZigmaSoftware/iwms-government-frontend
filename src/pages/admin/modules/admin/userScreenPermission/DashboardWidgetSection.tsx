import type { DashboardWidget } from "./types";

// Canonical widget catalog — the only place widget names are enumerated,
// since the backend stores widget_name as free text with no seeded choices.
export const WIDGET_CATALOG = [
  { widgetName: "trip_summary", label: "Trip Summary" },
  { widgetName: "live_vehicle_map", label: "Live Vehicle Map" },
  { widgetName: "staff_attendance", label: "Staff Attendance" },
  { widgetName: "complaint_queue", label: "Complaint Queue" },
  { widgetName: "weighbridge_log", label: "Weighbridge Log" },
  { widgetName: "monthly_report", label: "Monthly Report" },
];

type Props = {
  widgets: DashboardWidget[];
  onChange: (widgets: DashboardWidget[]) => void;
};

export default function DashboardWidgetSection({ widgets, onChange }: Props) {
  const byName = new Map(widgets.map((widget) => [widget.widgetName, widget]));

  const toggle = (widgetName: string, checked: boolean) => {
    const existing = byName.get(widgetName);
    const others = widgets.filter((widget) => widget.widgetName !== widgetName);
    if (!checked && !existing) return;
    onChange([
      ...others,
      {
        widgetName,
        isEnabled: checked,
        orderNo: existing?.orderNo ?? WIDGET_CATALOG.findIndex((w) => w.widgetName === widgetName) + 1,
      },
    ]);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        Dashboard Widgets
      </h4>
      <div className="grid gap-3 md:grid-cols-2">
        {WIDGET_CATALOG.map((widget) => {
          const checked = Boolean(byName.get(widget.widgetName)?.isEnabled);
          return (
            <label
              key={widget.widgetName}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-950"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200">{widget.label}</span>
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={checked}
                onChange={(event) => toggle(widget.widgetName, event.target.checked)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
