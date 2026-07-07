import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useMemo, useState } from "react";
import { staffCreationApi } from "@/helpers/admin";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { formatIsoDate, normalizeList } from "@/utils/forms";
import type { ResourceEmployee } from "./types/ResourceManagement/types";

const mapRecord = (record: any, t: TFunction): ResourceEmployee => {
  const notAvailable = t("common.not_available");
  const name = record.employee_name ?? record.staff_name ?? notAvailable;
  const roleLabel =
    record.designation ??
    record.department ??
    record.staffusertype_name ??
    record.user_type_name ??
    "staff";
  const role = roleLabel.toString().toLowerCase();
  const zone =
    record.zone_name ??
    record.site_name ??
    record.department ??
    record.project_name ??
    notAvailable;
  const vehicle =
    record.vehicle_name ??
    record.grade ??
    record.salary_type ??
    record.staff_vehicle ??
    notAvailable;
  const joinDate = formatIsoDate(record.doj ?? record.staff_doj ?? record.created_at);

  return {
    id: record.unique_id ?? record.emp_id ?? record.id?.toString() ?? "-",
    name: name.toString(),
    role,
    zone,
    status: record.is_active || record.active_status ? "active" : "inactive",
    phone: record.staff_contact_mobile ?? record.contact_mobile ?? notAvailable,
    email: record.staff_contact_email ?? record.contact_email ?? notAvailable,
    vehicle,
    joinDate,
    ward: record.department ?? notAvailable,
  };
};

export default function ResourceManagement() {
  const [employees, setEmployees] = useState<any[]>([]);
  const { t } = useTranslation();
  const allFilterValue = "all";
  // FILTER STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(allFilterValue);
  const [zoneFilter, setZoneFilter] = useState(allFilterValue);
  const [vehicleFilter, setVehicleFilter] = useState(allFilterValue);
  const [joinDateFilter, setJoinDateFilter] = useState(allFilterValue);

  const translateRole = (role: string) => {
    const normalized = role.toLowerCase();
    if (normalized === "driver") return t("dashboard.resources.roles.driver");
    if (normalized === "operator") return t("dashboard.resources.roles.operator");
    if (normalized === "helper") return t("dashboard.resources.roles.helper");
    if (normalized === "staff") return t("dashboard.resources.roles.staff");
    return role;
  };

  const translateStatus = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "active") return t("common.active");
    if (normalized === "inactive") return t("common.inactive");
    if (normalized === "on-leave") return t("dashboard.resources.status.on_leave");
    return status;
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await staffCreationApi.readAll();
        console.log(res);
        const records = normalizeList(res);
        const staffOnly = records.filter(
          (record: any) =>
            (record.user_type_name?.toLowerCase() === "staff") ||
            (record.staffusertype_name?.toLowerCase() === "staff") ||
            (record.designation?.toLowerCase() === "driver") ||
            (record.designation?.toLowerCase() === "operator")
        );  

        const mapped = staffOnly.map((record: any) => mapRecord(record, t));
        setEmployees(mapped);
      } catch (err) {
        console.error("Failed to load staff", err);
      }
    };

    fetchStaff();
  }, [t]);

  // CLEAN LABEL OPTIONS
  const roleOptions = useMemo(
    () => [
      { value: allFilterValue, label: t("dashboard.resources.filters.all_roles") },
      ...Array.from(new Set(employees.map((e) => e.role || t("dashboard.resources.roles.staff")))).map(
        (role) => ({ value: role, label: translateRole(role) })
      ),
    ],
    [employees, t]
  );
  const zoneOptions = useMemo(
    () => [
      { value: allFilterValue, label: t("dashboard.resources.filters.all_zones") },
      ...new Set(employees.map((e) => e.zone || "-")),
    ].map((zone) =>
      typeof zone === "string" ? { value: zone, label: zone } : zone
    ),
    [employees, t]
  );
  const vehicleOptions = useMemo(
    () => [
      { value: allFilterValue, label: t("dashboard.resources.filters.all_vehicles") },
      ...new Set(employees.map((e) => e.vehicle || "-")),
    ].map((vehicle) =>
      typeof vehicle === "string" ? { value: vehicle, label: vehicle } : vehicle
    ),
    [employees, t]
  );
  const joinDateOptions = useMemo(
    () => [
      { value: allFilterValue, label: t("dashboard.resources.filters.all_join_dates") },
      ...new Set(employees.map((e) => e.joinDate || "-")),
    ].map((date) =>
      typeof date === "string" ? { value: date, label: date } : date
    ),
    [employees, t]
  );

  // RESET FILTERS
  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter(allFilterValue);
    setZoneFilter(allFilterValue);
    setVehicleFilter(allFilterValue);
    setJoinDateFilter(allFilterValue);
  };

  // FILTER LOGIC
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === allFilterValue ||
      emp.role.toLowerCase() === roleFilter.toLowerCase();

    const matchesZone =
      zoneFilter === allFilterValue || emp.zone === zoneFilter;

    const matchesVehicle =
      vehicleFilter === allFilterValue || emp.vehicle === vehicleFilter;

    const matchesJoinDate =
      joinDateFilter === allFilterValue || emp.joinDate === joinDateFilter;

    return matchesSearch && matchesRole && matchesZone && matchesVehicle && matchesJoinDate;
  });

  const roleCounts = employees.reduce(
    (acc, emp) => {
      const key = emp.role.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const workforceStats = [
    {
      label: t("dashboard.resources.stats.total_workforce"),
      value: employees.length,
      subtext: t("dashboard.resources.stats.total_workforce_subtext"),
      accent: "from-white via-sky-50 to-sky-200 dark:from-slate-900 dark:via-sky-950/40 dark:to-slate-900",
      filterValue: allFilterValue,
      border: "border-sky-200/80 dark:border-sky-500/40",
      ringColor: "ring-sky-300 dark:ring-sky-500/60",
      emphasis: true,
      colors: {
        label: "text-sky-500 dark:text-sky-200",
        value: "text-sky-600 dark:text-sky-200",
        sparkle: "text-sky-400 dark:text-sky-200",
      },
    },
    {
      label: t("dashboard.resources.stats.drivers"),
      value: roleCounts["driver"] ?? 0,
      subtext: t("dashboard.resources.stats.drivers_subtext"),
      accent: "from-white via-emerald-50 to-emerald-200 dark:from-slate-900 dark:via-emerald-950/40 dark:to-slate-900",
      filterValue: "driver",
      border: "border-emerald-200/80 dark:border-emerald-500/40",
      ringColor: "ring-emerald-300 dark:ring-emerald-500/60",
      colors: {
        label: "text-emerald-500 dark:text-emerald-200",
        value: "text-emerald-600 dark:text-emerald-200",
        sparkle: "text-emerald-400 dark:text-emerald-200",
      },
    },
    {
      label: t("dashboard.resources.stats.operators"),
      value: roleCounts["operator"] ?? 0,
      subtext: t("dashboard.resources.stats.operators_subtext"),
      accent: "from-white via-amber-50 to-amber-200 dark:from-slate-900 dark:via-amber-950/40 dark:to-slate-900",
      filterValue: "operator",
      border: "border-amber-200/80 dark:border-amber-500/40",
      ringColor: "ring-amber-300 dark:ring-amber-500/60",
      colors: {
        label: "text-amber-500 dark:text-amber-200",
        value: "text-amber-600 dark:text-amber-200",
        sparkle: "text-amber-400 dark:text-amber-200",
      },
    },
    // {
    //   label: "Helpers",
    //   value: roleCounts["helper"] ?? 0,
    //   subtext: "Support crew",
    //   accent: "from-white via-rose-50 to-rose-200 dark:from-slate-900 dark:via-rose-950/40 dark:to-slate-900",
    //   filterValue: "Helper",
    //   border: "border-rose-200/80 dark:border-rose-500/40",
    //   ringColor: "ring-rose-300 dark:ring-rose-500/60",
    //   colors: {
    //     label: "text-rose-500 dark:text-rose-200",
    //     value: "text-rose-600 dark:text-rose-200",
    //     sparkle: "text-rose-400 dark:text-rose-200",
    //   },
    // },
  ];

  const roleAccentLines: Record<string, string> = {
    driver: "from-white via-emerald-100 to-emerald-400 dark:from-emerald-900 dark:via-emerald-800 dark:to-emerald-700",
    operator: "from-white via-amber-100 to-amber-400 dark:from-amber-900 dark:via-amber-800 dark:to-amber-700",
    helper: "from-white via-rose-100 to-rose-400 dark:from-rose-900 dark:via-rose-800 dark:to-rose-700",
    default: "from-white via-slate-100 to-slate-300 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700",
  };

  const statusGlowColors: Record<string, string> = {
    active: "bg-emerald-100/70 dark:bg-emerald-900/40",
    inactive: "bg-slate-200/70 dark:bg-slate-800/40",
    "on-leave": "bg-amber-100/70 dark:bg-amber-900/40",
  };

  // BADGE COLORS
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "inactive":
        return "bg-muted text-muted-foreground border-border";
      case "on-leave":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "driver":
        return "bg-primary/10 text-primary border-primary/20";
      case "operator":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "helper":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="flex flex-col lg:h-[calc(100vh-80px)] lg:overflow-hidden pb-4 pr-2 relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white via-slate-50 to-sky-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />
      <div className="absolute inset-y-0 right-12 -z-10 w-64 blur-3xl opacity-50 bg-gradient-to-b from-sky-100 via-blue-50 to-emerald-100 dark:from-slate-800 dark:via-slate-900 dark:to-emerald-900/30 animate-pulse" />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:h-full">

        {/* LEFT PANEL — 30% */}
        <div className="lg:col-span-3 border-r border-border/30 pr-4 pl-2 flex flex-col gap-4 lg:overflow-y-auto bg-white/80 dark:bg-slate-950/70 backdrop-blur rounded-3xl shadow-lg shadow-primary/5 dark:shadow-black/30 relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-primary/5 via-transparent to-transparent dark:from-slate-900/60 opacity-70 pointer-events-none animate-pulse" />

          <div className="space-y-4 relative pt-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {t("dashboard.resources.title")}
              </h2>
              <div className="flex items-center gap-1 text-sky-500 dark:text-sky-300 mt-2 text-sm">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <p className="text-muted-foreground">
                  {t("dashboard.resources.subtitle")}
                </p>
              </div>
            </div>

            {/* SEARCH */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("dashboard.resources.search_placeholder")}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {/* ROLE FILTER */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* ZONE FILTER */}
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* VEHICLE FILTER */}
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleOptions.map((vehicle) => (
                    <SelectItem key={vehicle.value} value={vehicle.value}>
                      {vehicle.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* JOIN DATE FILTER */}
              <Select value={joinDateFilter} onValueChange={setJoinDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {joinDateOptions.map((date) => (
                    <SelectItem key={date.value} value={date.value}>
                      {date.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CLEAR BUTTON */}
            <Button
              variant="ghost"
              className="w-full border text-slate-700 dark:text-white bg-gradient-to-r from-sky-100 via-slate-100 to-blue-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 hover:from-sky-200 hover:to-blue-200 dark:hover:from-slate-700 dark:hover:to-slate-800 transition-colors"
              onClick={clearFilters}
            >
              {t("dashboard.resources.clear")}
            </Button>
          </div>
        </div>

        {/* RIGHT PANEL — 70% */}
        <div className="lg:col-span-9 lg:overflow-y-auto pl-2 flex flex-col gap-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {workforceStats.map((stat) => {
              const valueSize = stat.emphasis ? "text-4xl font-bold" : "text-3xl font-semibold";
              const accentOpacity = stat.emphasis ? "opacity-60" : "opacity-35";
              const isActive = roleFilter === (stat.filterValue ?? allFilterValue);
              const activeRing = isActive
                ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${stat.ringColor ?? ""}`
                : "";

              return (
                <button
                  type="button"
                  key={stat.label}
                  onClick={() => setRoleFilter(stat.filterValue ?? allFilterValue)}
                  className={`relative overflow-hidden rounded-2xl border ${
                    stat.border ?? "border-border/40 dark:border-border/60"
                  } bg-white/80 dark:bg-slate-950/70 backdrop-blur p-4 w-full transition-transform duration-500 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:dark:ring-offset-slate-900 ${activeRing} text-left`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${stat.accent} ${accentOpacity} animate-[pulse_6s_ease-in-out_infinite]`}
                  />
                  <div className="relative space-y-2">
                    <p className={`text-sm flex items-center gap-1 ${stat.colors.label}`}>
                      <Sparkles className={`h-3.5 w-3.5 ${stat.colors.sparkle}`} />
                      {stat.label}
                    </p>
                    <p className={`${valueSize} ${stat.colors.value}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 pb-4">

            {filteredEmployees.map((emp, cardIndex) => (
              <Card
                key={emp.id}
                className="group relative overflow-hidden border border-border/40 bg-white/90 dark:bg-slate-900/70 backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/40 shadow-md hover:shadow-2xl dark:hover:shadow-black/50"
              >
                <div className="pointer-events-none absolute inset-0 z-0">
                  <div
                    className={`card-shimmer absolute inset-y-6 -left-1/3 w-1/2 rounded-full blur-3xl ${
                      statusGlowColors[emp.status] ?? "bg-slate-200/70 dark:bg-slate-800/50"
                    } opacity-40`}
                    style={{ animationDelay: `${cardIndex * 0.2}s` }}
                  />
                </div>
                <div
                  className={`absolute inset-x-4 top-2 h-1 rounded-full bg-gradient-to-r z-10 ${
                    roleAccentLines[emp.role.toLowerCase()] ?? roleAccentLines.default
                  }`}
                />
                <CardHeader className="relative z-10">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-sky-50 dark:bg-slate-800 text-primary font-semibold">
                        {emp.name.split(" ").map((n:any) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-base">{emp.name}</CardTitle>
                      <CardDescription className="text-xs">{emp.id}</CardDescription>

                      <div className="flex flex-wrap gap-2">
                        <Badge className={getRoleColor(emp.role)} variant="outline">
                          {translateRole(emp.role)}
                        </Badge>
                        <Badge className={getStatusColor(emp.status)} variant="outline">
                          {translateStatus(emp.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 relative z-10">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{emp.phone}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("dashboard.resources.labels.zone")}</span>
                      <span className="font-medium">{emp.zone}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("dashboard.resources.labels.vehicle")}</span>
                      <span className="font-medium">{emp.vehicle}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("common.ward")}:</span>
                      <span className="font-medium">{emp.ward}</span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.resources.labels.joined")}: {emp.joinDate}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
