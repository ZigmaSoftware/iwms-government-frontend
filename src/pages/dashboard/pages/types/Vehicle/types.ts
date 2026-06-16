export type VehicleStatus = "active" | "maintenance" | "inactive";

export type VehicleCard = {
  vehicleId: string;
  registration: string;
  type: string;
  capacity: string;
  status: VehicleStatus;
  driver: string;
  zone: string;
  lastMaintenance: string;
  fuelEfficiency: string;
};

export type VehicleCreationRecord = {
  unique_id: string;
  vehicle_no: string;
  vehicle_type_id?: string | null;
  fuel_type_id?: string | null;
  vehicle_type_name?: string | null;
  fuel_type_name?: string | null;
  capacity?: string | null;
  mileage_per_liter?: string | null;
  service_record?: string | null;
  vehicle_insurance?: string | null;
  insurance_expiry_date?: string | null;
  vehicle_condition?: "NEW" | "SECOND_HAND" | string | null;
  fuel_tank_capacity?: string | null;
  rc_upload?: string | null;
  vehicle_insurance_file?: string | null;
  is_active: boolean;
  driver_name?: string | null;
  driver_mobile?: string | null;
  driver_no?: string | null;
  zone?: string | null;
  zone_name?: string | null;
};

