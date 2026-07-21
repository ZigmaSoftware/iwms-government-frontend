export type FuelPayload = Record<string, unknown>;

export type Fuel = {
  unique_id: string;
  fuel_type: string;
  description: string;
  is_active: boolean;
  company_id?: string | null;
  company_unique_id?: string | null;
  company_name?: string | null;
  project_id?: string | null;
  project_unique_id?: string | null;
  project_name?: string | null;
};
