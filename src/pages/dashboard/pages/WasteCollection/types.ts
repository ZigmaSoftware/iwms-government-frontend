export type ApiWasteRow = {
  date?: string;
  dry_weight?: number;
  wet_weight?: number;
  mix_weight?: number;
  total_net_weight?: number;
  no_of_household?: number;
};

export type VehicleCollectionSummary = {
  vehicle: string;
  trips: number;
  wet: number;
  dry: number;
  mixed: number;
  total: number;
};

export type VehicleDialogRange = {
  fromDate: string;
  toDate: string;
  label: string;
  zone?: string | null;
};

export type MonthlyVehicleDialogRange = {
  fromDate: string;
  toDate: string;
  label: string;
  monthKey: string;
};

export type MonthlyDailyDialogRange = {
  fromDate: string;
  toDate: string;
  label: string;
  monthKey: string;
};

export type DailyRow = {
  date: string;
  zone: string;
  wet: number;
  dry: number;
  mix: number;
  total: number;
  target: number;
  households: number;
};

export type MonthlyStat = {
  monthKey: string;
  wet: number;
  dry: number;
  mix: number;
  total: number;
  avgDaily: number;
};

export type MonthlyFilterMode = "all" | "selected";

