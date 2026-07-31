import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Map, LatLngTuple } from "leaflet";
import { wardApi } from "@/helpers/admin";

type WardGeofence = {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  district_name?: string;
  local_body_type?: string;
  local_body_name?: string;
};

type WardGeofenceLayerProps = {
  map: Map | null;
  wards: WardGeofence[];
  visible: boolean;
  onWardClick?: (ward: WardGeofence) => void;
};

const DISTRICT_COLORS: Record<string, { fill: string; stroke: string }> = {
  Erode: { fill: "rgba(56, 189, 248, 0.25)", stroke: "#0ea5e9" },
  Coimbatore: { fill: "rgba(34, 197, 94, 0.25)", stroke: "#22c55e" },
  Salem: { fill: "rgba(168, 85, 247, 0.25)", stroke: "#a855f7" },
};

const DEFAULT_STYLE = { fill: "rgba(99, 102, 241, 0.25)", stroke: "#6366f1" };

export function WardGeofenceLayer({
  map,
  wards,
  visible,
  onWardClick,
}: WardGeofenceLayerProps) {
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map);
    }

    const layer = layerRef.current;
    layer.clearLayers();

    if (!visible) return;

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
  }, [map, wards, visible, onWardClick]);

  useEffect(() => {
    if (!layerRef.current || !map) return;
    if (visible) {
      layerRef.current.addTo(map);
    } else {
      map.removeLayer(layerRef.current);
    }
  }, [visible, map]);

  return null;
}

export function useWardGeofences(params: Record<string, string>) {
  const [wards, setWards] = useState<WardGeofence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchWards();
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  return { wards, loading };
}