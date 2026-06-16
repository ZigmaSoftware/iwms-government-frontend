import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { Building2, FolderOpen } from "lucide-react";

/**
 * Compact company + project filter bar.
 * Drop this at the top of any dashboard or report page.
 * It reads/writes from ProjectSelectorContext — no props needed.
 */
export function ProjectSelectorBar() {
  const {
    companyId,
    companyName,
    companies,
    setCompanyId,
    projectId,
    projects,
    setProjectId,
    loading,
  } = useProjectSelector();

  const isMultiCompany = companies.length > 1;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/70 px-4 py-2.5 backdrop-blur-sm shadow-sm mb-4">
      {/* Company */}
      <div className="flex items-center gap-2 min-w-0">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        {isMultiCompany ? (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={loading}
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.unique_id} value={c.unique_id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {companyName || "—"}
          </span>
        )}
      </div>

      <span className="text-muted-foreground/40 hidden sm:block">|</span>

      {/* Project */}
      <div className="flex items-center gap-2 min-w-0">
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        {projects.length > 1 ? (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[140px]"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={loading}
          >
            {projects.map((p) => (
              <option key={p.unique_id} value={p.unique_id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {projects[0]?.name ?? "—"}
          </span>
        )}
      </div>

      {loading && (
        <span className="ml-auto text-xs text-muted-foreground animate-pulse">
          Loading…
        </span>
      )}
    </div>
  );
}
