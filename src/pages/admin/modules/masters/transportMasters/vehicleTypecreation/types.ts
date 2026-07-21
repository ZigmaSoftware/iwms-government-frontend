export type VehicleTypePayload = Record<string, unknown>;

export type VehicleTypeRecord = {
  unique_id: string;
  vehicleType: string;
  description?: string | null;
  is_active: boolean;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};
