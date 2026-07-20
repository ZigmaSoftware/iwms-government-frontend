import { jwtDecode } from "jwt-decode";
import { API_ROOT } from "@/config/configApi";
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
export const DATA_SCOPE_STORAGE_KEY = "data_scope";

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

export type DataScopeRef = { unique_id?: string; name?: string } | null;

/** The level a staff data scope was granted at (most-specific field set). */
export type ScopeGrantedLevel =
  | "state"
  | "district"
  | "area_type"
  | "corporation"
  | "municipality"
  | "town_panchayat"
  | "panchayat_union"
  | "panchayat";

export type ScopeLocalBodyType =
  | "corporation"
  | "municipality"
  | "town_panchayat"
  | "panchayat_union"
  | "panchayat";

/** A government sub-admin / supervisor scoped within a local body. */
export type ScopeStaffSummary = {
  staff_unique_id?: string;
  employee_name?: string | null;
  role?: string | null;
  staff_config_name?: string | null;
};

export type ScopeLocalBody = {
  unique_id: string;
  name: string | null;
  local_body_type: ScopeLocalBodyType;
  staff?: ScopeStaffSummary[];
};

export type ScopeAreaType = {
  unique_id: string;
  name: string | null;
  group?: "urban" | "rural" | null;
  local_bodies: ScopeLocalBody[];
};

export type ScopeDistrict = {
  unique_id: string;
  name: string | null;
  area_types: ScopeAreaType[];
};

/** Full geo subtree beneath the granted scope (see backend `expanded_scope_payload`). */
export type ScopeDescendants = {
  districts: ScopeDistrict[];
};

export type DataScope = {
  state?: DataScopeRef;
  district?: DataScopeRef;
  area_type?: DataScopeRef;
  corporation?: DataScopeRef;
  municipality?: DataScopeRef;
  town_panchayat?: DataScopeRef;
  panchayat_union?: DataScopeRef;
  panchayat?: DataScopeRef;
  depot?: DataScopeRef;
  location_nodes?: Array<{ unique_id: string; name: string }>;
  /** Additive scope-expansion fields (login feature). */
  granted_level?: ScopeGrantedLevel | null;
  descendants?: ScopeDescendants | null;
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
  data_scope?: DataScope | null;
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

export const getStoredDataScope = (): DataScope | null =>
  safeJsonParse<DataScope | null>(localStorage.getItem(DATA_SCOPE_STORAGE_KEY), null);

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

  // The backend nests data_scope under profile (see login_viewset.py's
  // Response body: profile_payload -> "profile" key), not top-level.
  const dataScope = payload.data_scope ?? (profile?.data_scope as DataScope | undefined) ?? null;
  if (dataScope) {
    safeSetStorageItem(DATA_SCOPE_STORAGE_KEY, JSON.stringify(dataScope));
  } else {
    localStorage.removeItem(DATA_SCOPE_STORAGE_KEY);
  }

  scheduleProactiveRefresh();
};

/**
 * Exchanges the stored refresh token for a fresh access token so an expired
 * 5-hour session can be silently renewed instead of forcing a re-login.
 * Concurrent callers (the axios interceptor, the permission poller) share
 * the same in-flight request via `refreshInFlight`, so only one refresh
 * call ever hits the backend at a time. Returns null if there's no refresh
 * token, or the backend rejects it (session is genuinely dead).
 */
let refreshInFlight: Promise<string | null> | null = null;

export const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_ROOT}/login/refresh-token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!response.ok) return null;

      const data = await response.json();
      const newAccessToken = data?.access_token;
      if (!newAccessToken) return null;

      safeSetStorageItem(ACCESS_TOKEN_STORAGE_KEY, newAccessToken);
      return newAccessToken as string;
    } catch (error) {
      console.warn("[Auth] Token refresh failed:", error);
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
};

// Refresh 15 minutes before the access token's real expiry (e.g. at the
// 4h45m mark of a 5h token) so it renews in the background before any
// request has a chance to hit a 401. The reactive refresh-on-401 paths
// (axios interceptor, permission poller) remain as a fallback for cases
// this misses (device asleep past expiry, clock skew, etc).
const PROACTIVE_REFRESH_BUFFER_SECONDS = 15 * 60;
let scheduledRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export const clearScheduledRefresh = (): void => {
  if (scheduledRefreshTimer) {
    clearTimeout(scheduledRefreshTimer);
    scheduledRefreshTimer = null;
  }
};

export const scheduleProactiveRefresh = (): void => {
  clearScheduledRefresh();

  const token = getStoredAccessToken();
  if (!token) return;

  let exp: number | undefined;
  try {
    exp = jwtDecode<JwtPayload>(token).exp;
  } catch {
    return;
  }
  if (!exp) return;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilRefresh = exp - PROACTIVE_REFRESH_BUFFER_SECONDS - nowSeconds;
  const delayMs = Math.max(secondsUntilRefresh, 0) * 1000;

  scheduledRefreshTimer = setTimeout(async () => {
    const newToken = await refreshAccessToken();
    // Reschedule off the freshly issued token's own exp. If the refresh
    // failed (refresh token itself is dead), don't reschedule — the
    // reactive paths take over and only force a logout once a real
    // request actually fails.
    if (newToken) scheduleProactiveRefresh();
  }, delayMs);
};

export const clearAuthSession = (): void => {
  clearScheduledRefresh();
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
  localStorage.removeItem(DATA_SCOPE_STORAGE_KEY);
  clearStoredPermissions();
  clearAdminViewPreference();
};
