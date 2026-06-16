import type { HistoryPopupLabels, RawRecord, StatusKey, TrackPoint, VehicleOption } from "./types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./vehiclehistory.css";
import "../../../../../components/map/adminMapPanel.css";

import { useTranslation } from "react-i18next";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";


const HISTORY_DEFAULT_PROXIES = [
  "https://cors.isomorphic-git.org/{url}",
  "https://thingproxy.freeboard.io/fetch/{url}",
  "https://corsproxy.io/?",
];

const HISTORY_DEFAULT_PARAMS = {
  userId: "BLUEPLANET",
  groupName: "BLUEPLANET:VAM",
  interval: "-1",
} as const;


const STATUS_META: Record<StatusKey, { labelKey: string; color: string }> = {
  running: { labelKey: "dashboard.live_map.status_running", color: "#22c55e" },
  idle: { labelKey: "dashboard.live_map.status_idle", color: "#f59e0b" },
  stopped: { labelKey: "dashboard.live_map.status_stopped", color: "#2563eb" },
  no_data: { labelKey: "dashboard.live_map.status_no_data", color: "#f87171" },
};

const pad = (v: number) => String(v).padStart(2, "0");
const formatInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;

function pick(source: RawRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const val = source[key];
    if (val !== null && val !== undefined && String(val).trim()) {
      return String(val).trim();
    }
  }
  return fallback;
}

function pickNum(source: RawRecord, keys: string[]): number | null {
  for (const key of keys) {
    const n = Number(source[key]);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function pickRaw(source: RawRecord, keys: string[]): any {
  for (const k of keys) {
    if (source[k] !== undefined && source[k] !== null && source[k] !== "") {
      return source[k];
    }
  }
  return undefined;
}

const firstArray = (candidates: any[]): any[] => {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  return [];
};

const formatProxyUrl = (template: string, target: string) => {
  const encoded = encodeURIComponent(target);
  if (/\{url\}/i.test(template)) {
    return template.replace(/\{url\}/gi, encoded);
  }
  if (template.endsWith("?") || template.endsWith("&")) {
    return `${template}${encoded}`;
  }
  if (template.includes("?")) {
    return `${template}&url=${encoded}`;
  }
  return `${template}${encoded}`;
};

const buildHistoryUrls = (baseUrl: string): string[] => {
  const templates = HISTORY_DEFAULT_PROXIES;
  const proxyUrls = templates.map((tpl) => formatProxyUrl(tpl, baseUrl));
  return [baseUrl, ...proxyUrls];
};

const fetchJsonSafe = async (url: string) => {
  const candidates = buildHistoryUrls(url);
  let lastError: any = null;

  for (const endpoint of candidates) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const snippet = (await res.text()).slice(0, 160);
        throw new Error(`HTTP ${res.status}: ${snippet}`);
      }
      const text = await res.text();
      return JSON.parse(text);
    } catch (err) {
      lastError = err;
      console.warn("Vehicle history request failed", endpoint, err);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Unable to load vehicle history.");
};

const HISTORY_TIMESTAMP_KEYS = [
  "deviceTime", "timestamp", "gpsTime", "time", "serverTime",
  "_ts", "date", "dateSec", "lastComunicationTime",
];

const mapHistoryStatus = (rawStatus: string, speed: number): StatusKey => {
  const normalized = rawStatus.toLowerCase();
  if (normalized.includes("no data") || normalized.includes("nodata")) return "no_data";
  if (normalized.includes("run") || normalized.includes("moving")) return "running";
  if (normalized.includes("idle")) return "idle";
  if (normalized.includes("stop") || normalized.includes("park") || normalized.includes("off")) {
    return "stopped";
  }
  if (speed > 2) return "running";
  if (speed > 0) return "idle";
  if (speed === 0) return "stopped";
  return "no_data";
};

const createHistoryIcon = (status: StatusKey, isFocused: boolean) => {
  const size = isFocused ? 40 : 34;
  const pulseSize = Math.round(size * 1.2);

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div class="vh-vehicle-marker status-${status} ${isFocused ? "focused" : ""}" style="width:${size}px;height:${size}px;">
        ${
          isFocused
            ? `<span class="vh-vehicle-pulse" style="width:${pulseSize}px;height:${pulseSize}px;"></span>`
            : ""
        }
        <svg class="vh-vehicle-icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      </div>
    `,
  });
};


const buildHistoryPopup = (
  labels: HistoryPopupLabels,
  statusLabel: string,
  speedKmph: number,
  showSpeed: boolean
) => {
  const speedLine = showSpeed
    ? `<div class="vh-popup-row"><span>${labels.speed}:</span><strong>${speedKmph.toFixed(
        1
      )} ${labels.unit}</strong></div>`
    : "";

  return `
    <div class="vh-popup">
      <div class="vh-popup-title">${labels.title}</div>
      <div class="vh-popup-row"><span>${labels.status}:</span><strong>${statusLabel}</strong></div>
      ${speedLine}
    </div>
  `;
};

const toRad = (value: number) => (value * Math.PI) / 180;

const haversineKm = (a: TrackPoint, b: TrackPoint) => {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
};

function parseTs(value: any): Date | null {
  if (!value) return null;

  if (typeof value === "number") {
    let s = value;
    if (s > 1e12) s = s / 1000;
    return new Date(Math.round(s * 1000));
  }

  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      let s = n;
      if (s > 1e12) s = s / 1000;
      return new Date(Math.round(s * 1000));
    }
    const p = Date.parse(value);
    if (!Number.isNaN(p)) return new Date(p);
  }

  return null;
}

function normalizeHistory(rec: RawRecord[]) {
  const out: any[] = [];

  for (const r of rec) {
    const lat = pickNum(r, ["lat", "latitude", "Latitude"]);
    const lng = pickNum(r, ["lng", "lon", "longitude", "Longitude"]);
    if (lat == null || lng == null) continue;

    const tsVal = pickRaw(r, HISTORY_TIMESTAMP_KEYS);
    const ts = parseTs(tsVal);
    if (!ts) continue;

    const speed = pickNum(r, ["speedKmph", "speed", "speedKMH"]) ?? 0;
    const status = pick(r, ["statusCode", "status", "vehicleStatus", "mode"], "");
    const address = pick(r, ["address", "geoAddress", "location"], "");

    out.push({
      lat,
      lng,
      speedKmph: speed,
      statusCode: status,
      address,
      _ts: ts,
    });
  }

  out.sort((a, b) => a._ts - b._ts);
  return out;
}

export default function VehicleHistory(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { gpsApiUrl } = useProjectSelector();
  const TRACKING_API_URL = gpsApiUrl;
  const HISTORY_API_BASE = gpsApiUrl;
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  // NEW SPEED STATE
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // default 2x

  const initialTo = new Date();
  const initialFrom = new Date(initialTo.getTime() - 6 * 60 * 60 * 1000);

  const [fromDate, setFromDate] = useState(formatInput(initialFrom));
  const [toDate, setToDate] = useState(formatInput(initialTo));

  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const trackLayerRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const popupLabels = useMemo(
    () => ({
      title: t("dashboard.live_map.popup_status"),
      status: t("dashboard.live_map.labels.status"),
      speed: t("dashboard.live_map.popup_speed"),
      unit: t("dashboard.live_map.units.kmh"),
    }),
    [t]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(TRACKING_API_URL);
        const body = await res.json();
        const arr = Array.isArray(body) ? body : body.data;

        if (!Array.isArray(arr)) {
          setVehicles([]);
          return;
        }

        const normalized = arr
          .map((r) => {
            const id = pick(r, ["vehicleId", "vehicleNo", "regNo"], "");
            const lat = pickNum(r, ["lat", "latitude"]);
            const lng = pickNum(r, ["lng", "lon"]);
            if (!id || lat == null || lng == null) return null;

            return {
              id,
              label: id,
              lat,
              lng,
              status: "running" as StatusKey,
            };
          })
          .filter(Boolean) as VehicleOption[];

        if (normalized.length) {
          setVehicles(normalized);
          setVehicleId(normalized[0].id);
        }
      } catch {
        setVehicles([]);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [28.61, 77.21],
      zoom: 10,
      zoomControl: true,
    });

    const layer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    layer.addTo(map);

    trackLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryError("");
    setTrack([]);

    if (!vehicleId) {
      setHistoryError("admin.vehicle_history.error_select_vehicle");
      return;
    }

    try {
      const fromMs = new Date(fromDate).getTime();
      const toMs = new Date(toDate).getTime();

      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
        setHistoryError("admin.vehicle_history.error_invalid_range");
        return;
      }

      if (fromMs >= toMs) {
        setHistoryError("admin.vehicle_history.error_from_after_to");
        return;
      }

      const baseParams = { ...HISTORY_DEFAULT_PARAMS, vehicleId };
      const fromMsStr = Math.floor(fromMs).toString();
      const toMsStr = Math.floor(toMs).toString();
      const fromSecStr = Math.floor(fromMs / 1000).toString();
      const toSecStr = Math.floor(toMs / 1000).toString();

      const strategies = [
        {
          label: "utc-ms",
          params: {
            ...baseParams,
            fromDateUTC: fromMsStr,
            toDateUTC: toMsStr,
          },
        },
        {
          label: "datetime-ms",
          params: {
            ...baseParams,
            fromDateTimeUTC: fromMsStr,
            toDateTimeUTC: toMsStr,
          },
        },
        {
          label: "utc-sec",
          params: {
            ...baseParams,
            fromDateUTC: fromSecStr,
            toDateUTC: toSecStr,
          },
        },
        {
          label: "latest",
          params: {
            ...baseParams,
          },
        },
      ];

      let normalized: any[] = [];
      const lastError = "admin.vehicle_history.error_no_history";

      for (const strat of strategies) {
        const params = new URLSearchParams(strat.params as Record<string, string>);
        const url = `${HISTORY_API_BASE}?${params.toString()}`;
        try {
          const json = await fetchJsonSafe(url);
          const source =
            firstArray([
              json.vehicleLocations,
              json.history4Mobile,
              json.totalRecordList,
              json.data,
              json.track,
              json.records,
              json.locations,
            ]) || [];

          normalized = normalizeHistory(source);
          if (normalized.length) {
            break;
          }
        } catch (err) {
          continue;
        }
      }

      const pts: TrackPoint[] = normalized.map((p) => {
        const statusKey = mapHistoryStatus(p.statusCode ?? "", p.speedKmph ?? 0);
        return {
          lat: p.lat,
          lng: p.lng,
          speedKmph: p.speedKmph,
          statusKey,
          statusLabel: t(STATUS_META[statusKey].labelKey),
          address: p.address,
          timestamp: p._ts.toISOString(),
        };
      });

      setTrack(pts);
      setPlaybackIndex(0);
      setIsPlaying(false);

      if (!pts.length) {
        setHistoryError(lastError);
      }
    } catch (err) {
      console.error("History fetch failed:", err);
      setHistoryError("admin.vehicle_history.error_load_failed");
    }
  }, [vehicleId, fromDate, toDate, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!mapRef.current || !trackLayerRef.current) return;

    const layer = trackLayerRef.current;
    layer.clearLayers();

    if (!track.length) return;

    const coords: LatLngTuple[] = track.map((t) => [t.lat, t.lng]);
    const poly = L.polyline(coords, { color: "#2563eb", weight: 4 });
    poly.addTo(layer);

    mapRef.current.fitBounds(poly.getBounds(), { padding: [40, 40] });

    if (markerRef.current) markerRef.current.remove();
    const initial = track[0];
    const shouldShowSpeed = initial.statusKey === "running";
    markerRef.current = L.marker(coords[0], {
      icon: createHistoryIcon(initial.statusKey, true),
    })
      .bindPopup(
        buildHistoryPopup(popupLabels, initial.statusLabel, initial.speedKmph, shouldShowSpeed),
        { closeButton: true, autoPan: true, offset: [0, -8] }
      )
      .addTo(layer);
    markerRef.current.on("click", () => {
      setPanelOpen(true);
    });
  }, [popupLabels, track]);

  /* SPEED-AWARE PLAYBACK */
  useEffect(() => {
    if (!isPlaying || !track.length) return;

    const interval = 400 / playbackSpeed;

    const id = setInterval(() => {
      setPlaybackIndex((idx) => {
        if (idx >= track.length - 1) {
          setIsPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, interval);

    return () => clearInterval(id);
  }, [isPlaying, track.length, playbackSpeed]);

  useEffect(() => {
    const p = track[playbackIndex];
    if (!p || !markerRef.current) return;

    markerRef.current.setLatLng([p.lat, p.lng]);
    markerRef.current.setIcon(createHistoryIcon(p.statusKey, true));

    const shouldShowSpeed = p.statusKey === "running";
    markerRef.current.bindPopup(
      buildHistoryPopup(popupLabels, p.statusLabel, p.speedKmph, shouldShowSpeed),
      { closeButton: true, autoPan: true, offset: [0, -8] }
    );

    if (p.statusKey !== "no_data") {
      markerRef.current.openPopup();
    } else {
      markerRef.current.closePopup();
    }
  }, [playbackIndex, popupLabels, t]);

  const activePoint = track[playbackIndex] ?? null;
  const placeholderDash = t("dashboard.live_map.placeholder_dash");
  const activeTimestamp = activePoint
    ? new Date(activePoint.timestamp).toLocaleString(i18n.language || "en-US")
    : t("dashboard.live_map.placeholder_na");
  const totalDistanceKm = useMemo(() => {
    if (track.length < 2) return null;
    let total = 0;
    for (let i = 1; i < track.length; i += 1) {
      total += haversineKm(track[i - 1], track[i]);
    }
    return total;
  }, [track]);

  if (!gpsApiUrl) {
    return (
      <div className="vh-container fade-in">
        <ProjectSelectorBar />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">GPS API not configured for this project.</p>
          <p className="text-sm mt-1">Set a GPS API URL in the project settings to enable vehicle tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vh-container fade-in">
      <ProjectSelectorBar />
      <div className="vh-filter-bar slide-up">
        <div className="vh-filter-item">
          <label>{t("admin.vehicle_history.filters.vehicle")}</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="vh-filter-item">
          <label>{t("admin.vehicle_history.filters.from")}</label>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="vh-filter-item">
          <label>{t("admin.vehicle_history.filters.to")}</label>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <button className="vh-go-btn" onClick={fetchHistory}>
          {t("common.go")}
        </button>
      </div>

      <h2 className="vh-title slide-up">
        {t("admin.vehicle_history.title", { vehicleId })}
      </h2>

      <div className="vh-map-wrapper fade-in">
        <div className="vh-map-canvas" ref={mapDivRef}></div>
        <div className={`admin-map-panel ${panelOpen ? "is-open" : ""}`}>
          <button
            type="button"
            className="admin-map-panel__toggle"
            onClick={() => setPanelOpen((prev) => !prev)}
          >
            {panelOpen ? "<" : ">"}
          </button>
          <button
            type="button"
            className="admin-map-panel__close"
            onClick={() => setPanelOpen(false)}
          >
            x
          </button>
          <div className="admin-map-panel__content">
            <div className="admin-map-panel__header">
              <div className="vh-panel-title-row">
                <span className="vh-panel-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                </span>
                <div>
                  <div className="admin-map-panel__eyebrow">
                    {t("admin.vehicle_history.filters.vehicle")}
                  </div>
                  <div className="admin-map-panel__title">
                    {vehicleId || t("dashboard.live_map.placeholder_na")}
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-map-panel__section">
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("admin.vehicle_history.filters.from")}
                </span>
                <span className="admin-map-panel__value">
                  {fromDate || placeholderDash}
                </span>
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("admin.vehicle_history.filters.to")}
                </span>
                <span className="admin-map-panel__value">
                  {toDate || placeholderDash}
                </span>
              </div>
            </div>
            <div className="admin-map-panel__section">
              <div className="admin-map-panel__section-title">
                {t("dashboard.live_map.vehicle_information")}
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("dashboard.live_map.labels.status")}
                </span>
                <span className="admin-map-panel__value">
                  {activePoint?.statusLabel || t("dashboard.live_map.status_unknown")}
                </span>
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("dashboard.live_map.labels.speed")}
                </span>
                <span className="admin-map-panel__value">
                  {activePoint ? activePoint.speedKmph.toFixed(1) : placeholderDash}{" "}
                  {t("dashboard.live_map.units.kmh")}
                </span>
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("common.total")} {t("admin.vehicle_tracking.labels.distance")}
                </span>
                <span className="admin-map-panel__value">
                  {totalDistanceKm === null
                    ? placeholderDash
                    : `${totalDistanceKm.toFixed(2)} km`}
                </span>
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("dashboard.live_map.labels.coordinates")}
                </span>
                <span className="admin-map-panel__value">
                  {activePoint
                    ? `${activePoint.lat.toFixed(5)}, ${activePoint.lng.toFixed(5)}`
                    : placeholderDash}
                </span>
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("dashboard.live_map.labels.location")}
                </span>
                <span className="admin-map-panel__value">
                  {activePoint?.address || t("common.location_unavailable")}
                </span>
              </div>
              <div className="admin-map-panel__row">
                <span className="admin-map-panel__label">
                  {t("dashboard.live_map.labels.last_updated")}
                </span>
                <span className="admin-map-panel__value">{activeTimestamp}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="vh-playback floating">
        <button onClick={() => setIsPlaying((p) => !p)} disabled={!track.length}>
          {isPlaying ? t("admin.vehicle_history.pause") : t("admin.vehicle_history.play")}
        </button>

        {/* SPEED BUTTONS — 2x / 4x / 8x */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setPlaybackSpeed(2)}
            style={{
              background: playbackSpeed === 2 ? "#059669" : "#1d4ed8",
              padding: "8px 12px",
              borderRadius: "12px",
            }}
          >
            2x
          </button>

          <button
            onClick={() => setPlaybackSpeed(4)}
            style={{
              background: playbackSpeed === 4 ? "#059669" : "#1d4ed8",
              padding: "8px 12px",
              borderRadius: "12px",
            }}
          >
            4x
          </button>

          <button
            onClick={() => setPlaybackSpeed(8)}
            style={{
              background: playbackSpeed === 8 ? "#059669" : "#1d4ed8",
              padding: "8px 12px",
              borderRadius: "12px",
            }}
          >
            8x
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(track.length - 1, 0)}
          value={playbackIndex}
          onChange={(e) => setPlaybackIndex(Number(e.target.value))}
          disabled={!track.length}
        />
      </div>

      {historyError && <div className="vh-error">{t(historyError)}</div>}
    </div>
  );
}
