import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navigation, Search, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { fetchWasteReport } from "@/utils/wasteApi";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";

type RawRecord = Record<string, unknown>;
type StatusKey = "running" | "idle" | "stopped" | "no_data";
type StatusFilterKey = StatusKey | "all";

type StatusSurface = { bg: string; border: string };
type StatusBadge = { bg: string; color: string };

const STATUS_META: Record<
  StatusFilterKey,
  {
    labelKey: string;
    accent: string;
    textLight: string;
    textDark: string;
    surfaceLight: StatusSurface;
    surfaceDark: StatusSurface;
    badgeLight: StatusBadge;
    badgeDark: StatusBadge;
  }
> = {
  all: {
    labelKey: "dashboard.live_map.status_all",
    accent: "#6366f1",
    textLight: "#312e81",
    textDark: "#c7d2fe",
    surfaceLight: { bg: "#eef2ff", border: "#c7d2fe" },
    surfaceDark: { bg: "rgba(99,102,241,0.16)", border: "rgba(129,140,248,0.45)" },
    badgeLight: { bg: "#6366f1", color: "#ffffff" },
    badgeDark: { bg: "rgba(79,70,229,0.75)", color: "#e0e7ff" },
  },
  running: {
    labelKey: "dashboard.live_map.status_running",
    accent: "#16a34a",
    textLight: "#14532d",
    textDark: "#4ade80",
    surfaceLight: { bg: "#e6f5ec", border: "#a3e0b9" },
    surfaceDark: { bg: "rgba(34,197,94,0.28)", border: "rgba(74,222,128,0.7)" },
    badgeLight: { bg: "#16a34a", color: "#ffffff" },
    badgeDark: { bg: "#22c55e", color: "#052e16" },
  },
  idle: {
    labelKey: "dashboard.live_map.status_idle",
    accent: "#f59e0b",
    textLight: "#92400e",
    textDark: "#fde68a",
    surfaceLight: { bg: "#fff8e1", border: "#fcd34d" },
    surfaceDark: { bg: "rgba(245,158,11,0.14)", border: "rgba(251,191,36,0.45)" },
    badgeLight: { bg: "#facc15", color: "#1f2937" },
    badgeDark: { bg: "#b45309", color: "#fff7ed" },
  },
  stopped: {
    labelKey: "dashboard.live_map.status_stopped",
    accent: "#ef4444",
    textLight: "#991b1b",
    textDark: "#fecaca",
    surfaceLight: { bg: "#ffe5e5", border: "#fca5a5" },
    surfaceDark: { bg: "rgba(239,68,68,0.15)", border: "rgba(248,113,113,0.45)" },
    badgeLight: { bg: "#ef4444", color: "#ffffff" },
    badgeDark: { bg: "#b91c1c", color: "#fee2e2" },
  },
  no_data: {
    labelKey: "dashboard.live_map.status_no_data",
    accent: "#9ca3af",
    textLight: "#374151",
    textDark: "#d1d5db",
    surfaceLight: { bg: "#f3f4f6", border: "#d1d5db" },
    surfaceDark: { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.35)" },
    badgeLight: { bg: "#9ca3af", color: "#1f2937" },
    badgeDark: { bg: "#4b5563", color: "#e5e7eb" },
  },
};

const STATUS_FILTERS: { key: StatusFilterKey; labelKey: string }[] = [
  { key: "all", labelKey: "dashboard.live_map.filters.all" },
  { key: "running", labelKey: "dashboard.live_map.filters.running" },
  { key: "idle", labelKey: "dashboard.live_map.filters.idle" },
  { key: "stopped", labelKey: "dashboard.live_map.filters.stopped" },
];

const VEHICLE_ICON_EMOJI = "🚚";

const vehicleMarkerAnimations = `
  @keyframes vehiclePulse {
    0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
    100% { transform: translate(-50%, -50%) scale(1.35); opacity: 0; }
  }
  @keyframes vehicleBounce {
    0% { transform: scale(0.9); }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); }
  }
`;

function createVehicleIcon(status: StatusKey, isFocused: boolean) {
  const meta = STATUS_META[status];
  const size = isFocused ? 40 : 32;
  const border = isFocused ? 3 : 2;
  const shadow = isFocused ? "0 8px 18px rgba(0,0,0,.35)" : "0 4px 12px rgba(0,0,0,.3)";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${meta.accent};
          display:flex;
          align-items:center;
          justify-content:center;
          color:#fff;
          font-size:${isFocused ? 20 : 16}px;
          box-shadow:${shadow};
          border:${border}px solid #fff;
          position:relative;
          ${isFocused ? "animation: vehicleBounce 0.6s ease-out;" : ""}
        "
      >
        ${
          isFocused
            ? `<span style="
                position:absolute;
                top:50%;
                left:50%;
                width:${Math.round(size * 1.15)}px;
                height:${Math.round(size * 1.15)}px;
                border-radius:50%;
                background:${meta.accent};
                opacity:0.35;
                transform:translate(-50%, -50%);
                animation: vehiclePulse 1.4s ease-out infinite;
              "></span>`
            : ""
        }
        <span style="line-height:1;">${VEHICLE_ICON_EMOJI}</span>
      </div>
    `,
  });
}

const TRIP_SUMMARY_ENDPOINT =
  "https://gpsvtsprobend.vamosys.com/v2/getTripSummary";

const TRIP_SUMMARY_USER_ID = "NMCP2DISPOSAL";

const IST_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
});

const HISTORY_TIMESTAMP_KEYS = [
  "deviceTime",
  "timestamp",
  "gpsTime",
  "time",
  "serverTime",
  "_ts",
  "date",
  "dateSec",
  "lastComunicationTime",
];

function pick(source: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function pickNum(source: RawRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null || value === "") continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

const parseNumeric = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const cleaned =
    typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
};

const normalizeVehicleId = (value?: string) =>
  value ? value.replace(/[^a-z0-9]/gi, "").toUpperCase() : "";

const PLATE_PATTERN = /[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{3,4}/g;

const extractPlateId = (value?: string) => {
  const normalized = normalizeVehicleId(value);
  if (!normalized) return "";
  const match = normalized.match(PLATE_PATTERN);
  if (match && match[0]) return match[0];
  return normalized;
};

const idsMatch = (left?: string, right?: string) => {
  const normalizedLeft = extractPlateId(left);
  const normalizedRight = extractPlateId(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  const [shorter, longer] =
    normalizedLeft.length <= normalizedRight.length
      ? [normalizedLeft, normalizedRight]
      : [normalizedRight, normalizedLeft];
  if (shorter.length < 5) return false;
  const diff = longer.length - shorter.length;
  if (diff > 3) return false;
  return longer.startsWith(shorter) || longer.endsWith(shorter);
};

const pickVehicleId = (row: RawRecord) =>
  pick(
    row,
    [
      "Vehicle No",
      "Vehicle_No",
      "VehicleNo",
      "vehicle no",
      "vehicleno",
      "vehicle_no",
      "vehicleNo",
      "vehicle_number",
      "vehicleNumber",
      "Reg_No",
      "reg_no",
      "registrationNo",
      "regNo",
    ],
    ""
  );

const parseWeightParts = (row: RawRecord) => {
  const dry =
    parseNumeric(row.Dry_Wt ?? row.dry_weight ?? row.dryWeight ?? row.dry_wt) ??
    0;
  const wet =
    parseNumeric(row.Wet_Wt ?? row.wet_weight ?? row.wetWeight ?? row.wet_wt) ??
    0;
  const mix =
    parseNumeric(row.Mix_Wt ?? row.mix_weight ?? row.mixWeight ?? row.mix_wt) ??
    0;
  const net =
    parseNumeric(
      row.Net_Wt ??
        row.net_wt ??
        row.netWeight ??
        row.total_net_weight ??
        row.totalNetWeight ??
        row.total_weight ??
        row.weight
    ) ?? dry + wet + mix;

  return { dry, wet, mix, net };
};

const parseTripTimestamp = (v?: number | string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const REPORT_DATE_KEYS = [
  "date",
  "Date",
  "collection_date",
  "collectionDate",
  "collection_date_time",
  "collection_datetime",
  "collection_time",
  "timestamp",
  "Start_Time",
  "start_time",
  "startTime",
  "End_Time",
  "end_time",
  "endTime",
];

const getRowDateKey = (row: RawRecord) => {
  const rawDate = pick(row, REPORT_DATE_KEYS, "");
  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
  const dmyMatch = rawDate.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  const ymdSlashMatch = rawDate.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (ymdSlashMatch) return `${ymdSlashMatch[1]}-${ymdSlashMatch[2]}-${ymdSlashMatch[3]}`;
  if (!rawDate) return "";
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return IST_DAY_KEY.format(parsed);
};

function pickRaw(source: RawRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (!source?.hasOwnProperty(key)) continue;
    const value = source[key];
    if (value === undefined || value === null || value === "") continue;
    return value;
  }
  return undefined;
}

function parseVamosysTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    let seconds = value;
    if (seconds > 1e12) seconds = seconds / 1000;
    return new Date(Math.round(seconds * 1000));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      let seconds = numeric;
      if (seconds > 1e12) seconds = seconds / 1000;
      return new Date(Math.round(seconds * 1000));
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return null;
}

function mapStatusKey(value: string): StatusKey {
  const raw = value.toLowerCase();
  if (raw.includes("run") || raw.includes("on")) return "running";
  if (raw.includes("idle")) return "idle";
  if (raw.includes("park") || raw.includes("stop") || raw.includes("complete") || raw.includes("off")) return "stopped";
  return "no_data";
}

function deriveVehicleStatus(record: RawRecord, speed: number): StatusKey {
  if (speed > 2) return "running";
  const ignition = pick(record, ["ignitionStatus", "vehicleMode"], "").toLowerCase();
  if (ignition.includes("on")) {
    return "idle";
  }
  if (ignition.includes("off")) {
    return "stopped";
  }
  return mapStatusKey(pick(record, ["status", "vehicleStatus", "mode"], ""));
}

type LiveVehicle = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  status: StatusKey;
  speed: number;
  lastUpdate: string;
  driver?: string;
  location?: string;
};

type VehicleMetrics = {
  loading: boolean;
  totalWeightTodayTons: number | null;
  totalDistanceTodayKm: number | null;
  totalDistanceMonthKm: number | null;
  totalTripsToday: number | null;
  dryWeightTodayTons: number | null;
  wetWeightTodayTons: number | null;
  mixWeightTodayTons: number | null;
  reportDateKey: string | null;
};

function normalizeVehicle(record: RawRecord): LiveVehicle | null {
  const id = pick(record, ["vehicleNo", "regNo", "vehicle_number", "vehicleId", "vehicle_id"]);
  const lat = pickNum(record, ["lat", "latitude", "Latitude"]);
  const lng = pickNum(record, ["lng", "lon", "longitude", "Longitude"]);
  if (!id || lat === null || lng === null) return null;
  const timestampValue = pickRaw(record, HISTORY_TIMESTAMP_KEYS);
  const timestamp = parseVamosysTimestamp(timestampValue) ?? new Date();
  const speed = pickNum(record, ["speedKmph", "speed", "speedKMH", "speedKmH", "speedMs"]) ?? 0;
  const driver = pick(record, ["driverName", "driver_name", "driver", "staffName", "staff"], "");
  const location = pick(record, ["location", "address", "lastLocation", "last_location"], "");
  return {
    id,
    label: id,
    lat,
    lng,
    status: deriveVehicleStatus(record, speed),
    speed: Math.max(0, speed),
    lastUpdate: timestamp.toISOString(),
    driver: driver || undefined,
    location: location || undefined,
  };
}

export default function MapView() {
  const { theme, palette } = useTheme();
  const { t, i18n } = useTranslation();
  const { gpsApiUrl, weighmentApiUrl } = useProjectSelector();
  const isDarkMode = theme === "dark";
  const preferredVehicleId = "UP16KT1737";
  const [vehicleId, setVehicleId] = useState(preferredVehicleId);
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [focusedVehicleId, setFocusedVehicleId] = useState<string>(preferredVehicleId);
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [liveError, setLiveError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date());
  const [panelOpen, setPanelOpen] = useState(false);
  const metricsRequestRef = useRef(0);
  const [metrics, setMetrics] = useState<VehicleMetrics>({
    loading: false,
    totalWeightTodayTons: null,
    totalDistanceTodayKm: null,
    totalDistanceMonthKm: null,
    totalTripsToday: null,
    dryWeightTodayTons: null,
    wetWeightTodayTons: null,
    mixWeightTodayTons: null,
    reportDateKey: null,
  });

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const statusCounts = useMemo(() => {
    const base: Record<StatusKey, number> = { running: 0, idle: 0, stopped: 0, no_data: 0 };
    liveVehicles.forEach((vehicle) => {
      base[vehicle.status] += 1;
    });
    return base;
  }, [liveVehicles]);

  const filteredVehicles = useMemo<LiveVehicle[]>(() => {
    const filteredByStatus = liveVehicles.filter((vehicle) => statusFilter === "all" || vehicle.status === statusFilter);
    const term = searchTerm.trim().toLowerCase();
    if (!term) return filteredByStatus;
    return filteredByStatus.filter((vehicle) => vehicle.label.toLowerCase().includes(term));
  }, [liveVehicles, statusFilter, searchTerm]);

  const displayVehicles = filteredVehicles.slice(0, 12);

  const searchDropdownVehicles = liveVehicles.slice(0, 12).filter((vehicle) =>
    vehicle.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
  const locale = i18n.language || "en-US";
  const formatStatusLabel = useCallback(
    (status: StatusFilterKey) =>
      t(STATUS_META[status]?.labelKey ?? "dashboard.live_map.status_unknown"),
    [t],
  );
  const speedUnit = t("dashboard.live_map.units.kmh");

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current?.contains(event.target as Node) ||
        searchDropdownRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return;
    if (!document.getElementById("vehicle-marker-animations")) {
      const style = document.createElement("style");
      style.id = "vehicle-marker-animations";
      style.textContent = vehicleMarkerAnimations;
      document.head.appendChild(style);
    }
    if (!liveVehicles.length) return;
    const initialVehicle =
      liveVehicles.find((vehicle) => vehicle.id === preferredVehicleId) ?? liveVehicles[0];
    const map = L.map(mapDivRef.current, {
      center: [initialVehicle.lat, initialVehicle.lng],
      zoom: 11,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    });
    tiles.addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 0);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [liveVehicles, preferredVehicleId]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!filteredVehicles.length) return;
    const bounds: LatLngTuple[] = [];
    filteredVehicles.forEach((vehicle) => {
      const position: LatLngTuple = [vehicle.lat, vehicle.lng];
      bounds.push(position);
      const statusMeta = STATUS_META[vehicle.status];
      const isFocused = vehicle.id === focusedVehicleId;
      const marker = L.marker(position, {
        icon: createVehicleIcon(vehicle.status, isFocused),
        title: vehicle.label,
      });
      marker
        .bindPopup(
          `<strong>${vehicle.label}</strong><br/>${t(
            "dashboard.live_map.popup_status",
          )}: ${formatStatusLabel(vehicle.status)}<br/>${t(
            "dashboard.live_map.popup_speed",
          )}: ${vehicle.speed.toFixed(1)} ${speedUnit}`,
        )
        .addTo(layer);
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.on("click", () => handleVehicleClick(vehicle.id));
    });
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [filteredVehicles, focusedVehicleId, formatStatusLabel, speedUnit, t]);

  useEffect(() => {
    if (!mapRef.current) return;
    const target = liveVehicles.find((vehicle) => vehicle.id === focusedVehicleId);
    if (!target) return;
    mapRef.current.setView([target.lat, target.lng], mapRef.current.getZoom(), { animate: true });
  }, [focusedVehicleId, liveVehicles]);

  useEffect(() => {
    if (!mapRef.current) return;
    const zoomControl = mapRef.current.getContainer().querySelector(".leaflet-control-zoom") as HTMLElement | null;
    if (!zoomControl) return;
    zoomControl.style.pointerEvents = isDropdownOpen ? "none" : "";
    zoomControl.style.opacity = isDropdownOpen ? "0.45" : "1";
    zoomControl.style.visibility = isDropdownOpen ? "hidden" : "visible";
  }, [isDropdownOpen]);

  useEffect(() => {
    let isMounted = true;
    const fetchLive = async () => {
      setLoadingLive(true);
      try {
        if (!gpsApiUrl) { setLoadingLive(false); return; }
        const response = await fetch(gpsApiUrl);
        if (!response.ok) {
          throw new Error(`Live data error (${response.status})`);
        }
        const body = await response.json();
        const payload = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
          ? body.data
          : [];
        const normalized = payload
          .map((record: RawRecord) => normalizeVehicle(record))
          .filter(
            (vehicle: LiveVehicle | null | undefined): vehicle is LiveVehicle => Boolean(vehicle),
          ) as LiveVehicle[];
        if (!isMounted) return;
        if (normalized.length) {
          let limited = normalized.slice(0, 20);
          const preferred = normalized.find((vehicle) => vehicle.id === preferredVehicleId);
          if (preferred && !limited.some((vehicle) => vehicle.id === preferredVehicleId)) {
            limited = [preferred, ...limited.slice(0, 19)];
          }
          setLiveVehicles(limited);
          if (preferred && limited.some((vehicle) => vehicle.id === preferredVehicleId)) {
            setVehicleId(preferredVehicleId);
            setFocusedVehicleId(preferredVehicleId);
          } else {
            setFocusedVehicleId((prev) =>
              limited.some((vehicle) => vehicle.id === prev) ? prev : limited[0]?.id ?? prev,
            );
            setVehicleId((prev) =>
              limited.some((vehicle) => vehicle.id === prev) ? prev : limited[0]?.id ?? prev,
            );
          }
          setLiveError("");
          setLastUpdatedAt(new Date());
        } else {
          setLiveError("dashboard.live_map.error_no_vehicles");
        }
      } catch (err) {
        console.error("Live vehicle fetch failed:", err);
        if (!isMounted) return;
        setLiveError("dashboard.live_map.error_load_failed");
      } finally {
        if (isMounted) {
          setLoadingLive(false);
        }
      }
    };
    fetchLive();
    const intervalId = window.setInterval(fetchLive, 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [gpsApiUrl]);

  useEffect(() => {
    if (!filteredVehicles.length) return;
    const hasSelected = filteredVehicles.some((vehicle) => vehicle.id === vehicleId);
    if (!hasSelected) {
      const fallbackId = filteredVehicles[0]?.id;
      if (fallbackId) {
        setVehicleId(fallbackId);
        setFocusedVehicleId(fallbackId);
      }
    }
  }, [filteredVehicles, vehicleId]);

  const handleVehicleClick = (id: string) => {
    setVehicleId(id);
    if (liveVehicles.some((vehicle) => vehicle.id === id)) {
      setFocusedVehicleId(id);
    }
    setPanelOpen(true);
  };

  const lastUpdatedLabel = lastUpdatedAt.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const selectedVehicle = liveVehicles.find((vehicle) => vehicle.id === vehicleId);

  useEffect(() => {
    if (!selectedVehicle) {
      setMetrics({
        loading: false,
        totalWeightTodayTons: null,
        totalDistanceTodayKm: null,
        totalDistanceMonthKm: null,
        totalTripsToday: null,
        dryWeightTodayTons: null,
        wetWeightTodayTons: null,
        mixWeightTodayTons: null,
        reportDateKey: null,
      });
      return;
    }

    const requestId = ++metricsRequestRef.current;
    const currentVehicleId = selectedVehicle.id;
    let cancelled = false;

    const loadMetrics = async () => {
      setMetrics((prev) => ({ ...prev, loading: true }));
      try {
        const now = new Date();
        const todayKey = IST_DAY_KEY.format(now);
        const reportStart = new Date(now);
        reportStart.setDate(reportStart.getDate() - 90);
        const reportStartKey = IST_DAY_KEY.format(reportStart);
        const monthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        ).getTime();
        const monthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        ).getTime();

        const tripUrl = `${TRIP_SUMMARY_ENDPOINT}?vehicleId=${encodeURIComponent(
          currentVehicleId
        )}&fromDateUTC=${monthStart}&toDateUTC=${monthEnd}&userId=${TRIP_SUMMARY_USER_ID}&duration=0`;

        const [tripRes, weightResult] = await Promise.all([
          fetch(tripUrl).then((res) => res.json()),
          fetchWasteReport(weighmentApiUrl, "day_wise_data", reportStartKey, todayKey).catch(
            () => ({ rows: [] }),
          ),
        ]);

        if (cancelled || requestId !== metricsRequestRef.current) return;

        const history: Array<Record<string, any>> =
          tripRes?.data?.historyConsilated || [];

        let totalMonth = 0;
        let totalToday = 0;
        for (const entry of history) {
          const ts = parseTripTimestamp(entry.startTime ?? entry.endTime);
          if (!ts) continue;
          const distance = Number(entry.tripDistance || 0);
          if (Number.isNaN(distance)) continue;
          totalMonth += distance;
          if (IST_DAY_KEY.format(ts) === todayKey) {
            totalToday += distance;
          }
        }

        const targetVehicle = normalizeVehicleId(currentVehicleId);
        const dailyAgg: Record<
          string,
          { trips: number; dry: number; wet: number; mix: number; net: number }
        > = {};
        let matchedAny = false;

        weightResult.rows.forEach((row: RawRecord) => {
          const rowVehicle = pickVehicleId(row);
          if (!idsMatch(targetVehicle, rowVehicle)) return;
          const rowDateKey = getRowDateKey(row);
          if (!rowDateKey) return;
          matchedAny = true;
          const weights = parseWeightParts(row);
          const tripCount =
            parseNumeric(
              row.total_trip ?? row.totalTrip ?? row.trips ?? row.trip
            ) ?? 1;
          const existing =
            dailyAgg[rowDateKey] ?? { trips: 0, dry: 0, wet: 0, mix: 0, net: 0 };
          dailyAgg[rowDateKey] = {
            trips: existing.trips + tripCount,
            dry: existing.dry + weights.dry,
            wet: existing.wet + weights.wet,
            mix: existing.mix + weights.mix,
            net: existing.net + weights.net,
          };
        });

        let reportDateKey: string | null = null;
        let selectedAgg:
          | { trips: number; dry: number; wet: number; mix: number; net: number }
          | null = null;

        if (matchedAny) {
          if (dailyAgg[todayKey]) {
            reportDateKey = todayKey;
            selectedAgg = dailyAgg[todayKey];
          } else {
            const latestDateKey = Object.keys(dailyAgg).sort().slice(-1)[0];
            if (latestDateKey) {
              reportDateKey = latestDateKey;
              selectedAgg = dailyAgg[latestDateKey];
            }
          }
        }

        setMetrics({
          loading: false,
          totalWeightTodayTons: selectedAgg ? selectedAgg.net / 1000 : null,
          totalDistanceTodayKm: totalToday,
          totalDistanceMonthKm: totalMonth,
          totalTripsToday: selectedAgg ? selectedAgg.trips : null,
          dryWeightTodayTons: selectedAgg ? selectedAgg.dry / 1000 : null,
          wetWeightTodayTons: selectedAgg ? selectedAgg.wet / 1000 : null,
          mixWeightTodayTons: selectedAgg ? selectedAgg.mix / 1000 : null,
          reportDateKey,
        });
      } catch (error) {
        if (cancelled || requestId !== metricsRequestRef.current) return;
        setMetrics((prev) => ({ ...prev, loading: false }));
      }
    };

    loadMetrics();
    const interval = window.setInterval(loadMetrics, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedVehicle?.id]);

  if (!gpsApiUrl) {
    return (
      <div className="space-y-3">
        <ProjectSelectorBar />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">GPS API not configured for this project.</p>
          <p className="text-sm mt-1">Set a GPS API URL in the project settings to enable the live map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ProjectSelectorBar />
      <div>
        <h2 className="text-3xl font-bold text-sky-500">
          {t("dashboard.live_map.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("dashboard.live_map.subtitle")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 -mt-2">
        <div className="lg:col-span-2">
          <Card
            className="h-[760px] overflow-visible"
            style={{
              background: isDarkMode ? "#0f172a" : undefined,
              borderColor: isDarkMode ? "rgba(148,163,184,0.2)" : undefined,
              boxShadow: isDarkMode ? "0 25px 45px rgba(2,6,23,0.85)" : undefined,
            }}
          >
            <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              {/* <div>
                <CardTitle>Fleet Location Map</CardTitle>
                <CardDescription>GPS-tracked vehicles with current status</CardDescription>
              </div> */}
              <div className="relative ml-auto flex w-full max-w-xs lg:w-auto">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded border border-border bg-background px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm outline-none"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                >
                  <span className="flex items-center gap-2 text-[13px]">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{searchTerm || t("dashboard.live_map.all_vehicles")}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
                {isDropdownOpen && (
                  <div
                    ref={searchDropdownRef}
                    className="absolute left-0 top-full z-[1000] mt-2 w-[240px] rounded-lg border border-border bg-card text-card-foreground text-[13px] shadow-xl dark:shadow-slate-900/50"
                  >
                    <div className="border-b border-border px-3 py-2 text-xs uppercase text-muted-foreground tracking-wide">
                      {t("dashboard.live_map.search_title")}
                    </div>
                    <div className="px-3 py-2">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder={t("dashboard.live_map.search_placeholder")}
                        className="w-full rounded border border-border/70 px-2 py-1 text-xs outline-none focus:border-primary"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          className="mt-2 w-full rounded border border-border/70 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition hover:text-foreground"
                          onClick={() => setSearchTerm("")}
                        >
                          {t("dashboard.live_map.search_clear")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-none border-t border-border px-3 py-2 text-left text-foreground transition hover:bg-primary/10"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSearchTerm("");
                          setIsDropdownOpen(false);
                        }}
                      >
                        <span>{t("dashboard.live_map.all_vehicles")}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {t("dashboard.live_map.showing_count", {
                            count: liveVehicles.length,
                          })}
                        </span>
                      </button>
                      {searchDropdownVehicles.length ? (
                        searchDropdownVehicles.map((vehicle) => (
                          <button
                            key={vehicle.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-none border-t border-border px-3 py-2 text-left text-foreground transition hover:bg-primary/10"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setSearchTerm(vehicle.label);
                              setIsDropdownOpen(false);
                              handleVehicleClick(vehicle.id);
                            }}
                          >
                            <span>{vehicle.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatStatusLabel(vehicle.status)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-muted-foreground">
                          {t("dashboard.live_map.no_matching")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-[640px] bg-gradient-to-br from-secondary to-muted rounded-lg border-2 border-dashed border-border overflow-hidden">
                <div ref={mapDivRef} className="absolute inset-0" />
                <VehicleSidePanel
                  vehicle={selectedVehicle}
                  open={panelOpen}
                  onToggle={() => setPanelOpen((prev) => !prev)}
                  onClose={() => setPanelOpen(false)}
                  isDarkMode={isDarkMode}
                  metrics={metrics}
                />
                <div className="absolute left-3 bottom-3 rounded-md bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow">
                  <div>
                    {t("dashboard.live_map.live_vehicles", {
                      count: liveVehicles.length,
                    })}
                  </div>
                  <div>
                    {t("dashboard.live_map.updated", { time: lastUpdatedLabel })}
                  </div>
                </div>
                {loadingLive && (
                  <div className="absolute right-3 top-3 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {t("dashboard.live_map.refreshing")}
                  </div>
                )}
                {liveError && (
                  <div className="absolute left-3 top-3 rounded-md bg-error/90 px-2 py-1 text-[11px] font-medium text-white">
                    {t(liveError)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            style={{
              background: isDarkMode ? "#0f172a" : undefined,
              borderColor: isDarkMode ? "rgba(148,163,184,0.15)" : undefined,
              boxShadow: isDarkMode ? "0 25px 45px rgba(2,6,23,0.75)" : undefined,
            }}
          >
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <CardTitle className="text-lg font-semibold">
                {t("dashboard.live_map.vehicle_status_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STATUS_FILTERS.map((filter) => {
                    const isActive = statusFilter === filter.key;
                    const count = filter.key === "all" ? liveVehicles.length : statusCounts[filter.key];
                    const meta = filter.key === "all" ? STATUS_META.all : STATUS_META[filter.key];
                    const surface = isDarkMode ? meta.surfaceDark : meta.surfaceLight;
                    const labelColor = isDarkMode ? meta.textDark : meta.textLight;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setStatusFilter(filter.key)}
                        className={`flex flex-col items-center justify-center rounded-xl border px-3 py-3 text-center text-[11px] font-semibold tracking-wide transition shadow-sm hover:shadow ${
                          isActive ? "ring-1 ring-primary" : ""
                        }`}
                        style={{
                          background: surface.bg,
                          borderColor: surface.border,
                        }}
                      >
                        <span
                          className="text-[16px]"
                          style={{ color: isDarkMode ? "#f8fafc" : "#0f172a" }}
                        >
                          {count}
                        </span>
                        <span className="text-[11px]" style={{ color: labelColor }}>
                          {t(filter.labelKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            style={{
              background: isDarkMode ? "#0f172a" : undefined,
              borderColor: isDarkMode ? "rgba(148,163,184,0.15)" : undefined,
              boxShadow: isDarkMode ? "0 25px 45px rgba(2,6,23,0.75)" : undefined,
            }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                {t("dashboard.live_map.active_vehicles_title")}
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-3 max-h-[495px] overflow-y-auto pr-1">
              {displayVehicles.map((vehicle) => {
                const statusMeta = STATUS_META[vehicle.status];
                const isSelected = vehicle.id === vehicleId;
                const surface = isDarkMode ? statusMeta.surfaceDark : statusMeta.surfaceLight;
                const badge = isDarkMode ? statusMeta.badgeDark : statusMeta.badgeLight;
                return (
                  <div
                    key={vehicle.id}
                    className="p-3 rounded-xl border hover:shadow-md transition-all cursor-pointer"
                    style={{
                      background: surface.bg,
                      borderColor: isSelected ? palette.primary : surface.border,
                      boxShadow: isSelected ? palette.cardShadow : undefined,
                    }}
                    onClick={() => handleVehicleClick(vehicle.id)}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-sm">{vehicle.label}</span>
                      <span
                        className="rounded-full px-3 py-1 text-[11px] font-medium"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {formatStatusLabel(vehicle.status)}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t("dashboard.live_map.labels.speed")}:</span>
                        <span>
                          {vehicle.speed.toFixed(1)} {speedUnit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t("dashboard.live_map.labels.coords")}:</span>
                        <span>
                          {vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{t("dashboard.live_map.labels.updated")}:</span>
                        <span>{new Date(vehicle.lastUpdate).toLocaleTimeString(locale)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VehicleSidePanel({
  vehicle,
  open,
  onToggle,
  onClose,
  isDarkMode,
  metrics,
}: {
  vehicle?: LiveVehicle;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  metrics: VehicleMetrics;
}) {
  const { t, i18n } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(true);
  const meta = vehicle ? STATUS_META[vehicle.status] : null;
  const surface = meta ? (isDarkMode ? meta.surfaceDark : meta.surfaceLight) : null;
  const WIDTH = 280;
  const locationLabel = vehicle?.location?.trim()
    ? vehicle.location
    : t("dashboard.live_map.location_unavailable");
  const driverLabel = vehicle?.driver?.trim()
    ? vehicle.driver
    : t("dashboard.live_map.placeholder_dash");
  const lastUpdatedLabel = vehicle
    ? new Date(vehicle.lastUpdate).toLocaleString(i18n.language || "en-US")
    : t("dashboard.live_map.placeholder_na");
  const placeholderDash = t("dashboard.live_map.placeholder_dash");
  const loadingLabel = t("common.loading");
  const weightUnitLabel = t("common.tons");
  const tripsTodayLabel = t("dashboard.live_map.info.trips_today");
  const dryWeightLabel = t("dashboard.live_map.info.dry_weight_today");
  const wetWeightLabel = t("dashboard.live_map.info.wet_weight_today");
  const mixWeightLabel = t("dashboard.live_map.info.mix_weight_today");
  const reportDateLabel = t("dashboard.live_map.info.report_date");

  const formatMetricValue = (value: number | null, unit: string) => {
    if (value === null) return placeholderDash;
    return `${value.toFixed(2)} ${unit}`;
  };

  const formatTripValue = (value: number | null) => {
    if (value === null) return placeholderDash;
    return Math.round(value).toLocaleString();
  };

  const renderMetricValue = (value: number | null, unit: string) => {
    if (metrics.loading && value === null) return loadingLabel;
    return formatMetricValue(value, unit);
  };

  const renderTripValue = (value: number | null) => {
    if (metrics.loading && value === null) return loadingLabel;
    return formatTripValue(value);
  };

  return (
    <div
      className={`absolute left-0 top-0 z-[700] h-full shadow-xl transition-transform duration-300 ${
        isDarkMode ? "bg-slate-950/95 text-slate-100" : "bg-white text-slate-900"
      }`}
      style={{
        width: WIDTH,
        transform: open ? "translateX(0)" : `translateX(-${WIDTH}px)`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`absolute -right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-bold shadow ${
          isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        {open ? "❮" : "❯"}
      </button>

      <button
        type="button"
        onClick={onClose}
        className={`absolute right-2 top-2 rounded-full border px-2 py-1 text-xs font-bold shadow ${
          isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        ✕
      </button>

      <div className="h-full overflow-y-auto border-l border-border/60">
        {vehicle ? (
          <>
            <div className="flex items-start justify-between border-b border-border px-3 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dashboard.live_map.labels.vehicle")}
                </div>
                <div className="text-base font-semibold">{vehicle.label}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 pt-3">
              <div
                className="flex h-[72px] w-[72px] items-center justify-center rounded-xl border text-2xl"
                style={{
                  background: surface?.bg ?? (isDarkMode ? "rgba(148,163,184,0.12)" : "#f1f5f9"),
                  borderColor: surface?.border ?? "transparent",
                }}
              >
                🚚
              </div>
              <div className="text-xs leading-relaxed">
                <div className="font-semibold">{t("dashboard.live_map.live_vehicle")}</div>
                <div className="text-muted-foreground">{locationLabel}</div>
              </div>
            </div>

            <div className="space-y-3 px-3 pt-3 text-xs">
                <div className="space-y-1">
                  <div>
                    <span className="font-semibold">{t("dashboard.live_map.labels.status")}:</span>{" "}
                    <span className="text-muted-foreground">
                      {meta ? t(meta.labelKey) : t("dashboard.live_map.status_unknown")}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">{t("dashboard.live_map.labels.driver")}:</span>{" "}
                    <span className="text-muted-foreground">{driverLabel}</span>
                  </div>
                  <div>
                    <span className="font-semibold">{t("dashboard.live_map.labels.speed")}:</span>{" "}
                    <span className="text-muted-foreground">
                      {vehicle.speed.toFixed(1)} {t("dashboard.live_map.units.kmh")}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">{t("dashboard.live_map.labels.coordinates")}:</span>{" "}
                    <span className="text-muted-foreground">
                      {vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}
                    </span>
                  </div>
                <div>
                  <span className="font-semibold">{t("dashboard.live_map.labels.location")}:</span>{" "}
                  <span className="text-muted-foreground">{locationLabel}</span>
                </div>
                <div>
                  <span className="font-semibold">{t("dashboard.live_map.labels.last_updated")}:</span>{" "}
                  <span className="text-muted-foreground">{lastUpdatedLabel}</span>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => setInfoOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-xs font-semibold"
                >
                  <span>{t("dashboard.live_map.vehicle_information")}</span>
                  <span className="text-base">{infoOpen ? "−" : "+"}</span>
                </button>
                {infoOpen && (
                  <div className="mt-2 space-y-1 rounded-md border border-border/60 bg-background/60 p-2">
                    <InfoRow
                      label={reportDateLabel}
                      value={metrics.reportDateKey ?? placeholderDash}
                    />
                    <InfoRow
                      label={tripsTodayLabel}
                      value={renderTripValue(metrics.totalTripsToday)}
                    />
                    <InfoRow
                      label={dryWeightLabel}
                      value={renderMetricValue(metrics.dryWeightTodayTons, weightUnitLabel)}
                    />
                    <InfoRow
                      label={wetWeightLabel}
                      value={renderMetricValue(metrics.wetWeightTodayTons, weightUnitLabel)}
                    />
                    <InfoRow
                      label={mixWeightLabel}
                      value={renderMetricValue(metrics.mixWeightTodayTons, weightUnitLabel)}
                    />
                    <InfoRow
                      label={t("dashboard.live_map.info.total_weight_today")}
                      value={renderMetricValue(metrics.totalWeightTodayTons, weightUnitLabel)}
                    />
                    <InfoRow
                      label={t("dashboard.live_map.info.total_distance_today")}
                      value={renderMetricValue(metrics.totalDistanceTodayKm, "km")}
                    />
                    <InfoRow
                      label={t("dashboard.live_map.info.total_distance_month")}
                      value={renderMetricValue(metrics.totalDistanceMonthKm, "km")}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="p-3 text-xs text-muted-foreground">
            {t("dashboard.live_map.select_vehicle")}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between border-b border-border/60 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">
        {value ?? t("dashboard.live_map.placeholder_na")}
      </span>
    </div>
  );
}
