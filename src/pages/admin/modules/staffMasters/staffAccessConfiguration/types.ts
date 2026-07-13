export type BasicInfoForm = {
  employeeName: string;
  mobileNumber: string;
  officeEmail: string;
  departmentId: string;
  designationId: string;
  doj: string;
  activeStatus: boolean;
};

export type LoginConfigForm = {
  username: string;
  password: string;
  confirmPassword: string;
  userTypeId: string;
  governmentUserTypeId: string;
  loginEnabled: boolean;
};

export type ScreenPermission = {
  userScreenId: string;
  userScreenName?: string;
  enabled: boolean;
  actions: Record<string, boolean>;
};

export type UserActionOption = {
  value: string;
  label: string;
};

export type ModulePermission = {
  mainScreenId: string;
  mainScreenName: string;
  enabled: boolean;
  screens: ScreenPermission[];
};

export type DashboardWidget = {
  widgetName: string;
  isEnabled: boolean;
  orderNo: number;
};

export type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";

export type AreaTypeCategory = "urban" | "rural";

export type DataScopeForm = {
  stateId: string | null;
  districtId: string | null;
  areaTypeId: string | null;
  areaTypeCategory: AreaTypeCategory | null;
  localBodyLevel: LocalBodyLevel | null;
  localBodyId: string | null;
  depotId: string | null;
  vehicleId: string | null;
};

export type StaffAccessConfigPayload = {
  basicInfo: BasicInfoForm;
  loginConfig: LoginConfigForm;
  permissions: ModulePermission[];
  dashboardPermissions: DashboardWidget[];
  dataScope: DataScopeForm;
};

export type StaffAccessConfigPreviewResponse = {
  valid: boolean;
  summary: {
    staffName: string;
    username: string;
    roleLabel: string;
    permissionCount: number;
    scopeLabel: string;
  };
  errors?: Record<string, string>;
};
