import type { FilterMatchMode } from "primereact/api";

export type MainCategoryPayload = {
  main_categoryName?: string;
  is_active: boolean;
  company_id?: string;
};

export type MainCategoryEditorProps = {
  initialPayload: MainCategoryPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: MainCategoryPayload) => Promise<void>;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  main_categoryName: { value: string | null; matchMode: FilterMatchMode };
};

export type MainCategoryRecord = {
  unique_id: string | number;
  main_categoryName?: string;
  is_active: boolean;
  [key: string]: unknown;
};
