import { useCallback, useMemo, useState } from "react";
import { USER_ROLE_STORAGE_KEY, normalizeRole } from "@/types/roles";

export type CompanyProjectOption = {
  value: string;
  label: string;
};

type LoginProfile = { role?: string };

type UseCompanyProjectSelectionArgs = {
  isEdit: boolean;
  initialCompanyId?: string;
  initialProjectId?: string;
  defaultToAll?: boolean;
};

const REMOVED_SCOPE_VALUE = "__removed_scope__";

const readLoginProfile = (): LoginProfile | null => {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem("profile");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LoginProfile;
  } catch {
    return null;
  }
};

export const useCompanyProjectSelection = ({
  isEdit: _isEdit,
  initialCompanyId: _initialCompanyId,
  initialProjectId: _initialProjectId,
  defaultToAll: _defaultToAll = false,
}: UseCompanyProjectSelectionArgs) => {
  const [companyUniqueId, setCompanyUniqueId] = useState(REMOVED_SCOPE_VALUE);
  const [projectId, setProjectId] = useState(REMOVED_SCOPE_VALUE);

  const profile = useMemo(() => readLoginProfile(), []);
  const isSuperAdmin = useMemo(() => {
    if (typeof window === "undefined") return false;

    const roleFromStorage = normalizeRole(
      localStorage.getItem(USER_ROLE_STORAGE_KEY)
    );
    const roleFromProfile = normalizeRole(profile?.role);
    const normalizedRole = roleFromStorage ?? roleFromProfile;
    return normalizedRole === "superadmin" || normalizedRole === "super_admin";
  }, [profile]);

  const onCompanyChange = useCallback((value: string) => {
    setCompanyUniqueId(value || REMOVED_SCOPE_VALUE);
    setProjectId(REMOVED_SCOPE_VALUE);
  }, []);

  const setScopedProjectId = useCallback((value: string) => {
    setProjectId(value || REMOVED_SCOPE_VALUE);
  }, []);

  const applyCompanyProjectFromRecord = useCallback((_record: Record<string, unknown>) => {}, []);

  return {
    companyUniqueId,
    projectId,
    projects: [{ value: REMOVED_SCOPE_VALUE, label: "All" }],
    companies: [{ value: REMOVED_SCOPE_VALUE, label: "All" }],
    isSuperAdmin,
    loggedInCompanyUniqueId: "",
    setProjectId: setScopedProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  };
};
