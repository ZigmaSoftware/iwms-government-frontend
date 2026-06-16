import type { LatLngTuple } from "leaflet";
import type { GeofenceSite } from "@/types/geofence";

export function parsePolygonLatLng(latlong: string[]): LatLngTuple[] {
  return latlong
    .map((point) => {
      const [lat, lng] = point.split(",").map(Number);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      return [lat, lng] as LatLngTuple;
    })
    .filter(Boolean) as LatLngTuple[];
}

export function extractPolygonGeofences(sites: GeofenceSite[]) {
  return sites
    .filter((site) => site.type === "Polygon" && site.latlong?.length)
    .map((site) => ({
      name: site.siteName,
      coordinates: parsePolygonLatLng(site.latlong),
    }));
}
