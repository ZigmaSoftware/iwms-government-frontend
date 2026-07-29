import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapTabKey = "vehicle" | "bins" | "households" | "wards";

export type HouseholdStatus = "collected" | "not_collected";

export type HouseholdPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: HouseholdStatus;
  ward: string;
};

export const MAP_TABS: { key: MapTabKey; labelKey: string; summaryKey: string }[] = [
  {
    key: "vehicle",
    labelKey: "dashboard.home.map_tabs.vehicle",
    summaryKey: "dashboard.home.map_summaries.vehicle",
  },
  {
    key: "bins",
    labelKey: "dashboard.home.map_tabs.bins",
    summaryKey: "dashboard.home.map_summaries.bins",
  },
  {
    key: "households",
    labelKey: "dashboard.home.map_tabs.households",
    summaryKey: "dashboard.home.map_summaries.households",
  },
  {
    key: "wards",
    labelKey: "dashboard.home.map_tabs.wards",
    summaryKey: "dashboard.home.map_summaries.wards",
  },
];

// Ward-geofence polygon styling, shared by every map panel that can draw
// wards (WardMapPanel, and the ward-geofence overlay on Vehicle/Bin/Household
// panels) — one place to add a district's color instead of four.
export const DISTRICT_COLORS: Record<string, { fill: string; stroke: string }> = {
  Erode: { fill: "rgba(56, 189, 248, 0.25)", stroke: "#0ea5e9" },
  Coimbatore: { fill: "rgba(34, 197, 94, 0.25)", stroke: "#22c55e" },
  Salem: { fill: "rgba(168, 85, 247, 0.25)", stroke: "#a855f7" },
};

export const DEFAULT_WARD_STYLE = { fill: "rgba(99, 102, 241, 0.25)", stroke: "#6366f1" };

export const HOUSEHOLD_POINTS: HouseholdPoint[] = [
  { id: "HH-210", name: "House 210", lat: 11.0176, lng: 76.9561, status: "collected", ward: "Ward 23" },
  { id: "HH-214", name: "House 214", lat: 11.0203, lng: 76.9598, status: "not_collected", ward: "Ward 23" },
  { id: "HH-218", name: "House 218", lat: 11.0221, lng: 76.9655, status: "not_collected", ward: "Ward 23" },
  { id: "HH-302", name: "House 302", lat: 11.0132, lng: 76.9492, status: "collected", ward: "Ward 45" },
  { id: "HH-307", name: "House 307", lat: 11.0101, lng: 76.9526, status: "not_collected", ward: "Ward 45" },
  { id: "HH-311", name: "House 311", lat: 11.0085, lng: 76.9579, status: "not_collected", ward: "Ward 45" },
  { id: "HH-319", name: "House 319", lat: 11.0264, lng: 76.9532, status: "collected", ward: "Ward 12" },
  { id: "HH-325", name: "House 325", lat: 11.0282, lng: 76.9608, status: "not_collected", ward: "Ward 12" },
  { id: "HH-331", name: "House 331", lat: 11.0301, lng: 76.9669, status: "not_collected", ward: "Ward 12" },
  { id: "HH-408", name: "House 408", lat: 11.0062, lng: 76.9624, status: "collected", ward: "Ward 31" },
  { id: "HH-412", name: "House 412", lat: 11.0039, lng: 76.9672, status: "not_collected", ward: "Ward 31" },
  { id: "HH-415", name: "House 415", lat: 11.0018, lng: 76.9715, status: "not_collected", ward: "Ward 31" },
];

export const HOUSEHOLD_STATUS_META: Record<
  HouseholdStatus,
  { labelKey: string; color: string; bg: string }
> = {
  collected: { labelKey: "common.collected", color: "#15803d", bg: "rgba(34,197,94,0.18)" },
  not_collected: { labelKey: "common.not_collected", color: "#b91c1c", bg: "rgba(239,68,68,0.2)" },
};

export const DEFAULT_CENTER: LatLngTuple = [11.0168, 76.9572];

export const spreadPositions = (
  count: number,
  center: LatLngTuple = DEFAULT_CENTER,
  padding = 0.002
): LatLngTuple[] => {
  if (count <= 0) return [];
  const spread = count > 1 ? (padding * (count - 1)) / 2 : 0;
  return Array.from({ length: count }, (_, i) => [
    center[0] - spread + i * padding,
    center[1] - spread + i * padding,
  ] as LatLngTuple);
};

export const createBinIcon = (status: HouseholdStatus, isFocused = false) => {
  const meta = HOUSEHOLD_STATUS_META[status];
  const size = isFocused ? 40 : 34;
  const shadow = isFocused
    ? "0 0 0 4px rgba(255,255,255,0.9), 0 8px 18px rgba(0,0,0,.3)"
    : "0 6px 14px rgba(0,0,0,.25)";
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
          background:${meta.color};
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:${shadow};
          border:2px solid #fff;
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="width:18px;height:18px;"
        >
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
          <path d="M3 6h18"></path>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </div>
    `,
  });
};

export const createHouseIcon = (status: HouseholdStatus, isFocused = false) => {
  const meta = HOUSEHOLD_STATUS_META[status];
  const size = isFocused ? 38 : 32;
  const shadow = isFocused
    ? "0 0 0 4px rgba(255,255,255,0.9), 0 8px 16px rgba(0,0,0,.3)"
    : "0 6px 12px rgba(0,0,0,.22)";
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
          border-radius:10px;
          background:${meta.color};
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:${shadow};
          border:2px solid #fff;
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="width:16px;height:16px;"
        >
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        </svg>
      </div>
    `,
  });
};

export const initBaseMap = (container: HTMLDivElement) => {
  const map = L.map(container, {
    center: DEFAULT_CENTER,
    zoom: 13,
    zoomControl: false,
  });
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);
  return map;
};
