import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchAllRoles, extractRoleValues, getAdminRoles, getDefaultRole, type RoleOption } from "@/utils/roleLoader";

type RolesContextValue = {
  /**
   * All available roles from API
   */
  allRoles: RoleOption[];
  
  /**
   * All role values as strings
   */
  roleValues: string[];
  
  /**
   * Admin roles (admin, superadmin, companyadmin, etc.)
   */
  adminRoles: string[];
  
  /**
   * Default/user role
   */
  defaultRole: string;
  
  /**
   * Loading state
   */
  isLoading: boolean;
};

const RolesContext = createContext<RolesContextValue | undefined>(undefined);

export const RolesProvider = ({ children }: { children: ReactNode }) => {
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const roles = await fetchAllRoles();
        setAllRoles(roles);
        console.log("[RolesContext] Roles loaded successfully:", roles);
      } catch (error) {
        console.error("[RolesContext] Failed to load roles:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRoles();
  }, []);

  const roleValues = extractRoleValues(allRoles);
  const adminRoles = getAdminRoles(allRoles);
  const defaultRole = getDefaultRole(allRoles);

  const value: RolesContextValue = {
    allRoles,
    roleValues,
    adminRoles,
    defaultRole,
    isLoading,
  };

  return (
    <RolesContext.Provider value={value}>
      {children}
    </RolesContext.Provider>
  );
};

/**
 * Hook to access roles context
 */
export const useRoles = () => {
  const ctx = useContext(RolesContext);

  if (!ctx) {
    throw new Error("useRoles must be used within RolesProvider");
  }

  return ctx;
};
