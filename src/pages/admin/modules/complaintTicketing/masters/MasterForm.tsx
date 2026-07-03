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
  complaintPriorityApi,
  complaintSourceApi,
  complaintStatusApi,
  complaintSubcategoryApi,
  complaintTeamApi,
} from "@/features/complaintTicketing/api";
import { asArray, errorText, idOf } from "../utils";

type MasterKind = "category" | "subcategory" | "priority" | "status" | "source" | "team";

type Props = {
  kind: MasterKind;
};

const routeModule: Record<MasterKind, keyof ReturnType<typeof getEncryptedRoute>> = {
  category: "encComplaintCategories",
  subcategory: "encComplaintSubcategories",
  priority: "encComplaintPriorities",
  status: "encComplaintStatuses",
  source: "encComplaintSources",
  team: "encComplaintTeams",
};

const title: Record<MasterKind, string> = {
  category: "Complaint Category",
  subcategory: "Complaint Subcategory",
  priority: "Complaint Priority",
  status: "Complaint Status",
  source: "Complaint Source",
  team: "Complaint Team",
};

const emptyForm = {
  code: "",
  name: "",
  description: "",
  category: "",
  default_priority: "",
  default_team: "",
  sort_order: "0",
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
  is_active: true,
};

export default function MasterForm({ kind }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const routes = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(routes.encComplaintTicket, routes[routeModule[kind]]);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const api = useMemo(() => {
    if (kind === "category") return complaintCategoryApi;
    if (kind === "subcategory") return complaintSubcategoryApi;
    if (kind === "priority") return complaintPriorityApi;
    if (kind === "status") return complaintStatusApi;
    if (kind === "source") return complaintSourceApi;
    return complaintTeamApi;
  }, [kind]);

  useEffect(() => {
    complaintCategoryApi.readAll().then((res) => setCategories(asArray(res))).catch(() => {});
    complaintPriorityApi.readAll().then((res) => setPriorities(asArray(res))).catch(() => {});
    complaintTeamApi.readAll().then((res) => setTeams(asArray(res))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    api.read(id).then((record: any) => {
      setForm({
        code: record.category_code ?? record.subcategory_code ?? record.priority_code ?? record.status_code ?? record.source_code ?? record.team_code ?? "",
        name: record.category_name ?? record.subcategory_name ?? record.priority_name ?? record.status_name ?? record.source_name ?? record.team_name ?? "",
        description: record.description ?? "",
        category: idOf(record.category),
        default_priority: idOf(record.default_priority),
        default_team: idOf(record.default_team),
        sort_order: String(record.sort_order ?? 0),
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
        is_active: record.is_active !== false,
      });
    }).catch((err) => Swal.fire("Error", errorText(err, "Unable to load record"), "error"));
  }, [api, id]);

  const setValue = (key: keyof typeof emptyForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      Swal.fire("Missing fields", "Code and name are required.", "warning");
      return;
    }

    const common = { is_active: form.is_active };
    const payload: Record<string, unknown> =
      kind === "category"
        ? {
            ...common,
            category_code: form.code.trim().toUpperCase(),
            category_name: form.name.trim(),
            description: form.description,
            default_priority: form.default_priority || null,
            default_team: form.default_team || null,
            requires_location: form.requires_location,
            requires_media: form.requires_media,
            requires_address_change_detail: form.requires_address_change_detail,
            is_sensitive: form.is_sensitive,
            sort_order: Number(form.sort_order || 0),
          }
        : kind === "subcategory"
          ? {
              ...common,
              category: form.category,
              subcategory_code: form.code.trim().toUpperCase(),
              subcategory_name: form.name.trim(),
              default_priority: form.default_priority || null,
              sort_order: Number(form.sort_order || 0),
            }
          : kind === "priority"
            ? { ...common, priority_code: form.code.trim().toUpperCase(), priority_name: form.name.trim(), description: form.description, sort_order: Number(form.sort_order || 0) }
            : kind === "status"
              ? { ...common, status_code: form.code.trim().toUpperCase(), status_name: form.name.trim(), is_final: form.is_final, allow_reopen: form.allow_reopen, sort_order: Number(form.sort_order || 0) }
              : kind === "source"
                ? { ...common, source_code: form.code.trim().toUpperCase(), source_name: form.name.trim() }
                : {
                    ...common,
                    team_code: form.code.trim().toUpperCase(),
                    team_name: form.name.trim(),
                    department: form.department || null,
                    lead_staff: form.lead_staff || null,
                    escalates_to: form.escalates_to || null,
                    escalation_level: Number(form.escalation_level || 1),
                    is_field_team: form.is_field_team,
                  };

    if (kind === "subcategory" && !payload.category) {
      Swal.fire("Missing fields", "Category is required.", "warning");
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
        {kind === "subcategory" && (
          <div>
            <Label>Category</Label>
            <select className="h-11 w-full rounded-md border px-3 text-sm" value={form.category} onChange={(e) => setValue("category", e.target.value)} required>
              <option value="">Select category</option>
              {categories.map((item) => <option key={item.unique_id} value={item.unique_id}>{item.category_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <Label>Code</Label>
          <Input value={form.code} onChange={(e) => setValue("code", e.target.value)} required />
        </div>
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setValue("name", e.target.value)} required />
        </div>
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
        {["category", "subcategory", "priority", "status"].includes(kind) && (
          <div>
            <Label>Sort Order</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setValue("sort_order", e.target.value)} />
          </div>
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
        {["category", "priority"].includes(kind) && (
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
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(listPath)}>Cancel</button>
          <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </ComponentCard>
  );
}
