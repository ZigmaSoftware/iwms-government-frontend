import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { GIcon } from "@/components/ui/gicon";

const routesData = [
  { route: "North Zone – R1", status: "On time", completion: 78 },
  { route: "North Zone – R2", status: "Delayed", completion: 43 },
  { route: "South Zone – R3", status: "On time", completion: 85 },
  { route: "East Zone – R4", status: "Not started", completion: 0 },
];

const grievanceSummary = [
  { type: "Non-collection", open: 9, sla: "4h", risk: "High" },
  { type: "Overflowing bins", open: 4, sla: "6h", risk: "Medium" },
  { type: "Vehicle nuisance", open: 2, sla: "12h", risk: "Low" },
  { type: "Others", open: 2, sla: "24h", risk: "Low" },
];

const HomeDashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation();

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dashboard.header")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("dashboard.subheader")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            {t("dashboard.live_sync")}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <GIcon
              name="refresh"
              className={`text-base ${refreshing ? "animate-spin" : ""}`}
            />
            {t("dashboard.refresh")}
          </Button>
        </div>
      </div>

      {/* KPI ROW */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("dashboard.kpi_collections")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">128</div>
              <p className="text-xs text-emerald-600 mt-1">
                {t("dashboard.kpi_delta_collections")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <GIcon name="local_shipping" className="text-lg text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("dashboard.kpi_efficiency")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">92%</div>
              <p className="text-xs text-emerald-600 mt-1">
                {t("dashboard.kpi_delta_efficiency")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-100">
              <GIcon name="monitor_heart" className="text-lg text-sky-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("dashboard.kpi_grievances")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">17</div>
              <p className="text-xs text-emerald-600 mt-1">
                {t("dashboard.kpi_delta_grievances")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <GIcon name="warning" className="text-lg text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t("dashboard.kpi_workforce")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold">246</div>
              <p className="text-xs text-emerald-600 mt-1">
                {t("dashboard.kpi_delta_workforce")}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <GIcon name="groups" className="text-lg text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS */}
      <Tabs defaultValue="routes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="routes" className="gap-2">
            <GIcon name="map" className="text-base" />
            {t("dashboard.tab_routes")}
          </TabsTrigger>
          <TabsTrigger value="grievances" className="gap-2">
            <GIcon name="support_agent" className="text-base" />
            {t("dashboard.tab_grievances")}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <GIcon name="query_stats" className="text-base" />
            {t("dashboard.tab_analytics")}
          </TabsTrigger>
        </TabsList>

        {/* ROUTES TAB */}
        <TabsContent value="routes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GIcon name="route" className="text-base" />
                {t("dashboard.routes_card_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {routesData.map((r) => (
                <div
                  key={r.route}
                  className="flex flex-col gap-1 border-b last:border-none pb-3 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.route}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "On time"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : r.status === "Delayed"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-slate-50 text-slate-700 border border-slate-100"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={r.completion} className="h-1.5" />
                    <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                      {r.completion}%
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GRIEVANCES TAB */}
        <TabsContent value="grievances">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GIcon name="report" className="text-base" />
                {t("dashboard.grievances_card_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {grievanceSummary.map((g) => (
                  <div
                    key={g.type}
                    className="rounded-lg border border-border/60 p-3 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{g.type}</span>
                      <Badge
                        variant={
                          g.risk === "High"
                            ? "destructive"
                            : g.risk === "Medium"
                            ? "default"
                            : "outline"
                        }
                      >
                        {g.risk} risk
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>Open: {g.open}</span>
                      <span>SLA: {g.sla}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GIcon name="analytics" className="text-base" />
                {t("dashboard.analytics_card_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("dashboard.no_charts_placeholder")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HomeDashboard;
