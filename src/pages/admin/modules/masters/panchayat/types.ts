import type { CompanyProjectFields } from "@/types";

export type LoginProfile = {
  role?: string;
  company_name?: string;
  company?: {
    name?: string;
  };
};

export type GeoCoordinate = {
  latitude?: string | number | null;
  longitude?: string | number | null;
};

export type PanchayatListRecord = CompanyProjectFields & {
  unique_id: string;
  panchayat_name: string;
  state_name?: string;
  district_name?: string;
  city_name?: string;
  agreed_weight_kg?: string | number | null;
  weight_unit?: "kg" | "tonne" | string | null;
  effective_from?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  geofencing_type?: string | null;
  coordinates?: GeoCoordinate[] | null;
  is_active: boolean;
};
