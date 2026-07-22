export type ContinentPayload = {
  name: string;
  is_active: boolean;
  [key: string]: unknown;
};

export type ContinentRecord = {
  unique_id: string | number;
  name: string;
  is_active: boolean;
  [key: string]: unknown;
};

export type ContinentEditorProps = {
  initialPayload: ContinentPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: ContinentPayload) => Promise<void>;
};

import type { FilterMatchMode } from "primereact/api";

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  name: { value: string | null; matchMode: FilterMatchMode };
};
