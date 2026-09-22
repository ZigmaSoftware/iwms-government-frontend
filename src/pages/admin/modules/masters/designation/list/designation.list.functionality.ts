import { designationApi } from "@/helpers/admin";
import { resolveSimpleOrdering, toRecordList } from "../../shared/recordHelpers";
import type { DesignationListRecord, SortOrder } from "./designation.list.types";

export const SORTABLE_FIELDS = new Set(["designation_name"]);

export function resolveOrdering(sortField: string | undefined, sortOrder: SortOrder) {
  return resolveSimpleOrdering(sortField, sortOrder, SORTABLE_FIELDS);
}

/** Fetches a page of Designation list rows. */
export async function loadDesignationRows(
  page: number,
  limit: number,
  search: string,
  ordering?: string,
) {
  const response = await designationApi.readAllwithPaginated(page, limit, {
    params: {
      ...(search ? { search } : {}),
      ...(ordering ? { ordering } : {}),
    },
  });
  const rows = toRecordList<DesignationListRecord>(response);
  const totalRecords =
    typeof (response as { count?: number })?.count === "number"
      ? (response as { count: number }).count
      : rows.length;
  return { rows, totalRecords };
}

export async function loadDesignationsForExport() {
  return toRecordList<DesignationListRecord>(await designationApi.readAllForExport());
}

export async function updateDesignationStatus(row: DesignationListRecord, value: boolean) {
  await designationApi.update(String(row.unique_id), {
    designation_name: row.designation_name,
    department_id: row.department_id ?? null,
    description: row.description ?? "",
    status: value ? "active" : "inactive",
  });
}

export async function deleteDesignation(id: string) {
  await designationApi.delete(id);
}
