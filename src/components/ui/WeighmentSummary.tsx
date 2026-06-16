import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { DataCard } from "../ui/DataCard";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";

const API_KEY = "ZIGMA-DELHI-WEIGHMENT-2025-SECURE";

type Summary = {
  trips: number;
  totalTons: number;
  avgTons: string;
};

const getMonthParam = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export function WeighmentSummary() {
  const { t } = useTranslation();
  const { weighmentApiUrl, projectId } = useProjectSelector();
  const [summary, setSummary] = useState<Summary>({
    trips: 0,
    totalTons: 0,
    avgTons: "0.00",
  });
  const [loading, setLoading] = useState(true);
  const { encDashboardWeighBridge } = getEncryptedRoute();
  const weighbridgePath = `/dashboard/${encDashboardWeighBridge}`;

  useEffect(() => {
    if (!weighmentApiUrl) return;
    const controller = new AbortController();
    const monthParam = getMonthParam();
    const url = `${weighmentApiUrl}?action=month_wise_date&date=${monthParam}&key=${API_KEY}`;

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!Array.isArray(json?.data)) {
          setSummary({ trips: 0, totalTons: 0, avgTons: "0.00" });
          return;
        }

        const totals = json.data.reduce(
          (acc: { trips: number; totalNet: number }, row: any) => {
            acc.trips += Number(row.total_trip) || 0;
            acc.totalNet += Number(row.total_net_weight) || 0;
            return acc;
          },
          { trips: 0, totalNet: 0 }
        );

        const totalTons = totals.totalNet / 1000;
        const avgTons = totals.trips ? totalTons / totals.trips : 0;

        setSummary({
          trips: totals.trips,
          totalTons,
          avgTons: avgTons.toFixed(2),
        });
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setSummary({ trips: 0, totalTons: 0, avgTons: "0.00" });
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [weighmentApiUrl, projectId]);

  const tripsValue = loading ? "--" : summary.trips;
  const totalTonsValue = loading ? "--" : summary.totalTons.toFixed(1);
  const avgTonsValue = loading ? "--" : summary.avgTons;
  const avgTonsNumeric = Number(summary.avgTons) || 0;

  const chartData = [
    {
      label: t("common.trips"),
      value: summary.trips,
      display: tripsValue,
      unit: t("common.trips"),
    },
    {
      label: t("dashboard.home.weighment_total_tons"),
      value: summary.totalTons,
      display: totalTonsValue,
      unit: t("common.tons"),
    },
    {
      label: t("dashboard.home.weighment_avg_tons_per_trip"),
      value: avgTonsNumeric,
      display: avgTonsValue,
      unit: t("common.tons"),
    },
  ];

  const chartMax = Math.max(1, ...chartData.map((item) => item.value));
  const chartColors = ["#22c55e", "#3b82f6", "#f97316"];

  return (
    <DataCard
      title={t("dashboard.home.weighment_summary_title")}
      compact
      accent="brand-primary"
      icon={<span className="text-emerald-500 text-sm leading-none font-bold">⚖</span>}
      action={
        <Link
          to={weighbridgePath}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t("common.view_all")}
        </Link>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-200 bg-linear-to-br from-white via-slate-50 to-white p-2 shadow-sm dark:border-gray-700 dark:from-gray-900 dark:via-gray-900/60 dark:to-gray-900">
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 6, right: 6, left: -16, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                />
                <YAxis hide domain={[0, chartMax]} />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] shadow-md dark:border-gray-700 dark:bg-gray-900">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {entry.label}
                        </div>
                        <div className="text-gray-600 dark:text-gray-300">
                          {entry.display} {entry.unit}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 2, 2]} minPointSize={4}>
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={chartColors[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="text-[10px] text-gray-600 dark:text-gray-400">
              {t("common.trips")}
            </div>
            <div className="text-lg font-bold text-green-700 dark:text-green-400">
              {tripsValue}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="text-[10px] text-gray-600 dark:text-gray-400">
              {t("dashboard.home.weighment_total_tons")}
            </div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
              {totalTonsValue}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <div className="text-[10px] text-gray-600 dark:text-gray-400">
              {t("dashboard.home.weighment_avg_tons_per_trip")}
            </div>
            <div className="text-lg font-bold text-orange-700 dark:text-orange-400">
              {avgTonsValue}
            </div>
          </div>
        </div>
      </div>

    </DataCard>
  );
}
