import { departmentApi } from "@/helpers/admin";
import { resolveSimpleOrdering, toRecordList } from "../../shared/recordHelpers";
import type { DepartmentListRecord, SortOrder } from "./department.list.types";

export const SORTABLE_FIELDS = new Set(["department_name", "department_code"]);

export function resolveOrdering(sortField: string | undefined, sortOrder: SortOrder) {
  return resolveSimpleOrdering(sortField, sortOrder, SORTABLE_FIELDS);
}

/** Fetches a page of Department list rows. */
export async function loadDepartmentRows(
  page: number,
  limit: number,
  search: string,
  ordering?: string,
) {
  const response = await departmentApi.readAllwithPaginated(page, limit, {
    params: {
      ...(search ? { search } : {}),
      ...(ordering ? { ordering } : {}),
    },
  });
  const rows = toRecordList<DepartmentListRecord>(response);
  const totalRecords =
    typeof (response as { count?: number })?.count === "number"
      ? (response as { count: number }).count
      : rows.length;
  return { rows, totalRecords };
}

export async function loadDepartmentsForExport() {
  return toRecordList<DepartmentListRecord>(await departmentApi.readAllForExport());
}

export async function updateDepartmentStatus(row: DepartmentListRecord, value: boolean) {
  await departmentApi.update(String(row.unique_id), {
    department_name: row.department_name,
    department_code: row.department_code,
    description: row.description ?? "",
    status: value ? "active" : "inactive",
  });
}

export async function deleteDepartment(id: string) {
  await departmentApi.delete(id);
}
