import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Search, MapPin, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Swal from "@/lib/notify";
import { vehicleCreationApi } from "@/helpers/admin";
import { formatIsoDate } from "@/utils/forms";
import type { VehicleCard, VehicleCreationRecord, VehicleStatus } from "./types/Vehicle/types";

const resolveStatus = (raw: any, lastMaintenance: string): VehicleStatus => {
  const isInactive =
    raw === false || raw === 0 || raw === "0" || raw === "false";
  if (isInactive) return "inactive";
  if (!lastMaintenance || lastMaintenance === "-") return "maintenance";
  return "active";
};


export default function Vehicle() {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<VehicleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [capacityFilter, setCapacityFilter] = useState("all");
  const [maintenanceFilter, setMaintenanceFilter] = useState("all");
  


  const conditionLabel = (value?: string | null) => {
    if (value === "SECOND_HAND")
      return t("admin.vehicle_creation.condition_second_hand");
    if (value === "NEW") return t("admin.vehicle_creation.condition_new");
    return value ?? t("common.not_available");
  };

  const normalizeVehicleCreations = (payload: any): VehicleCreationRecord[] => {
    const rawList: VehicleCreationRecord[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.results)
        ? payload.results
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    const seen = new Set<string>();
    return rawList.filter((item) => {
      const key = (item?.unique_id ?? item?.vehicle_no)?.toString();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const mapRecordToVehicleCard = (record: VehicleCreationRecord): VehicleCard => {
    const notAvailable = t("common.not_available");
    const registration = record.vehicle_no ?? notAvailable;
    const lastMaintenance = formatIsoDate(
      record.service_record ?? record.insurance_expiry_date,
    );
    const resolvedZone =
      record.zone_name ??
      record.zone ??
      (record.vehicle_condition ? conditionLabel(record.vehicle_condition) : null) ??
      notAvailable;
    const driver =
      record.driver_name ?? record.driver_no ?? record.driver_mobile ?? notAvailable;

    return {
      vehicleId: record.unique_id ?? registration,
      registration,
      type: record.vehicle_type_name ?? record.vehicle_type_id ?? notAvailable,
      capacity: record.capacity ?? notAvailable,
      status: resolveStatus(record.is_active, lastMaintenance),
      driver,
      zone: resolvedZone,
      lastMaintenance,
      fuelEfficiency: record.mileage_per_liter ?? notAvailable,
    };
  };

  const fetchVehicles = async () => {
    try {
      const res = await vehicleCreationApi.readAll();
      setVehicles(
        normalizeVehicleCreations(res).map((record) =>
          mapRecordToVehicleCard(record),
        ),
      );
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: t("common.fetch_failed"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);


  const statusGradients: Record<string, string> = {
    active: "from-white via-emerald-50 to-emerald-300 dark:from-slate-900 dark:via-emerald-900/30 dark:to-emerald-800",
    maintenance: "from-white via-amber-50 to-amber-200 dark:from-slate-900 dark:via-amber-900/30 dark:to-amber-800",
    inactive: "from-white via-rose-50 to-rose-200 dark:from-slate-900 dark:via-rose-900/30 dark:to-rose-800",
  };

  const statusGlowColors: Record<string, string> = {
    active: "bg-emerald-100/70 dark:bg-emerald-900/40",
    maintenance: "bg-amber-100/70 dark:bg-amber-900/40",
    inactive: "bg-rose-100/70 dark:bg-rose-900/40",
  };

  const statusLabels: Record<string, string> = {
    active: t("common.active"),
    maintenance: t("dashboard.vehicle.status.maintenance"),
    inactive: t("common.inactive"),
  };

  const translateStatus = (status: string) =>
    statusLabels[status] ?? status;

  const statusCounts = vehicles.reduce(
    (acc, vehicle) => {
      acc[vehicle.status] = (acc[vehicle.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const fleetStats = [
    {
      label: t("dashboard.vehicle.stats.total_vehicles"),
      value: vehicles.length,
      subtext: t("dashboard.vehicle.stats.total_vehicles_subtext"),
      accent: "from-white via-sky-50 to-sky-200 dark:from-slate-900 dark:via-sky-950/40 dark:to-slate-900",
      border: "border-sky-200/80 dark:border-sky-500/40",
      ringColor: "ring-sky-300 dark:ring-sky-500/60",
      filterValue: "all",
      emphasis: true,
      backgroundClass: "bg-gradient-to-b from-white via-sky-50 to-blue-50 dark:from-slate-900 dark:via-sky-950/40 dark:to-slate-950 shadow-blue-100 dark:shadow-sky-900/30",
      colors: {
        label: "text-sky-500 dark:text-sky-200",
        value: "text-sky-600 dark:text-sky-200",
        sparkle: "text-sky-400 dark:text-sky-200",
      },
    },
    {
      label: t("dashboard.vehicle.stats.ready_dispatch"),
      value: statusCounts["active"] ?? 0,
      subtext: t("dashboard.vehicle.stats.ready_dispatch_subtext"),
      accent: "from-white via-emerald-50 to-emerald-200 dark:from-slate-900 dark:via-emerald-950/40 dark:to-slate-900",
      border: "border-emerald-200/80 dark:border-emerald-500/40",
      ringColor: "ring-emerald-300 dark:ring-emerald-500/60",
      filterValue: "active",
      backgroundClass: "bg-gradient-to-b from-white via-emerald-50 to-emerald-100 dark:from-slate-900 dark:via-emerald-950/40 dark:to-slate-950 shadow-emerald-100 dark:shadow-emerald-900/30",
      colors: {
        label: "text-emerald-500 dark:text-emerald-200",
        value: "text-emerald-600 dark:text-emerald-200",
        sparkle: "text-emerald-400 dark:text-emerald-200",
      },
    },
    {
      label: t("dashboard.vehicle.stats.under_maintenance"),
      value: statusCounts["maintenance"] ?? 0,
      subtext: t("dashboard.vehicle.stats.under_maintenance_subtext"),
      accent: "from-white via-amber-50 to-yellow-100 dark:from-slate-900 dark:via-amber-950/40 dark:to-slate-900",
      border: "border-amber-200/80 dark:border-amber-500/40",
      ringColor: "ring-amber-300 dark:ring-amber-500/60",
      filterValue: "maintenance",
      backgroundClass: "bg-gradient-to-b from-white via-amber-50 to-yellow-100 dark:from-slate-900 dark:via-amber-950/40 dark:to-slate-950 shadow-amber-100 dark:shadow-amber-900/30",
      colors: {
        label: "text-amber-500 dark:text-amber-200",
        value: "text-amber-600 dark:text-amber-200",
        sparkle: "text-amber-400 dark:text-amber-200",
      },
    },
    {
      label: t("dashboard.vehicle.stats.inactive_vehicles"),
      value: statusCounts["inactive"] ?? 0,
      subtext: t("dashboard.vehicle.stats.inactive_vehicles_subtext"),
      accent: "from-white via-rose-50 to-rose-200 dark:from-slate-900 dark:via-rose-950/40 dark:to-slate-900",
      border: "border-rose-200/80 dark:border-rose-500/40",
      ringColor: "ring-rose-300 dark:ring-rose-500/60",
      filterValue: "inactive",
      backgroundClass: "bg-gradient-to-b from-white via-rose-50 to-rose-100 dark:from-slate-900 dark:via-rose-950/40 dark:to-slate-950 shadow-rose-100 dark:shadow-rose-900/30",
      colors: {
        label: "text-rose-500 dark:text-rose-200",
        value: "text-rose-600 dark:text-rose-200",
        sparkle: "text-rose-400 dark:text-rose-200",
      },
    },
  ];

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(vehicles.map((v) => v.type).filter((v) => v && v !== "-"))).sort(),
    [vehicles]
  );

  const capacityOptions = useMemo(
    () =>
      Array.from(new Set(vehicles.map((v) => v.capacity).filter((v) => v && v !== "-"))).sort(),
    [vehicles]
  );

  const maintenanceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          vehicles
            .map((v) => v.lastMaintenance)
            .filter((v) => v && v !== "-")
        )
      ).sort(),
    [vehicles]
  );



  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.registration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vehicleId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || vehicle.status === statusFilter;

    const matchesType =
      typeFilter === "all" || vehicle.type === typeFilter;

    const matchesCapacity =
      capacityFilter === "all" || vehicle.capacity === capacityFilter;

    const matchesMaintenance =
      maintenanceFilter === "all" ||
      vehicle.lastMaintenance === maintenanceFilter;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesCapacity &&
      matchesMaintenance
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "maintenance":
        return "bg-warning/10 text-warning border-warning/20";
      case "inactive":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCapacityFilter("all");
    setMaintenanceFilter("all");
  };



  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden pb-4 pr-2 relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white via-sky-50 to-blue-50" />
      <div className="absolute inset-y-0 right-12 -z-10 w-64 blur-3xl opacity-50 bg-gradient-to-b from-sky-100 via-blue-50 to-indigo-100 animate-pulse" />
      <div className="grid grid-cols-12 gap-4 h-full">

        {/* LEFT COLUMN 30% */}
        <div className="col-span-3 border-r border-border/30 pr-4 pl-2 flex flex-col gap-4 overflow-y-auto bg-white/80 backdrop-blur rounded-3xl shadow-lg shadow-primary/5 relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-sky-100/60 via-transparent to-transparent opacity-80 pointer-events-none animate-pulse" />

          <div className="ml-3 mt-4 relative">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t("dashboard.vehicle.title")}
            </h2>
            <div className="flex items-center gap-1 text-sky-500 mt-2 text-sm">
              <Sparkles className="h-4 w-4 text-sky-500 animate-pulse" />
              <p className="text-muted-foreground">
                {t("dashboard.vehicle.subtitle")}
              </p>
            </div>
          </div>

          {/* SEARCH */}

          <div className="relative ml-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("dashboard.vehicle.search_placeholder")}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>


          {/* STATUS FILTER */}
          <div className="ml-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.vehicle.filters.status_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.vehicle.filters.status_all")}</SelectItem>
                <SelectItem value="active">{translateStatus("active")}</SelectItem>
                <SelectItem value="maintenance">{translateStatus("maintenance")}</SelectItem>
                <SelectItem value="inactive">{translateStatus("inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {/* TYPE FILTER */}

          <div className="ml-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.vehicle.filters.type_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.vehicle.filters.type_all")}</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>


          </div>


          {/* CAPACITY FILTER */}

          <div className="ml-3">
            <Select value={capacityFilter} onValueChange={setCapacityFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.vehicle.filters.capacity_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.vehicle.filters.capacity_all")}</SelectItem>
                {capacityOptions.map((capacity) => (
                  <SelectItem key={capacity} value={capacity}>
                    {capacity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>


          {/* LAST MAINTENANCE FILTER */}

          <div className="ml-3">
            <Select
              value={maintenanceFilter}
              onValueChange={setMaintenanceFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.vehicle.filters.maintenance_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.vehicle.filters.maintenance_any")}</SelectItem>
                {maintenanceOptions.map((date) => (
                  <SelectItem key={date} value={date}>
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>


          <div className="ml-3 pb-6">
            <Button
              variant="ghost"
              className="w-full border text-slate-700 dark:text-white bg-gradient-to-r from-sky-100 via-slate-100 to-blue-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 hover:from-sky-200 hover:to-blue-200 dark:hover:from-slate-700 dark:hover:to-slate-800 transition-colors"
              onClick={clearFilters}
            >
              {t("dashboard.vehicle.clear")}
            </Button>

          </div>
        </div>

        {/* RIGHT COLUMN 70% */}
        <div className="col-span-9 overflow-y-auto pl-2 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
            {fleetStats.map((stat) => {
              const valueSize = stat.emphasis ? "text-4xl font-bold" : "text-3xl font-semibold";
              const accentOpacity = stat.emphasis ? "opacity-60" : "opacity-35";
              const isActive = statusFilter === (stat.filterValue ?? "all");
              const activeRing = isActive
                ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${stat.ringColor ?? ""}`
                : "";

              return (
                <button
                  type="button"
                  key={stat.label}
                  onClick={() => setStatusFilter(stat.filterValue ?? "all")}
                  className={`relative overflow-hidden rounded-2xl border ${
                    stat.border ?? "border-border/40 dark:border-border/50"
                  } bg-white/80 dark:bg-slate-950/70 backdrop-blur p-4 w-full lg:max-w-[320px] lg:mx-auto transition-transform duration-500 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:dark:ring-offset-slate-900 ${
                    stat.backgroundClass ?? ""
                  } ${activeRing} text-left`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${stat.accent} ${accentOpacity} animate-[pulse_6s_ease-in-out_infinite]`}
                  />
                  <div className="relative space-y-2 pt-2">
                    <p className={`text-sm flex items-center gap-1 ${stat.colors?.label ?? "text-muted-foreground"}`}>
                      <Sparkles className={`h-3.5 w-3.5 ${stat.colors?.sparkle ?? "text-primary"}`} />
                      {stat.label}
                    </p>
                    <p className={`${valueSize} ${stat.colors?.value ?? "text-foreground"}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {loading && !vehicles.length ? (
            <div className="text-sm text-muted-foreground">
              {t("dashboard.vehicle.loading")}
            </div>
          ) : null}

          {!loading && !filteredVehicles.length ? (
            <div className="text-sm text-muted-foreground">
              {t("dashboard.vehicle.empty")}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 pb-4">
            {filteredVehicles.map((vehicle, cardIndex) => (
              <Card
                key={vehicle.vehicleId}
                className="group relative overflow-hidden border border-border/40 bg-white/90 backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/40 shadow-md hover:shadow-2xl"
              >
                <div className="pointer-events-none absolute inset-0 z-0">
                  <div
                    className={`card-shimmer absolute inset-y-6 -left-1/3 w-1/2 rounded-full blur-3xl ${
                      statusGlowColors[vehicle.status] ?? "bg-slate-200/70 dark:bg-slate-800/50"
                    } opacity-40`}
                    style={{ animationDelay: `${cardIndex * 0.2}s` }}
                  />
                </div>
                <div
                  className={`absolute inset-x-4 top-2 h-1 rounded-full bg-gradient-to-r z-10 ${
                    statusGradients[vehicle.status] ??
                    "from-white via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700"
                  } animate-[pulse_3s_ease-in-out_infinite] opacity-60`}
                />
                <CardHeader className="relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-sky-50">
                        <Truck className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <CardTitle>{vehicle.registration}</CardTitle>
                        <CardDescription>{vehicle.type}</CardDescription>
                        <p className="text-xs text-muted-foreground">
                          {t("dashboard.vehicle.labels.id")}: {vehicle.vehicleId}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${getStatusColor(
                        vehicle.status
                      )} capitalize tracking-wide`}
                    >
                      {translateStatus(vehicle.status)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("dashboard.vehicle.labels.capacity")}</p>
                      <p className="font-medium">{vehicle.capacity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("dashboard.vehicle.labels.fuel_efficiency")}</p>
                      <p className="font-medium">{vehicle.fuelEfficiency}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-sky-500" />
                      <span className="font-medium ">{vehicle.zone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{t("dashboard.vehicle.labels.driver")}:</span>
                      <span className="font-medium">{vehicle.driver}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.vehicle.labels.last_maintenance")}: {vehicle.lastMaintenance}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 transition-colors border-sky-200 hover:bg-sky-50"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {t("dashboard.vehicle.track")}
                    </Button>
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
