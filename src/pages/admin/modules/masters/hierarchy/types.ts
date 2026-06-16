export type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

export type HierarchyPayload = Record<string, unknown>;

export type HierarchyRecord = {
  unique_id?: string | number;
  level_name?: string;
  area_type?: string | number | null;
  area_type_id?: string | number | null;
  is_active?: boolean;
  company_id?: string | number | null;
  company_unique_id?: string | number | null;
  project_id?: string | number | null;
  project_unique_id?: string | number | null;
};
