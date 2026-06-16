import { useEffect, useMemo, useState } from "react";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, MapPin, Clock, Filter, BellRing, ShieldAlert, Activity } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { complaintApi, customerCreationApi, wasteCollectionApi } from "@/helpers/admin";
import { cn } from "@/lib/utils";
import { filterActiveCustomers, normalizeCustomerArray } from "@/utils/customerUtils";

type AlertSeverity = "critical" | "high" | "medium" | "low";
type SeverityFilter = "all" | AlertSeverity | "medium_low";
type AlertSource = "complaint" | "weighbridge" | "vehicle" | "collection";

type AlertItem = {
  id: string;
  source: AlertSource;
  title: string;
  message: string;
  zone?: string | null;
  occurredAt?: number | null;
  severity: AlertSeverity;
};

const REFRESH_MS = 10000;
const WEIGHBRIDGE_API_KEY = "ZIGMA-DELHI-WEIGHMENT-2025-SECURE";
const WEIGHBRIDGE_EXPECTED_KG = 500;
const VEHICLE_IDLE_MINUTES = 30;
const OVERSPEED_CRITICAL_DELTA = 15;
const MAX_MISSED_ALERTS = 25;

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseTimestamp = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return value > 1e12 ? value : value * 1000;
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && String(value).trim() !== "") {
    return numeric > 1e12 ? numeric : numeric * 1000;
  }

  const parsed = new Date(String(value));
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};

const normalizeStatus = (value: unknown) => {
  const status = String(value ?? "").toLowerCase();
  if (status.includes("close") || status.includes("resolved")) return "resolved";
  if (status.includes("progress") || status.includes("ongoing")) return "in-progress";
  return "open";
};

const normalizePriority = (value: unknown): AlertSeverity => {
  const priority = String(value ?? "").toLowerCase();
  if (priority.includes("critical")) return "critical";
  if (priority.includes("high")) return "high";
  if (priority.includes("low")) return "low";
  if (priority.includes("medium")) return "medium";
  return "medium";
};

const extractArray = (response: any) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.results)) return response.data.results;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const pickText = (row: Record<string, any>, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
};

const pickVehicleLabel = (row: Record<string, any>) =>
  pickText(
    row,
    [
      "vehicle_no",
      "vehicleNo",
      "Vehicle_No",
      "VehicleNo",
      "vehicleNumber",
      "vehicle_number",
      "Reg_No",
      "reg_no",
    ],
    "Vehicle"
  );

const pickVehicleZone = (row: Record<string, any>) =>
  pickText(
    row,
    [
      "zone",
      "Zone",
      "area",
      "Area",
      "location",
      "address",
      "geofenceName",
      "geofence",
    ],
    ""
  );

const pickVehicleTimestamp = (row: Record<string, any>) =>
  parseTimestamp(
    pickText(
      row,
      [
        "deviceTime",
        "timestamp",
        "gpsTime",
        "time",
        "serverTime",
        "_ts",
        "date",
        "dateSec",
        "lastComunicationTime",
      ],
      ""
    )
  );

const fetchComplaintAlerts = async (): Promise<AlertItem[]> => {
  try {
    const response = await complaintApi.readAll();
    const rows = extractArray(response);
    const alerts: AlertItem[] = [];

    rows.forEach((row: Record<string, any>, index: number) => {
      const status = normalizeStatus(row.status);
      if (status === "resolved") return;

      const rawId = row.unique_id ?? row.id ?? row.complaint_id ?? index;
      const id = String(rawId).trim();
      if (!id) return;

      const message = String(
        row.title ??
          row.details ??
          row.description ??
          row.main_category ??
          row.sub_category ??
          row.category ??
          "Complaint reported"
      ).trim();

      const zoneValue =
        row.zone_name ??
        row.ward_name ??
        row.zone?.name ??
        row.zone ??
        row.ward?.name ??
        row.ward ??
        null;
      const zone = zoneValue ? String(zoneValue) : null;
      const title = String(row.unique_id ?? row.complaint_id ?? row.id ?? "Complaint").trim();

      alerts.push({
        id,
        source: "complaint",
        title: title || "Complaint",
        message: message || "Complaint reported",
        zone,
        occurredAt: parseTimestamp(row.created ?? row.updated ?? row.created_at),
        severity: normalizePriority(row.priority ?? row.risk ?? row.severity),
      });
    });

    return alerts;
  } catch (error) {
    console.error("Failed to load complaint alerts:", error);
    return [];
  }
};

const fetchWeighbridgeAlerts = async (apiUrl: string, dateKey: string): Promise<AlertItem[]> => {
  if (!apiUrl) return [];
  try {
    const url = `${apiUrl}?action=day_wise_data&from_date=${dateKey}&to_date=${dateKey}&key=${WEIGHBRIDGE_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    const alerts: AlertItem[] = [];

    rows.forEach((row: Record<string, any>, index: number) => {
      const actualKg = Number(String(row.Net_Wt ?? "0").replace(/,/g, ""));
      if (!Number.isFinite(actualKg) || actualKg <= 0) return;

      const diffPct = ((actualKg - WEIGHBRIDGE_EXPECTED_KG) / WEIGHBRIDGE_EXPECTED_KG) * 100;
      const diffAbs = Math.abs(diffPct);

      let severity: AlertSeverity | null = null;
      if (diffAbs > 10) severity = "critical";
      else if (diffAbs > 5) severity = "high";
      if (!severity) return;

      const vehicle = String(row.Vehicle_No ?? row.VehicleNo ?? row.vehicle_no ?? "Vehicle");
      const diffLabel = `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(0)}%`;
      const expectedTons = (WEIGHBRIDGE_EXPECTED_KG / 1000).toFixed(1);
      const actualTons = (actualKg / 1000).toFixed(1);
      const message = `Weight mismatch ${diffLabel} (exp ${expectedTons}t, actual ${actualTons}t)`;
      const rawId = row.Ticket_No ?? row.id ?? `${vehicle}-${row.Date ?? index}`;
      const id = String(rawId).trim() || `${vehicle}-${index}`;

      const zoneValue = row.Zone ?? row.zone ?? null;
      const zone = zoneValue ? String(zoneValue) : null;

      alerts.push({
        id,
        source: "weighbridge",
        title: vehicle,
        message,
        zone,
        occurredAt: parseTimestamp(row.Date ?? row.date ?? row.timestamp),
        severity,
      });
    });

    return alerts;
  } catch (error) {
    console.error("Failed to load weighbridge alerts:", error);
    return [];
  }
};

const fetchVehicleAlerts = async (apiUrl: string): Promise<AlertItem[]> => {
  if (!apiUrl) return [];
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    const alerts: AlertItem[] = [];

    rows.forEach((row: Record<string, any>) => {
      const vehicle = pickVehicleLabel(row);
      const speed = parseNumber(row.speed) ?? 0;
      const speedLimit = parseNumber(row.overSpeedLimit) ?? 60;
      const ignition = String(row.ignitionStatus ?? "").toUpperCase();
      const idleTime = parseNumber(row.idleTime) ?? 0;
      const zone = pickVehicleZone(row) || null;
      const occurredAt = pickVehicleTimestamp(row);

      if (speedLimit > 0 && speed > speedLimit) {
        const delta = speed - speedLimit;
        const severity: AlertSeverity =
          delta >= OVERSPEED_CRITICAL_DELTA ? "critical" : "high";
        const message = `Overspeeding ${Math.round(speed)} km/h (limit ${Math.round(speedLimit)} km/h)`;
        alerts.push({
          id: `${vehicle}-overspeed`,
          source: "vehicle",
          title: vehicle,
          message,
          zone,
          occurredAt,
          severity,
        });
        return;
      }

      if (speed === 0 && ignition === "ON" && idleTime >= VEHICLE_IDLE_MINUTES) {
        const message = `Idle for ${Math.round(idleTime)} minutes`;
        alerts.push({
          id: `${vehicle}-idle`,
          source: "vehicle",
          title: vehicle,
          message,
          zone,
          occurredAt,
          severity: "medium",
        });
      }
    });

    return alerts;
  } catch (error) {
    console.error("Failed to load vehicle alerts:", error);
    return [];
  }
};

const extractCustomerId = (row: Record<string, any>, fallback: string) => {
  const raw =
    row.customer ??
    row.customer_id ??
    row.customer_unique_id ??
    row.customerId ??
    fallback;
  return String(raw ?? "").trim();
};

const extractCustomerZone = (row: Record<string, any>) => {
  const zoneValue =
    row.zone_name ??
    row.zone?.name ??
    row.zone?.zone_name ??
    row.zone ??
    row.ward_name ??
    row.ward?.ward_name ??
    row.ward ??
    null;
  return zoneValue ? String(zoneValue) : null;
};

const fetchCollectionAlerts = async (dateKey: string): Promise<AlertItem[]> => {
  try {
    const [customerResponse, collectionResponse] = await Promise.all([
      customerCreationApi.readAll(),
      wasteCollectionApi.readAll({ params: { collection_date: dateKey } }),
    ]);

    const customers = filterActiveCustomers(normalizeCustomerArray(customerResponse));
    const collectionRows = extractArray(collectionResponse);
    const collectedIds = new Set(
      collectionRows
        .map((row: Record<string, any>) =>
          extractCustomerId(row, String(row.id ?? row.unique_id ?? ""))
        )
        .filter((id: string) => Boolean(id))
    );

    const missed = customers.filter((customer) => {
      const id = String(customer.unique_id ?? customer.id ?? "").trim();
      if (!id) return false;
      return !collectedIds.has(id);
    });

    const alerts: AlertItem[] = [];
    const limited = missed.slice(0, MAX_MISSED_ALERTS);

    limited.forEach((customer, index) => {
      const id = String(customer.unique_id ?? customer.id ?? index).trim() || `missed-${index}`;
      const name =
        String(customer.customer_name ?? customer.name ?? customer.unique_id ?? "Customer").trim() ||
        "Customer";
      const zone = extractCustomerZone(customer);

      alerts.push({
        id: `missed-${id}`,
        source: "collection",
        title: name,
        message: "Missed pickup today",
        zone,
        occurredAt: parseTimestamp(dateKey),
        severity: "high",
      });
    });

    const remaining = missed.length - limited.length;
    if (remaining > 0) {
      alerts.push({
        id: "missed-summary",
        source: "collection",
        title: "Missed pickups",
        message: `+${remaining} more missed pickups`,
        zone: null,
        occurredAt: parseTimestamp(dateKey),
        severity: "medium",
      });
    }

    return alerts;
  } catch (error) {
    console.error("Failed to load collection alerts:", error);
    return [];
  }
};

export default function Alerts() {
  const { t, i18n } = useTranslation();
  const { gpsApiUrl, weighmentApiUrl } = useProjectSelector();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>("all");

  const rtf = useMemo(
    () => new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }),
    [i18n.language]
  );

  const formatTimeAgo = (timestamp?: number | null) => {
    if (timestamp === null || timestamp === undefined) {
      return t("common.not_available");
    }
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.max(Math.floor(diffMs / 1000), 0);

    if (diffSec < 60) return t("common.now");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return rtf.format(-diffHr, "hour");
    const diffDay = Math.floor(diffHr / 24);
    return rtf.format(-diffDay, "day");
  };

  useEffect(() => {
    let isMounted = true;

    const loadAlerts = async () => {
      const dateKey = formatDateKey(new Date());
      const [complaintsResult, weighbridgeResult, vehicleResult, collectionResult] =
        await Promise.allSettled([
        fetchComplaintAlerts(),
        fetchWeighbridgeAlerts(weighmentApiUrl, dateKey),
        fetchVehicleAlerts(gpsApiUrl),
        fetchCollectionAlerts(dateKey),
      ]);

      if (!isMounted) return;

      const combined = [
        ...(complaintsResult.status === "fulfilled" ? complaintsResult.value : []),
        ...(weighbridgeResult.status === "fulfilled" ? weighbridgeResult.value : []),
        ...(vehicleResult.status === "fulfilled" ? vehicleResult.value : []),
        ...(collectionResult.status === "fulfilled" ? collectionResult.value : []),
      ];

      const deduped = new Map<string, AlertItem>();
      combined.forEach((alert, index) => {
        const key = `${alert.source}-${alert.id || index}`;
        const existing = deduped.get(key);
        if (!existing || (alert.occurredAt ?? 0) > (existing.occurredAt ?? 0)) {
          deduped.set(key, alert);
        }
      });

      const severityRank: Record<AlertSeverity, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      const nextAlerts = Array.from(deduped.values()).sort((a, b) => {
        const timeDiff = (b.occurredAt ?? 0) - (a.occurredAt ?? 0);
        if (timeDiff !== 0) return timeDiff;
        return (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4);
      });

      setAlerts(nextAlerts);
      setLoading(false);
    };

    loadAlerts();
    const interval = window.setInterval(loadAlerts, REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [gpsApiUrl, weighmentApiUrl]);

  const severityCounts = useMemo(
    () =>
      alerts.reduce(
        (acc, alert) => {
          acc[alert.severity] += 1;
          return acc;
        },
        { critical: 0, high: 0, medium: 0, low: 0 }
      ),
    [alerts]
  );

  const zoneOptions = useMemo(() => {
    const zones = new Map<string, string>();
    alerts.forEach((alert) => {
      const zone = alert.zone?.trim();
      if (zone) zones.set(zone.toLowerCase(), zone);
    });
    return Array.from(zones.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const zoneMatch =
        selectedZone === "all" ||
        (alert.zone ?? "").toLowerCase() === selectedZone;
      const severityMatch =
        selectedSeverity === "all" ||
        (selectedSeverity === "medium_low"
          ? alert.severity === "medium" || alert.severity === "low"
          : alert.severity === selectedSeverity);
      return zoneMatch && severityMatch;
    });
  }, [alerts, selectedZone, selectedSeverity]);

  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const base = days.map((date) => ({
      key: formatDateKey(date),
      label: date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" }),
      total: 0,
    }));

    const bucketMap = new Map(base.map((entry) => [entry.key, entry]));
    filteredAlerts.forEach((alert) => {
      if (!alert.occurredAt) return;
      const key = formatDateKey(new Date(alert.occurredAt));
      const bucket = bucketMap.get(key);
      if (!bucket) return;
      bucket.total += 1;
    });

    return base;
  }, [filteredAlerts, i18n.language]);

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

  const summaryCards = [
    {
      label: t("dashboard.alerts.summary_total_active_alerts"),
      value: alerts.length,
      subtext: t("dashboard.alerts.summary_records_across_fleet"),
      gradient: "bg-gradient-to-br from-white via-sky-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900/40 dark:to-slate-900",
      border: "border-sky-200/80 dark:border-sky-500/40",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      iconColor: "text-sky-600 dark:text-sky-200",
      Icon: BellRing,
      filterValue: "all" as const,
    },
    {
      label: t("dashboard.alerts.summary_critical_alerts"),
      value: severityCounts["critical"] ?? 0,
      subtext: t("dashboard.alerts.summary_immediate_action"),
      gradient: "bg-gradient-to-br from-white via-rose-50 to-rose-100 dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-900",
      border: "border-rose-200/80 dark:border-rose-500/40",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      iconColor: "text-rose-600 dark:text-rose-200",
      Icon: ShieldAlert,
      filterValue: "critical" as const,
    },
    {
      label: t("dashboard.alerts.summary_high_priority"),
      value: severityCounts["high"] ?? 0,
      subtext: t("dashboard.alerts.summary_needs_review"),
      gradient: "bg-gradient-to-br from-white via-amber-50 to-amber-100 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-900",
      border: "border-amber-200/80 dark:border-amber-500/40",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      iconColor: "text-amber-600 dark:text-amber-200",
      Icon: Activity,
      filterValue: "high" as const,
    },
    {
      label: t("dashboard.alerts.summary_medium_low"),
      value: (severityCounts["medium"] ?? 0) + (severityCounts["low"] ?? 0),
      subtext: t("dashboard.alerts.summary_monitoring"),
      gradient: "bg-gradient-to-br from-white via-emerald-50 to-emerald-100 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-900",
      border: "border-emerald-200/80 dark:border-emerald-500/40",
      iconBg: "bg-white/70 dark:bg-slate-900/60",
      iconColor: "text-emerald-600 dark:text-emerald-200",
      Icon: AlertTriangle,
      filterValue: "medium_low" as const,
    },
  ];

  const severityTokens: Record<
    AlertSeverity,
    {
      badge: string;
      chip: string;
      ring: string;
      icon: string;
      glow: string;
    }
  > = {
    critical: {
      badge: "border-rose-300 text-rose-600 dark:border-rose-500/50 dark:text-rose-200",
      chip: "bg-white/85 dark:bg-slate-900/60 border border-rose-100/70 dark:border-rose-500/30",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-rose-200/70 dark:ring-rose-500/40",
      icon: "text-rose-600 dark:text-rose-200",
      glow: "from-rose-300/30 via-transparent to-transparent dark:from-rose-600/20",
    },
    high: {
      badge: "border-amber-300 text-amber-600 dark:border-amber-500/50 dark:text-amber-200",
      chip: "bg-white/85 dark:bg-slate-900/60 border border-amber-100/70 dark:border-amber-500/30",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-amber-200/70 dark:ring-amber-500/40",
      icon: "text-amber-600 dark:text-amber-200",
      glow: "from-amber-300/30 via-transparent to-transparent dark:from-amber-500/20",
    },
    medium: {
      badge: "border-sky-300 text-sky-600 dark:border-sky-500/50 dark:text-sky-200",
      chip: "bg-white/85 dark:bg-slate-900/60 border border-sky-100/70 dark:border-sky-500/30",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-sky-200/70 dark:ring-sky-500/40",
      icon: "text-sky-600 dark:text-sky-200",
      glow: "from-sky-300/30 via-transparent to-transparent dark:from-sky-500/20",
    },
    low: {
      badge: "border-emerald-300 text-emerald-600 dark:border-emerald-500/50 dark:text-emerald-200",
      chip: "bg-white/85 dark:bg-slate-900/60 border border-emerald-100/70 dark:border-emerald-500/30",
      ring: "ring-1 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 ring-emerald-200/70 dark:ring-emerald-500/40",
      icon: "text-emerald-600 dark:text-emerald-200",
      glow: "from-emerald-300/30 via-transparent to-transparent dark:from-emerald-500/20",
    },
  };

  return (
    <div className={pageBgClass}>
      <ProjectSelectorBar />
      <div className="space-y-6 h-[calc(100vh-80px)] overflow-y-auto pr-2 pb-10">
        <div className={heroPanelClass}>
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              {t("dashboard.alerts.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("dashboard.alerts.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="w-[190px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t("dashboard.alerts.filter_by_zone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.alerts.all_zones")}</SelectItem>
                {zoneOptions.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedSeverity}
              onValueChange={(value) => setSelectedSeverity(value as SeverityFilter)}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder={t("dashboard.alerts.filter_by_severity")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.alerts.all_severities")}</SelectItem>
                <SelectItem value="critical">{t("dashboard.alerts.severity_critical")}</SelectItem>
                <SelectItem value="high">{t("dashboard.alerts.severity_high")}</SelectItem>
                <SelectItem value="medium">{t("dashboard.alerts.severity_medium")}</SelectItem>
                <SelectItem value="low">{t("dashboard.alerts.severity_low")}</SelectItem>
                <SelectItem value="medium_low">{t("dashboard.alerts.summary_medium_low")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.Icon;
            return (
              <Card
                key={card.label}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedSeverity(card.filterValue);
                  setSelectedZone("all");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedSeverity(card.filterValue);
                    setSelectedZone("all");
                  }
                }}
                className={cn(
                  surfaceCardClass,
                  card.gradient,
                  card.border,
                  "text-slate-900 dark:text-slate-100 hover:-translate-y-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500/60"
                )}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="card-shimmer absolute -right-10 top-10 h-24 w-24 rounded-full bg-white/40 dark:bg-white/5 blur-3xl" />
                </div>
                <CardContent className="relative pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                      <p className="text-4xl font-bold mt-1">{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.subtext}</p>
                    </div>
                    <div className={cn("p-3 rounded-xl shadow-inner", card.iconBg)}>
                      <Icon className={cn("h-6 w-6", card.iconColor)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle>{t("dashboard.alerts.trend_title")}</CardTitle>
            <CardDescription>{t("dashboard.alerts.trend_subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 18, left: -10, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDarkMode ? "#1f2937" : "#e2e8f0"}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: isDarkMode ? "#94a3b8" : "#64748b" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: isDarkMode ? "#94a3b8" : "#64748b" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
                      border: isDarkMode ? "1px solid #1e293b" : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: isDarkMode ? "#e2e8f0" : "#0f172a" }}
                    itemStyle={{ color: isDarkMode ? "#38bdf8" : "#2563eb" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={isDarkMode ? "#38bdf8" : "#2563eb"}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={surfaceCardClass}>
          <CardHeader>
            <CardTitle>{t("dashboard.alerts.active_alerts_title")}</CardTitle>
            <CardDescription>{t("dashboard.alerts.active_alerts_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading && alerts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : null}
              {!loading && filteredAlerts.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t("dashboard.home.alerts_none")}
                </div>
              ) : null}
              {filteredAlerts.map((alert, index) => {
                const severity = severityTokens[alert.severity];
                const zoneLabel = alert.zone || t("common.not_available");
                return (
                  <div
                    key={`${alert.source}-${alert.id}`}
                    className={cn(
                      "relative border rounded-2xl p-4 flex items-start gap-4 transition-all duration-500 hover:-translate-y-1",
                      "bg-white/90 dark:bg-slate-950/60 backdrop-blur",
                      severity.ring
                    )}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r opacity-40 blur-xl",
                        severity.glow
                      )}
                    />
                    <div className={cn("relative p-3 rounded-xl shadow-inner", severity.chip)}>
                      <AlertTriangle className={cn("h-5 w-5", severity.icon)} />
                    </div>
                    <div className="relative flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{alert.title}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs font-semibold", severity.badge)}
                        >
                          {t(`dashboard.alerts.severity_${alert.severity}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{alert.message}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {zoneLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(alert.occurredAt)}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="relative">
                      {t("dashboard.alerts.review")}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
