/* ===========================================================
   CORE BASE TYPES
=========================================================== */
export interface BaseEntity {
  unique_id: string;
  is_active: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/* ===========================================================
   MAIN SCREEN TYPES (Top-Level Menu)
=========================================================== */
export interface MainScreenType extends BaseEntity {
  type_name: string;
  company_id?: string;
  project_id?: string;
  company_name?: string;
  project_name?: string;
}

export interface MainScreen extends BaseEntity {
  mainscreentype_id: string;
  mainscreentype_name?: string;
  company_id?: string;
  company_name?: string;
  project_id?: string;
  project_name?: string;

  mainscreen_name: string;
  icon_name: string;
  order_no: number;
  description: string;
}

/* ===========================================================
   USER SCREENS (Second-Level Menu)
=========================================================== */
export interface UserScreen extends BaseEntity {
  mainscreen_id: string;
  company_id?: string;
  company_name?: string;
  project_id?: string;
  project_name?: string;

  mainscreen_name?: string;
  userscreen_name: string;
  folder_name: string;
  icon_name: string;
  order_no: number;
}

/* ===========================================================
   USER SCREEN ACTIONS (CRUD BUTTON ACCESS)
=========================================================== */
export interface UserScreenAction extends BaseEntity {
  company_id?: string;
  company_name?: string;
  project_id?: string;
  project_name?: string;
  action_name: string;
  variable_name: string;
}

/* ===========================================================
   USER TYPES (HR ROLE DEFINITION)
=========================================================== */
export interface UserType extends BaseEntity {
  name: string;
  [key: string]: any;
}

/* ===========================================================
   PERMISSION STRUCTURE (Flattened Access Map)
=========================================================== */
export interface PermissionScreen {
  screen: string;
  action: string;
  order: number;
}

/* ===========================================================
   STAFF USER TYPE (Role → Permissions)
=========================================================== */
export interface StaffUserType extends BaseEntity {
  name: string;
  usertype_id?: string | null;

  staffusertype_name?: string;
  mainscreen_id?: string | null;

  screens?: PermissionScreen[];

  [key: string]: any;
}

/* ===========================================================
   GROUPED MAP FOR PERMISSION BUILDER
=========================================================== */
export type GroupedMap = Record<string, StaffUserType>;
