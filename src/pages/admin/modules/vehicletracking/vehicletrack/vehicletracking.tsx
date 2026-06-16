import type { PanelStatusKey, PanelVehicle, RawRecord, Status, StatusSurface, Vehicle, VehicleMetrics } from "./types";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./vehicletracking.css";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";
import { fetchWasteReport } from "@/utils/wasteApi";


const STATUS_META: Record<
  PanelStatusKey,
  {
    labelKey: string;
    accent: string;
    textLight: string;
    textDark: string;
    surfaceLight: StatusSurface;
    surfaceDark: StatusSurface;
  }
> = {
  running: {
    labelKey: "dashboard.live_map.status_running",
    accent: "#16a34a",
    textLight: "#14532d",
    textDark: "#4ade80",
    surfaceLight: { bg: "#e6f5ec", border: "#a3e0b9" },
    surfaceDark: { bg: "rgba(34,197,94,0.28)", border: "rgba(74,222,128,0.7)" },
  },
  idle: {
    labelKey: "dashboard.live_map.status_idle",
    accent: "#f59e0b",
    textLight: "#92400e",
    textDark: "#fde68a",
    surfaceLight: { bg: "#fff8e1", border: "#fcd34d" },
    surfaceDark: { bg: "rgba(245,158,11,0.14)", border: "rgba(251,191,36,0.45)" },
  },
  stopped: {
    labelKey: "dashboard.live_map.status_stopped",
    accent: "#ef4444",
    textLight: "#991b1b",
    textDark: "#fecaca",
    surfaceLight: { bg: "#ffe5e5", border: "#fca5a5" },
    surfaceDark: { bg: "rgba(239,68,68,0.15)", border: "rgba(248,113,113,0.45)" },
  },
  no_data: {
    labelKey: "dashboard.live_map.status_no_data",
    accent: "#9ca3af",
    textLight: "#374151",
    textDark: "#d1d5db",
    surfaceLight: { bg: "#f3f4f6", border: "#d1d5db" },
    surfaceDark: { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.35)" },
  },
};


const TRIP_SUMMARY_ENDPOINT =
  "https://gpsvtsprobend.vamosys.com/v2/getTripSummary";

const TRIP_SUMMARY_USER_ID = "NMCP2DISPOSAL";

const IST_DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
});

/* ================= MAP ICON ================= */
const createVehicleIcon = (status: Status, isFocused: boolean) => {
  const size = isFocused ? 42 : 34;
  const statusClass = status.toLowerCase().replace(" ", "");
  const pulseSize = Math.round(size * 1.2);

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="vehicle-icon ${statusClass} ${isFocused ? "focused" : ""}" style="width:${size}px;height:${size}px;">
        ${
          isFocused
            ? `<span class="vehicle-pulse" style="width:${pulseSize}px;height:${pulseSize}px;"></span>`
            : ""
        }
        <span class="vehicle-emoji">🚚</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const mapPanelStatusKey = (status: Status): PanelStatusKey => {
  if (status === "Running") return "running";
  if (status === "Idle") return "idle";
  if (status === "Parked") return "stopped";
  return "no_data";
};

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

function pick(source: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = source?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

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

const parseTripTimestamp = (value?: number | string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

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

export default function VehicleTracking() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { gpsApiUrl, weighmentApiUrl } = useProjectSelector();
  const API_URL = gpsApiUrl;
  const isDarkMode = theme === "dark";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [focusedVehicleId, setFocusedVehicleId] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [filters, setFilters] = useState<Record<Status, boolean>>({
    Running: true,
    Idle: true,
    Parked: true,
    "No Data": true,
  });
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

  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Record<string, L.Marker>>({});
  const metricsRequestRef = useRef(0);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const statusControlRef = useRef<HTMLDivElement | null>(null);

  const statusLabels = useMemo(
    () => ({
      running: t("dashboard.live_map.status_running"),
      idle: t("dashboard.live_map.status_idle"),
      parked: t("dashboard.live_map.status_parked"),
      no_data: t("dashboard.live_map.status_no_data"),
    }),
    [i18n.language, t],
  );

  const formatStatusLabel = (status: Status) => {
    const key = status.toLowerCase().replace(" ", "_") as keyof typeof statusLabels;
    return statusLabels[key] ?? status;
  };

  const speedUnit = t("dashboard.live_map.units.kmh");
  const activeVehicle = useMemo(() => {
    const id = focusedVehicleId || selectedVehicle;
    if (!id) return null;
    return vehicles.find((vehicle) => vehicle.id === id) ?? null;
  }, [focusedVehicleId, selectedVehicle, vehicles]);

  const panelVehicle = useMemo<PanelVehicle | null>(() => {
    if (!activeVehicle) return null;
    return {
      id: activeVehicle.id,
      label: activeVehicle.label,
      lat: activeVehicle.lat,
      lng: activeVehicle.lng,
      statusKey: mapPanelStatusKey(activeVehicle.status),
      statusLabel: formatStatusLabel(activeVehicle.status),
      speed: activeVehicle.speed,
      lastUpdate: activeVehicle.updatedAt,
      driver: activeVehicle.driver,
      location: activeVehicle.location,
    };
  }, [activeVehicle, formatStatusLabel]);

  /* ================= FETCH DATA ================= */
  const fetchData = async () => {
    const res = await fetch(API_URL);
    const json = await res.json();

    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : [];

    const normalized: Vehicle[] = rows
      .map((r: any) => {
        const lat = Number(r.latitude);
        const lng = Number(r.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        const speed = Number(r.speedKmph ?? r.speed ?? 0);
        const ignitionRaw = String(
          r.ignitionStatus ?? r.ignition ?? ""
        ).toUpperCase();

        const ignition: "ON" | "OFF" | "NA" =
          ignitionRaw === "ON" || ignitionRaw === "1"
            ? "ON"
            : ignitionRaw === "OFF" || ignitionRaw === "0"
            ? "OFF"
            : "NA";

        let status: Status = "Idle";
        if (Number(r.noDataStatus) === 1) status = "No Data";
        else if (speed > 2) status = "Running";
        else if (ignition === "OFF") status = "Parked";

        const driver = String(
          r.driverName || r.driver_name || r.driver || r.staffName || r.staff || ""
        ).trim();
        const location = String(
          r.location || r.address || r.lastLocation || r.last_location || ""
        ).trim();

        return {
          id: r.vehicleNo || r.vehicle_number || r.regNo,
          label: r.vehicleNo || r.vehicle_number || r.regNo,
          lat,
          lng,
          speed,
          ignition,
          status,
          distance: Number(r.distanceCovered ?? r.distance ?? 0),
          updatedAt:
            r.updatedTime ||
            r.lastComunicationTime ||
            new Date().toLocaleString(),
          driver: driver || undefined,
          location: location || undefined,
        };
      })
      .filter(Boolean) as Vehicle[];

    setVehicles(normalized);
  };

  /* ================= MAP INIT ================= */
  useEffect(() => {
    fetchData();

    const map = L.map(mapDivRef.current!).setView([28.61, 77.23], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    /* -------- STATUS FILTER (KEEP) -------- */
    const StatusControl = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create(
          "div",
          "leaflet-control vehicle-status-control"
        );

        div.innerHTML = `
          <label class="running"><input type="checkbox" checked /> <span data-status="running">${statusLabels.running}</span></label>
          <label class="idle"><input type="checkbox" checked /> <span data-status="idle">${statusLabels.idle}</span></label>
          <label class="parked"><input type="checkbox" checked /> <span data-status="parked">${statusLabels.parked}</span></label>
          <label class="nodata"><input type="checkbox" checked /> <span data-status="no_data">${statusLabels.no_data}</span></label>
        `;

        L.DomEvent.disableClickPropagation(div);
        statusControlRef.current = div;

        const statuses: Status[] = ["Running", "Idle", "Parked", "No Data"];
        div.querySelectorAll("input").forEach((input, i) => {
          input.addEventListener("change", () => {
            setFilters((prev) => ({
              ...prev,
              [statuses[i]]: (input as HTMLInputElement).checked,
            }));
          });
        });

        return div;
      },
    });

    map.addControl(new StatusControl({ position: "topleft" }));

    const timer = setInterval(fetchData, 15000);
    return () => {
      clearInterval(timer);
      map.remove();
    };
  }, []);

  useEffect(() => {
    const control = statusControlRef.current;
    if (!control) return;
    Object.entries(statusLabels).forEach(([key, label]) => {
      const span = control.querySelector(`span[data-status="${key}"]`);
      if (span) span.textContent = label;
    });
  }, [statusLabels]);

  /* ================= FILTER PIPELINE ================= */
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(
      (v) =>
        filters[v.status] &&
        (!selectedVehicle || v.id === selectedVehicle) &&
        v.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [vehicles, filters, search, selectedVehicle]);

  useEffect(() => {
    if (!panelVehicle) {
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
    const currentVehicleId = panelVehicle.id;
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

        (weightResult.rows || []).forEach((row: RawRecord) => {
          const rowVehicle = pickVehicleId(row);
          if (!idsMatch(targetVehicle, rowVehicle)) return;
          const rowDateKey = getRowDateKey(row);
          if (!rowDateKey) return;
          matchedAny = true;
          const weights = parseWeightParts(row);
          const tripCount =
            parseNumeric(
              (row as Record<string, any>).total_trip ??
                (row as Record<string, any>).totalTrip ??
                (row as Record<string, any>).trips ??
                (row as Record<string, any>).trip
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
  }, [panelVehicle?.id]);

  /* ================= MARKERS + POPUP ================= */
  useEffect(() => {
    if (!layerRef.current || !mapRef.current) return;

    layerRef.current.clearLayers();
    markerLookupRef.current = {};

    filteredVehicles.forEach((v) => {
      const popupHtml = `
        <div class="vehicle-popup">
          <div class="popup-title">${v.label}</div>
          <div class="popup-row">
            <span class="popup-label">${t("dashboard.live_map.labels.status")}:</span>
            <span class="popup-value">${formatStatusLabel(v.status)}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">${t("dashboard.live_map.labels.speed")}:</span>
            <span class="popup-value">${v.speed.toFixed(1)} ${speedUnit}</span>
          </div>
        </div>
      `;

      const isFocused = v.id === focusedVehicleId;
      const marker = L.marker([v.lat, v.lng], {
        icon: createVehicleIcon(v.status, isFocused),
      })
        .bindPopup(popupHtml, {
          closeButton: true,
          autoPan: true,
          offset: [0, -8],
        })
        .addTo(layerRef.current!);
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.on("click", () => {
        setFocusedVehicleId(v.id);
        setPanelOpen(true);
      });
      markerLookupRef.current[v.id] = marker;
    });
  }, [filteredVehicles, focusedVehicleId, formatStatusLabel, speedUnit, t]);

  /* ================= AUTO FIT ================= */
  useEffect(() => {
    if (!mapRef.current || filteredVehicles.length === 0) return;

    const bounds = L.latLngBounds(
      filteredVehicles.map((v) => [v.lat, v.lng] as [number, number])
    );

    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [filteredVehicles]);

  useEffect(() => {
    if (!mapRef.current || !focusedVehicleId) return;
    const target = filteredVehicles.find((v) => v.id === focusedVehicleId);
    if (!target) return;
    const marker = markerLookupRef.current[focusedVehicleId];
    if (marker) {
      marker.openPopup();
    }
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.setView([target.lat, target.lng], Math.max(currentZoom, 15), {
      animate: true,
    });
  }, [focusedVehicleId, filteredVehicles]);

  /* ================= SCROLL ================= */
  const scroll = (dir: "left" | "right") => {
    carouselRef.current?.scrollBy({
      left: dir === "left" ? -340 : 340,
      behavior: "smooth",
    });
  };

  /* ================= JSX ================= */

  if (!gpsApiUrl) {
    return (
      <div className={`tracking-page ${isDarkMode ? "dark-mode" : ""}`}>
        <div className="px-2 pt-2">
          <ProjectSelectorBar />
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">GPS API not configured for this project.</p>
          <p className="text-sm mt-1">Set a GPS API URL in the project settings to enable vehicle tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`tracking-page ${isDarkMode ? "dark-mode" : ""}`}>
      <div className="px-2 pt-2">
        <ProjectSelectorBar />
      </div>
      <div className="map-wrap">
        <div id="map" className="map-canvas" ref={mapDivRef} />
        <VehicleSidePanel
          vehicle={panelVehicle ?? undefined}
          open={panelOpen}
          onToggle={() => setPanelOpen((prev) => !prev)}
          onClose={() => setPanelOpen(false)}
          isDarkMode={isDarkMode}
          metrics={metrics}
        />
      </div>

      <div className="carousel-wrap">
        <div className="carousel-header-row">
          <div className="carousel-header">
            {t("admin.vehicle_tracking.carousel_title", {
              count: Math.min(filteredVehicles.length, 12),
            })}
          </div>

          <div className="vehicle-search-group">
            <input
              className="vehicle-search"
              placeholder={t("admin.vehicle_tracking.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="vehicle-dropdown"
              value={selectedVehicle}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedVehicle(value);
                setFocusedVehicleId(value);
                setPanelOpen(true);
              }}
            >
              <option value="">{t("admin.vehicle_tracking.all_vehicles")}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="carousel-btn left" onClick={() => scroll("left")}>
          ‹
        </button>

        <div className="vehicle-carousel" ref={carouselRef}>
          {filteredVehicles.slice(0, 12).map((v) => (
            <div key={v.id} className={`vehicle-card ${v.status.toLowerCase()}`}>
              <div className="vehicle-header">
                <span>{v.label}</span>
                <span className="status">{formatStatusLabel(v.status)}</span>
              </div>
              <div className="vehicle-body">
                <p>
                  {t("admin.vehicle_tracking.labels.speed")}: {v.speed} {speedUnit}
                </p>
                <p>
                  {t("admin.vehicle_tracking.labels.ignition")}: {v.ignition}
                </p>
                <p>
                  {t("admin.vehicle_tracking.labels.distance")}: {v.distance.toFixed(1)} km
                </p>
                <p>
                  {t("admin.vehicle_tracking.labels.updated")}: {v.updatedAt}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button className="carousel-btn right" onClick={() => scroll("right")}>
          ›
        </button>
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
  vehicle?: PanelVehicle;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  metrics: VehicleMetrics;
}) {
  const { t, i18n } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(true);
  const meta = vehicle ? STATUS_META[vehicle.statusKey] : null;
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
        {open ? "<" : ">"}
      </button>

      <button
        type="button"
        onClick={onClose}
        className={`absolute right-2 top-2 rounded-full border px-2 py-1 text-xs font-bold shadow ${
          isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
        }`}
      >
        x
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
                    {vehicle.statusLabel || t(meta?.labelKey ?? "dashboard.live_map.status_unknown")}
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
                  <span className="text-base">{infoOpen ? "-" : "+"}</span>
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
