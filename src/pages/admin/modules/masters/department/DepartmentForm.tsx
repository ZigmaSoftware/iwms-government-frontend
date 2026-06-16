import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import { Input } from "@/components/ui/input";
import Select from "@/components/form/Select";
import { departmentApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";

const { encMasters, encDepartments } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encDepartments);

export default function DepartmentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    department_name: "",
    department_code: "",
    description: "",
    status: "active",
  });

  useEffect(() => {
    if (!id) return;
    departmentApi.read(id).then((record: any) => {
      setForm({
        department_name: record.department_name ?? "",
        department_code: record.department_code ?? "",
        description: record.description ?? "",
        status: record.is_active === false ? "inactive" : "active",
      });
    });
  }, [id]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.department_name.trim() || !form.department_code.trim()) {
      Swal.fire(t("common.error"), "Department name and code are required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        department_code: form.department_code.trim().toUpperCase(),
      };
      if (isEdit && id) {
        await departmentApi.update(id, payload);
      } else {
        await departmentApi.create(payload);
      }
      Swal.fire(t("common.success"), "Department saved successfully", "success");
      navigate(LIST_PATH);
    } catch (error: any) {
      Swal.fire(
        t("common.error"),
        error?.response?.data ? JSON.stringify(error.response.data) : "Save failed",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard
      title={isEdit ? "Edit Department" : "Add Department"}
      desc="Department Master"
    >
      <form onSubmit={save} className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="department_name">Department Name</Label>
          <Input
            id="department_name"
            value={form.department_name}
            onChange={(e) => setForm((prev) => ({ ...prev, department_name: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="department_code">Department Code</Label>
          <Input
            id="department_code"
            value={form.department_code}
            onChange={(e) => setForm((prev) => ({ ...prev, department_code: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={form.status}
            onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
            options={[
              { value: "active", label: t("common.active") },
              { value: "inactive", label: t("common.inactive") },
            ]}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={() => navigate(LIST_PATH)}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={saving} className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60">
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
