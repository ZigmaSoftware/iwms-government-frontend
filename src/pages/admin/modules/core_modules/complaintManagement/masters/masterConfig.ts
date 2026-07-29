import {
  complaintCategoryApi,
  complaintModuleApi,
  complaintPriorityApi,
  complaintSlaRuleApi,
  complaintSourceApi,
  complaintStatusApi,
  complaintSubcategoryApi,
  complaintTeamApi,
} from "@/features/complaintTicketing/api";
import { getEncryptedRoute } from "@/utils/routeCache";

/**
 * Single source of truth for the 8 "reference data" master kinds that share
 * the generic `MasterForm`/`MasterList` engine (module, category,
 * subcategory, priority, status, source, team, slaRule).
 *
 * Before this file, `MasterForm.tsx` and `MasterList.tsx` each kept their own
 * copy of `title`/`routeModule`/`api` lookup maps — nearly identical, but
 * free to drift out of sync. This is the one place that per-kind metadata
 * lives now; both components (and the merged Reference Data / Category
 * screens) read from it instead of hard-coding their own copies.
 *
 * Field-level form JSX (which dropdowns appear, category-filtered
 * subcategory pickers, self-excluding "escalates to", etc.) stays inline in
 * `MasterForm.tsx` — those differ enough per kind (and carry real relational
 * logic) that forcing them through a declarative schema here would trade a
 * small amount of duplication for a much larger risk of subtle behavioural
 * regressions.
 */
export type MasterKind =
  | "module"
  | "category"
  | "subcategory"
  | "priority"
  | "status"
  | "source"
  | "team"
  | "slaRule";

export type MasterColumn = {
  field: string;
  header: string;
  sortable?: boolean;
  /** Render the field through `yesNo()` instead of showing the raw value. */
  render?: "yesno";
};

export type MasterConfigEntry = {
  /** Singular label, e.g. "Complaint Module" (used on the form). */
  title: string;
  /** Plural label, e.g. "Complaint Modules" (used on the list). */
  titlePlural: string;
  api: () => typeof complaintModuleApi;
  /** Which `getEncryptedRoute()` key resolves this kind's URL segment. */
  routeKey: keyof ReturnType<typeof getEncryptedRoute>;
  /** Global-search fields for the list's search box. */
  searchFields: string[];
  /** Table columns, in addition to the S.No/Active/Actions columns every kind gets. */
  columns: MasterColumn[];
};

export const MASTER_CONFIG: Record<MasterKind, MasterConfigEntry> = {
  module: {
    title: "Complaint Module",
    titlePlural: "Complaint Modules",
    api: () => complaintModuleApi,
    routeKey: "encComplaintModules",
    searchFields: ["module_code", "module_name"],
    columns: [
      { field: "module_code", header: "Code", sortable: true },
      { field: "module_name", header: "Module", sortable: true },
    ],
  },
  category: {
    title: "Complaint Category",
    titlePlural: "Complaint Categories",
    api: () => complaintCategoryApi,
    routeKey: "encComplaintCategories",
    searchFields: ["category_code", "category_name", "module_name", "default_priority_code", "default_team_name"],
    columns: [
      { field: "category_code", header: "Code", sortable: true },
      { field: "category_name", header: "Category", sortable: true },
      { field: "module_name", header: "Module" },
      { field: "default_priority_code", header: "Default Priority" },
      { field: "default_team_name", header: "Default Team" },
    ],
  },
  subcategory: {
    title: "Complaint Subcategory",
    titlePlural: "Complaint Subcategories",
    api: () => complaintSubcategoryApi,
    routeKey: "encComplaintSubcategories",
    searchFields: ["subcategory_code", "subcategory_name", "category_name"],
    columns: [
      { field: "subcategory_code", header: "Code", sortable: true },
      { field: "subcategory_name", header: "Subcategory", sortable: true },
      { field: "category_name", header: "Category", sortable: true },
    ],
  },
  priority: {
    title: "Complaint Priority",
    titlePlural: "Priorities",
    api: () => complaintPriorityApi,
    routeKey: "encComplaintPriorities",
    searchFields: ["priority_code", "priority_name"],
    columns: [
      { field: "priority_code", header: "Code", sortable: true },
      { field: "priority_name", header: "Priority", sortable: true },
    ],
  },
  status: {
    title: "Complaint Status",
    titlePlural: "Statuses",
    api: () => complaintStatusApi,
    routeKey: "encComplaintStatuses",
    searchFields: ["status_code", "status_name"],
    columns: [
      { field: "status_code", header: "Code", sortable: true },
      { field: "status_name", header: "Status", sortable: true },
      { field: "is_final", header: "Final", render: "yesno" },
      { field: "allow_reopen", header: "Allow Reopen", render: "yesno" },
    ],
  },
  source: {
    title: "Complaint Source",
    titlePlural: "Sources",
    api: () => complaintSourceApi,
    routeKey: "encComplaintSources",
    searchFields: ["source_code", "source_name"],
    columns: [
      { field: "source_code", header: "Code", sortable: true },
      { field: "source_name", header: "Source", sortable: true },
    ],
  },
  team: {
    title: "Complaint Team",
    titlePlural: "Teams",
    api: () => complaintTeamApi,
    routeKey: "encComplaintTeams",
    searchFields: ["team_code", "team_name", "department_name", "lead_staff_name"],
    columns: [
      { field: "team_code", header: "Code", sortable: true },
      { field: "team_name", header: "Team", sortable: true },
      { field: "department_name", header: "Department" },
      { field: "lead_staff_name", header: "Lead Staff" },
    ],
  },
  slaRule: {
    title: "Complaint SLA Rule",
    titlePlural: "SLA Rules",
    api: () => complaintSlaRuleApi,
    routeKey: "encComplaintSlaRules",
    searchFields: ["category_code", "priority_code"],
    columns: [
      { field: "category_code", header: "Category", sortable: true },
      { field: "priority_code", header: "Priority", sortable: true },
      { field: "assign_within_minutes", header: "Assign Minutes" },
      { field: "resolve_within_minutes", header: "Resolve Minutes" },
      { field: "working_hours_only", header: "Working Hours", render: "yesno" },
    ],
  },
};

/** The 4 "Tier A" masters merged into the single Reference Data screen. */
export const REFERENCE_DATA_KINDS: MasterKind[] = ["module", "priority", "source", "status"];
