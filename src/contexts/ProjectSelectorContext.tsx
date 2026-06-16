import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getStoredProjects, getStoredProfile } from "@/utils/authStorage";
import type { ProjectConfig } from "@/utils/authStorage";
import { projectApi, companyApi } from "@/helpers/admin";

const SESSION_KEY = "ps_project_id";

type CompanyOption = { unique_id: string; name: string };

interface ProjectSelectorContextValue {
  /* company */
  companyId: string;
  companyName: string;
  companies: CompanyOption[];
  setCompanyId: (id: string) => void;

  /* project */
  projectId: string;
  projects: ProjectConfig[];
  selectedProject: ProjectConfig | null;
  setProjectId: (id: string) => void;

  /* resolved API URLs (project-specific, env-fallback) */
  gpsApiUrl: string;
  weighmentApiUrl: string;

  /* loading state for async fetch */
  loading: boolean;
}

const ProjectSelectorContext = createContext<ProjectSelectorContextValue | null>(null);

export function useProjectSelector(): ProjectSelectorContextValue {
  const ctx = useContext(ProjectSelectorContext);
  if (!ctx) throw new Error("useProjectSelector must be used inside ProjectSelectorProvider");
  return ctx;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function resolveInitialProjectId(projects: ProjectConfig[]): string {
  const saved = sessionStorage.getItem(SESSION_KEY) ?? "";
  if (saved && projects.some((p) => p.unique_id === saved)) return saved;
  return projects[0]?.unique_id ?? "";
}

// ─── provider ────────────────────────────────────────────────────────────────

export function ProjectSelectorProvider({ children }: { children: ReactNode }) {
  const profile = getStoredProfile();
  const storedProjects = getStoredProjects();

  // Company state — seeded from the user's login profile
  const [companyId, setCompanyIdState] = useState<string>(
    () => (profile?.company_unique_id as string) ?? ""
  );
  const [companyName, setCompanyName] = useState<string>(
    () => (profile?.company_name as string) ?? ""
  );
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  // Project state — seeded from the login response projects list
  const [projects, setProjects] = useState<ProjectConfig[]>(storedProjects);
  const [projectId, setProjectIdState] = useState<string>(() =>
    resolveInitialProjectId(storedProjects)
  );
  const [loading, setLoading] = useState(false);

  // ── For superadmin / empty stored list — fetch via API ─────────────────────
  useEffect(() => {
    if (storedProjects.length > 0) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Fetch all accessible companies
        const companyRecords = await companyApi.readAll();
        if (cancelled) return;
        const companyList: CompanyOption[] = (companyRecords as CompanyOption[]).map(
          (c) => ({ unique_id: c.unique_id, name: c.name })
        );
        setCompanies(companyList);

        // Use existing companyId or default to first company
        const targetCompany = companyId || companyList[0]?.unique_id || "";
        if (targetCompany && !companyId) setCompanyIdState(targetCompany);

        if (targetCompany) {
          const projectRecords = await (projectApi as any).readAll({
            params: { company_unique_id: targetCompany },
          });
          if (cancelled) return;
          const projectList: ProjectConfig[] = (projectRecords as any[]).map((p) => ({
            unique_id: p.unique_id,
            name: p.name,
            gps_api_url: p.gps_api_url ?? null,
            weighment_api_url: p.weighment_api_url ?? null,
          }));
          setProjects(projectList);
          setProjectIdState(resolveInitialProjectId(projectList));
        }
      } catch {
        // non-fatal — pages still work with env-var fallbacks
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── When company changes (superadmin switching) — reload projects ──────────
  const setCompanyId = useCallback(async (id: string) => {
    const matched = companies.find((c) => c.unique_id === id);
    setCompanyIdState(id);
    setCompanyName(matched?.name ?? "");

    if (!id) return;
    try {
      setLoading(true);
      const projectRecords = await (projectApi as any).readAll({
        params: { company_unique_id: id },
      });
      const projectList: ProjectConfig[] = (projectRecords as any[]).map((p) => ({
        unique_id: p.unique_id,
        name: p.name,
        gps_api_url: p.gps_api_url ?? null,
        weighment_api_url: p.weighment_api_url ?? null,
      }));
      setProjects(projectList);
      const newProjectId = resolveInitialProjectId(projectList);
      setProjectIdState(newProjectId);
      sessionStorage.setItem(SESSION_KEY, newProjectId);
    } catch {
      // keep current
    } finally {
      setLoading(false);
    }
  }, [companies]);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    sessionStorage.setItem(SESSION_KEY, id);
  }, []);

  const selectedProject = projects.find((p) => p.unique_id === projectId) ?? null;

  const gpsApiUrl = selectedProject?.gps_api_url ?? "";
  const weighmentApiUrl = selectedProject?.weighment_api_url ?? "";

  return (
    <ProjectSelectorContext.Provider
      value={{
        companyId,
        companyName,
        companies,
        setCompanyId,
        projectId,
        projects,
        selectedProject,
        setProjectId,
        gpsApiUrl,
        weighmentApiUrl,
        loading,
      }}
    >
      {children}
    </ProjectSelectorContext.Provider>
  );
}
