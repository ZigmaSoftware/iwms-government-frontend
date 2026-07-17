import type { FilterMatchMode } from "primereact/api";

export interface ChangePasswordModalProps {
  targetType: "staff" | "customer";
  targetId: string;
  onClose: () => void;
  onSuccess: (newPasswordCrtDate: string) => void;
}

export type Section = "official" | "personal";

export type LocationOption = {
  value: string;
  label: string;
  uniqueId?: string;
  countryId?: string;
  countryName?: string;
  stateId?: string;
  stateName?: string;
  districtId?: string;
  districtName?: string;
};

export type ErrorWithResponse = {
  response?: {
    data?: unknown;
  };
};

export type Staff = {
  unique_id: number;
  employee_name: string;
  staff_unique_id: string;
  qr_code?: string | null;
  designation?: string;
  doj?: string;
  active_status: boolean;
  contact_mobile?: number;
  department?: string;
  user_type_name?: string;
  governmentusertype_name?: string;
  [key: string]: unknown;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  employee_name: { value: string | null; matchMode: FilterMatchMode };
  designation: { value: string | null; matchMode: FilterMatchMode };
  doj: { value: string | null; matchMode: FilterMatchMode };
};
