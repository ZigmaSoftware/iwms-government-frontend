import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  const formatRelative = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
    rtf.format(value, unit);

  const activities = [
    {
      vehicle: "TRK-001",
      statusKey: "dashboard.overview.activity_completed_route",
      time: formatRelative(-2, "minute"),
      type: "success",
    },
    {
      vehicle: "TRK-015",
      statusKey: "dashboard.overview.activity_deviation_alert",
      time: formatRelative(-5, "minute"),
      type: "warning",
    },
    {
      vehicle: "TRK-008",
      statusKey: "dashboard.overview.activity_weight_mismatch",
      time: formatRelative(-12, "minute"),
      type: "destructive",
    },
    {
      vehicle: "TRK-022",
      statusKey: "dashboard.overview.activity_started_route",
      time: formatRelative(-18, "minute"),
      type: "default",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("dashboard.overview.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("dashboard.overview.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t("dashboard.overview.kpi_active_vehicles")}
          value={24}
          icon={Truck}
          trend={t("dashboard.overview.trend_active_vehicles")}
          variant="success"
        />
        <MetricCard
          title={t("dashboard.overview.kpi_idle_vehicles")}
          value={5}
          icon={Clock}
          trend={t("dashboard.overview.trend_idle_vehicles")}
          variant="warning"
        />
        <MetricCard
          title={t("dashboard.overview.kpi_active_alerts")}
          value={8}
          icon={AlertTriangle}
          trend={t("dashboard.overview.trend_active_alerts")}
          variant="destructive"
        />
        <MetricCard
          title={t("dashboard.overview.kpi_completed_routes")}
          value={142}
          icon={CheckCircle}
          trend={t("dashboard.overview.trend_completed_routes")}
          variant="success"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.overview.recent_activity_title")}</CardTitle>
            <CardDescription>
              {t("dashboard.overview.recent_activity_subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{activity.vehicle}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(activity.statusKey)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        activity.type === "success"
                          ? "bg-success"
                          : activity.type === "warning"
                          ? "bg-warning"
                          : activity.type === "destructive"
                          ? "bg-destructive"
                          : "bg-primary"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.overview.status_distribution_title")}</CardTitle>
            <CardDescription>
              {t("dashboard.overview.status_distribution_subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("dashboard.overview.status_running")}
                  </span>
                  <span className="font-medium">
                    {t("dashboard.overview.vehicles_count", { count: 24 })}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-success" style={{ width: "65%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("dashboard.overview.status_idle")}
                  </span>
                  <span className="font-medium">
                    {t("dashboard.overview.vehicles_count", { count: 5 })}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-warning" style={{ width: "14%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("dashboard.overview.status_completed")}
                  </span>
                  <span className="font-medium">
                    {t("dashboard.overview.vehicles_count", { count: 8 })}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-primary" style={{ width: "21%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
