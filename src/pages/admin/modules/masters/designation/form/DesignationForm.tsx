import ComponentCard from "@/components/common/ComponentCard";

import DesignationFields from "./DesignationFields";
import { useDesignationForm } from "./useDesignation";

export default function DesignationForm() {
  const { t, isEdit, isSubmitting, form, departmentOptions, onSubmit, onCancel } = useDesignationForm();

  return (
    <ComponentCard title={isEdit ? "Edit Designation" : "Add Designation"} desc="Designation Master">
      <form onSubmit={onSubmit} noValidate>
        <DesignationFields form={form} departmentOptions={departmentOptions} />
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
