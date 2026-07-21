import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";
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

export default function MasterList({ kind }: Props) {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();
  const { newPath, editPath } = createCrudRoutePaths(routes.encComplaintTicket, routes[routeModule[kind]]);
  const [records, setRecords] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

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

  const load = async () => {
    const response = await api.readAll();
    setRecords(asArray(response));
  };

  useEffect(() => {
    load().catch((err) => Swal.fire("Error", errorText(err, "Unable to load records"), "error"));
  }, [api]);

  const edit = (row: any) => navigate(editPath(row.unique_id));

  const fields =
    kind === "module"
      ? ["module_code", "module_name"]
      : kind === "category"
      ? ["category_code", "category_name", "module_name", "default_priority_code", "default_team_name"]
      : kind === "subcategory"
        ? ["subcategory_code", "subcategory_name", "category_name"]
        : kind === "priority"
          ? ["priority_code", "priority_name"]
          : kind === "status"
            ? ["status_code", "status_name"]
            : kind === "source"
              ? ["source_code", "source_name"]
              : kind === "team"
                ? ["team_code", "team_name", "department_name", "lead_staff_name"]
                : ["category_code", "priority_code"];

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
        value={records}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        onFilter={(event: any) => setFilters(event.filters)}
        globalFilterFields={fields}
        header={
          <div className="flex justify-end">
            <InputText
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFilters((prev: any) => ({ ...prev, global: { ...prev.global, value: event.target.value } }));
              }}
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
        {kind === "module" && <Column field="module_code" header="Code" sortable />}
        {kind === "module" && <Column field="module_name" header="Module" sortable />}
        {kind === "category" && <Column field="category_code" header="Code" sortable />}
        {kind === "category" && <Column field="category_name" header="Category" sortable />}
        {kind === "category" && <Column field="module_name" header="Module" sortable />}
        {kind === "category" && <Column field="default_priority_code" header="Default Priority" />}
        {kind === "category" && <Column field="default_team_name" header="Default Team" />}
        {kind === "subcategory" && <Column field="subcategory_code" header="Code" sortable />}
        {kind === "subcategory" && <Column field="subcategory_name" header="Subcategory" sortable />}
        {kind === "subcategory" && <Column field="category_name" header="Category" sortable />}
        {kind === "priority" && <Column field="priority_code" header="Code" sortable />}
        {kind === "priority" && <Column field="priority_name" header="Priority" sortable />}
        {kind === "status" && <Column field="status_code" header="Code" sortable />}
        {kind === "status" && <Column field="status_name" header="Status" sortable />}
        {kind === "status" && <Column header="Final" body={(row) => yesNo(row.is_final)} />}
        {kind === "status" && <Column header="Allow Reopen" body={(row) => yesNo(row.allow_reopen)} />}
        {kind === "source" && <Column field="source_code" header="Code" sortable />}
        {kind === "source" && <Column field="source_name" header="Source" sortable />}
        {kind === "team" && <Column field="team_code" header="Code" sortable />}
        {kind === "team" && <Column field="team_name" header="Team" sortable />}
        {kind === "team" && <Column field="department_name" header="Department" />}
        {kind === "team" && <Column field="lead_staff_name" header="Lead Staff" />}
        {kind === "slaRule" && <Column field="category_code" header="Category" sortable />}
        {kind === "slaRule" && <Column field="priority_code" header="Priority" sortable />}
        {kind === "slaRule" && <Column field="assign_within_minutes" header="Assign Minutes" />}
        {kind === "slaRule" && <Column field="resolve_within_minutes" header="Resolve Minutes" />}
        {kind === "slaRule" && <Column header="Working Hours" body={(row) => yesNo(row.working_hours_only)} />}
        <Column header="Active" body={(row) => yesNo(row.is_active !== false)} />
        <Column header="Actions" body={(row) => <button className="text-blue-600" onClick={() => edit(row)} title="Edit"><PencilIcon className="size-5" /></button>} style={{ width: "100px" }} />
      </DataTable>
    </div>
  );
}
