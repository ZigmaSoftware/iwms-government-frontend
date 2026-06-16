import { Filter, Search } from "lucide-react";
import { DataCard } from "../ui/DataCard";

export type MapFilterState = {
  country: string;
  state: string;
  district: string;
  zone: string;
  ward: string;
  vehicle_no: string;
};

interface MapFiltersProps {
  filters: MapFilterState;
  onChange: (next: MapFilterState) => void;
  zones: string[];
  wards: string[];
  vehicles: string[];
  onSearch: () => void;
  
}

export function MapFilters({
  filters,
  onChange,
  zones,
  wards,
  vehicles,
  onSearch,
}: MapFiltersProps) {
  return (
    <DataCard compact className="mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />

        {/* Country
        <select
          value={filters.country}
          onChange={(e) => onChange({ ...filters, country: e.target.value })}
          className="text-xs border px-2 py-1 rounded"
        >
          <option>India</option>
        </select> */}

        {/* State */}
        {/* <select
          value={filters.state}
          onChange={(e) => onChange({ ...filters, state: e.target.value })}
          className="text-xs border px-2 py-1 rounded"
        >
          <option>Tamil Nadu</option>
        </select> */}

        {/* District */}
        <select
          value={filters.district}
          onChange={(e) => onChange({ ...filters, district: e.target.value })}
          className="text-xs border px-2 py-1 rounded"
        >
          <option>Coimbatore</option>
        </select>

        {/* Zone */}
        <select
          value={filters.zone}
          onChange={(e) => onChange({ ...filters, zone: e.target.value })}
          className="text-xs border px-2 py-1 rounded"
        >
          {zones.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>

        {/* Ward */}
        <select
          value={filters.ward}
          onChange={(e) => onChange({ ...filters, ward: e.target.value })}
          className="text-xs border px-2 py-1 rounded"
        >
          {wards.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>

        {/* Vehicle Number */}
        <select
          value={filters.vehicle_no}
          onChange={(e) => onChange({ ...filters, vehicle_no: e.target.value })}
          className="text-xs border px-2 py-1 rounded"
        >
          <option value="">All Vehicles</option>
          {vehicles.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>

        {/* Search Button */}
        <button
          onClick={onSearch}
          className="bg-blue-600 text-white text-xs px-3 py-1 rounded flex items-center gap-1"
        >
          <Search size={14} /> Search
        </button>
      </div>
    </DataCard>
  );
}
