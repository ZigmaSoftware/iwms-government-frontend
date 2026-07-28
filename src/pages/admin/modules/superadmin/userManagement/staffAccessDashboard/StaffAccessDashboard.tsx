import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";

import {
  fetchScopedDailyWaste,
  fetchScopedMonthlyWaste,
  fetchStaffAccessDashboard,
  type DashboardFilters,
  type ScopeType,
  type StaffAccessDashboardResponse,
} from "@/helpers/admin/staffAccessDashboardApi";
import type { DailyReportResponse } from "@/pages/admin/modules/reports/wasteReports/dailyWasteComparison/types";
import type { ReportResponse as MonthlyReportResponse } from "@/pages/admin/modules/reports/wasteReports/monthlyWasteComparison/types";
import { exportRecordsToExcel } from "@/utils/exportExcel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/form/MultiSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const number = (value: number | null | undefined, digits = 0) =>
  Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: digits });

const STAFF_STATUS_OPTIONS = [
  { value: "active", label: "Active staff" },
  { value: "inactive", label: "Inactive staff" },
] as const;
const ASSIGNMENT_ROLE_OPTIONS = [
  { value: "driver", label: "Driver" },
  { value: "operator", label: "Operator" },
  { value: "additional_operator", label: "Additional operator" },
] as const;
const TRIP_STATUS_OPTIONS = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "In Progress", label: "In progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
] as const;

type MetricProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "rose";
};

const toneClass = {
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

function Metric({ label, value, icon, tone = "blue" }: MetricProps) {
  return (
    <Card className={toneClass[tone]}>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
          <p className="mt-1 text-2xl font-bold">{number(value)}</p>
        </div>
        <span className="rounded-xl bg-white/70 p-2 dark:bg-black/20">{icon}</span>
      </CardContent>
    </Card>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

const PAGE_SIZE = 10;

function PaginationBar({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  return (
    <div className="flex flex-col gap-2 border-t bg-slate-50/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing <b className="text-foreground">{start}–{end}</b> of{" "}
        <b className="text-foreground">{total}</b> · 10 per page
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onChange(safePage - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Badge variant="secondary">
          Page {safePage} of {totalPages}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          disabled={safePage >= totalPages}
          onClick={() => onChange(safePage + 1)}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const pageItems = <T,>(items: T[], page: number) => {
  const totalPages = Math.max(Math.ceil(items.length / PAGE_SIZE), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
};

export default function StaffAccessDashboard() {
  const [adminId, setAdminId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("corporation");
  const [scopeId, setScopeId] = useState("");
  const [statuses, setStatuses] = useState<
    Array<"active" | "inactive">
  >([]);
  const [search, setSearch] = useState("");
  const [assignmentRoles, setAssignmentRoles] = useState<
    Array<"driver" | "operator" | "additional_operator">
  >([]);
  const [tripStatuses, setTripStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(1);
  const [scopePage, setScopePage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [vehiclePage, setVehiclePage] = useState(1);
  const [tripPage, setTripPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [dailyPage, setDailyPage] = useState(1);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [dashboardData, setDashboardData] =
    useState<StaffAccessDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);
  const [dashboardRetry, setDashboardRetry] = useState(0);
  const [dailyData, setDailyData] = useState<DailyReportResponse | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState(false);
  const [dailyRetry, setDailyRetry] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportResponse | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState(false);
  const [monthlyRetry, setMonthlyRetry] = useState(0);
  const dashboardRequestRef = useRef(0);
  const dailyRequestRef = useRef(0);
  const monthlyRequestRef = useRef(0);
  const accessContextAppliedRef = useRef(false);

  const filters = useMemo<DashboardFilters>(
    () => ({
      admin_id: adminId || undefined,
      scope_type: scopeType,
      scope_id: scopeId || undefined,
      status: statuses.length ? statuses : undefined,
      search: search || undefined,
      assignment_role: assignmentRoles.length
        ? assignmentRoles
        : undefined,
      trip_status: tripStatuses.length ? tripStatuses : undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page,
      page_size: PAGE_SIZE,
    }),
    [adminId, assignmentRoles, dateFrom, dateTo, page, scopeId, scopeType, search, statuses, tripStatuses],
  );

  useEffect(() => {
    const requestId = ++dashboardRequestRef.current;
    queueMicrotask(() => {
      if (dashboardRequestRef.current !== requestId) return;
      setDashboardLoading(true);
      setDashboardError(false);
    });
    void fetchStaffAccessDashboard(filters)
      .then((response) => {
        if (dashboardRequestRef.current !== requestId) return;
        setDashboardData(response);
      })
      .catch(() => {
        if (dashboardRequestRef.current !== requestId) return;
        setDashboardError(true);
      })
      .finally(() => {
        if (dashboardRequestRef.current === requestId) setDashboardLoading(false);
      });
  }, [dashboardRetry, filters]);

  useEffect(() => {
    if (!scopeId) {
      const requestId = ++dailyRequestRef.current;
      queueMicrotask(() => {
        if (dailyRequestRef.current !== requestId) return;
        setDailyData(null);
        setDailyLoading(false);
        setDailyError(false);
      });
      return;
    }
    const requestId = ++dailyRequestRef.current;
    queueMicrotask(() => {
      if (dailyRequestRef.current !== requestId) return;
      setDailyLoading(true);
      setDailyError(false);
    });
    void fetchScopedDailyWaste(filters)
      .then((response) => {
        if (dailyRequestRef.current !== requestId) return;
        setDailyData(response);
      })
      .catch(() => {
        if (dailyRequestRef.current !== requestId) return;
        setDailyError(true);
      })
      .finally(() => {
        if (dailyRequestRef.current === requestId) setDailyLoading(false);
      });
  }, [dailyRetry, filters, scopeId]);

  useEffect(() => {
    if (!scopeId) {
      const requestId = ++monthlyRequestRef.current;
      queueMicrotask(() => {
        if (monthlyRequestRef.current !== requestId) return;
        setMonthlyData(null);
        setMonthlyLoading(false);
        setMonthlyError(false);
      });
      return;
    }
    const requestId = ++monthlyRequestRef.current;
    queueMicrotask(() => {
      if (monthlyRequestRef.current !== requestId) return;
      setMonthlyLoading(true);
      setMonthlyError(false);
    });
    void fetchScopedMonthlyWaste(filters, month)
      .then((response) => {
        if (monthlyRequestRef.current !== requestId) return;
        setMonthlyData(response);
      })
      .catch(() => {
        if (monthlyRequestRef.current !== requestId) return;
        setMonthlyError(true);
      })
      .finally(() => {
        if (monthlyRequestRef.current === requestId) setMonthlyLoading(false);
      });
  }, [filters, month, monthlyRetry, scopeId]);

  const data = dashboardData;
  const accessContext = data?.access_context;
  const selectedName =
    data?.selected_scope?.name ??
    data?.scope_rows.find((scope) => scope.id === scopeId)?.name ??
    "";

  const selectScope = (id: string) => {
    setScopeId(id);
    setPage(1);
    setAssignmentPage(1);
    setVehiclePage(1);
    setTripPage(1);
    setTeamPage(1);
    setDailyPage(1);
    setMonthlyPage(1);
  };

  const selectAdmin = (id: string) => {
    if (accessContext?.locked) return;
    setAdminId(id === "all" ? "" : id);
    setPage(1);
    const admin = data?.filters.admins.find((item) => item.id === id);
    if (admin?.default_scope) {
      setScopeType(admin.default_scope.scope_type);
      setScopeId(admin.default_scope.scope_id);
    } else {
      setScopeId("");
    }
  };

  const reset = () => {
    setAdminId(accessContext?.admin_id ?? "");
    setScopeType(accessContext?.scope_type ?? "corporation");
    setScopeId(accessContext?.scope_id ?? "");
    setStatuses([]);
    setSearch("");
    setAssignmentRoles([]);
    setTripStatuses([]);
    setDateFrom(today());
    setDateTo(today());
    setMonth(currentMonth());
    setPage(1);
    setScopePage(1);
    setAssignmentPage(1);
    setVehiclePage(1);
    setTripPage(1);
    setTeamPage(1);
    setDailyPage(1);
    setMonthlyPage(1);
  };

  useEffect(() => {
    if (
      !dashboardData?.access_context.locked ||
      accessContextAppliedRef.current
    ) {
      return;
    }
    const context = dashboardData.access_context;
    accessContextAppliedRef.current = true;
    queueMicrotask(() => {
      setAdminId(context.admin_id ?? "");
      if (context.scope_type) setScopeType(context.scope_type);
      setScopeId(context.scope_id ?? "");
      setPage(1);
    });
  }, [dashboardData]);

  const activeFilterCount =
    statuses.length +
    assignmentRoles.length +
    tripStatuses.length +
    (search.trim() ? 1 : 0) +
    (dateFrom !== today() ? 1 : 0) +
    (dateTo !== today() ? 1 : 0) +
    (!accessContext?.locked && adminId ? 1 : 0);
  const pagedScopes = pageItems(data?.scope_rows ?? [], scopePage);
  const pagedAssignments = pageItems(
    data?.assignment_rows ?? [],
    assignmentPage,
  );
  const pagedVehicles = pageItems(
    data?.vehicle_performance ?? [],
    vehiclePage,
  );
  const pagedTrips = pageItems(data?.trip_performance ?? [], tripPage);
  const pagedTeams = pageItems(data?.team_performance ?? [], teamPage);
  const dailyRows = dailyData?.results ?? [];
  const monthlyRows = monthlyData?.results ?? [];
  const pagedDailyRows = pageItems(dailyRows, dailyPage);
  const pagedMonthlyRows = pageItems(monthlyRows, monthlyPage);

  if (dashboardError) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="font-semibold text-destructive">Unable to load the Staff Access Dashboard.</p>
            <Button onClick={() => setDashboardRetry((value) => value + 1)}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 bg-slate-50 p-3 text-slate-900 dark:bg-[#020912] dark:text-slate-100">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold">Staff Access Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Staff permissions, assignments, vehicles, trips, and waste comparison by data scope.
          </p>
        </div>
        {scopeId && !accessContext?.scope_id && (
          <Button variant="outline" onClick={() => setScopeId("")}>
            <ArrowLeft /> Back to scope summary
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="flex flex-col gap-2 border-b bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Dashboard filters</p>
              <p className="text-xs text-muted-foreground">
                Combine multiple staff, assignment, and trip conditions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                {activeFilterCount} active
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={reset}
            >
              Reset filters
            </Button>
          </div>
        </div>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="space-y-1.5 xl:col-span-3">
            <label className="text-xs font-semibold text-slate-600">Access owner</label>
            <Select
              value={adminId || "all"}
              onValueChange={selectAdmin}
              disabled={Boolean(accessContext?.locked)}
            >
              <SelectTrigger aria-label="Access owner admin"><SelectValue placeholder="Select admin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All admins</SelectItem>
                {(data?.filters.admins ?? []).map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>{admin.name} · {admin.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Hierarchy level</label>
            <Select
              value={scopeType}
              onValueChange={(value: ScopeType) => {
                setScopeType(value);
                setScopeId("");
                setPage(1);
                setScopePage(1);
              }}
              disabled={Boolean(accessContext?.locked && accessContext.scope_type)}
            >
              <SelectTrigger aria-label="Scope type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="district">District</SelectItem>
                <SelectItem value="corporation">Corporation</SelectItem>
                <SelectItem value="panchayat_union">Panchayat Union</SelectItem>
                <SelectItem value="panchayat">Panchayat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 xl:col-span-3">
            <label className="text-xs font-semibold text-slate-600">Staff status</label>
            <MultiSelect
              inputId="dashboard-staff-status"
              value={statuses}
              onChange={(event) => {
                setStatuses(event.value as Array<"active" | "inactive">);
                setPage(1);
              }}
              options={STAFF_STATUS_OPTIONS}
              optionLabel="label"
              optionValue="value"
              placeholder="All staff statuses"
              filter={false}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
            <label className="text-xs font-semibold text-slate-600">Search staff</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Name, staff ID, username, phone, or email"
              />
            </div>
          </div>
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-xs font-semibold text-slate-600">From date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setAssignmentPage(1);
                setVehiclePage(1);
                setTripPage(1);
                setTeamPage(1);
                setDailyPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-xs font-semibold text-slate-600">To date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setAssignmentPage(1);
                setVehiclePage(1);
                setTripPage(1);
                setTeamPage(1);
                setDailyPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5 xl:col-span-4">
            <label className="text-xs font-semibold text-slate-600">Assignment roles</label>
            <MultiSelect
              inputId="dashboard-assignment-roles"
              value={assignmentRoles}
              onChange={(event) => {
                setAssignmentRoles(
                  event.value as Array<"driver" | "operator" | "additional_operator">,
                );
                setPage(1);
                setAssignmentPage(1);
                setVehiclePage(1);
                setTripPage(1);
                setTeamPage(1);
              }}
              options={ASSIGNMENT_ROLE_OPTIONS}
              optionLabel="label"
              optionValue="value"
              placeholder="All assignment roles"
              filter={false}
            />
          </div>
          <div className="space-y-1.5 xl:col-span-4">
            <label className="text-xs font-semibold text-slate-600">Trip statuses</label>
            <MultiSelect
              inputId="dashboard-trip-statuses"
              value={tripStatuses}
              onChange={(event) => {
                setTripStatuses(event.value as string[]);
                setPage(1);
                setVehiclePage(1);
                setTripPage(1);
                setTeamPage(1);
              }}
              options={TRIP_STATUS_OPTIONS}
              optionLabel="label"
              optionValue="value"
              placeholder="All trip statuses"
              filter={false}
            />
          </div>
        </CardContent>
      </Card>

      {data?.selected_admin && (
        <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm dark:bg-black/20 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Admin access owner
                </p>
                <h2 className="text-lg font-bold">{data.selected_admin.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {data.selected_admin.role}
                  {data.selected_admin.username
                    ? ` · ${data.selected_admin.username}`
                    : ""}
                </p>
                {accessContext?.locked && (
                  <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Scope fixed by Staff Access Configuration
                  </p>
                )}
              </div>
            </div>
            <div className="lg:max-w-[60%] lg:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Responsible hierarchy
              </p>
              <p className="mt-1 font-medium">
                {data.selected_admin.hierarchy_label || "No hierarchy assigned"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-end">
                {data.selected_admin.hierarchy.map((item) => (
                  <Badge key={`${item.level}-${item.id}`} variant="outline">
                    {item.level.replaceAll("_", " ")}: {item.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardLoading || !data ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Loading dashboard…</CardContent></Card>
      ) : !scopeId ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Scopes" value={data.summary.total_scopes ?? 0} icon={<ShieldCheck />} />
            <Metric label="Staff" value={data.summary.total_staff} icon={<Users />} tone="green" />
            <Metric label="Active" value={data.summary.active_staff} icon={<UserCheck />} tone="green" />
            <Metric label="Without permissions" value={data.summary.without_permissions} icon={<UserMinus />} tone="amber" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pagedScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => selectScope(scope.id)}
                className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{scope.name}</p>
                    <p className="text-xs text-muted-foreground">{scope.district_name} · {scope.scope_type_label}</p>
                  </div>
                  <Badge variant="secondary">{scope.total_staff} staff</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/30">
                    <p className="text-lg font-bold text-emerald-600">{scope.active_staff}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Active</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/30">
                    <p className="text-lg font-bold text-blue-600">{scope.with_permissions}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">Permitted</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/30">
                    <p className="text-lg font-bold text-amber-600">{scope.without_permissions}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">No access</p>
                  </div>
                </div>
              </button>
            ))}
            {data.scope_rows.length === 0 && <Empty text="No accessible scopes found." />}
          </div>
          <PaginationBar
            page={scopePage}
            total={data.scope_rows.length}
            onChange={setScopePage}
          />
        </>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{data.selected_scope?.scope_type_label}</p>
            <h2 className="text-lg font-bold">{selectedName}</h2>
            <p className="text-sm text-muted-foreground">
              {data.selected_scope?.state_name} / {data.selected_scope?.district_name}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Metric label="Total staff" value={data.kpis?.total_staff ?? 0} icon={<Users />} />
            <Metric label="Active staff" value={data.kpis?.active_staff ?? 0} icon={<UserCheck />} tone="green" />
            <Metric label="Login enabled" value={data.kpis?.login_enabled ?? 0} icon={<KeyRound />} tone="green" />
            <Metric label="Fully configured" value={data.kpis?.fully_configured ?? 0} icon={<CheckCircle2 />} tone="blue" />
            <Metric label="No permissions" value={data.kpis?.without_permissions ?? 0} icon={<UserMinus />} tone="amber" />
            <Metric label="Assigned staff" value={data.assignment_kpis.staff_assigned} icon={<Route />} tone="green" />
          </div>

          <Tabs defaultValue="access">
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              <TabsTrigger value="access">Staff Access</TabsTrigger>
              <TabsTrigger value="assignments">Staff Assignments</TabsTrigger>
              <TabsTrigger value="performance">Trip & Vehicle Performance</TabsTrigger>
              <TabsTrigger value="daily">Daily Waste Comparison</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Waste Comparison</TabsTrigger>
            </TabsList>

            <TabsContent value="access">
              <Panel
                title="Staff access and permissions"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      exportRecordsToExcel(
                        data.staff_rows.results,
                        `staff-access-${selectedName}.xlsx`,
                        "Staff Access",
                      )
                    }
                  >
                    <Download /> Export
                  </Button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                      <tr>{["Staff", "Hierarchy level", "Assigned hierarchy", "Username", "Role", "Status", "Login", "Main screens", "User screens", "Actions"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.staff_rows.results.map((staff) => (
                        <tr key={staff.staff_id} className="border-t">
                          <td className="px-4 py-3"><p className="font-medium">{staff.name}</p><p className="text-xs text-muted-foreground">{staff.emp_id || staff.staff_id}</p></td>
                          <td className="px-4 py-3"><Badge variant="outline">{staff.hierarchy_level_label}</Badge></td>
                          <td className="px-4 py-3">{staff.hierarchy_names.join(", ") || "Unassigned"}</td>
                          <td className="px-4 py-3">{staff.username || "—"}</td>
                          <td className="px-4 py-3">{staff.role || "—"}</td>
                          <td className="px-4 py-3"><Badge variant={staff.active ? "default" : "secondary"}>{staff.active ? "Active" : "Inactive"}</Badge></td>
                          <td className="px-4 py-3">{staff.login_enabled ? "Enabled" : "Disabled"}</td>
                          <td className="px-4 py-3">{staff.main_screens}</td>
                          <td className="px-4 py-3">{staff.user_screens}</td>
                          <td className="px-4 py-3">{staff.actions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.staff_rows.results.length === 0 && <Empty text="No staff match the selected filters." />}
                </div>
                <PaginationBar
                  page={data.staff_rows.pagination.page}
                  total={data.staff_rows.pagination.count}
                  onChange={setPage}
                />
              </Panel>
            </TabsContent>

            <TabsContent value="assignments" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Assigned" value={data.assignment_kpis.staff_assigned} icon={<UserCheck />} tone="green" />
                <Metric label="Unassigned" value={data.assignment_kpis.staff_unassigned} icon={<UserMinus />} tone="amber" />
                <Metric label="Trips" value={data.assignment_kpis.trip_assignments} icon={<Route />} />
                <Metric label="Vehicles assigned" value={data.assignment_kpis.vehicles_assigned} icon={<Truck />} />
              </div>
              <Panel
                title="Staff → team → trip → vehicle"
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportRecordsToExcel(data.assignment_rows, `staff-assignments-${selectedName}.xlsx`, "Assignments")}
                  >
                    <Download /> Export
                  </Button>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px] text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                      <tr>{["Staff", "Role", "Attendance", "Team", "Trip", "Date / time", "Vehicle", "Wards", "Status"].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr>
                    </thead>
                    <tbody>
                      {pagedAssignments.map((row) => (
                        <tr key={`${row.trip_assignment_id}-${row.staff_id}-${row.assignment_role}`} className="border-t align-top">
                          <td className="px-4 py-3"><p className="font-medium">{row.staff_name}</p><p className="text-xs text-muted-foreground">{row.emp_id || row.staff_id}</p></td>
                          <td className="px-4 py-3 capitalize">{row.assignment_role.replaceAll("_", " ")}{row.is_substitute && <Badge className="ml-2" variant="outline">Substitute</Badge>}</td>
                          <td className="px-4 py-3">{row.attendance_status}</td>
                          <td className="px-4 py-3">{row.effective_team_code}</td>
                          <td className="px-4 py-3"><p>{row.trip_plan_code}</p><p className="text-xs text-muted-foreground">{row.trip_assignment_id}</p></td>
                          <td className="px-4 py-3">{row.trip_date}<br /><span className="text-xs text-muted-foreground">{row.scheduled_time}</span></td>
                          <td className="px-4 py-3">{row.vehicle_no || "Unassigned"}<br /><span className="text-xs text-muted-foreground">{row.vehicle_type || ""}</span></td>
                          <td className="px-4 py-3">{row.wards.join(", ") || "—"}</td>
                          <td className="px-4 py-3"><Badge variant="secondary">{row.trip_status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.assignment_rows.length === 0 && <Empty text="No trip assignments exist for this scope and date range." />}
                </div>
                <PaginationBar
                  page={assignmentPage}
                  total={data.assignment_rows.length}
                  onChange={setAssignmentPage}
                />
              </Panel>
            </TabsContent>

            <TabsContent value="performance" className="grid gap-3 xl:grid-cols-3">
              <Panel title="Vehicle Performance">
                <>
                <div className="divide-y">
                  {pagedVehicles.map((vehicle) => (
                    <div key={vehicle.vehicle_id} className="flex items-center justify-between p-3 text-sm">
                      <div><p className="font-medium">{vehicle.registration_no}</p><p className="text-xs text-muted-foreground">{vehicle.vehicle_type}</p></div>
                      <div className="text-right"><p className="font-semibold">{vehicle.trips} trips</p><p className="text-xs text-muted-foreground">{vehicle.status}</p></div>
                    </div>
                  ))}
                  {data.vehicle_performance.length === 0 && <Empty text="No vehicles found." />}
                </div>
                <PaginationBar page={vehiclePage} total={data.vehicle_performance.length} onChange={setVehiclePage} />
                </>
              </Panel>
              <Panel title="Trip Performance">
                <>
                <div className="divide-y">
                  {pagedTrips.map((trip) => (
                    <div key={trip.trip_id} className="flex items-center justify-between p-3 text-sm">
                      <div><p className="font-medium">{trip.trip_plan_code}</p><p className="text-xs text-muted-foreground">{trip.vehicle_no || "No vehicle"} · {trip.trip_date}</p></div>
                      <Badge variant="secondary">{trip.status}</Badge>
                    </div>
                  ))}
                  {data.trip_performance.length === 0 && <Empty text="No trips found." />}
                </div>
                <PaginationBar page={tripPage} total={data.trip_performance.length} onChange={setTripPage} />
                </>
              </Panel>
              <Panel title="Team Performance">
                <>
                <div className="divide-y">
                  {pagedTeams.map((team) => (
                    <div key={team.team_id} className="flex items-center justify-between p-3 text-sm">
                      <div><p className="font-medium">{team.team_name}</p><p className="text-xs text-muted-foreground">{team.staff_count} assigned staff</p></div>
                      <p className="font-semibold">{team.trips} trips</p>
                    </div>
                  ))}
                  {data.team_performance.length === 0 && <Empty text="No teams found." />}
                </div>
                <PaginationBar page={teamPage} total={data.team_performance.length} onChange={setTeamPage} />
                </>
              </Panel>
            </TabsContent>

            <TabsContent value="daily">
              <Panel
                title={`Daily Waste Comparison · ${selectedName}`}
                action={<div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />{dateFrom}</div>}
              >
                {dailyLoading ? <Empty text="Loading daily waste comparison…" /> : dailyError ? (
                  <div className="space-y-2 p-8 text-center"><p className="text-sm text-destructive">Daily comparison could not be loaded.</p><Button size="sm" onClick={() => setDailyRetry((value) => value + 1)}>Retry</Button></div>
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="Actual weight (kg)" value={dailyData?.kpis.total_actual_weight_kg ?? 0} icon={<Truck />} tone="green" />
                      <Metric label="Trips" value={dailyData?.kpis.total_trips ?? 0} icon={<Route />} />
                      <Metric label="Points covered" value={dailyData?.kpis.collection_points_covered ?? 0} icon={<CheckCircle2 />} tone="blue" />
                      <Metric label="Waste types" value={dailyData?.kpis.waste_type_count ?? 0} icon={<ShieldCheck />} tone="amber" />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-muted/60 text-left"><tr>{["Date", "Local body", "Waste type", "Actual kg", "Trips", "Points"].map((item) => <th key={item} className="px-3 py-2">{item}</th>)}</tr></thead>
                        <tbody>{pagedDailyRows.map((row) => <tr key={row.unique_id} className="border-t"><td className="px-3 py-2">{row.collection_date}</td><td className="px-3 py-2">{row.local_body_name}</td><td className="px-3 py-2">{row.waste_type}</td><td className="px-3 py-2">{number(row.actual_weight_kg, 2)}</td><td className="px-3 py-2">{row.total_trips}</td><td className="px-3 py-2">{row.collection_points_covered}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <PaginationBar page={dailyPage} total={dailyRows.length} onChange={setDailyPage} />
                  </div>
                )}
              </Panel>
            </TabsContent>

            <TabsContent value="monthly">
              <Panel
                title={`Monthly Waste Comparison · ${selectedName}`}
                action={(
                  <Input
                    className="h-8 w-40"
                    type="month"
                    value={month}
                    onChange={(event) => {
                      setMonth(event.target.value);
                      setMonthlyPage(1);
                    }}
                  />
                )}
              >
                {monthlyLoading ? <Empty text="Loading monthly waste comparison…" /> : monthlyError ? (
                  <div className="space-y-2 p-8 text-center"><p className="text-sm text-destructive">Monthly comparison could not be loaded.</p><Button size="sm" onClick={() => setMonthlyRetry((value) => value + 1)}>Retry</Button></div>
                ) : (
                  <div className="space-y-4 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric label="Actual weight (kg)" value={monthlyData?.kpis.total_actual_weight ?? 0} icon={<Truck />} tone="green" />
                      <Metric label="Agreed weight (kg)" value={monthlyData?.kpis.total_agreed_weight ?? 0} icon={<ShieldCheck />} />
                      <Metric label="Trips" value={monthlyData?.kpis.total_trips ?? 0} icon={<Route />} />
                      <Metric label="Points covered" value={monthlyData?.kpis.collection_points_covered ?? 0} icon={<CheckCircle2 />} tone="blue" />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-sm">
                        <thead className="bg-muted/60 text-left"><tr>{["Month", "Local body", "Waste type", "Agreed kg", "Actual kg", "Variance", "Trips"].map((item) => <th key={item} className="px-3 py-2">{item}</th>)}</tr></thead>
                        <tbody>{pagedMonthlyRows.map((row, index) => <tr key={row.unique_id ?? `${row.local_body_id}-${row.waste_type_id}-${index}`} className="border-t"><td className="px-3 py-2">{row.month}</td><td className="px-3 py-2">{row.local_body_name}</td><td className="px-3 py-2">{row.waste_type}</td><td className="px-3 py-2">{number(row.total_agreed_weight, 2)}</td><td className="px-3 py-2">{number(row.total_actual_weight, 2)}</td><td className="px-3 py-2">{number(row.variance_kg, 2)}</td><td className="px-3 py-2">{row.total_trips}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <PaginationBar page={monthlyPage} total={monthlyRows.length} onChange={setMonthlyPage} />
                  </div>
                )}
              </Panel>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
