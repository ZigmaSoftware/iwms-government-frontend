import { jwtDecode } from "jwt-decode";
import {
  clearAdminViewPreference,
  USER_ROLE_STORAGE_KEY,
  normalizeRole,
} from "@/types/roles";
import {
  COLUMN_PERMISSIONS_STORAGE_KEY,
  clearStoredPermissions,
  PERMISSION_DETAILS_STORAGE_KEY,
  PERMISSIONS_STORAGE_KEY,
  setStoredColumnPermissions,
  setStoredPermissionDetails,
  setStoredPermissions,
} from "@/utils/permissions";

export const ACCESS_TOKEN_STORAGE_KEY = "access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";
export const USER_STORAGE_KEY = "user";
export const PROFILE_STORAGE_KEY = "profile";
export const PROJECTS_STORAGE_KEY = "projects_config";

type JwtPayload = {
  exp?: number;
  unique_id?: string;
  user_id?: string;
  username?: string;
  role?: string;
};

export type ProjectConfig = {
  unique_id: string;
  name: string;
  gps_api_url?: string | null;
  weighment_api_url?: string | null;
};

export type AuthUser = {  
  unique_id?: string;
  username?: string;
  email?: string;
  role?: string;
  name?: string;
  [key: string]: unknown;
};

export type AuthProfile = {
  company_name?: string;
  branch_name?: string;
  project_id?: string;
  project_unique_id?: string;
  project?: {
    unique_id?: string;
  };
  [key: string]: unknown;
};

export type LoginPayload = {
  access?: string;
  refresh?: string;
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
  role?: string;
  unique_id?: string;
  username?: string;
  name?: string;
  email?: string;
  permissions?: unknown;
  permission_details?: unknown;
  column_permissions?: unknown;
  profile?: AuthProfile;
  projects?: ProjectConfig[];
};

export type LoginEnvelope = LoginPayload | {
  success?: boolean;
  message?: string;
  data?: LoginPayload;
};

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const safeSetStorageItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[Auth] Unable to persist '${key}' in localStorage:`, error);
  }
};

export const unwrapLoginPayload = (response: LoginEnvelope): LoginPayload => {
  if (response && "data" in response && response.data) {
    return response.data;
  }
  return response as LoginPayload;
};

export const getStoredAccessToken = (): string =>
  localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? "";

export const getStoredRefreshToken = (): string =>
  localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? "";

export const getStoredAuthUser = (): AuthUser | null =>
  safeJsonParse<AuthUser | null>(localStorage.getItem(USER_STORAGE_KEY), null);

export const getStoredProfile = (): AuthProfile | null =>
  safeJsonParse<AuthProfile | null>(localStorage.getItem(PROFILE_STORAGE_KEY), null);

export const getStoredProjects = (): ProjectConfig[] =>
  safeJsonParse<ProjectConfig[]>(localStorage.getItem(PROJECTS_STORAGE_KEY), []);

export const getStoredProjectConfig = (projectId: string): ProjectConfig | null =>
  getStoredProjects().find((p) => p.unique_id === projectId) ?? null;

export const isAccessTokenValid = (token = getStoredAccessToken()): boolean => {
  if (!token) return false;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    if (!decoded.exp) return true;
    return decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

export const persistLoginSession = (payload: LoginPayload): void => {
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
  localStorage.removeItem(PERMISSION_DETAILS_STORAGE_KEY);
  localStorage.removeItem(COLUMN_PERMISSIONS_STORAGE_KEY);

  const access = payload.access ?? payload.access_token ?? "";
  const refresh = payload.refresh ?? payload.refresh_token ?? "";
  const user: AuthUser = payload.user ?? {
    unique_id: payload.unique_id,
    username: payload.username ?? payload.name,
    email: payload.email,
    role: payload.role,
  };
  const profile = payload.profile ?? null;
  const role = normalizeRole(user.role ?? payload.role ?? null);

  if (access) safeSetStorageItem(ACCESS_TOKEN_STORAGE_KEY, access);
  if (refresh) safeSetStorageItem(REFRESH_TOKEN_STORAGE_KEY, refresh);
  safeSetStorageItem(USER_STORAGE_KEY, JSON.stringify(user));
  if (role) safeSetStorageItem(USER_ROLE_STORAGE_KEY, role);
  if (user.unique_id) safeSetStorageItem("unique_id", String(user.unique_id));

  setStoredPermissions(payload.permissions ?? {});
  setStoredPermissionDetails(payload.permission_details ?? {});
  setStoredColumnPermissions(payload.column_permissions ?? {});

  if (profile) {
    safeSetStorageItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    const projectId =
      profile.project_id ??
      profile.project_unique_id ??
      profile.project?.unique_id;
    if (projectId) {
      safeSetStorageItem("project_id", String(projectId));
    } else {
      localStorage.removeItem("project_id");
    }
  } else {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem("project_id");
  }

  const projects = payload.projects ?? [];
  if (projects.length > 0) {
    safeSetStorageItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } else {
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
  }
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  localStorage.removeItem(USER_ROLE_STORAGE_KEY);
  localStorage.removeItem("unique_id");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_email");
  // Company context keys (used by useCompanyProjectSelection)
  localStorage.removeItem("company_unique_id");
  localStorage.removeItem("current_company_unique_id");
  localStorage.removeItem("selected_company_unique_id");
  // Project context keys
  localStorage.removeItem("project_id");
  localStorage.removeItem("project_unique_id");
  localStorage.removeItem("current_project_id");
  localStorage.removeItem("selected_project_id");
  localStorage.removeItem(PROJECTS_STORAGE_KEY);
  clearStoredPermissions();
  clearAdminViewPreference();
};
