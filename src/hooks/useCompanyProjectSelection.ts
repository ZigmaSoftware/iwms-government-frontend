export type CompanyProjectOption = {
  value: string;
  label: string;
};

type UseCompanyProjectSelectionArgs = {
  isEdit: boolean;
  initialCompanyId?: string;
  initialProjectId?: string;
  defaultToAll?: boolean;
};

export const useCompanyProjectSelection = (_args: UseCompanyProjectSelectionArgs) => {
  return {
    companyUniqueId: "",
    projectId: "",
    projects: [] as CompanyProjectOption[],
    companies: [] as CompanyProjectOption[],
    isSuperAdmin: true,
    loggedInCompanyUniqueId: "",
    setProjectId: (_v: string) => {},
    onCompanyChange: (_v: string) => {},
    applyCompanyProjectFromRecord: (_record: Record<string, unknown>) => {},
  };
};
