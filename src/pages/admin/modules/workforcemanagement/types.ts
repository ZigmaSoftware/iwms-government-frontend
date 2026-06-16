import type { WasteApiRow } from "@/utils/wasteApi";

export type ApiRow = WasteApiRow & {
  Ticket_No?: string;
  Vehicle_No?: string;
  Start_Time: string | null;
  End_Time?: string | null;
  total_trip: number;
  dry_weight: number;
  wet_weight: number;
  mix_weight: number;
  total_net_weight: number;
  average_weight_per_trip: number;
};
