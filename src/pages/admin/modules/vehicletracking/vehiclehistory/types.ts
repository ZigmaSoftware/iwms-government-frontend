export type RawRecord = Record<string, any>;

export type StatusKey = "running" | "idle" | "stopped" | "no_data";

export type VehicleOption = {
  id: string;
  label: string;
  status: StatusKey;
  lat: number;
  lng: number;
};

export type TrackPoint = {
  lat: number;
  lng: number;
  speedKmph: number;
  statusKey: StatusKey;
  statusLabel: string;
  address: string;
  timestamp: string;
};

export type HistoryPopupLabels = {
  title: string;
  status: string;
  speed: string;
  unit: string;
};
