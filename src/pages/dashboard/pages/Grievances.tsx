import { useCallback, useEffect, useMemo, useState } from "react";
import { MultiSelect } from "primereact/multiselect";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  MessageSquare,
  Search,
  Clock,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  BusFront,
  Car,
  Route,
  UserRound,
  UsersRound,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchGrievances } from "@/features/complaintTicketing/api";
import { vehicleBreakdownApi } from "@/helpers/admin";
import {
  BREAKDOWN_REASON_LABELS,
  type VehicleBreakdownRecord,
} from "@/pages/admin/modules/core_modules/dailyOperations/vehicleBreakdown/types";
import { AttachmentPreview } from "@/features/complaintTicketing/components/AttachmentPreview";
import { InfoField } from "@/features/complaintTicketing/components/InfoField";
import type { Grievance } from "@/features/complaintTicketing/types";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { capitalize } from "@/utils/capitalize";
import type { SummaryCard, SummaryFilter, SummaryTab } from "./types/Grievances/types";

export default function Grievances() {
  const { t, i18n } = useTranslation();
  const [complaints, setComplaints] = useState<Grievance[]>([]);
  const [breakdowns, setBreakdowns] = useState<VehicleBreakdownRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SummaryTab>("all");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("none");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<string[]>([]);
  const [incidentFilters, setIncidentFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Grievance | null>(null);

  const loadComplaints = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError(null);
        setLoading(true);
        const [data, breakdownResult] = await Promise.all([
          fetchGrievances(signal),
          vehicleBreakdownApi.readAll({ signal }).catch(() => []),
        ]);
        setComplaints(data);
        const breakdownRows = Array.isArray(breakdownResult)
          ? breakdownResult
          : Array.isArray((breakdownResult as { results?: unknown })?.results)
            ? (breakdownResult as { results: VehicleBreakdownRecord[] }).results
            : [];
        setBreakdowns(breakdownRows as VehicleBreakdownRecord[]);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("Unable to load complaints", err);
        setError(t("dashboard.grievances.error_load_failed"));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [t],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadComplaints(controller.signal);
    return () => controller.abort();
  }, [loadComplaints]);


  const formatDateTime = (d?: string | null) => {
    if (!d) return "-";
    const dt = new Date(d);

    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();

    let h = dt.getHours();
    const m = String(dt.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;

    return `${dd}-${mm}-${yyyy} ${h}.${m} ${ampm}`;
  };

  const normalizeStatus = (raw?: string | null) =>
    (raw ?? "").toLowerCase().trim();

  const isResolvedStatus = (raw?: string | null) =>
    ["resolved", "closed", "rejected", "cancelled"].includes(normalizeStatus(raw));

  const isProgressStatus = (raw?: string | null) =>
    ["assigned", "processing", "progressing", "in-progress", "escalated"].includes(
      normalizeStatus(raw),
    );

  const normalizePriority = (raw?: unknown) => {
    const value = String(raw ?? "").toLowerCase();
    if (value.includes("high") || value.includes("critical")) return "High";
    if (value.includes("low")) return "Low";
    return "Medium";
  };

  const getDateOnly = (value?: string | null) =>
    value ? value.split("T")[0] : null;

  const formatDateForSearch = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString(i18n.language).replace(/\//g, "-")
      : "";

  const optionList = (values: Array<string | undefined>, label?: (value: string) => string) =>
    [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: label ? label(value) : capitalize(value.replaceAll("_", " ")) }));

  const filterOptions = useMemo(() => ({
    statuses: optionList(complaints.map((item) => item.status_code || item.status)),
    priorities: optionList(complaints.map((item) => item.priority_code || item.priority)),
    incidents: optionList(complaints.map((item) => item.operational_context?.incident_type || "other")),
    sources: optionList(
      complaints.map((item) => item.source_code || "INTERNAL"),
      (value) => value === "PUBLIC_GRIEVANCE" ? "Public Grievance" : capitalize(value.replaceAll("_", " ")),
    ),
    categories: optionList(complaints.map((item) => item.category_name || item.category)),
    assignees: optionList(complaints.map((item) => item.assigned_staff_name || item.assigned_team_name)),
  }), [complaints]);

  // SEARCH + MULTI-SELECT FILTERS
  const filtered = complaints.filter((g) => {
    const s = searchQuery.toLowerCase();
    const created = formatDateForSearch(g.created);
    const searchable = [
      g.title,
      g.category,
      g.category_name,
      g.zone_name,
      g.city_name,
      g.description,
      g.unique_id,
      g.operational_context?.trip_reference,
      g.operational_context?.driver_reference,
      g.operational_context?.operator_reference,
      g.operational_context?.vehicle_reference,
      g.assigned_staff_name,
      g.assigned_team_name,
      created,
    ].join(" ").toLowerCase();
    const createdDay = getDateOnly(g.created) || "";
    const status = g.status_code || g.status || "";
    const priority = g.priority_code || g.priority || "";
    const incident = g.operational_context?.incident_type || "other";
    const source = g.source_code || "INTERNAL";
    const category = g.category_name || g.category || "";
    const assignee = g.assigned_staff_name || g.assigned_team_name || "";

    return (
      searchable.includes(s) &&
      (!statusFilters.length || statusFilters.includes(status)) &&
      (!priorityFilters.length || priorityFilters.includes(priority)) &&
      (!incidentFilters.length || incidentFilters.includes(incident)) &&
      (!sourceFilters.length || sourceFilters.includes(source)) &&
      (!categoryFilters.length || categoryFilters.includes(category)) &&
      (!assigneeFilters.length || assigneeFilters.includes(assignee)) &&
      (!dateFrom || createdDay >= dateFrom) &&
      (!dateTo || createdDay <= dateTo)
    );
  });

  // KPI LOGIC
  const todayISO = new Date().toISOString().split("T")[0];

  const todayNewCount = complaints.filter(
    (g) => (getDateOnly(g.created) ?? "") === todayISO,
  ).length;

  const openCount = complaints.filter((g) => {
    const st = normalizeStatus(g.status);
    return !isResolvedStatus(st) && !isProgressStatus(st);
  }).length;

  const inProgressCount = complaints.filter((g) => {
    const st = normalizeStatus(g.status);
    return isProgressStatus(st);
  }).length;

  const resolvedCount = complaints.filter((g) =>
    isResolvedStatus(g.status)
  ).length;

  const highPriorityCount = complaints.filter((g) => {
    const st = normalizeStatus(g.status);
    if (isResolvedStatus(st)) return false;
    const priority = normalizePriority(g.priority_code || g.priority);
    return priority === "High";
  }).length;

  // TAB FILTERING
  const tabFiltered = (tab: string) => {
    return filtered.filter((g) => {
      const st = normalizeStatus(g.status);
      const created = getDateOnly(g.created) ?? "";

      if (tab === "new") return created === todayISO;

      if (tab === "open") {
        return !isResolvedStatus(st) && !isProgressStatus(st);
      }

      if (tab === "resolved") return isResolvedStatus(st);

      return true;
    });
  };

  const applySummaryFilter = (rows: Grievance[]) => {
    if (summaryFilter === "priority_high") {
      return rows.filter((g) => {
        const st = normalizeStatus(g.status);
        if (isResolvedStatus(st)) return false;
        const priority = normalizePriority(g.priority_code || g.priority);
        return priority === "High";
      });
    }

    if (summaryFilter === "in_progress") {
      return rows.filter((g) => {
        const st = normalizeStatus(g.status);
        return isProgressStatus(st);
      });
    }

    return rows;
  };

  const statusTokens: Record<
    string,
    {
      badge: string;
      chip: string;
      ring: string;
      glow: string;
      icon: string;
    }
  > = {
    open: {
      badge: "border-rose-300 text-rose-600 bg-rose-50 dark:border-rose-500/50 dark:text-rose-200 dark:bg-rose-950/40",
      chip: "bg-gradient-to-br from-white via-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/50",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-rose-200/60 dark:ring-rose-500/40",
      glow: "bg-gradient-to-r from-rose-400/50 via-transparent to-transparent",
      icon: "text-rose-600 dark:text-rose-200",
    },
    processing: {
      badge: "border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:bg-amber-950/40",
      chip: "bg-gradient-to-br from-white via-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/50",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-amber-200/60 dark:ring-amber-500/40",
      glow: "bg-gradient-to-r from-amber-400/40 via-transparent to-transparent",
      icon: "text-amber-600 dark:text-amber-200",
    },
    "in-progress": {
      badge: "border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:bg-amber-950/40",
      chip: "bg-gradient-to-br from-white via-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/50",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-amber-200/60 dark:ring-amber-500/40",
      glow: "bg-gradient-to-r from-amber-400/40 via-transparent to-transparent",
      icon: "text-amber-600 dark:text-amber-200",
    },
    progressing: {
      badge: "border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-500/50 dark:text-amber-200 dark:bg-amber-950/40",
      chip: "bg-gradient-to-br from-white via-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/50",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-amber-200/60 dark:ring-amber-500/40",
      glow: "bg-gradient-to-r from-amber-400/40 via-transparent to-transparent",
      icon: "text-amber-600 dark:text-amber-200",
    },
    resolved: {
      badge: "border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-200 dark:bg-emerald-950/40",
      chip: "bg-gradient-to-br from-white via-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/50",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-emerald-200/60 dark:ring-emerald-500/40",
      glow: "bg-gradient-to-r from-emerald-400/40 via-transparent to-transparent",
      icon: "text-emerald-600 dark:text-emerald-200",
    },
    closed: {
      badge: "border-emerald-300 text-emerald-600 bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-200 dark:bg-emerald-950/40",
      chip: "bg-gradient-to-br from-white via-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/50",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-emerald-200/60 dark:ring-emerald-500/40",
      glow: "bg-gradient-to-r from-emerald-400/40 via-transparent to-transparent",
      icon: "text-emerald-600 dark:text-emerald-200",
    },
    default: {
      badge: "border-slate-300 text-slate-600 bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:bg-slate-900/50",
      chip: "bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-slate-200/50 dark:ring-slate-700/50",
      glow: "bg-gradient-to-r from-slate-300/30 via-transparent to-transparent",
      icon: "text-slate-500 dark:text-slate-300",
    },
  };

  const getStatusStyles = (status?: string) =>
    statusTokens[status?.toLowerCase() ?? ""] ?? statusTokens.default;

  const statusLabels: Record<string, string> = {
    open: t("common.status_open"),
    processing: t("common.status_in_progress"),
    progressing: t("common.status_in_progress"),
    "in-progress": t("common.status_in_progress"),
    resolved: t("common.status_resolved"),
    closed: t("dashboard.grievances.status_closed"),
  };

  const tabLabels: Record<string, string> = {
    all: t("dashboard.grievances.tabs.all"),
    new: t("dashboard.grievances.tabs.new"),
    open: t("dashboard.grievances.tabs.open"),
    resolved: t("dashboard.grievances.tabs.resolved"),
  };

  const formatStatusLabel = (status?: string) => {
    if (!status) return t("dashboard.grievances.status_unknown");
    const normalized = status.toLowerCase();
    return statusLabels[normalized] ?? status;
  };

  const handleRefresh = () => loadComplaints();

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilters([]);
    setPriorityFilters([]);
    setIncidentFilters([]);
    setSourceFilters([]);
    setCategoryFilters([]);
    setAssigneeFilters([]);
    setDateFrom("");
    setDateTo("");
    setSummaryFilter("none");
    setPage(1);
  };

  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  const pageBgClass = cn(
    "min-h-screen p-6 transition-colors duration-300",
    isDarkMode
      ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 text-slate-100"
      : "bg-white text-slate-900"
  );

  const heroPanelClass = cn(
    "flex flex-wrap gap-4 items-center justify-between rounded-2xl p-6 border shadow-sm",
    isDarkMode
      ? "bg-slate-900/80 backdrop-blur border-slate-800"
      : "bg-gradient-to-r from-white via-sky-50 to-slate-100 backdrop-blur border-slate-200"
  );

  const surfaceCardClass = cn(
    "relative overflow-hidden rounded-2xl border backdrop-blur transition-all duration-500",
    isDarkMode
      ? "bg-slate-900/70 border-slate-800 shadow-2xl shadow-black/30"
      : "bg-white/90 border-slate-200 shadow-lg"
  );

  const tabsListClass = cn(
    "grid w-full grid-cols-2 sm:grid-cols-4 rounded-xl p-1",
    isDarkMode ? "bg-slate-900/70 border border-slate-800" : "bg-slate-100"
  );

  const summaryCards: SummaryCard[] = [
    {
      label: t("dashboard.grievances.summary_total"),
      value: complaints.length,
      subtext: t("dashboard.grievances.summary_total_subtext"),
      gradient: "bg-gradient-to-br from-white via-sky-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900/30 dark:to-slate-900",
      border: "border-sky-200/80 dark:border-sky-500/40",
      iconColor: "text-sky-600 dark:text-sky-200",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      Icon: MessageSquare,
      tab: "all",
      filter: "none",
    },
    {
      label: t("dashboard.grievances.summary_open"),
      value: openCount,
      subtext: t("dashboard.grievances.summary_open_subtext"),
      gradient: "bg-gradient-to-br from-white via-rose-50 to-rose-100 dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-900",
      border: "border-rose-200/80 dark:border-rose-500/40",
      iconColor: "text-rose-600 dark:text-rose-200",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      Icon: ShieldAlert,
      tab: "open",
      filter: "none",
    },
    {
      label: t("dashboard.grievances.summary_priority"),
      value: highPriorityCount,
      subtext: t("dashboard.grievances.summary_priority_subtext"),
      gradient: "bg-gradient-to-br from-white via-fuchsia-50 to-fuchsia-100 dark:from-slate-950 dark:via-fuchsia-950/20 dark:to-slate-900",
      border: "border-fuchsia-200/80 dark:border-fuchsia-500/40",
      iconColor: "text-fuchsia-600 dark:text-fuchsia-200",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      Icon: ShieldAlert,
      tab: "all",
      filter: "priority_high",
    },
    {
      label: t("dashboard.grievances.summary_resolved"),
      value: resolvedCount,
      subtext: t("dashboard.grievances.summary_resolved_subtext"),
      gradient: "bg-gradient-to-br from-white via-emerald-50 to-emerald-100 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-900",
      border: "border-emerald-200/80 dark:border-emerald-500/40",
      iconColor: "text-emerald-600 dark:text-emerald-200",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      Icon: CheckCircle2,
      tab: "resolved",
      filter: "none",
    },
    {
      label: t("dashboard.grievances.summary_new"),
      value: todayNewCount,
      subtext: t("dashboard.grievances.summary_new_subtext"),
      gradient: "bg-gradient-to-br from-white via-blue-50 to-blue-100 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-900",
      border: "border-blue-200/80 dark:border-blue-500/40",
      iconColor: "text-blue-600 dark:text-blue-200",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      Icon: Sparkles,
      tab: "new",
      filter: "none",
    },
    {
      label: t("dashboard.grievances.summary_in_progress"),
      value: inProgressCount,
      subtext: t("dashboard.grievances.summary_in_progress_subtext"),
      gradient: "bg-gradient-to-br from-white via-amber-50 to-amber-100 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900",
      border: "border-amber-200/80 dark:border-amber-500/40",
      iconColor: "text-amber-600 dark:text-amber-200",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      Icon: Clock,
      tab: "all",
      filter: "in_progress",
    },
  ];

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as SummaryTab);
    setSummaryFilter("none");
  };

  const handleSummaryClick = (tab: SummaryTab, filter: SummaryFilter) => {
    setActiveTab(tab);
    setSummaryFilter(filter);
    setPage(1);
  };

  const incidentBreakdown = [
    { key: "trip", label: "Trip related", icon: Route, tone: "border-blue-200 bg-blue-50 text-blue-700" },
    { key: "driver", label: "Driver related", icon: UserRound, tone: "border-violet-200 bg-violet-50 text-violet-700" },
    { key: "operator", label: "Operator related", icon: UsersRound, tone: "border-cyan-200 bg-cyan-50 text-cyan-700" },
    { key: "vehicle", label: "Vehicle related", icon: Car, tone: "border-amber-200 bg-amber-50 text-amber-700" },
    { key: "public", label: "Public grievance", icon: MessageSquare, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    { key: "other", label: "Other", icon: BusFront, tone: "border-slate-200 bg-slate-50 text-slate-700" },
  ].map((item) => ({
    ...item,
    count: complaints.filter(
      (complaint) => (complaint.operational_context?.incident_type || "other") === item.key,
    ).length,
  }));

  useEffect(() => {
    setPage(1);
  }, [
    activeTab,
    searchQuery,
    statusFilters,
    priorityFilters,
    incidentFilters,
    sourceFilters,
    categoryFilters,
    assigneeFilters,
    dateFrom,
    dateTo,
  ]);

  // MAIN UI --------------------------------------------------------
  return (
    <div className={pageBgClass}>
      <div className="space-y-6 h-[calc(100vh-80px)] overflow-y-auto pr-2 pb-10">
        <div className={heroPanelClass}>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              {t("dashboard.grievances.title")}
            </h2>
            <p className="text-muted-foreground">{t("dashboard.grievances.subtitle")}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="border-sky-200 text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900/70"
          >
            {t("dashboard.grievances.refresh")}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {summaryCards.map((card) => {
            const Icon = card.Icon;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => handleSummaryClick(card.tab, card.filter)}
                className="text-left"
              >
                <Card
                  className={cn(
                    surfaceCardClass,
                    card.gradient,
                    card.border,
                    "text-slate-900 dark:text-slate-100 hover:-translate-y-1"
                  )}
                >
                  <div className="pointer-events-none absolute inset-0">
                    <div className="card-shimmer absolute -right-10 top-10 h-24 w-24 rounded-full bg-white/40 dark:bg-white/5 blur-3xl" />
                  </div>
                  <CardHeader className="relative z-10 flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base font-semibold">{card.label}</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        {card.subtext}
                      </CardDescription>
                    </div>
                    <div className={cn("p-2 rounded-xl shadow-inner", card.iconBg)}>
                      <Icon className={cn("h-5 w-5", card.iconColor)} />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <p className="text-4xl font-bold">{card.value}</p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <Card className={cn(surfaceCardClass, "p-4")}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold">Complaint breakup</p>
              <p className="text-xs text-muted-foreground">Operational context attached to each complaint ticket</p>
            </div>
            <Badge variant="outline">{complaints.length} records</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            {incidentBreakdown.map(({ key, label, icon: Icon, tone, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setIncidentFilters([key])}
                className={cn("flex items-center justify-between rounded-xl border p-3 text-left transition hover:-translate-y-0.5", tone)}
              >
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="mt-1 text-xl font-bold">{count}</p>
                </div>
                <Icon className="h-5 w-5 opacity-75" />
              </button>
            ))}
          </div>
        </Card>

        <Card className={cn(surfaceCardClass, "p-4")}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative xl:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Search complaints and references</label>
              <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ticket, trip, driver, operator, vehicle, category…"
                className={cn(
                  "pl-10",
                  isDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white/90"
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {[
              ["Status", statusFilters, setStatusFilters, filterOptions.statuses],
              ["Priority", priorityFilters, setPriorityFilters, filterOptions.priorities],
              ["Incident type", incidentFilters, setIncidentFilters, filterOptions.incidents],
              ["Source", sourceFilters, setSourceFilters, filterOptions.sources],
              ["Category", categoryFilters, setCategoryFilters, filterOptions.categories],
              ["Assigned staff / team", assigneeFilters, setAssigneeFilters, filterOptions.assignees],
            ].map(([label, value, setter, options]) => (
              <div key={label as string}>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label as string}</label>
                <MultiSelect
                  value={value as string[]}
                  options={options as Array<{ value: string; label: string }>}
                  onChange={(event) => (setter as (values: string[]) => void)(event.value as string[])}
                  optionLabel="label"
                  optionValue="value"
                  display="chip"
                  maxSelectedLabels={2}
                  placeholder={`All ${(label as string).toLowerCase()}`}
                  className="h-10 w-full text-sm"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">From date</label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">To date</label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {complaints.length} complaints
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset filters
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="bg-gradient-to-r from-sky-400 to-indigo-500 text-white"
              >
                {t("dashboard.grievances.reload")}
              </Button>
            </div>
          </div>
        </Card>

        <Card className={cn(surfaceCardClass, "border-rose-200/80")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Car className="h-5 w-5 text-rose-500" />
                Vehicle Breakdown Alerts
              </CardTitle>
              <CardDescription>
                Trip, vehicle, driver, and operator context for active operational incidents
              </CardDescription>
            </div>
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
              {breakdowns.filter((item) => item.status !== "REJECTED").length} active
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-2">
              {breakdowns
                .filter((item) => item.status !== "REJECTED")
                .slice(0, 6)
                .map((item) => (
                  <div key={item.unique_id} className="rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{item.unique_id}</p>
                        <p className="text-xs text-rose-600">{BREAKDOWN_REASON_LABELS[item.breakdown_reason]}</p>
                      </div>
                      <Badge variant={item.status === "REPORTED" ? "destructive" : "secondary"}>
                        {item.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <InfoField label="Trip" value={item.trip_assignment_detail?.trip_plan_display_code || item.trip_assignment_id} />
                      <InfoField label="Vehicle" value={item.breakdown_vehicle_detail?.vehicle_no || item.breakdown_vehicle_id} />
                      <InfoField label="Driver" value={item.original_driver_detail?.name || item.replacement_driver_detail?.name || "—"} />
                      <InfoField label="Operator" value={item.original_operator_detail?.name || item.replacement_operator_detail?.name || "—"} />
                    </div>
                  </div>
                ))}
              {breakdowns.filter((item) => item.status !== "REJECTED").length === 0 && (
                <p className="col-span-full rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-semibold text-emerald-700">
                  No active vehicle breakdown alerts.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className={cn(surfaceCardClass, "border-rose-200/70 dark:border-rose-500/40")}>
            <CardContent className="py-4 text-rose-600 dark:text-rose-200">
              {error}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className={tabsListClass}>
            {["all", "new", "open", "resolved"].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="text-sm font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-950/70 dark:data-[state=active]:text-slate-100 transition"
              >
                {tabLabels[tab] ?? capitalize(tab)}
              </TabsTrigger>
            ))}
          </TabsList>

          {["all", "new", "open", "resolved"].map((tab) => {
            const tabItems = applySummaryFilter(tabFiltered(tab));
            const totalPages = Math.max(1, Math.ceil(tabItems.length / 10));
            const safePage = Math.min(page, totalPages);
            const pageItems = tabItems.slice((safePage - 1) * 10, safePage * 10);
            return (
              <TabsContent key={tab} value={tab} className="space-y-4">
                {tabItems.length === 0 ? (
                  <Card className={cn(surfaceCardClass, "border-dashed text-center text-sm text-muted-foreground")}>
                    <CardContent className="py-6">
                      {t("dashboard.grievances.empty")}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {pageItems.map((g, index) => {
                      const statusStyles = getStatusStyles(g.status);
                      const context = g.operational_context;
                      return (
                        <Card
                          key={g.id}
                          className={cn(
                            surfaceCardClass,
                            "p-5 hover:-translate-y-1",
                            statusStyles.ring
                          )}
                          style={{ animationDelay: `${index * 0.03}s` }}
                        >
                          <div className="relative grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-6">
                            <InfoField label={t("dashboard.grievances.fields.id")} value={g.unique_id} />
                            <InfoField
                              label={t("dashboard.grievances.fields.category")}
                              value={`${capitalize(g.main_category)} / ${capitalize(g.sub_category)}`}
                            />

                            <InfoField label={t("dashboard.grievances.fields.zone")} value={g.zone_name || (g.zone_id ? g.zone_id.split('-').pop() : '-')} />
                            <InfoField label={t("dashboard.grievances.fields.ward")} value={g.ward_name || (g.ward_id ? g.ward_id.split('-').pop() : '-')} />

                            <div>
                              <p className="text-xs text-muted-foreground">{t("dashboard.grievances.fields.status")}</p>
                              <Badge className={cn("mt-1", statusStyles.badge)}>
                                {formatStatusLabel(g.status)}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Complaint type</p>
                              <Badge variant="outline" className="mt-1 capitalize">
                                {context?.incident_type || "other"}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {context?.trip_reference && <Badge variant="secondary">Trip: {context.trip_reference}</Badge>}
                              {context?.vehicle_reference && <Badge variant="secondary">Vehicle: {context.vehicle_reference}</Badge>}
                              {context?.driver_reference && <Badge variant="secondary">Driver: {context.driver_reference}</Badge>}
                              {context?.operator_reference && <Badge variant="secondary">Operator: {context.operator_reference}</Badge>}
                              {(g.assigned_staff_name || g.assigned_team_name) && (
                                <Badge variant="outline">Assigned: {g.assigned_staff_name || g.assigned_team_name}</Badge>
                              )}
                            </div>
                            <Button
                              onClick={() => {
                                setSelectedComplaint(g);
                                setOpenDialog(true);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              {t("dashboard.grievances.view_details")}
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
                {tabItems.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-xl border bg-white p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900">
                    <span>
                      Showing {(safePage - 1) * 10 + 1}–{Math.min(safePage * 10, tabItems.length)} of {tabItems.length} · 10 per page
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>
                      <Badge variant="secondary">Page {safePage} of {totalPages}</Badge>
                      <Button size="sm" variant="outline" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

      {/* VIEW DETAILS MODAL */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent
          className="max-w-4xl rounded-xl p-0"
          style={{ height: "90vh" }}
        >
          <div className="overflow-y-auto h-full p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {t("dashboard.grievances.dialog_title")}
              </DialogTitle>
              <DialogDescription>{t("dashboard.grievances.dialog_subtitle")}</DialogDescription>
            </DialogHeader>

            {selectedComplaint && (
              <div className="space-y-8 pt-4">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <InfoField label={t("dashboard.grievances.detail.complaint_no")} value={selectedComplaint.unique_id} />
                    <InfoField label={t("dashboard.grievances.fields.zone")} value={selectedComplaint.zone_name || (selectedComplaint.zone_id ? selectedComplaint.zone_id.split('-').pop() : '-')} />
                    <InfoField label={t("dashboard.grievances.detail.contact")} value={selectedComplaint.contact_no} />
                    <InfoField label={t("dashboard.grievances.detail.closed_at")} value={formatDateTime(selectedComplaint.complaint_closed_at)} />
                    <InfoField label={t("dashboard.grievances.detail.address")} value={selectedComplaint.address} />
                  </div>

                  <div className="space-y-6">
                    <InfoField label={t("dashboard.grievances.fields.category")} value={capitalize(selectedComplaint.category)} />
                    <InfoField label={t("dashboard.grievances.fields.ward")} value={selectedComplaint.ward_name || (selectedComplaint.ward_id ? selectedComplaint.ward_id.split('-').pop() : '-')} />
                    <InfoField label={t("dashboard.grievances.detail.created")} value={formatDateTime(selectedComplaint.created)} />

                    <div>
                      <p className="text-xs text-muted-foreground">{t("dashboard.grievances.fields.status")}</p>
                      <Badge className={cn("px-3 py-1", getStatusStyles(selectedComplaint.status).badge)}>
                        {formatStatusLabel(selectedComplaint.status)}
                      </Badge>
                    </div>

                    <InfoField label={t("dashboard.grievances.detail.details")} value={selectedComplaint.details} />
                  </div>
                </div>

                <hr />

                <div>
                  <h3 className="mb-3 font-semibold">Operational complaint context</h3>
                  <div className="grid gap-4 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoField label="Incident type" value={capitalize(selectedComplaint.operational_context?.incident_type || "other")} />
                    <InfoField label="Trip" value={selectedComplaint.operational_context?.trip_reference || "—"} />
                    <InfoField label="Vehicle" value={selectedComplaint.operational_context?.vehicle_reference || "—"} />
                    <InfoField label="Driver" value={selectedComplaint.operational_context?.driver_reference || "—"} />
                    <InfoField label="Operator" value={selectedComplaint.operational_context?.operator_reference || "—"} />
                    <InfoField label="Assigned to" value={selectedComplaint.assigned_staff_name || selectedComplaint.assigned_team_name || "—"} />
                  </div>
                </div>

                <hr />

                <div className="grid md:grid-cols-2 gap-8">
                  <AttachmentPreview label={t("dashboard.grievances.detail.uploaded_file")} fileUrl={selectedComplaint.image_url} />
                  <AttachmentPreview label={t("dashboard.grievances.detail.close_file")} fileUrl={selectedComplaint.close_image_url} />
                </div>

                <hr />

                <InfoField label={t("dashboard.grievances.detail.remarks")} value={selectedComplaint.action_remarks || "-"} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
