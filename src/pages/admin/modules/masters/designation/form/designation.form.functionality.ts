import { departmentApi, designationApi } from "@/helpers/admin";
import type { DepartmentOption, DesignationFormValues } from "./designation.form.types";

/** Loads active departments for the Designation form's dropdown. */
export async function loadDepartmentOptions(): Promise<DepartmentOption[]> {
  const res: any = await departmentApi.readAll({ params: { status: "active" } });
  const list = Array.isArray(res) ? res : (res?.data?.results ?? res?.data ?? []);
  return list
    .filter((d: any) => d?.is_active !== false && d?.is_deleted !== true)
    .map((d: any) => ({
      value: String(d.unique_id ?? d.id ?? ""),
      label: d.department_code ? `${d.department_name} (${d.department_code})` : d.department_name,
    }));
}

/** Loads one Designation record for editing, in the form's field shape. */
export async function loadDesignationRecord(id: string): Promise<DesignationFormValues> {
  const record: any = await designationApi.read(id);
  return {
    designation_name: record.designation_name ?? "",
    department_id: record.department_id ? String(record.department_id) : "",
    description: record.description ?? "",
    status: record.is_active === false ? "inactive" : "active",
  };
}

/** Creates or updates a Designation record. */
export async function submitDesignation(values: DesignationFormValues, isEdit: boolean, id?: string) {
  const payload = {
    designation_name: values.designation_name,
    department_id: values.department_id,
    description: values.description,
    status: values.status,
  };
  if (isEdit && id) {
    await designationApi.update(id, payload);
  } else {
    await designationApi.create(payload);
  }
}
