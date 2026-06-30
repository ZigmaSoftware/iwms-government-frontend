import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";
import { hierarchyLevelApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { getEncryptedRoute } from "@/utils/routeCache";

import type { HierarchyLevel } from "./types";

const { encMasters, encHierarchyLevels } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encHierarchyLevels);

export default function HierarchyLevelForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    order: "",
    is_active: true,
  });

  useEffect(() => {
    if (!id) return;
    hierarchyLevelApi.read(id).then((record: HierarchyLevel) => {
      setForm({
        name: record.name ?? "",
        code: record.code ?? "",
        order: String(record.order ?? ""),
        is_active: record.is_active !== false,
      });
    });
  }, [id]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const order = Number(form.order);
    if (!form.name.trim() || !Number.isInteger(order) || order <= 0) {
      Swal.fire("Missing details", "Level name and positive order are required.", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        order,
        is_active: form.is_active,
      };
      if (isEdit && id) {
        await hierarchyLevelApi.update(id, payload);
      } else {
        await hierarchyLevelApi.create(payload);
      }
      Swal.fire("Success", "Hierarchy level saved successfully.", "success");
      navigate(LIST_PATH);
    } catch (error) {
      const detail = (error as { response?: { data?: unknown }; message?: string })?.response?.data;
      Swal.fire("Error", detail ? JSON.stringify(detail) : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Hierarchy Level" : "Add Hierarchy Level"}>
      <form onSubmit={save} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Level Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="order">Order</Label>
          <Input
            id="order"
            type="number"
            min="1"
            value={form.order}
            onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="is_active">Status</Label>
          <Select
            id="is_active"
            value={form.is_active ? "true" : "false"}
            onChange={(value) => setForm((prev) => ({ ...prev, is_active: value === "true" }))}
            options={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
          />
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(LIST_PATH)}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
