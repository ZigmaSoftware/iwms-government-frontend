import type { FilterMatchMode } from "primereact/api";

import type { FormEvent } from "react";

export type SelectOption = { value: string; label: string };

export type VehicleTripAuditPayload = {
  daily_trip_assignment_id?: string;
  vehicle_id?: string;
  gps_lat?: number[];
  gps_lon?: number[];
  avg_speed?: number;
  idle_seconds?: number;
  captured_at?: string;
};

export type VehicleTripAuditFormState = {
  daily_trip_assignment_id: string;
  vehicle_id: string;
  gps_lat: string;
  gps_lon: string;
  avg_speed: string;
  idle_seconds: string;
  captured_at: string;
};

export type VehicleTripAuditEditorProps = {
  formData: VehicleTripAuditFormState;
  tripOptions: SelectOption[];
  vehicles: SelectOption[];
  fetching: boolean;
  isEdit: boolean;
  isSubmitting: boolean;
  isVehicleLocked: boolean;
  onChange: (updates: Partial<VehicleTripAuditFormState>) => void;
  onCancel: () => void;
  onSubmit: (e: FormEvent) => Promise<void>;
};

export type VehicleTripAuditRecord = {
  id: number;
  daily_trip_assignment_id: string;
  vehicle_id: string;
  gps_lat: number[];
  gps_lon: number[];
  avg_speed: number;
  idle_seconds: number;
  captured_at: string;
  created_at?: string | null;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  daily_trip_assignment_id: { value: string | null; matchMode: FilterMatchMode };
  vehicle_id: { value: string | null; matchMode: FilterMatchMode };
};

export type DailyTripAssignmentRecord = {
  unique_id: string;
  trip_no?: string;
  vehicle_id?: string;
  status?: string;
};
