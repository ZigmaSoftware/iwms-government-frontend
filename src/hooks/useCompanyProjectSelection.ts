/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import { companyApi, projectApi } from "@/helpers/admin";
import { getCurrentCompanyUniqueId } from "@/utils/projectContext";
import { USER_ROLE_STORAGE_KEY, normalizeRole } from "@/types/roles";

export type CompanyProjectOption = {
  value: string;
  label: string;
};

type LoginProfile = {
  role?: string;
  company_name?: string;
  company?: {
    name?: string;
  };
};

type UseCompanyProjectSelectionArgs = {
  isEdit: boolean;
  initialCompanyId?: string;
  initialProjectId?: string;
  defaultToAll?: boolean;
};

const toStringId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return toStringId(record.unique_id ?? record.id ?? record.value);
  }
  return String(value);
};

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item)
    );
  }

  if (value && typeof value === "object") {
    const maybeResults = (value as { results?: unknown }).results;
    if (Array.isArray(maybeResults)) {
      return maybeResults.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item)
      );
    }
  }

  return [];
};

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
  isEdit,
  initialCompanyId,
  initialProjectId,
  defaultToAll = false,
}: UseCompanyProjectSelectionArgs) => {
  const [companyUniqueId, setCompanyUniqueId] = useState(
    () => initialCompanyId || (defaultToAll ? "" : getCurrentCompanyUniqueId() ?? "")
  );
  const [projectId, setProjectId] = useState(initialProjectId || "");
  const [apiCompanies, setApiCompanies] = useState<CompanyProjectOption[]>([]);
  const [projects, setProjects] = useState<CompanyProjectOption[]>([]);
  const [resolvedLoggedInCompanyLabel, setResolvedLoggedInCompanyLabel] =
    useState("");

  const profile = useMemo(() => readLoginProfile(), []);
  const loggedInCompanyUniqueIdRaw = useMemo(
    () => getCurrentCompanyUniqueId(),
    []
  );
  
  const isSuperAdmin = useMemo(() => {
    if (typeof window === "undefined") return false;

    const roleFromStorage = normalizeRole(
      localStorage.getItem(USER_ROLE_STORAGE_KEY)
    );
    const roleFromProfile = normalizeRole(profile?.role);
    const normalizedRole = roleFromStorage ?? roleFromProfile;
    return normalizedRole === "superadmin" || normalizedRole === "super_admin";
  }, [profile]);

  const loggedInCompanyUniqueId = useMemo(() => {
    if (isSuperAdmin) return "";
    return loggedInCompanyUniqueIdRaw ?? "";
  }, [isSuperAdmin, loggedInCompanyUniqueIdRaw]);

  useEffect(() => {
    if (!isSuperAdmin && loggedInCompanyUniqueId) {
      setCompanyUniqueId((prev) => prev || loggedInCompanyUniqueId);
    }
  }, [isSuperAdmin, loggedInCompanyUniqueId]);

  const profileCompanyLabel = useMemo(() => {
    const directName =
      typeof profile?.company_name === "string"
        ? profile.company_name.trim()
        : "";
    const nestedName =
      typeof profile?.company?.name === "string"
        ? profile.company.name.trim()
        : "";

    return directName || nestedName || "";
  }, [profile]);

  useEffect(() => {
    if (!loggedInCompanyUniqueIdRaw || profileCompanyLabel) {
      return;
    }

    let active = true;

    companyApi.read(loggedInCompanyUniqueIdRaw)
      .then((company) => {
        if (!active) return;

        const name =
          (typeof company?.name === "string" && company.name.trim()) ||
          (typeof company?.company_name === "string" &&
            company.company_name.trim()) ||
          "";

        setResolvedLoggedInCompanyLabel(name);
      })
      .catch(() => {
        if (!active) return;
        setResolvedLoggedInCompanyLabel("");
      });

    return () => {
      active = false;
    };
  }, [loggedInCompanyUniqueIdRaw, profileCompanyLabel]);

  const loggedInCompanyLabel = useMemo(() => {
    return (
      profileCompanyLabel ||
      resolvedLoggedInCompanyLabel ||
      loggedInCompanyUniqueIdRaw ||
      ""
    );
  }, [
    profileCompanyLabel,
    resolvedLoggedInCompanyLabel,
    loggedInCompanyUniqueIdRaw,
  ]);

  const companies = useMemo<CompanyProjectOption[]>(() => {
    if (!isSuperAdmin && loggedInCompanyUniqueId) {
      return [
        {
          value: loggedInCompanyUniqueId,
          label: loggedInCompanyLabel,
        },
      ];
    }

    if (isSuperAdmin && apiCompanies.length === 0 && loggedInCompanyUniqueIdRaw) {
      return [
        {
          value: loggedInCompanyUniqueIdRaw,
          label: loggedInCompanyLabel,
        },
      ];
    }

    if (!isSuperAdmin) {
      return [];
    }

    return apiCompanies;
  }, [
    apiCompanies,
    isSuperAdmin,
    loggedInCompanyLabel,
    loggedInCompanyUniqueId,
    loggedInCompanyUniqueIdRaw,
  ]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    companyApi
      .readAll()
      .then((res) => {
        const options: CompanyProjectOption[] = toRecordList(res).map((x) => ({
          value: toStringId(x.unique_id),
          label: String(x.name ?? ""),
        }));

        setApiCompanies(options);
        if (!isEdit && !defaultToAll && options.length > 0) {
          setCompanyUniqueId((prev) => prev || options[0].value);
        }
      })
      .catch(() => {
        setApiCompanies([]);
      });
  }, [defaultToAll, isEdit, isSuperAdmin]);

  useEffect(() => {
    if (!companyUniqueId) {
      if (defaultToAll && isSuperAdmin) {
        let active = true;

        projectApi
          .readAll()
          .then((res) => {
            if (!active) return;

            const options: CompanyProjectOption[] = toRecordList(res).map((x) => ({
              value: toStringId(x.unique_id),
              label: String(x.name ?? ""),
            }));

            setProjects(options);
            setProjectId((prev) =>
              prev && options.some((option) => option.value === prev) ? prev : ""
            );
          })
          .catch(() => {
            if (!active) return;
            setProjects([]);
            setProjectId("");
          });

        return () => {
          active = false;
        };
      }

      setProjects([]);
      setProjectId("");
      return;
    }

    let active = true;

    projectApi
      .readAll({ params: { company_unique_id: companyUniqueId } })
      .then((res) => {
        if (!active) return;

        const options: CompanyProjectOption[] = toRecordList(res).map((x) => ({
          value: toStringId(x.unique_id),
          label: String(x.name ?? ""),
        }));

        setProjects(options);

        if (options.length === 0) {
          setProjectId("");
          return;
        }

        setProjectId((prev) => {
          if (prev && options.some((option) => option.value === prev)) {
            return prev;
          }
          return defaultToAll ? "" : options[0].value;
        });
      })
      .catch(() => {
        if (!active) return;

        setProjects([]);
        setProjectId("");
      });

    return () => {
      active = false;
    };
  }, [companyUniqueId, defaultToAll, isSuperAdmin]);

  const onCompanyChange = useCallback((value: string) => {
    setCompanyUniqueId(value);
    setProjects([]);
    setProjectId("");
  }, []);

  const applyCompanyProjectFromRecord = useCallback(
    (record: Record<string, unknown>) => {
      const companyCandidate =
        record.company_unique_id ??
        record.company_id ??
        ((record.company as Record<string, unknown> | undefined)?.unique_id ??
          null);
      const projectCandidate =
        record.project_id ??
        record.project_unique_id ??
        ((record.project as Record<string, unknown> | undefined)?.unique_id ??
          null);

      const recordCompanyId = toStringId(companyCandidate);
      if (recordCompanyId && (isSuperAdmin || !loggedInCompanyUniqueId)) {
        setCompanyUniqueId(recordCompanyId);
      }

      // Only override projectId when the record actually has a project value.
      // If the record has null/empty project (e.g. saved before project was required),
      // keep whatever is already selected (e.g. from route state / initialProjectId).
      const recordProjectId = toStringId(projectCandidate);
      if (recordProjectId) {
        setProjectId(recordProjectId);
      }
    },
    [isSuperAdmin, loggedInCompanyUniqueId]
  );

  return {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    loggedInCompanyUniqueId,
    setProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  };
};
