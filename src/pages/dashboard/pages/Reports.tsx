import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Calendar, TrendingUp, Sparkles, BarChart2, Fuel, Recycle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

export default function Reports() {
  const { t } = useTranslation();
  const kpiCards = [
    {
      title: t("dashboard.reports.kpis.total_attendance"),
      value: "96.8%",
      subtext: t("dashboard.reports.kpis.total_attendance_subtext"),
      subtextColor: "text-success",
      icon: FileText,
      overlay: "from-sky-50 via-white/40 to-blue-100 dark:from-slate-900/80 dark:via-transparent dark:to-slate-900",
      border: "border-sky-200/60 dark:border-sky-500/40",
      shadow: "",
      valueColor: "text-sky-600 dark:text-sky-100",
      iconBg: "bg-white/70 border border-sky-100 dark:bg-slate-900/70 dark:border-slate-700",
      iconColor: "text-sky-600 dark:text-sky-200",
    },
    {
      title: t("dashboard.reports.kpis.fuel_efficiency"),
      value: "8.2 km/L",
      subtext: t("dashboard.reports.kpis.fuel_efficiency_subtext"),
      subtextColor: "text-success",
      icon: Fuel,
      overlay: "from-emerald-50 via-white/40 to-emerald-100 dark:from-slate-900/80 dark:via-transparent dark:to-slate-900",
      border: "border-emerald-200/60 dark:border-emerald-500/40",
      shadow: "",
      valueColor: "text-emerald-600 dark:text-emerald-100",
      iconBg: "bg-white/70 border border-emerald-100 dark:bg-slate-900/70 dark:border-slate-700",
      iconColor: "text-emerald-600 dark:text-emerald-200",
    },
    {
      title: t("dashboard.reports.kpis.waste_collected"),
      value: "847 tons",
      subtext: t("dashboard.reports.kpis.waste_collected_subtext"),
      subtextColor: "text-muted-foreground",
      icon: Recycle,
      showTrendIcon: false,
      overlay: "from-amber-50 via-white/40 to-amber-100 dark:from-slate-900/80 dark:via-transparent dark:to-slate-900",
      border: "border-amber-200/60 dark:border-amber-500/40",
      shadow: "",
      valueColor: "text-amber-600 dark:text-amber-100",
      iconBg: "bg-white/70 border border-amber-100 dark:bg-slate-900/70 dark:border-slate-700",
      iconColor: "text-amber-600 dark:text-amber-200",
    },
  ];

  return (
   <div className="space-y-6 h-[calc(100vh-80px)] overflow-y-auto pr-2 pb-6 relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white via-slate-50 to-sky-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />
      <div className="absolute inset-y-0 right-10 -z-10 w-72 blur-3xl opacity-50 bg-gradient-to-b from-sky-100 via-blue-50 to-emerald-100 dark:from-slate-800 dark:via-slate-900 dark:to-emerald-900/40 animate-pulse" />
      <div className="flex items-center justify-between bg-white/80 dark:bg-slate-950/70 backdrop-blur rounded-3xl border border-border/40 dark:border-border/60 p-6">
        <div>
          <div className="flex items-center gap-2 text-sky-500 dark:text-sky-300">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span className="text-sm font-medium">{t("dashboard.reports.insights_hub")}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground mt-1">
            {t("dashboard.reports.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("dashboard.reports.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="today">
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t("dashboard.reports.range_today")}</SelectItem>
              <SelectItem value="week">{t("dashboard.reports.range_week")}</SelectItem>
              <SelectItem value="month">{t("dashboard.reports.range_month")}</SelectItem>
              <SelectItem value="quarter">{t("dashboard.reports.range_quarter")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className={`relative overflow-hidden border ${card.border} bg-white/90 dark:bg-slate-900/70 backdrop-blur transition-transform duration-500 hover:-translate-y-1`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r ${card.overlay} opacity-70 pointer-events-none animate-[pulse_7s_ease-in-out_infinite]`}
              />
              <CardHeader className="space-y-2 relative z-10">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</div>
                  <p className={`text-xs flex items-center gap-1 ${card.subtextColor}`}>
                    {card.showTrendIcon !== false && <TrendingUp className="h-3 w-3" />}
                    {card.subtext}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.iconBg ?? "bg-white/70 border border-border/40"}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor ?? "text-muted-foreground"}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden border border-amber-200/60 dark:border-amber-500/40 bg-white/95 dark:bg-slate-900/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-50 via-transparent to-white/60 dark:from-slate-900/60 dark:via-transparent dark:to-slate-900 opacity-60 pointer-events-none animate-[pulse_8s_ease-in-out_infinite]" />
          <CardHeader className="relative">
            <CardTitle>{t("dashboard.reports.attendance_report_title")}</CardTitle>
            <CardDescription>{t("dashboard.reports.attendance_report_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.reports.attendance_on_time")}</span>
                  <span className="font-medium">89%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden dark:bg-slate-800/80">
                  <div className="h-full bg-gradient-success dark:from-emerald-500 dark:via-emerald-400 dark:to-emerald-600 transition-all" style={{ width: "89%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.reports.attendance_late")}</span>
                  <span className="font-medium">8%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden dark:bg-slate-800/80">
                  <div className="h-full bg-gradient-warning dark:from-amber-500 dark:via-amber-400 dark:to-amber-600 transition-all" style={{ width: "8%" }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard.reports.attendance_absent")}</span>
                  <span className="font-medium">3%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden dark:bg-slate-800/80">
                  <div className="h-full bg-destructive dark:bg-rose-500 transition-all" style={{ width: "3%" }} />
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4 border-amber-200 hover:bg-amber-50 dark:hover:bg-slate-900/60">
                <Download className="h-4 w-4 mr-2" />
                {t("dashboard.reports.attendance_export")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-rose-200/60 dark:border-rose-500/40 bg-white/95 dark:bg-slate-900/80 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-50 via-transparent to-white/60 dark:from-slate-900/60 dark:via-transparent dark:to-slate-900 opacity-50 pointer-events-none animate-[pulse_9s_ease-in-out_infinite]" />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("dashboard.reports.fuel_trends_title")}</CardTitle>
                <CardDescription>{t("dashboard.reports.fuel_trends_subtitle")}</CardDescription>
              </div>
              <BarChart2 className="h-5 w-5 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-3">
              {[
                { vehicle: "TRK-001", efficiency: "9.2 km/L", status: "excellent" },
                { vehicle: "TRK-015", efficiency: "8.1 km/L", status: "good" },
                { vehicle: "TRK-008", efficiency: "7.4 km/L", status: "average" },
                { vehicle: "TRK-022", efficiency: "6.8 km/L", status: "poor" },
              ].map((data, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-rose-100 dark:border-rose-900/40 bg-white/80 dark:bg-slate-950/50 backdrop-blur-sm transition-transform duration-500 hover:-translate-y-0.5 hover:border-rose-300">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{data.vehicle}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.status === "excellent"
                        ? t("dashboard.reports.fuel_status_excellent")
                        : data.status === "good"
                        ? t("dashboard.reports.fuel_status_good")
                        : data.status === "average"
                        ? t("dashboard.reports.fuel_status_average")
                        : t("dashboard.reports.fuel_status_needs_attention")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{data.efficiency}</p>
                    <div
                      className={`h-1 w-20 rounded-full mt-1 ${
                        data.status === "excellent"
                          ? "bg-rose-400"
                          : data.status === "good"
                          ? "bg-rose-500"
                          : data.status === "average"
                          ? "bg-amber-400"
                          : "bg-destructive"
                      }`}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-4 border-rose-200 hover:bg-rose-50 dark:hover:bg-slate-900/60">
                <Download className="h-4 w-4 mr-2" />
                Export Fuel Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden border border-sky-200/60 dark:border-sky-500/40 bg-white/95 dark:bg-slate-900/80 backdrop-blur">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-transparent to-white/60 dark:from-slate-900/60 dark:via-transparent dark:to-slate-900 opacity-60 pointer-events-none animate-[pulse_10s_ease-in-out_infinite]" />
        <CardHeader className="relative">
          <CardTitle>{t("dashboard.reports.daily_summary.title")}</CardTitle>
          <CardDescription>{t("dashboard.reports.daily_summary.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                key: "total_routes",
                value: t("dashboard.reports.daily_summary.cards.total_routes.value"),
                note: t("dashboard.reports.daily_summary.cards.total_routes.note"),
                noteClass: "text-success",
                accent: "from-white via-sky-50 to-blue-100 dark:from-slate-900 dark:via-sky-950/20 dark:to-slate-900",
                valueClass: "text-sky-600 dark:text-sky-200",
              },
              {
                key: "avg_load",
                value: t("dashboard.reports.daily_summary.cards.avg_load.value"),
                note: t("dashboard.reports.daily_summary.cards.avg_load.note"),
                noteClass: "text-muted-foreground",
                accent: "from-white via-emerald-50 to-emerald-100 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900",
                valueClass: "text-emerald-600 dark:text-emerald-200",
              },
              {
                key: "efficiency",
                value: t("dashboard.reports.daily_summary.cards.efficiency.value"),
                note: t("dashboard.reports.daily_summary.cards.efficiency.note"),
                noteClass: "text-success",
                accent: "from-white via-amber-50 to-amber-100 dark:from-slate-900 dark:via-amber-950/20 dark:to-slate-900",
                valueClass: "text-amber-600 dark:text-amber-200",
              },
            ].map((stat) => (
              <div
                key={stat.key}
                className={`space-y-2 rounded-2xl border border-border/40 dark:border-border/60 bg-gradient-to-br ${stat.accent} p-4`}
              >
                <p className="text-sm font-medium text-muted-foreground">
                  {t(`dashboard.reports.daily_summary.cards.${stat.key}.label`)}
                </p>
                <p className={`text-3xl font-bold ${stat.valueClass ?? ""}`}>{stat.value}</p>
                <p className={`text-xs ${stat.noteClass}`}>{stat.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {t("dashboard.reports.daily_summary.export_excel")}
            </Button>
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              {t("dashboard.reports.daily_summary.export_pdf")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
