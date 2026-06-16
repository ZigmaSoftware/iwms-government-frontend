import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { fetchWasteReport } from "@/utils/wasteApi";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";

/* ================= API ================= */
const GEOFENCE_API_URL =
  "https://api.vamosys.com/v2/viewSiteV2?userId=BLUEPLANET";

const TRIP_SUMMARY_ENDPOINT =
  "https://gpsvtsprobend.vamosys.com/v2/getTripSummary";

const TRIP_SUMMARY_USER_ID = "NMCP2DISPOSAL";

/* ================= TYPES ================= */
type VehicleStatus = "Running" | "Idle" | "Parked" | "No Data";

export interface VehicleData {
  vehicle_no: string;
  lat: number;
  lng: number;
  speed: number;
  status: VehicleStatus;
  driver: string;
  updated_at: string;
  location?: string;
}

interface GeofenceSite {
  siteName: string;
  latlong: string[];
  type: "Polygon" | "Circle";
}

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

/* ================= CONSTANTS ================= */
const STATUS_COLORS: Record<VehicleStatus, string> = {
  Running: "#22c55e",
  Idle: "#facc15",
  Parked: "#3b82f6",
  "No Data": "#ef4444",
};

const STATUS_LABEL_KEYS: Record<VehicleStatus, string> = {
  Running: "dashboard.live_map.status_running",
  Idle: "dashboard.live_map.status_idle",
  Parked: "dashboard.live_map.status_parked",
  "No Data": "dashboard.live_map.status_no_data",
};

const IST_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
});

/* ================= HELPERS ================= */
function parseLatLng(latlong: string[]): LatLngTuple[] {
  return latlong
    .map((p) => {
      const [lat, lng] = p.split(",").map(Number);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return [lat, lng] as LatLngTuple;
    })
    .filter(Boolean) as LatLngTuple[];
}

type RawRecord = Record<string, any>;

function pickString(
  source: RawRecord,
  keys: string[],
  fallback = ""
): string {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function pickNumber(source: RawRecord, keys: string[]): number | null {
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
  pickString(
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
    parseNumeric(row.Dry_Wt ?? row.dry_weight ?? row.dryWeight ?? row.dry_wt) ?? 0;
  const wet =
    parseNumeric(row.Wet_Wt ?? row.wet_weight ?? row.wetWeight ?? row.wet_wt) ?? 0;
  const mix =
    parseNumeric(row.Mix_Wt ?? row.mix_weight ?? row.mixWeight ?? row.mix_wt) ?? 0;
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
  const rawDate = pickString(row, REPORT_DATE_KEYS, "");
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

const VEHICLE_COLLECTION_KEYS = [
  "data",
  "vehicles",
  "vehicleData",
  "vehicleList",
  "vehicleDetails",
];

function extractVehicleRows(payload: any): RawRecord[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    for (const key of VEHICLE_COLLECTION_KEYS) {
      const candidate = payload[key];
      if (Array.isArray(candidate)) return candidate;
    }

    for (const key of VEHICLE_COLLECTION_KEYS) {
      const nestedParent = payload[key];
      if (!nestedParent || typeof nestedParent !== "object") continue;
      for (const nestedKey of VEHICLE_COLLECTION_KEYS) {
        const nested = nestedParent[nestedKey];
        if (Array.isArray(nested)) return nested;
      }
    }
  }

  return [];
}

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

/* ================= VEHICLE ICON ================= */
function getVehicleIcon(status: VehicleStatus, isFocused = false) {
  const color = STATUS_COLORS[status];
  const size = isFocused ? 42 : 34;
  const shadow = isFocused
    ? "0 0 0 4px rgba(255,255,255,0.9), 0 8px 18px rgba(0,0,0,.35)"
    : "0 4px 10px rgba(0,0,0,.35)";

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -18],
    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${color};
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:${shadow};
          border:2px solid #fff;
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
                background:${color};
                opacity:0.35;
                animation: vehiclePulse 1.4s ease-out infinite;
              "></span>`
            : ""
        }
        <span style="font-size:18px; line-height:1;">🚚</span>
      </div>
    `,
  });
}

interface LeafletMapContainerProps {
  vehicles?: VehicleData[];
  height?: string;
}

/* ================= COMPONENT ================= */
export function LeafletMapContainer({
  vehicles: overrideVehicles,
  height = "600px",
}: LeafletMapContainerProps = {}) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { gpsApiUrl, weighmentApiUrl } = useProjectSelector();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const metricsRequestRef = useRef(0);

  const [fetchedVehicles, setFetchedVehicles] = useState<VehicleData[]>([]);
  const [geofenceSites, setGeofenceSites] = useState<GeofenceSite[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
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
  const isDarkMode = theme === "dark";
  const speedUnit = t("dashboard.live_map.units.kmh");
  const placeholderDash = t("dashboard.live_map.placeholder_dash");
  const labelVehicle = t("dashboard.live_map.labels.vehicle");
  const labelStatus = t("dashboard.live_map.labels.status");
  const labelDriver = t("dashboard.live_map.labels.driver");
  const labelSpeed = t("dashboard.live_map.labels.speed");
  const labelCoordinates = t("dashboard.live_map.labels.coordinates");
  const labelLocation = t("dashboard.live_map.labels.location");
  const labelLastUpdated = t("dashboard.live_map.labels.last_updated");
  const liveVehicleLabel = t("dashboard.live_map.live_vehicle");
  const vehicleInformationLabel = t("dashboard.live_map.vehicle_information");
  const locationUnavailable = t("dashboard.live_map.location_unavailable");
  const labelWeightToday = t("dashboard.live_map.info.total_weight_today");
  const labelTripsToday = t("dashboard.live_map.info.trips_today");
  const labelDryToday = t("dashboard.live_map.info.dry_weight_today");
  const labelWetToday = t("dashboard.live_map.info.wet_weight_today");
  const labelMixToday = t("dashboard.live_map.info.mix_weight_today");
  const labelDistanceToday = t("dashboard.live_map.info.total_distance_today");
  const labelDistanceMonth = t("dashboard.live_map.info.total_distance_month");
  const labelReportDate = t("dashboard.live_map.info.report_date");
  const closeVehicleDetailsLabel = t("dashboard.live_map.aria.close_vehicle_details");
  const collapseVehicleDetailsLabel = t("dashboard.live_map.aria.collapse_vehicle_details");
  const expandVehicleDetailsLabel = t("dashboard.live_map.aria.expand_vehicle_details");
  const loadingLabel = t("common.loading");
  const weightUnitLabel = t("common.tons");

  const formatStatusLabel = useCallback(
    (status: VehicleStatus) => t(STATUS_LABEL_KEYS[status]),
    [t],
  );

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || "en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [i18n.language],
  );

  const formatUpdatedAt = useCallback(
    (value?: string) => {
      if (!value) return placeholderDash;
      const trimmed = String(value).trim();
      const numeric = Number(trimmed);
      let parsed: Date | null = null;

      if (!Number.isNaN(numeric)) {
        const ms = numeric < 1e12 ? numeric * 1000 : numeric;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) {
          parsed = d;
        }
      }

      if (!parsed) {
        const d = new Date(trimmed);
        if (!Number.isNaN(d.getTime())) {
          parsed = d;
        }
      }

      return parsed ? dateTimeFormatter.format(parsed) : trimmed;
    },
    [dateTimeFormatter, placeholderDash],
  );

  const formatDistanceValue = useCallback(
    (value: number | null) =>
      value === null ? placeholderDash : `${value.toFixed(2)} km`,
    [placeholderDash],
  );

  const formatWeightValue = useCallback(
    (value: number | null) =>
      value === null
        ? placeholderDash
        : `${value.toFixed(2)} ${weightUnitLabel}`,
    [placeholderDash, weightUnitLabel],
  );

  const formatTripValue = useCallback(
    (value: number | null) =>
      value === null ? placeholderDash : Math.round(value).toLocaleString(),
    [placeholderDash],
  );

  const renderMetricValue = useCallback(
    (value: number | null, formatter: (v: number | null) => string) => {
      if (metrics.loading && value === null) return loadingLabel;
      return formatter(value);
    },
    [loadingLabel, metrics.loading],
  );

  const [statusFilter, setStatusFilter] = useState<Record<VehicleStatus, boolean>>({
    Running: true,
    Idle: true,
    Parked: true,
    "No Data": true,
  });

  /* ================= MAP INIT ================= */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!document.getElementById("vehicle-marker-animations")) {
      const style = document.createElement("style");
      style.id = "vehicle-marker-animations";
      style.textContent = vehicleMarkerAnimations;
      document.head.appendChild(style);
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([28.476, 77.507], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    vehicleLayerRef.current = L.layerGroup().addTo(map);
    geofenceLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ================= FETCH GEOFENCES ================= */
  useEffect(() => {
    if (!gpsApiUrl) return;
    fetch(GEOFENCE_API_URL)
      .then((r) => r.json())
      .then((json) => {
        const sites =
          json?.data?.siteParent?.flatMap((p: any) => p.site) ?? [];
        setGeofenceSites(sites);
      })
      .catch(console.error);
  }, [gpsApiUrl]);

  /* ================= FETCH VEHICLES ================= */
  useEffect(() => {
    const fetchVehicles = async () => {
      if (!gpsApiUrl) { setFetchedVehicles([]); return; }
      try {
        const res = await fetch(gpsApiUrl);
        const json = await res.json();

        const rows = extractVehicleRows(json);

        const normalized: VehicleData[] = rows
          .map((entry: RawRecord) => {
            const lat = pickNumber(entry, ["lat", "Lat", "latitude", "Latitude"]);
            const lng = pickNumber(entry, ["lng", "lon", "longitude", "Longitude"]);
            if (lat == null || lng == null) return null;

            const speed =
              pickNumber(entry, ["speedKmph", "speed", "speed_kmph", "speedKMH"]) ?? 0;
            const ignitionRaw = pickString(
              entry,
              ["ignitionStatus", "ignition", "ign"],
              ""
            ).toUpperCase();

            const ignition =
              ignitionRaw === "ON" || ignitionRaw === "1"
                ? "ON"
                : ignitionRaw === "OFF" || ignitionRaw === "0"
                ? "OFF"
                : "NA";

            const noData =
              Number(entry.noDataStatus ?? entry.noData ?? entry.statusNoData ?? 0) === 1;

            let status: VehicleStatus = "Idle";
            if (noData) status = "No Data";
            else if (speed > 2) status = "Running";
            else if (ignition === "OFF") status = "Parked";

            return {
              vehicle_no:
                pickString(
                  entry,
                  [
                    "vehicle_no",
                    "vehicleNo",
                    "vehicle_number",
                    "vehicleNumber",
                    "regNo",
                  ],
                  "UNKNOWN"
                ) || "UNKNOWN",
              lat,
              lng,
              speed,
              status,
              driver:
                pickString(entry, ["driverName", "driver_name", "driver"], "-") || "-",
              location: pickString(entry, ["location", "address", "lastLocation"], ""),
              updated_at:
                pickString(
                  entry,
                  [
                    "updatedTime",
                    "lastComunicationTime",
                    "lastCommunication",
                    "gpsTime",
                    "deviceTime",
                    "serverTime",
                    "lastSeen",
                    "updated_at",
                  ],
                  ""
                ) || "",
            };
          })
          .filter(Boolean) as VehicleData[];

        setFetchedVehicles(normalized);
      } catch (err) {
        console.error("Failed to fetch vehicles", err);
      }
    };

    fetchVehicles();
    const t = setInterval(fetchVehicles, 15000);
    return () => clearInterval(t);
  }, [gpsApiUrl]);

  const displayedVehicles = useMemo(
    () => overrideVehicles ?? fetchedVehicles,
    [overrideVehicles, fetchedVehicles],
  );

  useEffect(() => {
    if (!selectedVehicle) return;
    const updated = displayedVehicles.find(
      (v) => v.vehicle_no === selectedVehicle.vehicle_no,
    );
    if (updated && updated !== selectedVehicle) {
      setSelectedVehicle(updated);
    }
  }, [displayedVehicles, selectedVehicle]);

  /* ================= DRAW VEHICLES ================= */
  useEffect(() => {
    if (!vehicleLayerRef.current) return;
    vehicleLayerRef.current.clearLayers();

    displayedVehicles
      .filter((v) => statusFilter[v.status])
      .forEach((v) => {
        const isFocused = selectedVehicle?.vehicle_no === v.vehicle_no;
        const marker = L.marker([v.lat, v.lng], {
          icon: getVehicleIcon(v.status, isFocused),
        });
        marker.on("click", () => {
          setSelectedVehicle(v);
          setInfoOpen(true);
          setPanelOpen(true);
        });
        marker.bindTooltip(
            `
              <div style="min-width:140px;">
                <div style="font-weight:600;">${v.vehicle_no}</div>
                <div>${labelDriver}: ${v.driver || placeholderDash}</div>
                <div>${labelStatus}: ${formatStatusLabel(v.status)}</div>
                <div>${labelSpeed}: ${v.speed} ${speedUnit}</div>
              </div>
            `,
            { direction: "top", offset: [0, -12], opacity: 0.95 }
          ).addTo(vehicleLayerRef.current!);
        if (isFocused) {
          marker.openTooltip();
        }
      });
  }, [
    displayedVehicles,
    formatStatusLabel,
    labelDriver,
    labelSpeed,
    labelStatus,
    placeholderDash,
    selectedVehicle,
    speedUnit,
    statusFilter,
  ]);

  /* ================= METRICS ================= */
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
    const vehicleId = selectedVehicle.vehicle_no;
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
          vehicleId
        )}&fromDateUTC=${monthStart}&toDateUTC=${monthEnd}&userId=${TRIP_SUMMARY_USER_ID}&duration=0`;

        const [tripRes, weightResult] = await Promise.all([
          fetch(tripUrl).then((res) => res.json()),
          fetchWasteReport(weighmentApiUrl, "day_wise_data", reportStartKey, todayKey).catch(
            () => ({
              rows: [],
            })
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

        const targetVehicle = normalizeVehicleId(vehicleId);
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
  }, [selectedVehicle?.vehicle_no]);

  /* ================= DRAW GEOFENCES ================= */
  useEffect(() => {
    if (!mapRef.current || !geofenceLayerRef.current) return;
    geofenceLayerRef.current.clearLayers();

    const bounds: LatLngTuple[] = [];

    geofenceSites
      .filter((s) => s.type === "Polygon")
      .forEach((site) => {
        const coords = parseLatLng(site.latlong);
        if (!coords.length) return;

        L.polygon(coords, {
          color: "#2563eb",
          fillOpacity: 0.25,
        })
          .bindTooltip(site.siteName)
          .addTo(geofenceLayerRef.current!);

        bounds.push(...coords);
      });

    displayedVehicles.forEach((v) => bounds.push([v.lat, v.lng]));

    if (bounds.length) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [geofenceSites, displayedVehicles]);

  useEffect(() => {
    if (!mapRef.current || !selectedVehicle) return;
    mapRef.current.setView([selectedVehicle.lat, selectedVehicle.lng], Math.max(mapRef.current.getZoom(), 15), {
      animate: true,
    });
  }, [selectedVehicle]);

  /* ================= UI ================= */
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        backgroundColor: isDarkMode ? "#0f172a" : "#fff",
      }}
    >
      {selectedVehicle && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 1100,
              width: "30%",
              minWidth: 260,
              maxWidth: "90vw",
              height: "100%",
              overflow: "visible",
              transform: panelOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.8s ease",
              pointerEvents: panelOpen ? "auto" : "none",
            }}
          >
            <div
              style={{
                height: "100%",
                overflow: "auto",
                borderRadius: 0,
                padding: 20,
                background: isDarkMode ? "rgba(15,23,42,.96)" : "#fff",
                color: isDarkMode ? "#f8fafc" : "#0f172a",
                border: isDarkMode ? "1px solid rgba(148,163,184,.35)" : "1px solid #e5e7eb",
                boxShadow: isDarkMode
                  ? "0 16px 30px rgba(0,0,0,.45)"
                  : "0 12px 24px rgba(15,23,42,.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", opacity: 0.7 }}>
                    {labelVehicle}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    {selectedVehicle.vehicle_no}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVehicle(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                    color: isDarkMode ? "#f8fafc" : "#0f172a",
                  }}
                  aria-label={closeVehicleDetailsLabel}
                >
                  ×
                </button>
              </div>

          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
              }}
            >
              🚚
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600 }}>{liveVehicleLabel}</div>
              <div style={{ opacity: 0.8 }}>{selectedVehicle.location || locationUnavailable}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
            <div>
              <strong>{labelStatus}:</strong> {formatStatusLabel(selectedVehicle.status)}
            </div>
            <div>
              <strong>{labelDriver}:</strong> {selectedVehicle.driver || placeholderDash}
            </div>
            <div>
              <strong>{labelSpeed}:</strong> {selectedVehicle.speed} {speedUnit}
            </div>
            <div>
              <strong>{labelCoordinates}:</strong> {selectedVehicle.lat.toFixed(5)}, {selectedVehicle.lng.toFixed(5)}
            </div>
            {selectedVehicle.location ? (
              <div>
                <strong>{labelLocation}:</strong> {selectedVehicle.location}
              </div>
            ) : null}
            {selectedVehicle.updated_at ? (
              <div>
                <strong>{labelLastUpdated}:</strong>{" "}
                {formatUpdatedAt(selectedVehicle.updated_at)}
              </div>
            ) : null}
          </div>

            <div
              style={{
                marginTop: 16,
                borderTop: isDarkMode ? "1px solid rgba(148,163,184,.25)" : "1px solid #e5e7eb",
                paddingTop: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setInfoOpen((prev) => !prev)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontWeight: 600,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isDarkMode ? "#f8fafc" : "#0f172a",
                  padding: 0,
                }}
                aria-expanded={infoOpen}
              >
                <span>{vehicleInformationLabel}</span>
                <span style={{ fontSize: 16 }}>{infoOpen ? "−" : "+"}</span>
              </button>

              {infoOpen && (
                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
                  <div>
                    <strong>{labelReportDate}:</strong> {metrics.reportDateKey ?? placeholderDash}
                  </div>
                  <div>
                    <strong>{labelTripsToday}:</strong>{" "}
                    {renderMetricValue(metrics.totalTripsToday, formatTripValue)}
                  </div>
                  <div>
                    <strong>{labelDryToday}:</strong>{" "}
                    {renderMetricValue(metrics.dryWeightTodayTons, formatWeightValue)}
                  </div>
                  <div>
                    <strong>{labelWetToday}:</strong>{" "}
                    {renderMetricValue(metrics.wetWeightTodayTons, formatWeightValue)}
                  </div>
                  <div>
                    <strong>{labelMixToday}:</strong>{" "}
                    {renderMetricValue(metrics.mixWeightTodayTons, formatWeightValue)}
                  </div>
                  <div>
                    <strong>{labelWeightToday}:</strong>{" "}
                    {renderMetricValue(metrics.totalWeightTodayTons, formatWeightValue)}
                  </div>
                  <div>
                    <strong>{labelDistanceToday}:</strong>{" "}
                    {renderMetricValue(metrics.totalDistanceTodayKm, formatDistanceValue)}
                  </div>
                  <div>
                    <strong>{labelDistanceMonth}:</strong>{" "}
                    {renderMetricValue(metrics.totalDistanceMonthKm, formatDistanceValue)}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen((prev) => !prev)}
            style={{
              position: "absolute",
              left: panelOpen ? "30%" : 12,
              top: "50%",
              transform: panelOpen ? "translate(-18px, -50%)" : "translate(0, -50%)",
              width: 42,
              height: 64,
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: isDarkMode ? "#f8fafc" : "#0f172a",
              boxShadow: isDarkMode
                ? "0 12px 24px rgba(0,0,0,.35)"
                : "0 10px 20px rgba(15,23,42,.15)",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              zIndex: 1200,
            }}
            aria-label={panelOpen ? collapseVehicleDetailsLabel : expandVehicleDetailsLabel}
          >
            {panelOpen ? "‹" : "›"}
          </button>
        </>
      )}

      {/* STATUS FILTER */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          background: isDarkMode ? "rgba(15,23,42,.85)" : "rgba(255,255,255,.8)",
          padding: "6px 10px",
          borderRadius: 8,
          display: "flex",
          gap: 10,
          fontSize: 12,
          boxShadow: isDarkMode
            ? "0 10px 30px rgba(0,0,0,.45)"
            : "0 4px 10px rgba(0,0,0,.15)",
          color: isDarkMode ? "#f8fafc" : "#0f172a",
          border: isDarkMode ? "1px solid rgba(148,163,184,.35)" : undefined,
        }}
      >
        {(Object.keys(statusFilter) as VehicleStatus[]).map((s) => (
          <label key={s} style={{ color: STATUS_COLORS[s] }}>
            <input
              type="checkbox"
              checked={statusFilter[s]}
              onChange={() =>
                setStatusFilter((p) => ({ ...p, [s]: !p[s] }))
              }
            />{" "}
            {formatStatusLabel(s)}
          </label>
        ))}
      </div>

      {/* MAP */}
      <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
