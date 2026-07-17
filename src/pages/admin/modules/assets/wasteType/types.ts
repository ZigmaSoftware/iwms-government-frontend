import type { CompanyProjectFields } from "@/types";

export type WasteTypeListRecord = CompanyProjectFields & {
  unique_id: string;
  waste_type_name?: string;
  is_active: boolean;
  default_team?: string | null;
  default_team_name?: string | null;
  default_priority?: string | null;
  default_priority_code?: string | null;
  assign_within_minutes?: number | null;
  resolve_within_minutes?: number | null;
  working_hours_only?: boolean;
};
