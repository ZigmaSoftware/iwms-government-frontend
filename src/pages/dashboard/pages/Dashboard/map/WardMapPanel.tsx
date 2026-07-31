import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { useTranslation } from "react-i18next";

import { DEFAULT_CENTER, DEFAULT_WARD_STYLE, DISTRICT_COLORS, initBaseMap } from "./mapUtils";

export type WardGeofence = {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  district_name?: string;
  local_body_type?: string;
  local_body_name?: string;
};

/**
 * Dedicated "Wards" map tab — shows every loaded ward's geofence at once and
 * frames the map to fit them, so the polygons are visible on load instead of
 * requiring the user to manually zoom in from a region-wide view (which is
 * what the Vehicle/Bin/Household tabs' geofence overlay requires, since a
 * ward is only a few hundred meters across).
 */
export function WardMapPanel({
  wards,
  loading = false,
}: {
  wards: WardGeofence[];
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const wardLayerRef = useRef<L.LayerGroup | null>(null);
  const [selectedWard, setSelectedWard] = useState<WardGeofence | null>(null);

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = initBaseMap(mapDivRef.current);
    wardLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resize = () => map.invalidateSize();
    const raf = requestAnimationFrame(resize);
    const timer = setTimeout(resize, 300);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      wardLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = wardLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: LatLngTuple[] = [];

    wards.forEach((ward) => {
      if (!ward.coordinates || ward.coordinates.length < 3) return;

      const latLngs: LatLngTuple[] = ward.coordinates.map((c) => [c.latitude, c.longitude]);
      latLngs.forEach((point) => bounds.push(point));

      const districtName = ward.district_name || "";
      const style = DISTRICT_COLORS[districtName] || DEFAULT_WARD_STYLE;
      const isSelected = ward.id === selectedWard?.id;

      const polygon = L.polygon(latLngs, {
        fillColor: style.fill,
        color: style.stroke,
        weight: isSelected ? 3 : 1.5,
        fillOpacity: isSelected ? 0.55 : 0.35,
        opacity: 0.9,
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
      });

      polygon.on("click", () => setSelectedWard(ward));
      polygon.addTo(layer);
    });

    // Fit the whole set on load / whenever the loaded ward set changes (a geo
    // filter narrows it) — this is the piece the other tabs' toggle lacks,
    // so the polygons are actually visible without manual zooming.
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    else if (bounds.length === 1) map.setView(bounds[0], 15);
    else map.setView(DEFAULT_CENTER, 13);
    // Re-running this whole effect just to restyle the selected polygon
    // would also re-fit the bounds; keep bounds-fitting keyed on the ward set
    // only by leaving `selectedWard` out of the deps below and instead
    // re-running the (cheap) layer redraw through a ref read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wards]);

  // Restyle without re-fitting bounds when the selection changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = wardLayerRef.current;
    if (!map || !layer || !selectedWard) return;
    const match = wards.find((w) => w.id === selectedWard.id);
    if (!match?.coordinates?.length) return;
    const latLngs: LatLngTuple[] = match.coordinates.map((c) => [c.latitude, c.longitude]);
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
  }, [selectedWard, wards]);

  const districtCounts = useMemo(() => {
    const counts = new Map<string, number>();
    wards.forEach((ward) => {
      const key = ward.district_name || "Other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries());
  }, [wards]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200">
      <div ref={mapDivRef} className="absolute inset-0" />

      <div className="absolute left-1/2 top-2 z-[600] -translate-x-1/2">
        <div className="flex max-w-[calc(100vw-32px)] flex-wrap items-center justify-center gap-2 rounded-md border border-white/40 bg-white/80 px-4 py-1 text-[10px] text-slate-700 dark:text-slate-200">
          {loading && (
            <span className="font-semibold text-slate-500">
              {t("dashboard.home.wards_loading")}
            </span>
          )}
          {!loading && districtCounts.length === 0 && (
            <span className="font-semibold text-slate-500">
              {t("dashboard.home.wards_empty")}
            </span>
          )}
          {!loading &&
            districtCounts.map(([district, count]) => {
              const style = DISTRICT_COLORS[district] || DEFAULT_WARD_STYLE;
              return (
                <span
                  key={district}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold"
                  style={{ background: style.fill, color: style.stroke }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: style.stroke }} />
                  {district}
                  <span className="ml-1 text-[11px] font-bold">{count}</span>
                </span>
              );
            })}
        </div>
      </div>

      {selectedWard && (
        <div className="absolute bottom-2 left-2 z-[600] max-w-xs rounded-md border border-white/40 bg-white/95 px-3 py-2 text-xs shadow-lg dark:bg-slate-900/95 dark:text-slate-100">
          <p className="font-bold">{selectedWard.name}</p>
          {selectedWard.local_body_name && (
            <p className="text-slate-500 dark:text-slate-400">
              {selectedWard.local_body_type || "Local Body"}: {selectedWard.local_body_name}
            </p>
          )}
          {selectedWard.district_name && (
            <p className="text-slate-500 dark:text-slate-400">District: {selectedWard.district_name}</p>
          )}
        </div>
      )}
    </div>
  );
}
