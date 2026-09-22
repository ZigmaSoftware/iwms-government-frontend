import { departmentApi } from "@/helpers/admin";
import type { DepartmentFormValues } from "./department.form.types";

/** Loads one Department record for editing, in the form's field shape. */
export async function loadDepartmentRecord(id: string): Promise<DepartmentFormValues> {
  const record: any = await departmentApi.read(id);
  return {
    department_name: record.department_name ?? "",
    department_code: record.department_code ?? "",
    description: record.description ?? "",
    status: record.is_active === false ? "inactive" : "active",
  };
}

/** Creates or updates a Department record. */
export async function submitDepartment(values: DepartmentFormValues, isEdit: boolean, id?: string) {
  const payload = {
    ...values,
    department_code: values.department_code.trim().toUpperCase(),
  };
  if (isEdit && id) {
    await departmentApi.update(id, payload);
  } else {
    await departmentApi.create(payload);
  }
}
