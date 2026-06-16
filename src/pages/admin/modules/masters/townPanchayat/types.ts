import type { CompanyProjectFields } from "@/types";

export type TownPanchayatListRecord = CompanyProjectFields & {
  unique_id: string;
  town_panchayat_name: string;
  state_name?: string;
  district_name?: string;
  is_active: boolean;
};
