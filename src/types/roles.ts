import type { ReactNode } from "react";

/* ========================
   Roles - DYNAMIC (from API)
======================== */

// These are now fetched from the API via RolesContext
// Import useRoles hook from @/contexts/RolesContext to use them

export type UserRole = string; // Dynamic - can be any role value from API

export const USER_ROLE_STORAGE_KEY = "user_role";

/* ========================
   Fallback Roles (for compatibility)
   Use these only when RolesContext is not available
======================== */

export const FALLBACK_ADMIN_ROLES = ["admin", "superadmin", "companyadmin", "company_admin", "company_project_admin"] as const;
export type FallbackAdminRole = typeof FALLBACK_ADMIN_ROLES[number];

export const FALLBACK_DEFAULT_ROLE: UserRole = "company_user";

// For backward compatibility - use fallback values
export const ADMIN_ROLES = FALLBACK_ADMIN_ROLES;
export type AdminRole = FallbackAdminRole;

export const DEFAULT_ROLE: UserRole = FALLBACK_DEFAULT_ROLE;

/* ========================
   Layout Props
======================== */

interface LayoutChildren {
  children: ReactNode;
}

export interface AdminLayoutProps extends LayoutChildren {}
export interface DashboardLayoutProps extends LayoutChildren {}

export interface RoleBasedLayoutProps extends LayoutChildren {
  /**
   * Optional override useful for testing or forcing a role context.
   */
  roleOverride?: UserRole | null;
}

/* ========================
   Role Utils
======================== */

export function normalizeRole(
  role: string | null | undefined
): UserRole | null {
  if (!role) return null;

  const normalized = role.toLowerCase().trim();
  if (!normalized) return null;

  return normalized as UserRole;
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  
  const normalized = String(role).toLowerCase();
  return (
    FALLBACK_ADMIN_ROLES.some(r => normalized === r.toLowerCase()) ||
    normalized.includes("admin") ||
    normalized.includes("superadmin")
  );
}

/**
 * Check if user role is one of the allowed roles (flexible string comparison)
 */
export function isAllowedRole(userRole: UserRole | null | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  
  const normalizedUser = String(userRole).toLowerCase();
  return allowedRoles.some(r => normalizedUser === r.toLowerCase());
}

/* ========================
   Admin View Mode
======================== */

export const ADMIN_VIEW_MODE_STORAGE_KEY = "admin_view_preference";
export const ADMIN_VIEW_MODE_ADMIN = "admin" as const;
export const ADMIN_VIEW_MODE_DASHBOARD = "dashboard" as const;

export type AdminViewMode =
  | typeof ADMIN_VIEW_MODE_ADMIN
  | typeof ADMIN_VIEW_MODE_DASHBOARD;

/* ========================
   Storage Helpers
======================== */

const isBrowser = () => typeof window !== "undefined";

const getAdminViewStorage = () => {
  if (!isBrowser()) return null;
  return localStorage.getItem(ADMIN_VIEW_MODE_STORAGE_KEY);
};

export function getAdminViewPreference(): AdminViewMode {
  const stored = getAdminViewStorage();
  return stored === ADMIN_VIEW_MODE_DASHBOARD
    ? ADMIN_VIEW_MODE_DASHBOARD
    : ADMIN_VIEW_MODE_ADMIN;
}

export function setAdminViewPreference(mode: AdminViewMode) {
  if (!isBrowser()) return;
  localStorage.setItem(ADMIN_VIEW_MODE_STORAGE_KEY, mode);
}

export function clearAdminViewPreference() {
  if (!isBrowser()) return;
  localStorage.removeItem(ADMIN_VIEW_MODE_STORAGE_KEY);
}