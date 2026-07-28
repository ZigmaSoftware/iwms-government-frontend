import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { PencilIcon } from "@/icons";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";
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
import { asArray, errorText, yesNo } from "../utils";

type MasterKind = "module" | "category" | "subcategory" | "priority" | "status" | "source" | "team" | "slaRule";

type Props = {
  kind: MasterKind;
};

const title: Record<MasterKind, string> = {
  module: "Complaint Modules",
  category: "Complaint Categories",
  subcategory: "Complaint Subcategories",
  priority: "Priorities",
  status: "Statuses",
  source: "Sources",
  team: "Teams",
  slaRule: "SLA Rules",
};

const routeModule: Record<MasterKind, keyof ReturnType<typeof getEncryptedRoute>> = {
  module: "encComplaintModules",
  category: "encComplaintCategories",
  subcategory: "encComplaintSubcategories",
  priority: "encComplaintPriorities",
  status: "encComplaintStatuses",
  source: "encComplaintSources",
  team: "encComplaintTeams",
  slaRule: "encComplaintSlaRules",
};

// Mirrors the `ordering_fields` configured on each backend viewset, intersected
// with the fields that are actually rendered as visible columns below. Related-object
// display fields (e.g. module_name, category_name, department_name, lead_staff_name,
// default_priority_code/default_team_name, and the slaRule category_code/priority_code
// lookups) are not safely orderable and are intentionally left out.
const SORTABLE_FIELDS_BY_KIND: Record<MasterKind, Set<string>> = {
  module: new Set(["module_code"]),
  category: new Set(["category_code"]),
  subcategory: new Set(["subcategory_code"]),
  priority: new Set(["priority_code"]),
  status: new Set(["status_code"]),
  source: new Set(["source_code", "source_name"]),
  team: new Set(["team_code", "team_name"]),
  slaRule: new Set([]),
};

export default function MasterList({ kind }: Props) {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(routes.encComplaintTicket, routes[routeModule[kind]]);

  const [rows, setRows] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const api = useMemo(() => {
    if (kind === "module") return complaintModuleApi;
    if (kind === "category") return complaintCategoryApi;
    if (kind === "subcategory") return complaintSubcategoryApi;
    if (kind === "priority") return complaintPriorityApi;
    if (kind === "status") return complaintStatusApi;
    if (kind === "source") return complaintSourceApi;
    if (kind === "slaRule") return complaintSlaRuleApi;
    return complaintTeamApi;
  }, [kind]);

  // Switching kind should restart pagination (and drop any sort tied to the old kind's columns).
  useEffect(() => {
    setFirst(0);
  }, [kind]);

  const ordering = sortField && SORTABLE_FIELDS_BY_KIND[kind].has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadRows = async (page: number, limit: number, search: string, sortOrdering?: string) => {
    setIsLoading(true);
    try {
      const response = await api.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(sortOrdering ? { ordering: sortOrdering } : {}),
        },
      });
      setRows(asArray(response));
      setTotalRecords(
        typeof (response as any)?.count === "number" ? (response as any).count : asArray(response).length,
      );
    } catch (error) {
      Swal.fire("Error", errorText(error, "Unable to load records"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, first, rowsPerPage, searchTerm, ordering]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(query);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, kind]);

  const edit = (row: any) => navigate(editPath(row.unique_id));

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{title[kind]}</h1>
          <p className="text-sm text-gray-500">Complaint ticketing setup</p>
        </div>
        <Button label="Add New" icon="pi pi-plus" className="p-button-success" onClick={() => navigate(newPath)} />
      </div>
      <DataTable
        value={rows}
        dataKey="unique_id"
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        header={
          <div className="flex justify-end">
            <InputText
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="p-inputtext-sm"
            />
          </div>
        }
        emptyMessage="No records found"
        stripedRows
        showGridlines
        className="p-datatable-sm"
      >
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        {kind === "module" && <Column field="module_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("module_code")} />}
        {kind === "module" && <Column field="module_name" header="Module" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("module_name")} />}
        {kind === "category" && <Column field="category_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("category_code")} />}
        {kind === "category" && <Column field="category_name" header="Category" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("category_name")} />}
        {kind === "category" && <Column field="module_name" header="Module" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("module_name")} />}
        {kind === "category" && <Column field="default_priority_code" header="Default Priority" />}
        {kind === "category" && <Column field="default_team_name" header="Default Team" />}
        {kind === "subcategory" && <Column field="subcategory_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("subcategory_code")} />}
        {kind === "subcategory" && <Column field="subcategory_name" header="Subcategory" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("subcategory_name")} />}
        {kind === "subcategory" && <Column field="category_name" header="Category" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("category_name")} />}
        {kind === "priority" && <Column field="priority_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("priority_code")} />}
        {kind === "priority" && <Column field="priority_name" header="Priority" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("priority_name")} />}
        {kind === "status" && <Column field="status_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("status_code")} />}
        {kind === "status" && <Column field="status_name" header="Status" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("status_name")} />}
        {kind === "status" && <Column header="Final" body={(row) => yesNo(row.is_final)} />}
        {kind === "status" && <Column header="Allow Reopen" body={(row) => yesNo(row.allow_reopen)} />}
        {kind === "source" && <Column field="source_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("source_code")} />}
        {kind === "source" && <Column field="source_name" header="Source" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("source_name")} />}
        {kind === "team" && <Column field="team_code" header="Code" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("team_code")} />}
        {kind === "team" && <Column field="team_name" header="Team" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("team_name")} />}
        {kind === "team" && <Column field="department_name" header="Department" />}
        {kind === "team" && <Column field="lead_staff_name" header="Lead Staff" />}
        {kind === "slaRule" && <Column field="category_code" header="Category" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("category_code")} />}
        {kind === "slaRule" && <Column field="priority_code" header="Priority" sortable={SORTABLE_FIELDS_BY_KIND[kind].has("priority_code")} />}
        {kind === "slaRule" && <Column field="assign_within_minutes" header="Assign Minutes" />}
        {kind === "slaRule" && <Column field="resolve_within_minutes" header="Resolve Minutes" />}
        {kind === "slaRule" && <Column header="Working Hours" body={(row) => yesNo(row.working_hours_only)} />}
        <Column header="Active" body={(row) => yesNo(row.is_active !== false)} />
        <Column header="Actions" body={(row) => <button className="text-blue-600" onClick={() => edit(row)} title="Edit"><PencilIcon className="size-5" /></button>} style={{ width: "100px" }} />
      </DataTable>
    </div>
  );
}
