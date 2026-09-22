import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import Label from "@/components/form/Label";
import { Input } from "@/components/ui/input";
import Select from "@/components/form/Select";
import { FieldError } from "@/components/form/FieldError";

import type { DepartmentOption, DesignationFormValues } from "./designation.form.types";

export type DesignationFieldsProps = {
  form: UseFormReturn<DesignationFormValues>;
  departmentOptions: DepartmentOption[];
};

/** Pure input fields for the Designation form — no data fetching, no API calls. */
export default function DesignationFields({ form, departmentOptions }: DesignationFieldsProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div>
        <Label htmlFor="designation_name">Designation Name</Label>
        <Input id="designation_name" {...register("designation_name")} />
        <FieldError message={errors.designation_name?.message} />
      </div>
      <div>
        <Label htmlFor="department_id">
          Department <span className="text-red-500 ml-1">*</span>
        </Label>
        <Controller
          control={control}
          name="department_id"
          render={({ field }) => (
            <Select
              id="department_id"
              value={field.value ?? ""}
              onChange={field.onChange}
              options={departmentOptions}
              placeholder="Select Department"
            />
          )}
        />
        <FieldError message={errors.department_id?.message} />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              id="status"
              value={field.value ?? ""}
              onChange={field.onChange}
              options={[
                { value: "active", label: t("common.active") },
                { value: "inactive", label: t("common.inactive") },
              ]}
            />
          )}
        />
        <FieldError message={errors.status?.message} />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>
    </div>
  );
}
