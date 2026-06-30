import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPin = {
  lat: number;
  lng: number;
  label?: string;
};

type Props = {
  pin: MapPin | null;
  height?: number;
  zoom?: number;
};

/**
 * A tiny read-only Leaflet map that drops a single pin for a hierarchy node's
 * coordinates. Uses raw Leaflet (no react-leaflet dep) to match the rest of
 * the app. Renders a placeholder when the node has no coordinates.
 */
export default function NodeMiniMap({ pin, height = 220, zoom = 11 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([20.5937, 78.9629], 4); // default: India
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Move/drop the pin when it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (pin) {
      const m = L.marker([pin.lat, pin.lng]);
      if (pin.label) m.bindPopup(pin.label);
      m.addTo(map);
      markerRef.current = m;
      map.setView([pin.lat, pin.lng], zoom);
    } else {
      map.setView([20.5937, 78.9629], 4);
    }
    // Leaflet needs a nudge when its container becomes visible/resized.
    setTimeout(() => map.invalidateSize(), 50);
  }, [pin, zoom]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <div ref={containerRef} style={{ height }} />
      {!pin && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 text-xs text-gray-500 dark:bg-black/40">
          No coordinates for this node.
        </div>
      )}
    </div>
  );
}
