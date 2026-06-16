import { roleTypesApi } from "@/helpers/admin";

export type RoleOption = {
  value: string;
  label: string;
};

/**
 * Fetch all available roles from the API
 */
export const fetchAllRoles = async (): Promise<RoleOption[]> => {
  try {
    const response = await roleTypesApi.readAll();
    
    // Handle different response formats
    let roles: unknown[] = [];
    
    if (Array.isArray(response)) {
      roles = response;
    } else if (response && typeof response === "object") {
      const data = (response as Record<string, unknown>);
      if (Array.isArray(data.results)) {
        roles = data.results;
      } else if (Array.isArray(data.data)) {
        roles = data.data;
      }
    }

    // Normalize to RoleOption format
    return roles.map((item: unknown) => {
      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        return {
          value: String(record.value ?? record.id ?? "").trim(),
          label: String(record.label ?? record.name ?? "").trim(),
        };
      }
      return { value: "", label: "" };
    }).filter(role => role.value);

  } catch (error) {
    console.error("[RoleLoader] Failed to fetch roles from API:", error);
    return [];
  }
};

/**
 * Extract just the role values from RoleOption array
 */
export const extractRoleValues = (roles: RoleOption[]): string[] => {
  return roles.map(r => r.value);
};

/**
 * Find admin roles from the fetched roles
 * Typically includes admin, superadmin, companyadmin, etc.
 */
export const getAdminRoles = (roles: RoleOption[]): string[] => {
  return roles
    .filter(r => 
      r.value.includes("admin") || 
      r.value.includes("superadmin") ||
      r.value.includes("supervisor")
    )
    .map(r => r.value);
};

/**
 * Get the default user role from fetched roles
 */
export const getDefaultRole = (roles: RoleOption[]): string => {
  // Look for 'company_user' or 'user' or first non-admin role
  const defaultCandidates = [
    roles.find(r => r.value === "company_user"),
    roles.find(r => r.value === "user"),
    roles.find(r => !r.value.includes("admin")),
  ];

  const found = defaultCandidates.find(r => r);
  return found?.value || roles[0]?.value || "user";
};
