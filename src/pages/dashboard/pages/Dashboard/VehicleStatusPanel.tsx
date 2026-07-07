import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataCard } from "@/components/ui/DataCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  MapPin,
  Truck,
  Gauge,
  PauseCircle,
  Square,
  HelpCircle,
} from "lucide-react";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";

interface VehicleStats {
  all: number;
  running: number;
  idle: number;
  stopped: number;
  overspeeding: number;
  
}

export function VehicleStatusPanel() {
  const { t } = useTranslation();
  const { gpsApiUrl } = useProjectSelector();
  const { encDashboardLiveMap, encDashboardVehicleManagement } = getEncryptedRoute();
  const liveMapPath = `/dashboard/${encDashboardLiveMap}`;
  const vehiclePath = `/dashboard/${encDashboardVehicleManagement}`;
  const [stats, setStats] = useState<VehicleStats>({
    all: 0,
    running: 0,
    idle: 0,
    stopped: 0,
    overspeeding: 0,
  });

  // ----------- FETCH FUNCTION -----------
  async function loadData() {
    if (!gpsApiUrl) return;
    try {
      const res = await fetch(gpsApiUrl);
      const data = await res.json();
      console.log(data);

      let running = 0;
      let idle = 0;
      let stopped = 0;
      let overspeeding = 0;

      data.forEach((v: any) => {
        const speed = Number(v.speed || 0);
        const ignition = v.ignitionStatus?.toUpperCase() || "";
        const position = v.position || "";
        const movingTime = Number(v.movingTime || 0);
        const idleTime = Number(v.idleTime || 0);
        const speedLimit = Number(v.overSpeedLimit || 60);

        // Running condition
        if (speed > 0 || position === "M" || movingTime > 0) {
          running++;
          return;
        }

        // Idle condition
        if (speed === 0 && ignition === "ON" && idleTime > 0) {
          idle++;
          return;
        }

        // Stopped condition
        if (speed === 0 && ignition === "OFF") {
          stopped++;
          return;
        }

        // Overspeed
        if (speed > speedLimit) overspeeding++;
      });

      setStats({
        all: data.length,
        running,
        idle,
        stopped,
        overspeeding,
      });
    } catch (err) {
      console.error("Vehicle API fetch failed:", err);
    }
  }

  // Re-fetch whenever the selected project (and thus gpsApiUrl) changes
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsApiUrl]);

  const totalVehicles = Math.max(stats.all, 0);
  const knownTotal = stats.running + stats.idle + stats.stopped;
  const unknownCount = Math.max(totalVehicles - knownTotal, 0);
  const getPercent = (value: number) =>
    totalVehicles ? (value / totalVehicles) * 100 : 0;

  const baseSegments = [
    {
      key: "running",
      label: t("dashboard.home.vehicle_status_running"),
      value: stats.running,
      icon: Gauge,
      color: "#22c55e",
      text: "text-green-700 dark:text-green-400",
      dot: "bg-green-500",
      bar: "bg-gradient-to-r from-green-400 to-emerald-500",
    },
    {
      key: "idle",
      label: t("dashboard.home.vehicle_status_idle"),
      value: stats.idle,
      icon: PauseCircle,
      color: "#f59e0b",
      text: "text-yellow-700 dark:text-yellow-400",
      dot: "bg-yellow-500",
      bar: "bg-gradient-to-r from-yellow-400 to-amber-500",
    },
    {
      key: "stopped",
      label: t("dashboard.home.vehicle_status_stopped"),
      value: stats.stopped,
      icon: Square,
      color: "#ef4444",
      text: "text-red-700 dark:text-red-400",
      dot: "bg-red-500",
      bar: "bg-gradient-to-r from-red-400 to-rose-500",
    },
  ];

  const segments = unknownCount
    ? [
        ...baseSegments,
        {
          key: "unknown",
          label: t("common.unknown"),
          value: unknownCount,
          icon: HelpCircle,
          color: "#94a3b8",
          text: "text-slate-600 dark:text-slate-300",
          dot: "bg-slate-400",
          bar: "bg-gradient-to-r from-slate-300 to-slate-400",
        },
      ]
    : baseSegments;

  const segmentsWithPercent = segments.map((segment) => ({
    ...segment,
    percent: getPercent(segment.value),
    displayPercent: Math.round(getPercent(segment.value)),
  }));

  let startOffset = 0;
  const conicStops = segmentsWithPercent.map((segment) => {
    const endOffset = startOffset + segment.percent;
    const stop = `${segment.color} ${startOffset}% ${endOffset}%`;
    startOffset = endOffset;
    return stop;
  });

  const hasSegmentValue = segmentsWithPercent.some((segment) => segment.value > 0);
  const conicGradient = totalVehicles && hasSegmentValue
    ? `conic-gradient(${conicStops.join(", ")})`
    : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <DataCard
      title={t("dashboard.home.vehicle_status_title")}
      compact
      accent="brand-accent"
      icon={<Truck className="w-3.5 h-3.5 text-(--admin-accent)" />}
      className="h-56 lg:h-[280px]"
      action={
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            Live
          </span>
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t("common.view_all")}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={liveMapPath} className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {t("dashboard.home.vehicle_status_live_map")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={vehiclePath} className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                {t("dashboard.home.vehicle_status_vehicle")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-28 w-28">
              <div
                className="absolute inset-0 rounded-full shadow-sm"
                style={{ background: conicGradient }}
              />
              <div className="absolute inset-2.5 rounded-full border border-gray-200 bg-white dark:border-gray-500 dark:bg-gray-700/60" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.all}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {t("dashboard.home.vehicle_status_all")}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {t("common.status")}
            </span>
          </div>

          <div className="flex-1 space-y-2">
            {segmentsWithPercent.map((segment) => (
              <div
                key={segment.key}
                className="rounded-lg border border-gray-200 bg-white/80 p-2 shadow-sm dark:border-gray-500 dark:bg-gray-700/30"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${segment.dot}`} />
                    <segment.icon className={`h-3.5 w-3.5 ${segment.text}`} />
                    <span className={`font-semibold ${segment.text}`}>
                      {segment.label}
                    </span>
                  </div>
                  <span className={`font-semibold ${segment.text}`}>
                    {segment.value}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-600/60">
                  <div
                    className={`h-2 rounded-full ${segment.bar}`}
                    style={{ width: `${segment.percent}%` }}
                    title={`${segment.displayPercent}%`}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">{segment.displayPercent}%</span>
                  <span>
                    {totalVehicles ? `${segment.value}/${totalVehicles}` : "0/0"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DataCard>
  );
}
