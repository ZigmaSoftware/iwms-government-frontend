import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapFilters } from "./MapFilters";
import type { MapFilterState } from "./MapFilters";
import type { VehicleData } from "./VehicleData";

type Household = {
  lat: number;
  lng: number;
  zone: string;
  ward: string;
  collected?: boolean;
};

export default function MapWithVehiclesAndHouseholds() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);

  const [filters, setFilters] = useState<MapFilterState>({
    country: "India",
    state: "Tamil Nadu",
    district: "Coimbatore",
    zone: "All Zones",
    ward: "All Wards",
    vehicle_no: "All Vehicles",
  });

  const [filteredVehicles, setFilteredVehicles] = useState<VehicleData[]>([]);
  const [filteredHouseholds, setFilteredHouseholds] = useState<Household[]>(
    [],
  );

  useEffect(() => {
    fetch("/vehicles.json").then((r) => r.json()).then(setVehicles);
    fetch("/households.json").then((r) => r.json()).then(setHouseholds);
  }, []);

  // Extract dynamic options
  const zones = [...new Set(vehicles.map((v) => v.geo.zone))];
  const wards = [...new Set(vehicles.map((v) => v.geo.ward))];
  const vehicleNos = vehicles.map((v) => v.vehicle_no);

  // Search button → apply filters
  const applyFilters = () => {
    setFilteredVehicles(
      vehicles.filter((v) => {
        if (!v.geo) return false;

        return (
          v.geo.country === filters.country &&
          v.geo.state === filters.state &&
          v.geo.district === filters.district &&
          (filters.zone === "All Zones" || v.geo.zone === filters.zone) &&
          (filters.ward === "All Wards" || v.geo.ward === filters.ward) &&
          (filters.vehicle_no === "All Vehicles" ||
            v.vehicle_no === filters.vehicle_no)
        );
      })
    );

    setFilteredHouseholds(
      households.filter((h) => {
        return (
          (filters.zone === "All Zones" || h.zone === filters.zone) &&
          (filters.ward === "All Wards" || h.ward === filters.ward)
        );
      })
    );
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(
      [11.0168, 76.9558],
      12
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;
  }, []);

  // Draw markers
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    map.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const bounds: L.LatLngTuple[] = [];

    filteredVehicles.forEach((v) => {
      const icon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:#0066FF;border-radius:50%;border:2px solid white;"></div>`,
      });
      L.marker([v.lat, v.lng], { icon }).addTo(map);
      bounds.push([v.lat, v.lng]);
    });

    filteredHouseholds.forEach((h) => {
      const color = h.collected ? "green" : "red";
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;"></div>`,
      });
      L.marker([h.lat, h.lng], { icon }).addTo(map);
      bounds.push([h.lat, h.lng]);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
  }, [filteredVehicles, filteredHouseholds]);

  return (
    <>
      <MapFilters
        filters={filters}
        onChange={setFilters}
        zones={zones}
        wards={wards}
        vehicles={vehicleNos}
        onSearch={applyFilters}
      />

      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "90vh",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      />
    </>
  );
}
