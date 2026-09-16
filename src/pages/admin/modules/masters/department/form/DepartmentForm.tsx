import ComponentCard from "@/components/common/ComponentCard";

import DepartmentFields from "./DepartmentFields";
import { useDepartmentForm } from "./useDepartment";

export default function DepartmentForm() {
  const { t, isEdit, isSubmitting, form, onSubmit, onCancel } = useDepartmentForm();

  return (
    <ComponentCard title={isEdit ? "Edit Department" : "Add Department"} desc="Department Master">
      <form onSubmit={onSubmit} noValidate>
        <DepartmentFields form={form} />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="rounded border px-4 py-2" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {isSubmitting ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
