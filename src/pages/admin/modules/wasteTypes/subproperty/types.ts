export type SubPropertyPayload = {
  sub_property_name?: string;
  property_id?: string | number | null;
  is_active?: boolean;
  [key: string]: unknown;
};

export type SubPropertyRecord = {
  unique_id: string | number;
  sub_property_name: string;
  property_id?: string | number | null;
  property?: unknown;
  property_name?: string | null;
  is_active: boolean;
  [key: string]: unknown;
};

export type SubPropertyOptionRecord = {
  unique_id: string | number;
  property_name: string;
  is_active: boolean;
};

export type SubPropertyEditorProps = {
  initialPayload: SubPropertyPayload;
  properties: SubPropertyOptionRecord[];
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: SubPropertyPayload) => Promise<void>;
};
