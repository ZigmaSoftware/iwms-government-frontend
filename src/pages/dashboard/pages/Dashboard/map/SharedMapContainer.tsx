import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Map, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

import { DEFAULT_CENTER } from "./mapUtils";
import { wardApi } from "@/helpers/admin";
import { useTranslation } from "react-i18next";

type WardGeofence = {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  district_name?: string;
  local_body_type?: string;
  local_body_name?: string;
};

type SharedMapContainerProps = {
  activeTab: "vehicle" | "bins" | "households";
  params: Record<string, string>;
  showWardGeofences: boolean;
  onWardClick?: (ward: WardGeofence) => void;
  children?: React.ReactNode;
  className?: string;
};

const DISTRICT_COLORS: Record<string, { fill: string; stroke: string }> = {
  Erode: { fill: "rgba(56, 189, 248, 0.25)", stroke: "#0ea5e9" },
  Coimbatore: { fill: "rgba(34, 197, 94, 0.25)", stroke: "#22c55e" },
  Salem: { fill: "rgba(168, 85, 247, 0.25)", stroke: "#a855f7" },
};

const DEFAULT_STYLE = { fill: "rgba(99, 102, 241, 0.25)", stroke: "#6366f1" };

export function SharedMapContainer({
  activeTab,
  params,
  showWardGeofences,
  onWardClick,
  children,
  className = "",
}: SharedMapContainerProps) {
  const { t } = useTranslation();
  const mapRef = useRef<Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const wardLayerRef = useRef<L.LayerGroup | null>(null);
  const [wards, setWards] = useState<WardGeofence[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: false,
    });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    // Create ward geofence layer group
    const wardLayer = L.layerGroup().addTo(map);
    wardLayerRef.current = wardLayer;

    mapRef.current = map;
    setMapReady(true);

    // Invalidate size on resize
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    const raf = requestAnimationFrame(handleResize);
    const timer = setTimeout(handleResize, 300);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      wardLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Fetch wards when params change
  useEffect(() => {
    let cancelled = false;
    const fetchWards = async () => {
      try {
        const config = Object.keys(params).length ? { params } : undefined;
        const response = await wardApi.readAll(config);
        const wardsData = Array.isArray(response) ? response : response?.results ?? [];
        const processed = wardsData
          .filter((w: any) => w.coordinates && Array.isArray(w.coordinates) && w.coordinates.length >= 3)
          .map((w: any) => ({
            id: w.unique_id,
            name: w.ward_name,
            coordinates: w.coordinates,
            district_name: w.district_name,
            local_body_type: w.local_body_type,
            local_body_name: w.local_body_name,
          }));
        if (!cancelled) setWards(processed);
      } catch (e) {
        console.error("Failed to fetch wards for geofences:", e);
        if (!cancelled) setWards([]);
      }
    };
    fetchWards();
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  // Render ward geofences
  useEffect(() => {
    if (!mapRef.current || !wardLayerRef.current || !mapReady) return;
    const layer = wardLayerRef.current;
    layer.clearLayers();

    if (!showWardGeofences) return;

    wards.forEach((ward) => {
      if (!ward.coordinates || ward.coordinates.length < 3) return;

      const latLngs: LatLngTuple[] = ward.coordinates.map((c) => [
        c.latitude,
        c.longitude,
      ]);

      const districtName = ward.district_name || "";
      const style = DISTRICT_COLORS[districtName] || DEFAULT_STYLE;

      const polygon = L.polygon(latLngs, {
        fillColor: style.fill,
        color: style.stroke,
        weight: 1.5,
        fillOpacity: 0.35,
        opacity: 0.8,
        className: "ward-geofence-polygon",
      });

      const tooltipContent = `
        <strong>${ward.name}</strong>
        ${ward.local_body_name ? `<br/>${ward.local_body_type || "Local Body"}: ${ward.local_body_name}` : ""}
        ${ward.district_name ? `<br/>District: ${ward.district_name}` : ""}
      `;

      polygon.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "center",
        className: "ward-geofence-tooltip",
        offset: [0, -10],
      });

      polygon.on("click", () => onWardClick?.(ward));
      polygon.addTo(layer);
    });
  }, [wards, showWardGeofences, mapReady, onWardClick]);

  // Render active panel content
  const renderPanel = () => {
    if (!mapReady) return <div className="h-full flex items-center justify-center text-slate-400">Loading map...</div>;
    
    // The children should be the panel content that uses the map
    return children;
  };

  return (
    <div className={`relative h-full w-full rounded-lg border border-slate-200 dark:border-[#28425f] ${className}`}>
      <div ref={mapDivRef} className="absolute inset-0" style={{ zIndex: 1 }} />
      <div className="relative h-full w-full" style={{ zIndex: 2 }}>
        {renderPanel()}
      </div>
    </div>
  );
}