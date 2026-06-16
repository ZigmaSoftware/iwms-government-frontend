import { useEffect } from "react";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";

type SyncArgs = {
  selectedCompanyId: string;
  setSelectedCompanyId: (v: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (v: string) => void;
};

export function useFormCompanyProjectSync({
  selectedCompanyId,
  setSelectedCompanyId,
  selectedProjectId,
  setSelectedProjectId,
}: SyncArgs) {
  const {
    companyUniqueId: globalCompanyId,
    projectId: globalProjectId,
    onCompanyChange: onGlobalCompanyChange,
    setProjectId: setGlobalProjectId,
  } = useCompanyProjectSelection({ isEdit: false });

  // When the global selection changes (e.g., from the list page), adopt it
  useEffect(() => {
    if (globalCompanyId && globalCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(globalCompanyId);
    }
    if (globalProjectId && globalProjectId !== selectedProjectId) {
      setSelectedProjectId(globalProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalCompanyId, globalProjectId]);

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
    setSelectedProjectId("");
    try {
      onGlobalCompanyChange(value);
    } catch {
      /* ignore */
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    try {
      setGlobalProjectId(value);
    } catch {
      /* ignore */
    }
  };

  return {
    handleCompanyChange,
    handleProjectChange,
    globalCompanyId,
    globalProjectId,
  };
}
