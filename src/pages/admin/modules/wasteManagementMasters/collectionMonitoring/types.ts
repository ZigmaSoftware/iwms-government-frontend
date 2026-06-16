import type { CustomerRecord as CustomerRecordBase } from "@/utils/customerUtils";

export interface Vehicle {
  id: string;
  number: string;
  lat: number;
  lon: number;
  status: "Running" | "Idle" | "Parked" | "No Data";
  speed: number;
  ignition: boolean;
  location: string;
  distance: number;
  updatedAt: string;
}

export type VehicleStatus = Vehicle["status"];

export type CustomerRecord = CustomerRecordBase & {
  customer_name?: string;
  zone_name?: string;
  ward_name?: string;
  latitude?: string;
  longitude?: string;
  lat?: string | number;
  lng?: string | number;
  latitude_value?: string | number;
  longitude_value?: string | number;
  building_no?: string;
  street?: string;
  area?: string;
};

export interface CustomerLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  zone?: string;
  ward?: string;
}
