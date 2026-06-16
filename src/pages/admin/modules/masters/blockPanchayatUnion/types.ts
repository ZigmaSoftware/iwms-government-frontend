import type { CompanyProjectFields } from "@/types";

export type BlockPanchayatUnionListRecord = CompanyProjectFields & {
  unique_id: string;
  block_name: string;
  state_name?: string;
  district_name?: string;
  is_active: boolean;
};
