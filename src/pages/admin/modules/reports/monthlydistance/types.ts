export type RawVehicle = Record<string, any>;

export type VehicleOption = { id: string; label: string };

export type HistoryRow = {
  startTime?: number | string;
  endTime?: number | string;
  tripDistance?: number | string;
};

export type VehicleDistanceRow = {
  vehicleId: string;
  vehicleName: string;
  distances: Record<string, number>;
  total: number;
};
