import type { FilterMatchMode } from "primereact/api";

export type BaseCollectionScope = "panchayat" | "ward";

export type CollectionRecord = {
  unique_id: string;
  panchayat_id?: string;
  panchayat_name?: string;
  panchayat_total_weight?: string | number;
  ward_id?: string;
  ward_name?: string;
  ward_total_weight?: string | number;
  zone_id?: string;
  zone_name?: string;
  wastetype_name?: string;
  collection_date?: string;
  trip_id?: string;
  company_id?: string;
  company_unique_id?: string;
  company_name?: string;
  project_id?: string;
  project_unique_id?: string;
  project_name?: string;
  point_collection_id?: string | null;
  bin_name?: string;
  collection_point_name?: string;
  latitude?: string | number;
  longitude?: string | number;
};

export type SummaryRow = {
  id: string;
  name: string;
  count: number;
  total_weight: number;
  records: CollectionRecord[];
  zone_name?: string;
  company_names: string[];
  project_names: string[];
  collection_dates: string[];
};

export type CollectionApiResponse = {
  panchayat_collections?: CollectionRecord[];
  ward_collections?: CollectionRecord[];
};

export type Props = {
  scope: BaseCollectionScope;
};

export type ViewLevel = "summary" | "records";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
};
