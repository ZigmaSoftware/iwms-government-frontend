import type { FilterMatchMode } from "primereact/api";

export type RawVehicle = Record<string, any>;

export type VehicleOption = {
  id: string;
  label: string;
};

export interface HistoryRow {
  startTime: number;
  endTime: number;
  intLoc: string;
  finLoc: string;
  tripDistance: number;
  position: string;
  duration: number;
  [key: string]: unknown;
}

export interface TripData {
  vehicleName?: string;
  startOdo?: number;
  endOdo?: number;
  totalTripLength?: number;
  moveCount?: number;
  parkCount?: number;
  idleCount?: number;
  historyConsilated?: HistoryRow[];
}

export type VisualStatus = "moving" | "parked" | "idle";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  startTime?: { value: string | null; matchMode: FilterMatchMode };
  endTime?: { value: string | null; matchMode: FilterMatchMode };
  intLoc?: { value: string | null; matchMode: FilterMatchMode };
  finLoc?: { value: string | null; matchMode: FilterMatchMode };
  position?: { value: string | null; matchMode: FilterMatchMode };
  duration?: { value: string | null; matchMode: FilterMatchMode };
  tripDistance?: { value: string | null; matchMode: FilterMatchMode };
  vehicleName?: { value: string | null; matchMode: FilterMatchMode };
  startodo?: { value: string | null; matchMode: FilterMatchMode };
  endodo?: { value: string | null; matchMode: FilterMatchMode };
  totalTripLength?: { value: string | null; matchMode: FilterMatchMode };
  moveCount?: { value: string | null; matchMode: FilterMatchMode };
  parkCount?: { value: string | null; matchMode: FilterMatchMode };
  idleCount?: { value: string | null; matchMode: FilterMatchMode };

};
