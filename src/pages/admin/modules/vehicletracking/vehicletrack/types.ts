export type Status = "Running" | "Idle" | "Parked" | "No Data";

export type RawRecord = Record<string, unknown>;

export type PanelStatusKey = "running" | "idle" | "stopped" | "no_data";

export type Vehicle = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  speed: number;
  ignition: "ON" | "OFF" | "NA";
  status: Status;
  distance: number;
  updatedAt: string;
  driver?: string;
  location?: string;
};

export type PanelVehicle = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  statusKey: PanelStatusKey;
  statusLabel: string;
  speed: number;
  lastUpdate: string;
  driver?: string;
  location?: string;
};

export type VehicleMetrics = {
  loading: boolean;
  totalWeightTodayTons: number | null;
  totalDistanceTodayKm: number | null;
  totalDistanceMonthKm: number | null;
  totalTripsToday: number | null;
  dryWeightTodayTons: number | null;
  wetWeightTodayTons: number | null;
  mixWeightTodayTons: number | null;
  reportDateKey: string | null;
};

export type StatusSurface = { bg: string; border: string };
