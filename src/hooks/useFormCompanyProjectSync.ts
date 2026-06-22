import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";

type SyncArgs = {
  selectedCompanyId: string;
  setSelectedCompanyId: (v: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (v: string) => void;
};

export function useFormCompanyProjectSync(_args: SyncArgs) {
  const { companyUniqueId, projectId } = useCompanyProjectSelection({ isEdit: false });
  return {
    handleCompanyChange: (_v: string) => {},
    handleProjectChange: (_v: string) => {},
    globalCompanyId: companyUniqueId,
    globalProjectId: projectId,
  };
}
