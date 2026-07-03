import { DataCard } from "@/components/ui/DataCard";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { complaintTicketApi, customerCreationApi, wasteCollectionApi } from "@/helpers/admin";
import { filterActiveCustomers, normalizeCustomerArray } from "@/utils/customerUtils";
import { getEncryptedRoute } from "@/utils/routeCache";

export function RecentActivityTimeline() {
  const { t, i18n } = useTranslation();
  const {
    encDashboardWeighBridge,
    encDashboardWasteCollection,
    encDashboardLiveMap,
    encDashboardGrievances,
  } = getEncryptedRoute();
  const routeMap: Record<string, string> = {
    warning: `/dashboard/${encDashboardWeighBridge}`,
    critical: `/dashboard/${encDashboardWeighBridge}`,
    collected: `/dashboard/${encDashboardWasteCollection}`,
    missed: `/dashboard/${encDashboardWasteCollection}`,
    running: `/dashboard/${encDashboardLiveMap}`,
    parking: `/dashboard/${encDashboardLiveMap}`,
    complaint_high: `/dashboard/${encDashboardGrievances}`,
    complaint_medium: `/dashboard/${encDashboardGrievances}`,
  };
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [stats, setStats] = useState({
    warning: 0,
    critical: 0,
    collected: 0,
    missed: 0,
    running: 0,
    parking: 0,
  });
  const [complaints, setComplaints] = useState({
    high: 0,
    medium: 0,
    low: 0,
  });

  const { gpsApiUrl, weighmentApiUrl } = useProjectSelector();
  const WEIGHBRIDGE_API_KEY = "ZIGMA-DELHI-WEIGHMENT-2025-SECURE";
  const REFRESH_MS = 10000;

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchVehicleStats = async () => {
    if (!gpsApiUrl) return { running: 0, parking: 0 };
    const res = await fetch(gpsApiUrl);
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];

    let running = 0;
    let idle = 0;
    let stopped = 0;

    rows.forEach((v: any) => {
      const speed = Number(v.speed || 0);
      const ignition = v.ignitionStatus?.toUpperCase() || "";
      const position = v.position || "";
      const movingTime = Number(v.movingTime || 0);
      const idleTime = Number(v.idleTime || 0);

      if (speed > 0 || position === "M" || movingTime > 0) {
        running++;
        return;
      }

      if (speed === 0 && ignition === "ON" && idleTime > 0) {
        idle++;
        return;
      }

      if (speed === 0 && ignition === "OFF") {
        stopped++;
      }
    });

    return { running, parking: idle + stopped };
  };

  const fetchCollectionStats = async () => {
    const customerResponse = await customerCreationApi.readAll();
    const normalized = normalizeCustomerArray(customerResponse);
    const activeCustomers = filterActiveCustomers(normalized);
    const total = activeCustomers.length;

    const today = formatDate(new Date());
    let collectedIds: string[] = [];
    try {
      const collectionResponse = await wasteCollectionApi.readAll({
        params: { collection_date: today },
      });
      const rows = Array.isArray(collectionResponse)
        ? collectionResponse
        : Array.isArray((collectionResponse as any)?.data)
        ? (collectionResponse as any).data
        : [];
      if (rows.length) {
        collectedIds = Array.from(
          new Set(
            rows
              .map((entry: any) =>
                String(
                  entry.customer ??
                    entry.customer_id ??
                    entry.customer_unique_id ??
                    ""
                )
              )
              .filter((id: string) => id.trim())
          )
        );
      }
    } catch (error) {
      console.error("Failed to fetch waste collection summary:", error);
    }

    const collected = collectedIds.length;
    const missed = Math.max(total - collected, 0);
    return { collected, missed };
  };

  const fetchWeighbridgeStats = async () => {
    if (!weighmentApiUrl) return { warning: 0, critical: 0 };
    const today = formatDate(new Date());
    const url = `${weighmentApiUrl}?action=day_wise_data&from_date=${today}&to_date=${today}&key=${WEIGHBRIDGE_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    const EXPECTED = 500;

    let warning = 0;
    let critical = 0;

    rows.forEach((row: any) => {
      const actualKg = Number(String(row.Net_Wt ?? "0").replace(/,/g, ""));
      const diffPct = ((actualKg - EXPECTED) / EXPECTED) * 100;
      const diffAbs = Math.abs(diffPct);

      if (diffAbs > 10) {
        critical++;
      } else if (diffAbs > 5) {
        warning++;
      }
    });

    return { warning, critical };
  };

  const normalizeStatus = (raw: unknown) => {
    const value = String(raw ?? "").toLowerCase();
    if (value.includes("close") || value.includes("resolved")) return "Resolved";
    if (value.includes("progress") || value.includes("ongoing")) return "In Progress";
    return "Open";
  };

  const normalizePriority = (raw: unknown) => {
    const value = String(raw ?? "").toLowerCase();
    if (value.includes("high") || value.includes("critical")) return "High";
    if (value.includes("low")) return "Low";
    return "Medium";
  };

  const fetchComplaintStats = async () => {
    const response = await complaintTicketApi.readAll();
    const rows = Array.isArray(response)
      ? response
      : Array.isArray((response as any)?.data)
      ? (response as any).data
      : Array.isArray((response as any)?.data?.results)
      ? (response as any).data.results
      : [];
    const deduped = new Map<string, { status: string; priority: string }>();

    rows.forEach((row: Record<string, any>, index: number) => {
      const id = String(
        row.unique_id ?? row.id ?? row.complaint_id ?? index
      ).trim();
      if (!id) return;
      const status = normalizeStatus(row.status);
      const priority = normalizePriority(
        row.priority ?? row.risk ?? row.severity
      );
      deduped.set(id, { status, priority });
    });

    let high = 0;
    let medium = 0;
    let low = 0;

    deduped.forEach((item) => {
      if (item.status === "Resolved") return;
      if (item.priority === "High") high += 1;
      else if (item.priority === "Medium") medium += 1;
      else low += 1;
    });

    return { high, medium, low };
  };


  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      const [vehicleResult, collectionResult, weighbridgeResult, complaintResult] =
        await Promise.allSettled([
          fetchVehicleStats(),
          fetchCollectionStats(),
          fetchWeighbridgeStats(),
          fetchComplaintStats(),
        ]);

      if (!isMounted) return;

      setStats((prev) => ({
        ...prev,
        ...(vehicleResult.status === "fulfilled" ? vehicleResult.value : {}),
        ...(collectionResult.status === "fulfilled" ? collectionResult.value : {}),
        ...(weighbridgeResult.status === "fulfilled" ? weighbridgeResult.value : {}),
      }));
      if (complaintResult.status === "fulfilled") {
        setComplaints(complaintResult.value);
      }
      setLastUpdated(Date.now());
      setLoading(false);
    };

    loadStats();
    const interval = window.setInterval(loadStats, REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [gpsApiUrl, weighmentApiUrl]);


  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  const formatTimeAgo = (timestamp?: number | null) => {
    if (!timestamp) return "-";
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.max(Math.floor(diffMs / 1000), 0);
    const formatWithUnit = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
      rtf.format(-value, unit);

    if (diffSec < 60) return t("common.now");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return formatWithUnit(diffMin, "minute");
    const diffHr = Math.floor(diffMin / 60);
    return formatWithUnit(diffHr, "hour");
  };

  const items = useMemo(() => {
    const base = [
      {
        key: "warning",
        label: t("dashboard.home.alert_warning"),
        value: stats.warning,
        priority: "Medium",
      },
      {
        key: "critical",
        label: t("dashboard.home.alert_critical"),
        value: stats.critical,
        priority: "High",
      },
      {
        key: "collected",
        label: t("dashboard.home.alert_collected"),
        value: stats.collected,
        priority: "Low",
      },
      {
        key: "missed",
        label: t("dashboard.home.alert_missed"),
        value: stats.missed,
        priority: "High",
      },
      {
        key: "running",
        label: t("dashboard.home.alert_running"),
        value: stats.running,
        priority: "Low",
      },
      {
        key: "parking",
        label: t("dashboard.home.alert_parking"),
        value: stats.parking,
        priority: "Medium",
      },
      {
        key: "complaint_high",
        label: t("dashboard.home.alert_complaints_high"),
        value: complaints.high,
        priority: "High",
      },
      {
        key: "complaint_medium",
        label: t("dashboard.home.alert_complaints_medium"),
        value: complaints.medium,
        priority: "Medium",
      },
    ];
    const priorityRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return base.slice().sort((a, b) => {
      const rankDiff =
        (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3);
      if (rankDiff !== 0) return rankDiff;
      return (b.value ?? 0) - (a.value ?? 0);
    });
  }, [complaints.high, complaints.medium, stats, t]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => item.priority !== "Low" && (item.value ?? 0) > 0
      ),
    [items]
  );
  const shouldScroll = visibleItems.length > 3;
  const maxValue = useMemo(() => {
    const values = visibleItems.map((item) => item.value ?? 0);
    return Math.max(1, ...values);
  }, [visibleItems]);

  const priorityStyles: Record<"High" | "Medium" | "Low", string> = {
    High: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-200",
    Medium:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200",
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-200",
  };
  const barStyles: Record<"High" | "Medium" | "Low", string> = {
    High: "bg-gradient-to-r from-rose-400 to-rose-500",
    Medium: "bg-gradient-to-r from-amber-400 to-amber-500",
    Low: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  };

  const getPriorityMeta = (priority: "High" | "Medium" | "Low") => {
    switch (priority) {
      case "High":
        return {
          icon: <AlertTriangle className="w-3 h-3 text-rose-500" />,
          ring: "bg-rose-50 dark:bg-rose-900/30",
        };
      case "Medium":
        return {
          icon: <Info className="w-3 h-3 text-amber-500" />,
          ring: "bg-amber-50 dark:bg-amber-900/30",
        };
      default:
        return {
          icon: <CheckCircle className="w-3 h-3 text-emerald-500" />,
          ring: "bg-emerald-50 dark:bg-emerald-900/30",
        };
    }
  };

  return (
    <DataCard title={t("dashboard.home.activity_title")} compact accent="brand-secondary" icon={<AlertTriangle className="w-3.5 h-3.5 text-(--brand-secondary)" />}>
      {loading && !items.some((item) => item.value > 0) ? (
        <div className="py-2 text-xs text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : null}
      <div
        className={`mt-3 space-y-2 pr-1 ${
          shouldScroll ? "max-h-40 overflow-y-auto" : ""
        }`}
      >
        {!loading && visibleItems.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            {t("dashboard.home.alerts_none")}
          </div>
        ) : null}
        {visibleItems.map((item, idx) => {
          const meta = getPriorityMeta(item.priority as "High" | "Medium");
          const linkTarget = routeMap[item.key] ?? "/dashboard";
          return (
            <Link
              key={item.key}
              to={linkTarget}
              className="flex gap-2 rounded-md transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <div className="flex flex-col items-center">
                <div className={`p-1 rounded-full ${meta.ring}`}>{meta.icon}</div>
                {idx < visibleItems.length - 1 && (
                  <div className="w-px h-full bg-gray-200 dark:bg-gray-700 my-1" />
                )}
              </div>
              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">
                    {item.label}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      priorityStyles[item.priority as "High" | "Medium"]
                    }`}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {item.value} • {formatTimeAgo(lastUpdated)}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-1.5 rounded-full ${barStyles[item.priority as "High" | "Medium"]}`}
                    style={{ width: `${Math.min(100, (item.value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </DataCard>
  );
}
