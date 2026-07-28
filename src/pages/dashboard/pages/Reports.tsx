import { useState } from "react";
import { BarChart3, CalendarDays, Recycle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DailyWasteComparisonList from "@/pages/admin/modules/reports/wasteReports/dailyWasteComparison/dailyWasteComparisonList";
import MonthlyWasteComparisonListPage from "@/pages/admin/modules/reports/wasteReports/monthlyWasteComparison/MonthlyWasteComparisonListPage";

type WasteReportTab = "daily" | "monthly";

export default function Reports() {
  const [activeReport, setActiveReport] = useState<WasteReportTab>("daily");

  return (
    <div className="h-[calc(100vh-80px)] overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 pb-8">
      <div className="mx-auto w-full max-w-[1920px] space-y-5 px-3 pt-4 sm:px-5">
        <Card className="overflow-hidden border-emerald-100 bg-white/95 shadow-sm">
          <CardContent className="relative p-5 sm:p-6">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold">Waste Insights Hub</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Daily & Monthly Waste Comparisons
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live collection weight, trips, coverage, and waste composition restricted to your assigned hierarchy.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1.5 border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Daily operations
                </Badge>
                <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Monthly analytics
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs
          value={activeReport}
          onValueChange={(value) => setActiveReport(value as WasteReportTab)}
          className="space-y-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border bg-white p-1 shadow-sm sm:w-[520px]">
            <TabsTrigger value="daily" className="gap-2 rounded-lg py-2.5">
              <Recycle className="h-4 w-4" />
              Daily Waste Comparison
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2 rounded-lg py-2.5">
              <BarChart3 className="h-4 w-4" />
              Monthly Waste Comparison
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-0">
            <DailyWasteComparisonList embedded />
          </TabsContent>
          <TabsContent value="monthly" className="mt-0">
            <MonthlyWasteComparisonListPage embedded />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
