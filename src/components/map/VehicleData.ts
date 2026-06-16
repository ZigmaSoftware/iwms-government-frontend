// types/VehicleData.ts

export type VehicleStatus =
  | "Active"
  | "Idle"
  | "Running"
  | "Stopped"
  | "Overspeeding"
  | "Completed";

export interface VehicleData {
  vehicle_no: string;
  driver: string;
  lat: number;
  lng: number;
  speed: number;
  status: VehicleStatus;
  geo: {
    continent: string;
    country: string;
    state: string;
    district: string;
    zone: string;
    ward: string;
  };
}
