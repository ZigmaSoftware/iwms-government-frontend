import type { CompanyProjectFields } from "@/types";

export type MunicipalityListRecord = CompanyProjectFields & {
  unique_id: string;
  municipality_name: string;
  state_name?: string;
  district_name?: string;
  is_active: boolean;
};
