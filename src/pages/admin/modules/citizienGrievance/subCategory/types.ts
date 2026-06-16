import type { FilterMatchMode } from "primereact/api";

export type MainCategoryRecord = {
  unique_id: string | number;
  main_categoryName: string;
  is_active: boolean;
  company_id?: string | null;
};

export type SubCategoryPayload = {
  name?: string;
  is_active: boolean;
  mainCategory?: string | number;
  company_id?: string;
};

export type SubCategoryEditorProps = {
  initialPayload: {
    name: string;
    mainCategory: string;
    is_active: boolean;
    company_id?: string;
  };
  mainList: MainCategoryRecord[];
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: SubCategoryPayload) => Promise<void>;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  name: { value: string | null; matchMode: FilterMatchMode };
  mainCategory_name: { value: string | null; matchMode: FilterMatchMode };
};

export type SubCategoryRecord = {
  unique_id: string | number;
  name?: string;
  mainCategory?: string | number;
  mainCategory_name?: string;
  is_active: boolean;
  [key: string]: unknown;
};
