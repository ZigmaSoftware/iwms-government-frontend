import type { WasteKpis } from "./types";
import { useEffect, useState } from "react";
import { capitalize } from "@/utils/capitalize";
import {
  AlertTriangle,
  MapPin,
  Trash2,
  Users,
  BarChart3,
  Activity,
  CheckCircle,
  Scale,
  Route,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Calendar,
} from "lucide-react";
import ComponentCard from "@/components/common/ComponentCard";
import { MetricCard } from "@/components/MetricCard";
import { DataCard } from "@/components/ui/DataCard";
import { useTranslation } from "react-i18next";
import { api } from "@/api";

/* ─── Types ─────────────────────────────────────────── */


const emptyKpis: WasteKpis = {
  total_agreed_weight: 0,
  total_actual_weight: 0,
  variance_kg: 0,
  collection_efficiency_percent: 0,
  average_weight_per_trip: 0,
  coverage_efficiency_percent: 0,
  total_trips: 0,
  collection_points_covered: 0,
  report_status: "—",
};

/* ─── Helpers ───────────────────────────────────────── */

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
};

const fmt = (v: number, suffix = "", decimals = 1) =>
  `${v.toLocaleString(undefined, { maximumFractionDigits: decimals })}${suffix}`;

const clamp = (v: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, v));

/* ─── Sub-components ─────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Surplus: {
      bg: "bg-green-50 border-green-200",
      text: "text-green-700",
      icon: <TrendingUp size={14} />,
    },
    Deficit: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-700",
      icon: <TrendingDown size={14} />,
    },
    "On Target": {
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
      icon: <Minus size={14} />,
    },
  };
  const s = map[status] ?? {
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
    icon: <Minus size={14} />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${s.bg} ${s.text}`}
    >
      {s.icon}
      {status}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  icon,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
  bar?: number;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-t-4 ${accent} flex flex-col gap-2 p-4`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {bar !== undefined && (
        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-400 to-blue-600 transition-all duration-500"
            style={{ width: `${clamp(bar)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function AgreedVsActualBar({
  agreed,
  actual,
}: {
  agreed: number;
  actual: number;
}) {
  const max = Math.max(agreed, actual, 1);
  const agreedPct = (agreed / max) * 100;
  const actualPct = (actual / max) * 100;
  const isOver = actual > agreed;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Agreed Target</span>
          <span className="font-medium text-gray-700">{fmt(agreed, " kg", 0)}</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-400"
            style={{ width: `${agreedPct}%` }}
          />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Actual Collected</span>
          <span className={`font-medium ${isOver ? "text-green-600" : "text-red-600"}`}>
            {fmt(actual, " kg", 0)}
          </span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${isOver ? "bg-green-400" : "bg-orange-400"}`}
            style={{ width: `${actualPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────── */

export default function Home() {
  const { t } = useTranslation();

  const [month] = useState(currentMonth());
  const [kpis, setKpis] = useState<WasteKpis>(emptyKpis);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState(false);

  const fetchKpis = async () => {
    setKpiLoading(true);
    setKpiError(false);
    try {
      const { data } = await api.get("/reports/monthly-waste-comparison/", {
        params: { month },
      });
      setKpis(data?.kpis ?? emptyKpis);
    } catch {
      setKpiError(true);
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, [month]);

  /* ── static operational data ── */
  const activityItems = [
    {
      title: t("admin.dashboard_home.activity.route_survey_title"),
      description: t("admin.dashboard_home.activity.route_survey_desc"),
      time: t("admin.dashboard_home.activity.route_survey_time"),
      status: t("admin.dashboard_home.activity.route_survey_status"),
    },
    {
      title: t("admin.dashboard_home.activity.missed_pickup_title"),
      description: t("admin.dashboard_home.activity.missed_pickup_desc"),
      time: t("admin.dashboard_home.activity.missed_pickup_time"),
      status: t("admin.dashboard_home.activity.missed_pickup_status"),
    },
    {
      title: t("admin.dashboard_home.activity.bulk_waste_title"),
      description: t("admin.dashboard_home.activity.bulk_waste_desc"),
      time: t("admin.dashboard_home.activity.bulk_waste_time"),
      status: t("admin.dashboard_home.activity.bulk_waste_status"),
    },
  ];

  const capacitySummary = [
    {
      label: t("admin.dashboard_home.capacity.total_vehicles"),
      value: "214",
      hint: t("admin.dashboard_home.capacity.total_vehicles_hint"),
    },
    {
      label: t("admin.dashboard_home.capacity.field_staff"),
      value: "1,420",
      hint: t("admin.dashboard_home.capacity.field_staff_hint"),
    },
    {
      label: t("admin.dashboard_home.capacity.processing_units"),
      value: "12",
      hint: t("admin.dashboard_home.capacity.processing_units_hint"),
    },
  ];

  const wasteKpiCards = [
    {
      label: "Collection Efficiency",
      value: kpiLoading ? "—" : fmt(kpis.collection_efficiency_percent, "%"),
      sub: "Actual ÷ Agreed weight",
      accent: "border-t-blue-500",
      icon: <BarChart3 size={16} />,
      bar: kpis.collection_efficiency_percent,
    },
    {
      label: "Coverage Efficiency",
      value: kpiLoading ? "—" : fmt(kpis.coverage_efficiency_percent, "%"),
      sub: "Points served ÷ Total trips",
      accent: "border-t-purple-500",
      icon: <CheckCircle size={16} />,
      bar: kpis.coverage_efficiency_percent,
    },
    {
      label: "Avg Weight / Trip",
      value: kpiLoading ? "—" : fmt(kpis.average_weight_per_trip, " kg"),
      sub: "Actual weight per trip",
      accent: "border-t-green-500",
      icon: <Scale size={16} />,
    },
    {
      label: "Total Variance",
      value: kpiLoading ? "—" : fmt(kpis.variance_kg, " kg"),
      sub: "Actual − Agreed",
      accent:
        kpis.variance_kg >= 0 ? "border-t-green-400" : "border-t-red-400",
      icon: <Activity size={16} />,
    },
    {
      label: "Total Trips",
      value: kpiLoading ? "—" : fmt(kpis.total_trips, "", 0),
      sub: "Collection trips this month",
      accent: "border-t-teal-500",
      icon: <Route size={16} />,
    },
    {
      label: "Points Covered",
      value: kpiLoading ? "—" : fmt(kpis.collection_points_covered, "", 0),
      sub: "Collection points served",
      accent: "border-t-pink-500",
      icon: <MapPin size={16} />,
    },
    {
      label: "Agreed Weight",
      value: kpiLoading ? "—" : fmt(kpis.total_agreed_weight, " kg"),
      sub: "Monthly collection target",
      accent: "border-t-indigo-500",
      icon: <TrendingUp size={16} />,
    },
    {
      label: "Actual Weight",
      value: kpiLoading ? "—" : fmt(kpis.total_actual_weight, " kg"),
      sub: "Weight actually collected",
      accent: "border-t-cyan-500",
      icon: <Trash2 size={16} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Operational Metrics ── */}
      <ComponentCard
        title={t("admin.dashboard_home.title")}
        desc={t("admin.dashboard_home.subtitle")}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t("admin.dashboard_home.metrics.daily_collections")}
            value="5,842 tons"
            icon={Trash2}
            trend={t("admin.dashboard_home.metrics.daily_collections_trend")}
            variant="success"
          />
          <MetricCard
            title={t("admin.dashboard_home.metrics.active_vehicles")}
            value="214"
            icon={MapPin}
            trend={t("admin.dashboard_home.metrics.active_vehicles_trend")}
          />
          <MetricCard
            title={t("admin.dashboard_home.metrics.on_ground_staff")}
            value="1,311"
            icon={Users}
            trend={t("admin.dashboard_home.metrics.on_ground_staff_trend")}
            variant="warning"
          />
          <MetricCard
            title={t("admin.dashboard_home.metrics.critical_alerts")}
            value="12"
            icon={AlertTriangle}
            trend={t("admin.dashboard_home.metrics.critical_alerts_trend")}
            variant="destructive"
          />
        </div>
      </ComponentCard>

      {/* ── Monthly Waste Comparison KPIs ── */}
      <div className="bg-white rounded-2xl border border-gray-200">
        {/* Section header */}
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              Monthly Waste Collection — KPI Overview
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Calendar size={13} className="text-gray-400" />
              <p className="text-sm text-gray-500">{monthLabel(month)}</p>
              {!kpiLoading && !kpiError && (
                <StatusBadge status={kpis.report_status} />
              )}
              {kpiError && (
                <span className="text-xs text-red-500">Failed to load — </span>
              )}
            </div>
          </div>
          <button
            onClick={fetchKpis}
            disabled={kpiLoading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={kpiLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 8 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            {wasteKpiCards.map((card) => (
              <KpiCard key={card.label} {...card} />
            ))}
          </div>

          {/* Agreed vs Actual comparison + summary row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Visual bar comparison */}
            <DataCard
              title="Agreed vs Actual Weight"
              accent="blue"
              compact
            >
              {kpiLoading ? (
                <div className="h-20 flex items-center justify-center text-sm text-gray-400">
                  Loading…
                </div>
              ) : (
                <AgreedVsActualBar
                  agreed={kpis.total_agreed_weight}
                  actual={kpis.total_actual_weight}
                />
              )}
            </DataCard>

            {/* Quick summary table */}
            <DataCard title="Performance Summary" accent="green" compact>
              <div className="space-y-2">
                {[
                  {
                    label: "Overall Status",
                    value: kpiLoading ? "—" : kpis.report_status,
                    highlight:
                      kpis.report_status === "Surplus"
                        ? "text-green-600"
                        : kpis.report_status === "Deficit"
                          ? "text-red-600"
                          : "text-blue-600",
                  },
                  {
                    label: "Collection Efficiency",
                    value: kpiLoading
                      ? "—"
                      : fmt(kpis.collection_efficiency_percent, "%"),
                    highlight:
                      kpis.collection_efficiency_percent >= 90
                        ? "text-green-600"
                        : kpis.collection_efficiency_percent >= 70
                          ? "text-amber-600"
                          : "text-red-600",
                  },
                  {
                    label: "Coverage Efficiency",
                    value: kpiLoading
                      ? "—"
                      : fmt(kpis.coverage_efficiency_percent, "%"),
                    highlight:
                      kpis.coverage_efficiency_percent >= 90
                        ? "text-green-600"
                        : kpis.coverage_efficiency_percent >= 70
                          ? "text-amber-600"
                          : "text-red-600",
                  },
                  {
                    label: "Variance (kg)",
                    value: kpiLoading ? "—" : fmt(kpis.variance_kg, " kg"),
                    highlight:
                      kpis.variance_kg >= 0
                        ? "text-green-600"
                        : "text-red-600",
                  },
                  {
                    label: "Trips Completed",
                    value: kpiLoading ? "—" : fmt(kpis.total_trips, "", 0),
                    highlight: "text-gray-800",
                  },
                  {
                    label: "Points Covered",
                    value: kpiLoading
                      ? "—"
                      : fmt(kpis.collection_points_covered, "", 0),
                    highlight: "text-gray-800",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className={`text-xs font-semibold ${row.highlight}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </DataCard>
          </div>
        </div>
      </div>

      {/* ── Activity + Capacity ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title={t("admin.dashboard_home.recent_activity_title")}>
          <div className="divide-y divide-border">
            {activityItems.map((item) => (
              <div
                key={item.title}
                className="py-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                  <span className="inline-flex rounded-full border px-2 py-0.5 text-xs mt-1">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title={t("admin.dashboard_home.capacity_snapshot_title")}>
          <div className="grid gap-4">
            {capacitySummary.map((item) => (
              <div
                key={capitalize(item.label)}
                className="rounded-2xl border border-border/60 bg-muted/30 p-4"
              >
                <p className="text-sm text-muted-foreground">{capitalize(item.label)}</p>
                <p className="text-3xl font-semibold text-foreground">
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.hint}
                </p>
              </div>
            ))}
          </div>
        </DataCard>
      </div>
    </div>
  );
}
