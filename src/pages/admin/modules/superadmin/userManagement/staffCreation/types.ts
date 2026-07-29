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
  unique_id: string | number;
  emp_id?: string | null;
  employee_name: string;
  staff_unique_id: string;
  qr_code?: string | null;
  photo?: string | null;
  attendance_reg_image?: string | null;
  staff_config_name?: string | null;
  doj?: string;
  active_status: boolean;
  contact_mobile?: number;
  user_type_name?: string;
  governmentusertype_name?: string;
  staff_type_name?: string;
  government_staff_type_name?: string;
  governmentusertype_level?: string | null;
  username?: string | null;
  login_enabled?: boolean;
  office_email?: string | null;
  contact_email?: string | null;
  marital_status?: string | null;
  dob?: string | null;
  age?: string | number | null;
  blood_group?: string | null;
  gender?: string | null;
  physically_challenged?: string | boolean | null;
  staff_head?: string | null;
  state_name?: string | null;
  district_name?: string | null;
  area_type_name?: string | null;
  local_body_name?: string | null;
  corporation_name?: string | null;
  municipality_name?: string | null;
  town_panchayat_name?: string | null;
  panchayat_union_name?: string | null;
  panchayat_name?: string | null;
  driving_licence_no?: string | null;
  driving_licence_expiry_date?: string | null;
  driving_licence_file?: string | null;
  driving_experience_years?: string | number | null;
  present_address?: StaffAddress | null;
  permanent_address?: StaffAddress | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
  [key: string]: unknown;
};

export type StaffAddress = {
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  building_no?: string | null;
  street?: string | null;
  area?: string | null;
  pincode?: string | null;
};

export type TableFilters = {
  global: { value: string | null; matchMode: FilterMatchMode };
  employee_name: { value: string | null; matchMode: FilterMatchMode };
  doj: { value: string | null; matchMode: FilterMatchMode };
};
