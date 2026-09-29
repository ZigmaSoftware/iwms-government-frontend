/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import notify from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import {
  complaintCategoryApi,
  complaintPriorityApi,
  complaintSourceApi,
  complaintSubcategoryApi,
  fetchHierarchyLevels,
} from "@/features/complaintTicketing/api";
import type { ComplaintSlaEscalationLevel, HierarchyLevelOption } from "@/features/complaintTicketing/types";
import { asArray, errorText, idOf, roleLabel } from "../utils";
import { buildComplaintMasterSchema } from "@/schemas/core_modules/complaintManagement/complaintMaster.schema";
import { toNotifyMessage } from "@/lib/zodErrors";
import Select from "@/components/form/Select";
import LocationFields, {
  emptyGeo,
  LOCAL_BODY_LEVELS,
  type GeoLocationValue,
} from "@/pages/admin/modules/masters/shared/LocationHierarchyFields";
import { MASTER_CONFIG, type MasterKind } from "./masterConfig";

// Optional pickers keep an explicit "None"/"Any" entry so a chosen value can be
// cleared again; the sentinel maps back to "" in the form state.
const EMPTY_OPTION = "__none__";
const withEmpty = (label: string, options: { value: string; label: string }[]) => [{ value: EMPTY_OPTION, label }, ...options];
const fromOptional = (value: string) => (value === EMPTY_OPTION ? "" : value);

/** SLA rule scope columns for a picked location (blank = every area). */
const scopeOf = (geo: GeoLocationValue): Record<string, string | null> => ({
  country_id: geo.countryId || null,
  state_id: geo.stateId || null,
  district_id: geo.districtId || null,
  area_type_id: geo.areaTypeId || null,
  ...Object.fromEntries(
    LOCAL_BODY_LEVELS.map(({ value }) => [value, geo.localBodyLevel === value && geo.localBodyId ? geo.localBodyId : null]),
  ),
});

const geoOf = (record: any): GeoLocationValue => {
  const localBodyLevel = LOCAL_BODY_LEVELS.find((item) => record[item.value])?.value ?? "";
  return {
    countryId: String(record.country_id ?? ""),
    stateId: String(record.state_id ?? ""),
    districtId: String(record.district_id ?? ""),
    areaTypeId: String(record.area_type_id ?? ""),
    localBodyLevel,
    localBodyId: localBodyLevel ? String(record[localBodyLevel] ?? "") : "",
  };
};

// One editable row per Staff Hierarchy level on the SLA rule form.
type EscalationLevelRow = {
  level: number;
  roles: string;
  enabled: boolean;
  resolve_within_minutes: string;
};

type Props = {
  kind: MasterKind;
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
  requires_location: true,
  requires_media: false,
  requires_address_change_detail: false,
  is_sensitive: false,
  is_final: false,
  allow_reopen: false,
  working_hours_only: false,
  is_active: true,
};

export default function MasterForm({ kind }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const routes = getEncryptedRoute();
  const config = MASTER_CONFIG[kind];
  const { listPath } = createCrudRoutePaths(routes.encComplaintTicket, routes[config.routeKey]);
  const [searchParams] = useSearchParams();
  // A subcategory created via the merged Categories & Subcategories screen's
  // "Add Subcategory" button (which links here with `?category=<id>`) should
  // return there with that category still selected, not to the standalone
  // Subcategories list.
  const prefillCategoryId = kind === "subcategory" ? searchParams.get("category") : null;
  const returnPath = prefillCategoryId
    ? `${createCrudRoutePaths(routes.encComplaintTicket, routes.encComplaintCategories).listPath}?selected=${prefillCategoryId}`
    : listPath;
  // The merged Categories & Subcategories screen links "Add Subcategory" here
  // with `?category=<id>` so the driver doesn't have to re-pick the category
  // they were already looking at. Only applies to a fresh subcategory (an
  // edit load below overwrites `category` with the record's own value).
  const [form, setForm] = useState(() =>
    kind === "subcategory" && searchParams.get("category")
      ? { ...emptyForm, category: searchParams.get("category") ?? "" }
      : emptyForm,
  );
  const [categories, setCategories] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevelOption[]>([]);
  const [savedEscalationLevels, setSavedEscalationLevels] = useState<ComplaintSlaEscalationLevel[]>([]);
  const [escalationLevels, setEscalationLevels] = useState<EscalationLevelRow[]>([]);
  const [geo, setGeo] = useState<GeoLocationValue>(emptyGeo);
  const [saving, setSaving] = useState(false);

  const api = useMemo(() => config.api(), [config]);

  useEffect(() => {
    MASTER_CONFIG.module.api().readAll().then((res) => setModules(asArray(res))).catch(() => {});
    complaintCategoryApi.readAll().then((res) => setCategories(asArray(res))).catch(() => {});
    complaintPriorityApi.readAll().then((res) => setPriorities(asArray(res))).catch(() => {});
    complaintSubcategoryApi.readAll().then((res) => setSubcategories(asArray(res))).catch(() => {});
    complaintSourceApi.readAll().then((res) => setSources(asArray(res))).catch(() => {});
  }, []);

  // The levels (and roles at them) follow the chosen location: Anthiyur
  // Panchayat and Chennai Corporation can each run their own chain.
  const scopeKey = JSON.stringify(scopeOf(geo));
  useEffect(() => {
    if (kind !== "slaRule") return;
    const params = Object.fromEntries(
      Object.entries(JSON.parse(scopeKey) as Record<string, string | null>).filter(([, value]) => value),
    ) as Record<string, string>;
    fetchHierarchyLevels(params).then((res) => setHierarchyLevels(asArray(res))).catch(() => setHierarchyLevels([]));
  }, [kind, scopeKey]);

  // One escalation row per Staff Hierarchy level, carrying over the rule's
  // saved window for that level (a level the rule never configured starts
  // enabled and empty).
  useEffect(() => {
    if (kind !== "slaRule") return;
    const saved = Object.fromEntries(savedEscalationLevels.map((row) => [row.level, row]));
    setEscalationLevels(
      hierarchyLevels.map((option) => ({
        level: option.level,
        roles: option.roles.map((role) => roleLabel(role.name)).join(", ") || "-",
        enabled: saved[option.level]?.is_enabled ?? true,
        resolve_within_minutes: String(saved[option.level]?.resolve_within_minutes ?? ""),
      })),
    );
  }, [kind, hierarchyLevels, savedEscalationLevels]);

  const setEscalationLevel = (index: number, patch: Partial<EscalationLevelRow>) =>
    setEscalationLevels((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  useEffect(() => {
    if (!id) return;
    api.read(id).then((record: any) => {
      setForm({
        code: record.module_code ?? record.category_code ?? record.subcategory_code ?? record.priority_code ?? record.status_code ?? record.source_code ?? "",
        name: record.module_name ?? record.category_name ?? record.subcategory_name ?? record.priority_name ?? record.status_name ?? record.source_name ?? "",
        description: record.description ?? "",
        category: idOf(record.category_id ?? record.category),
        module: idOf(record.module_id ?? record.module),
        priority: idOf(record.priority_id ?? record.priority),
        subcategory: idOf(record.subcategory_id ?? record.subcategory),
        source: idOf(record.source_id ?? record.source),
        default_priority: idOf(record.default_priority_id ?? record.default_priority),
        requires_location: record.requires_location ?? true,
        requires_media: Boolean(record.requires_media),
        requires_address_change_detail: Boolean(record.requires_address_change_detail),
        is_sensitive: Boolean(record.is_sensitive),
        is_final: Boolean(record.is_final),
        allow_reopen: Boolean(record.allow_reopen),
        working_hours_only: Boolean(record.working_hours_only),
        is_active: record.is_active !== false,
      });
      setSavedEscalationLevels(asArray<ComplaintSlaEscalationLevel>(record.escalation_levels));
      if (kind === "slaRule") setGeo(geoOf(record));
    }).catch((err) => notify.fire("Error", errorText(err, "Unable to load record"), "error"));
  }, [api, id, kind]);

  const setValue = (key: keyof typeof emptyForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = buildComplaintMasterSchema(kind).safeParse(form);
    if (!result.success) {
      notify.fire("Invalid fields", toNotifyMessage(result.error), "warning");
      return;
    }
    const missingWindow = escalationLevels.find(
      (row) => row.enabled && !(Number(row.resolve_within_minutes) > 0),
    );
    if (kind === "slaRule" && missingWindow) {
      notify.fire("Invalid fields", `Enter resolve-within minutes for enabled level L${missingWindow.level}.`, "warning");
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
            module_id: form.module || null,
            description: form.description,
            default_priority_id: form.default_priority || null,
            requires_location: form.requires_location,
            requires_media: form.requires_media,
            requires_address_change_detail: form.requires_address_change_detail,
            is_sensitive: form.is_sensitive,
          }
        : kind === "subcategory"
          ? {
              ...common,
              category_id: form.category,
              subcategory_code: form.code.trim().toUpperCase(),
              subcategory_name: form.name.trim(),
              default_priority_id: form.default_priority || null,
            }
          : kind === "priority"
            ? { ...common, priority_code: form.code.trim().toUpperCase(), priority_name: form.name.trim(), description: form.description }
            : kind === "status"
              ? { ...common, status_code: form.code.trim().toUpperCase(), status_name: form.name.trim(), is_final: form.is_final, allow_reopen: form.allow_reopen }
              : kind === "source"
                ? { ...common, source_code: form.code.trim().toUpperCase(), source_name: form.name.trim() }
                : {
                    ...common,
                    category_id: form.category,
                    subcategory_id: form.subcategory || null,
                    priority_id: form.priority,
                    source_id: form.source || null,
                    ...scopeOf(geo),
                    working_hours_only: form.working_hours_only,
                    // Disabled levels without a window are simply not stored.
                    escalation_levels: escalationLevels
                      .filter((row) => Number(row.resolve_within_minutes) > 0)
                      .map((row) => ({
                        level: row.level,
                        is_enabled: row.enabled,
                        resolve_within_minutes: Number(row.resolve_within_minutes),
                      })),
                  };

    setSaving(true);
    try {
      if (id) await api.update(id, payload);
      else await api.create(payload);
      notify.fire("Saved", `${config.title} saved successfully.`, "success");
      navigate(returnPath);
    } catch (err) {
      notify.fire("Error", errorText(err, "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const toOptions = (items: any[], labelKey: string) =>
    items.map((item) => ({ value: item.unique_id, label: item[labelKey] }));
  const categoryOptions = toOptions(categories, "category_name");
  const priorityOptions = toOptions(priorities, "priority_name");
  const moduleOptions = toOptions(modules, "module_name");
  const sourceOptions = toOptions(sources, "source_name");
  const subcategoryOptions = toOptions(
    subcategories.filter((item) => !form.category || idOf(item.category_id ?? item.category) === form.category),
    "subcategory_name",
  );

  return (
    <ComponentCard title={`${id ? "Edit" : "Add"} ${config.title}`}>
      <form onSubmit={save} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {kind === "slaRule" && (
          <div className="md:col-span-2">
            <Label>Location</Label>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Leave blank for the general rule that applies everywhere. Pick a district or a local body (e.g. Anthiyur
              Panchayat, Chennai Corporation) to give tickets of this category from that area their own escalation levels
              and timings — every other area keeps using the general rule. To add area-specific timings, create a new
              rule rather than adding a location to the general one.
            </p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <LocationFields value={geo} onChange={setGeo} optional />
            </div>
          </div>
        )}
        {kind === "slaRule" && (
          <>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onChange={(v) => setValue("category", v)} options={categoryOptions} placeholder="Select category" className="w-full" required />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onChange={(v) => setValue("priority", v)} options={priorityOptions} placeholder="Select priority" className="w-full" required />
            </div>
          </>
        )}
        {kind === "subcategory" && (
          <div>
            <Label>Category</Label>
            <Select value={form.category} onChange={(v) => setValue("category", v)} options={categoryOptions} placeholder="Select category" className="w-full" required />
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
            <Select value={form.module} onChange={(v) => setValue("module", fromOptional(v))} options={withEmpty("None", moduleOptions)} placeholder="None" className="w-full" />
          </div>
        )}
        {["category", "subcategory"].includes(kind) && (
          <div>
            <Label>Default Priority</Label>
            <Select value={form.default_priority} onChange={(v) => setValue("default_priority", fromOptional(v))} options={withEmpty("None", priorityOptions)} placeholder="None" className="w-full" />
          </div>
        )}
        {kind === "slaRule" && (
          <>
            <div>
              <Label>Subcategory</Label>
              <Select value={form.subcategory} onChange={(v) => setValue("subcategory", fromOptional(v))} options={withEmpty("Any", subcategoryOptions)} placeholder="Any" className="w-full" />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onChange={(v) => setValue("source", fromOptional(v))} options={withEmpty("Any", sourceOptions)} placeholder="Any" className="w-full" />
            </div>
            <div className="md:col-span-2">
              <Label>Escalation Levels</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                One row per Staff Hierarchy level of the chain that applies in the chosen location. Enable only the levels that should take part: a
                ticket is first assigned to the lowest enabled level&apos;s staff for its area and,
                if not resolved in time, auto-escalates to the next enabled level above it. Disabled
                levels (e.g. Driver, Operator) are skipped entirely.
              </p>
              {escalationLevels.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No Staff Hierarchy applies to this location yet — set one up under Role Assigns &rsaquo; Staff Hierarchy first.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {escalationLevels.map((row, index) => (
                    <div key={row.level} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Enable level ${row.level}`}
                        checked={row.enabled}
                        onChange={(e) => setEscalationLevel(index, { enabled: e.target.checked })}
                      />
                      <div className="w-10 text-sm font-medium text-muted-foreground">L{row.level}</div>
                      <div className="w-56 text-sm">{row.roles}</div>
                      <Input
                        type="number"
                        min={1}
                        className="flex-1"
                        placeholder="Resolve within minutes"
                        disabled={!row.enabled}
                        value={row.resolve_within_minutes}
                        onChange={(e) => setEscalationLevel(index, { resolve_within_minutes: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}
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
          {kind === "slaRule" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.working_hours_only} onChange={(e) => setValue("working_hours_only", e.target.checked)} /> Working hours only (escalation times count 09:00–18:00, Mon–Sat)</label>}
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(returnPath)}>Cancel</button>
          <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </ComponentCard>
  );
}
