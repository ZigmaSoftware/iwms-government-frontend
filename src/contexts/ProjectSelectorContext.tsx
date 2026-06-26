import { createContext, useContext, type ReactNode } from "react";
import {
  getCurrentProjectGpsApiUrl,
  getCurrentProjectWeighmentApiUrl,
} from "@/utils/projectContext";

interface ProjectSelectorContextValue {
  companyId: string;
  companyName: string;
  companies: { unique_id: string; name: string }[];
  setCompanyId: (id: string) => void;
  projectId: string;
  projects: { unique_id: string; name: string; gps_api_url: string | null; weighment_api_url: string | null }[];
  selectedProject: null;
  setProjectId: (id: string) => void;
  gpsApiUrl: string;
  weighmentApiUrl: string;
  loading: boolean;
}

const ProjectSelectorContext = createContext<ProjectSelectorContextValue | null>(null);

export function useProjectSelector(): ProjectSelectorContextValue {
  const ctx = useContext(ProjectSelectorContext);
  if (!ctx) throw new Error("useProjectSelector must be used inside ProjectSelectorProvider");
  return ctx;
}

const STUB_VALUE: ProjectSelectorContextValue = {
  companyId: "",
  companyName: "",
  companies: [],
  setCompanyId: () => {},
  projectId: "",
  projects: [],
  selectedProject: null,
  setProjectId: () => {},
  get gpsApiUrl() { return getCurrentProjectGpsApiUrl(); },
  get weighmentApiUrl() { return getCurrentProjectWeighmentApiUrl(); },
  loading: false,
};

export function ProjectSelectorProvider({ children }: { children: ReactNode }) {
  return (
    <ProjectSelectorContext.Provider value={STUB_VALUE}>
      {children}
    </ProjectSelectorContext.Provider>
  );
}
