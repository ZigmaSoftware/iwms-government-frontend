import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707]; // Chennai

// Reverse-geocoded addresses are only trusted (and auto-filled into the form)
// when the GPS fix is at least this precise. Desktop/IP-based fixes report
// accuracy in the thousands of metres and routinely land in the wrong city.
export const TRUSTED_ACCURACY_METERS = 500;

const pinIcon = L.divIcon({
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#0A5C36" stroke="white" stroke-width="1">
    <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  </svg>`,
  className: "drop-shadow-md",
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

type Props = {
  latitude: string;
  longitude: string;
  /** GPS accuracy radius in metres for the last device fix (null = pin was placed manually). */
  accuracy?: number | null;
  onPick: (lat: string, lng: string, address?: string) => void;
};

export default function LocationPicker({ latitude, longitude, accuracy, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const onPickRef = useRef(onPick);
  const accuracyRef = useRef(accuracy);
  const lastAppliedRef = useRef<string>("");
  onPickRef.current = onPick;
  accuracyRef.current = accuracy;

  const clearAccuracyCircle = () => {
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    const coordLabel = `${lat.toFixed(7)},${lng.toFixed(7)}`;
    lastAppliedRef.current = coordLabel;
    onPickRef.current(lat.toFixed(7), lng.toFixed(7));
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      );
      const json = await res.json();
      if (json?.display_name) onPickRef.current(lat.toFixed(7), lng.toFixed(7), json.display_name);
    } catch {
      /* reverse-geocoding is best-effort; lat/lng are already set */
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const hasCoords = Boolean(latitude && longitude);
    const center: [number, number] = hasCoords
      ? [parseFloat(latitude), parseFloat(longitude)]
      : DEFAULT_CENTER;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, hasCoords ? 16 : 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.marker(center, { icon: pinIcon, draggable: true }).addTo(map);
    marker.on("dragend", () => {
      clearAccuracyCircle();
      const pos = marker.getLatLng();
      reverseGeocode(pos.lat, pos.lng);
    });
    map.on("click", (event: L.LeafletMouseEvent) => {
      clearAccuracyCircle();
      marker.setLatLng(event.latlng);
      reverseGeocode(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    if (hasCoords) lastAppliedRef.current = `${center[0].toFixed(7)},${center[1].toFixed(7)}`;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      accuracyCircleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in sync when lat/lng change from outside the map (e.g. "Use My Current Location").
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !latitude || !longitude) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const coordLabel = `${lat.toFixed(7)},${lng.toFixed(7)}`;
    if (coordLabel === lastAppliedRef.current) return;
    lastAppliedRef.current = coordLabel;
    markerRef.current.setLatLng([lat, lng]);

    const fixAccuracy = accuracyRef.current;
    clearAccuracyCircle();
    if (fixAccuracy && fixAccuracy > 30) {
      accuracyCircleRef.current = L.circle([lat, lng], {
        radius: fixAccuracy,
        color: "#0A5C36",
        weight: 1.5,
        fillColor: "#0A5C36",
        fillOpacity: 0.12,
      }).addTo(mapRef.current);
      mapRef.current.fitBounds(accuracyCircleRef.current.getBounds(), { maxZoom: 17, padding: [24, 24] });
    } else {
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16));
    }

    // Only trust the reverse-geocoded address when the fix is genuinely
    // precise - IP-based desktop fixes can be a whole city away.
    if (fixAccuracy != null && fixAccuracy > TRUSTED_ACCURACY_METERS) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.display_name) onPickRef.current(latitude, longitude, json.display_name);
      })
      .catch(() => {
        /* reverse-geocoding is best-effort; lat/lng are already set */
      });
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-2xl border-[1.5px] border-black/15 shadow-inner sm:h-96"
    />
  );
}
