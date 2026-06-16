import type { LucideIcon } from "lucide-react";

export type SummaryFilter = "none" | "priority_high" | "in_progress";
export type SummaryTab = "all" | "new" | "open" | "resolved";

export type SummaryCard = {
  label: string;
  value: number;
  subtext: string;
  gradient: string;
  border: string;
  iconColor: string;
  iconBg: string;
  Icon: LucideIcon;
  tab: SummaryTab;
  filter: SummaryFilter;
};

