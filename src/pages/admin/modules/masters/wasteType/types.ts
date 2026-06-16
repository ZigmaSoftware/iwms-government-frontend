import type { CompanyProjectFields } from "@/types";

export type WasteTypeListRecord = CompanyProjectFields & {
  unique_id: string;
  waste_type_name?: string;
  is_active: boolean;
};
