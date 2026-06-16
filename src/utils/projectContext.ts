import { getStoredProjectConfig } from "@/utils/authStorage";

const PROJECT_STORAGE_KEYS = [
  "project_id",
  "project_unique_id",
  "current_project_id",
  "selected_project_id",
] as const;

const COMPANY_STORAGE_KEYS = [
  "company_unique_id",
  "current_company_unique_id",
  "selected_company_unique_id",
] as const;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readProfile = (): Record<string, unknown> | null => {
  const rawProfile = localStorage.getItem("profile");
  if (!rawProfile) return null;

  try {
    return JSON.parse(rawProfile) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const readProjectFromProfile = (profile: Record<string, unknown> | null): string | null => {
  if (!profile) return null;

  return (
    asNonEmptyString(profile.project_id) ??
    asNonEmptyString(profile.project_unique_id) ??
    asNonEmptyString((profile.project as Record<string, unknown> | undefined)?.unique_id)
  );
};

const readCompanyFromProfile = (profile: Record<string, unknown> | null): string | null => {
  if (!profile) return null;

  return (
    asNonEmptyString(profile.company_unique_id) ??
    asNonEmptyString((profile.company as Record<string, unknown> | undefined)?.unique_id)
  );
};

const getQueryStringValue = (key: string): string | null =>
  asNonEmptyString(new URLSearchParams(window.location.search).get(key));

export const getCurrentProjectId = (): string | null => {
  if (typeof window === "undefined") return null;

  const fromQuery = getQueryStringValue("project_id");
  if (fromQuery) return fromQuery;

  for (const key of PROJECT_STORAGE_KEYS) {
    const value = asNonEmptyString(localStorage.getItem(key));
    if (value) return value;
  }

  const profile = readProfile();
  const fromProfile = readProjectFromProfile(profile);
  if (fromProfile) return fromProfile;

  return null;
};

export const getCurrentCompanyUniqueId = (): string | null => {
  if (typeof window === "undefined") return null;

  const fromQuery = getQueryStringValue("company_unique_id");
  if (fromQuery) return fromQuery;

  for (const key of COMPANY_STORAGE_KEYS) {
    const value = asNonEmptyString(localStorage.getItem(key));
    if (value) return value;
  }

  const profile = readProfile();
  const fromProfile = readCompanyFromProfile(profile);
  if (fromProfile) return fromProfile;

  return null;
};

export const getCurrentProjectGpsApiUrl = (): string => {
  const projectId = getCurrentProjectId();
  if (projectId) {
    const config = getStoredProjectConfig(projectId);
    const url = asNonEmptyString(config?.gps_api_url ?? null);
    if (url) return url;
  }
  return "";
};

export const getCurrentProjectWeighmentApiUrl = (): string => {
  const projectId = getCurrentProjectId();
  if (projectId) {
    const config = getStoredProjectConfig(projectId);
    const url = asNonEmptyString(config?.weighment_api_url ?? null);
    if (url) return url;
  }
  return "";
};
