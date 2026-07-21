/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
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
import { asArray, errorText, idOf } from "../utils";

type MasterKind = "module" | "category" | "subcategory" | "priority" | "status" | "source" | "team" | "slaRule";

type Props = {
  kind: MasterKind;
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

const title: Record<MasterKind, string> = {
  module: "Complaint Module",
  category: "Complaint Category",
  subcategory: "Complaint Subcategory",
  priority: "Complaint Priority",
  status: "Complaint Status",
  source: "Complaint Source",
  team: "Complaint Team",
  slaRule: "Complaint SLA Rule",
};

const emptyForm = {
  code: "",
  name: "",
  description: "",
  category: "",
  module: "",
  priority: "",
  subcategory: "",
  source: "",
  default_priority: "",
  default_team: "",
  requires_location: true,
  requires_media: false,
  requires_address_change_detail: false,
  is_sensitive: false,
  is_final: false,
  allow_reopen: false,
  is_field_team: false,
  escalation_level: "1",
  department: "",
  lead_staff: "",
  escalates_to: "",
  assign_within_minutes: "",
  resolve_within_minutes: "",
  working_hours_only: false,
  escalation_after_minutes: "",
  escalation_team: "",
  is_active: true,
};

export default function MasterForm({ kind }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const routes = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(routes.encComplaintTicket, routes[routeModule[kind]]);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    complaintModuleApi.readAll().then((res) => setModules(asArray(res))).catch(() => {});
    complaintCategoryApi.readAll().then((res) => setCategories(asArray(res))).catch(() => {});
    complaintPriorityApi.readAll().then((res) => setPriorities(asArray(res))).catch(() => {});
    complaintSubcategoryApi.readAll().then((res) => setSubcategories(asArray(res))).catch(() => {});
    complaintSourceApi.readAll().then((res) => setSources(asArray(res))).catch(() => {});
    complaintTeamApi.readAll().then((res) => setTeams(asArray(res))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.read(id).then((record: any) => {
      setForm({
        code: record.module_code ?? record.category_code ?? record.subcategory_code ?? record.priority_code ?? record.status_code ?? record.source_code ?? record.team_code ?? "",
        name: record.module_name ?? record.category_name ?? record.subcategory_name ?? record.priority_name ?? record.status_name ?? record.source_name ?? record.team_name ?? "",
        description: record.description ?? "",
        category: idOf(record.category),
        module: idOf(record.module),
        priority: idOf(record.priority),
        subcategory: idOf(record.subcategory),
        source: idOf(record.source),
        default_priority: idOf(record.default_priority),
        default_team: idOf(record.default_team),
        requires_location: record.requires_location ?? true,
        requires_media: Boolean(record.requires_media),
        requires_address_change_detail: Boolean(record.requires_address_change_detail),
        is_sensitive: Boolean(record.is_sensitive),
        is_final: Boolean(record.is_final),
        allow_reopen: Boolean(record.allow_reopen),
        is_field_team: Boolean(record.is_field_team),
        escalation_level: String(record.escalation_level ?? 1),
        department: idOf(record.department),
        lead_staff: idOf(record.lead_staff),
        escalates_to: idOf(record.escalates_to),
        assign_within_minutes: String(record.assign_within_minutes ?? ""),
        resolve_within_minutes: String(record.resolve_within_minutes ?? ""),
        working_hours_only: Boolean(record.working_hours_only),
        escalation_after_minutes: String(record.escalation_after_minutes ?? ""),
        escalation_team: idOf(record.escalation_team),
        is_active: record.is_active !== false,
      });
    }).catch((err) => Swal.fire("Error", errorText(err, "Unable to load record"), "error"));
  }, [api, id]);

  const setValue = (key: keyof typeof emptyForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (kind !== "slaRule" && (!form.code.trim() || !form.name.trim())) {
      Swal.fire("Missing fields", "Code and name are required.", "warning");
      return;
    }

    const common = { is_active: form.is_active };
    const payload: Record<string, unknown> =
      kind === "module"
        ? {
            ...common,
            module_code: form.code.trim().toUpperCase(),
            module_name: form.name.trim(),
            description: form.description,
          }
        : kind === "category"
        ? {
            ...common,
            category_code: form.code.trim().toUpperCase(),
            category_name: form.name.trim(),
            module: form.module || null,
            description: form.description,
            default_priority: form.default_priority || null,
            default_team: form.default_team || null,
            requires_location: form.requires_location,
            requires_media: form.requires_media,
            requires_address_change_detail: form.requires_address_change_detail,
            is_sensitive: form.is_sensitive,
          }
        : kind === "subcategory"
          ? {
              ...common,
              category: form.category,
              subcategory_code: form.code.trim().toUpperCase(),
              subcategory_name: form.name.trim(),
              default_priority: form.default_priority || null,
            }
          : kind === "priority"
            ? { ...common, priority_code: form.code.trim().toUpperCase(), priority_name: form.name.trim(), description: form.description }
            : kind === "status"
              ? { ...common, status_code: form.code.trim().toUpperCase(), status_name: form.name.trim(), is_final: form.is_final, allow_reopen: form.allow_reopen }
              : kind === "source"
                ? { ...common, source_code: form.code.trim().toUpperCase(), source_name: form.name.trim() }
                : kind === "team"
                ? {
                    ...common,
                    team_code: form.code.trim().toUpperCase(),
                    team_name: form.name.trim(),
                    department: form.department || null,
                    lead_staff: form.lead_staff || null,
                    escalates_to: form.escalates_to || null,
                    escalation_level: Number(form.escalation_level || 1),
                    is_field_team: form.is_field_team,
                  }
                : {
                    ...common,
                    category: form.category,
                    subcategory: form.subcategory || null,
                    priority: form.priority,
                    source: form.source || null,
                    assign_within_minutes: form.assign_within_minutes ? Number(form.assign_within_minutes) : null,
                    resolve_within_minutes: form.resolve_within_minutes ? Number(form.resolve_within_minutes) : null,
                    working_hours_only: form.working_hours_only,
                    escalation_after_minutes: form.escalation_after_minutes ? Number(form.escalation_after_minutes) : null,
                    escalation_team: form.escalation_team || null,
                  };

    if (kind === "subcategory" && !payload.category) {
      Swal.fire("Missing fields", "Category is required.", "warning");
      return;
    }
    if (kind === "slaRule" && (!payload.category || !payload.priority)) {
      Swal.fire("Missing fields", "Category and priority are required.", "warning");
      return;
    }

    setSaving(true);
    try {
      if (id) await api.update(id, payload);
      else await api.create(payload);
      Swal.fire("Saved", `${title[kind]} saved successfully.`, "success");
      navigate(listPath);
    } catch (err) {
      Swal.fire("Error", errorText(err, "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={`${id ? "Edit" : "Add"} ${title[kind]}`}>
      <form onSubmit={save} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {kind === "slaRule" && (
          <>
            <div>
              <Label>Category</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.category} onChange={(e) => setValue("category", e.target.value)} required>
                <option value="">Select category</option>
                {categories.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.category_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.priority} onChange={(e) => setValue("priority", e.target.value)} required>
                <option value="">Select priority</option>
                {priorities.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.priority_name}</option>)}
              </select>
            </div>
          </>
        )}
        {kind === "subcategory" && (
          <div>
            <Label>Category</Label>
            <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.category} onChange={(e) => setValue("category", e.target.value)} required>
              <option value="">Select category</option>
              {categories.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.category_name}</option>)}
            </select>
          </div>
        )}
        {kind !== "slaRule" && <div>
          <Label>Code</Label>
          <Input value={form.code} onChange={(e) => setValue("code", e.target.value)} required />
        </div>}
        {kind !== "slaRule" && <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setValue("name", e.target.value)} required />
        </div>}
        {kind === "category" && (
          <div>
            <Label>Module</Label>
            <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.module} onChange={(e) => setValue("module", e.target.value)}>
              <option value="">None</option>
              {modules.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.module_name}</option>)}
            </select>
          </div>
        )}
        {["category", "subcategory"].includes(kind) && (
          <div>
            <Label>Default Priority</Label>
            <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.default_priority} onChange={(e) => setValue("default_priority", e.target.value)}>
              <option value="">None</option>
              {priorities.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.priority_name}</option>)}
            </select>
          </div>
        )}
        {kind === "category" && (
          <div>
            <Label>Default Team</Label>
            <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.default_team} onChange={(e) => setValue("default_team", e.target.value)}>
              <option value="">None</option>
              {teams.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.team_name}</option>)}
            </select>
          </div>
        )}
        {kind === "slaRule" && (
          <>
            <div>
              <Label>Subcategory</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.subcategory} onChange={(e) => setValue("subcategory", e.target.value)}>
                <option value="">Any</option>
                {subcategories.filter((item) => !form.category || idOf(item.category) === form.category).map((item) => <option key={item.unique_id} value={item.unique_id}>{item.subcategory_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Source</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.source} onChange={(e) => setValue("source", e.target.value)}>
                <option value="">Any</option>
                {sources.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.source_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Assign Within Minutes</Label>
              <Input type="number" value={form.assign_within_minutes} onChange={(e) => setValue("assign_within_minutes", e.target.value)} />
            </div>
            <div>
              <Label>Resolve Within Minutes</Label>
              <Input type="number" value={form.resolve_within_minutes} onChange={(e) => setValue("resolve_within_minutes", e.target.value)} />
            </div>
            <div>
              <Label>Escalation After Minutes</Label>
              <Input type="number" value={form.escalation_after_minutes} onChange={(e) => setValue("escalation_after_minutes", e.target.value)} />
            </div>
            <div>
              <Label>Escalation Team</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.escalation_team} onChange={(e) => setValue("escalation_team", e.target.value)}>
                <option value="">None</option>
                {teams.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.team_name}</option>)}
              </select>
            </div>
          </>
        )}
        {kind === "team" && (
          <>
            <div>
              <Label>Escalates To</Label>
              <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.escalates_to} onChange={(e) => setValue("escalates_to", e.target.value)}>
                <option value="">None</option>
                {teams.filter((team) => team.unique_id !== id).map((item) => <option key={item.unique_id} value={item.unique_id}>{item.team_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Escalation Level</Label>
              <Input type="number" value={form.escalation_level} onChange={(e) => setValue("escalation_level", e.target.value)} />
            </div>
          </>
        )}
        {["module", "category", "priority"].includes(kind) && (
          <div className="md:col-span-2">
            <Label>Description</Label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={form.description} onChange={(e) => setValue("description", e.target.value)} />
          </div>
        )}
        <div className="md:col-span-2 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setValue("is_active", e.target.checked)} /> Active</label>
          {kind === "category" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requires_location} onChange={(e) => setValue("requires_location", e.target.checked)} /> Requires location</label>}
          {kind === "category" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requires_media} onChange={(e) => setValue("requires_media", e.target.checked)} /> Requires media</label>}
          {kind === "status" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_final} onChange={(e) => setValue("is_final", e.target.checked)} /> Final status</label>}
          {kind === "status" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_reopen} onChange={(e) => setValue("allow_reopen", e.target.checked)} /> Allow reopen</label>}
          {kind === "team" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_field_team} onChange={(e) => setValue("is_field_team", e.target.checked)} /> Field team</label>}
          {kind === "slaRule" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.working_hours_only} onChange={(e) => setValue("working_hours_only", e.target.checked)} /> Working hours only</label>}
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(listPath)}>Cancel</button>
          <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </ComponentCard>
  );
}
