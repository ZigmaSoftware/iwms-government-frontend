export type PropertyPayload = {
  property_name?: string;
  is_active?: boolean;
  [key: string]: unknown;
};

export type PropertyRecord = {
  unique_id: string | number;
  property_name: string;
  is_active: boolean;
  company_id?: string | number | null;
  company_unique_id?: string | number | null;
  project_id?: string | number | null;
  project_unique_id?: string | number | null;
  company_name?: string | null;
  project_name?: string | null;
  [key: string]: unknown;
};

export type PropertyEditorProps = {
  initialPayload: PropertyPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: PropertyPayload) => Promise<void>;
};
