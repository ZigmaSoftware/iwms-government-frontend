import { areaTypeApi } from "@/helpers/admin";
import { formatCoordinates } from "../../shared/formatCoordinates";
import { displayValue, toRecordList } from "../../shared/recordHelpers";

import type { AreaTypeListRecord, SortOrder } from "./areaType.list.types";

// Backend `ordering_fields = ["name", "is_active"]`. The `area_type_name`
// column is serialized from the model's `name` field (source="name" in
// AreaTypeSerializer), so sorting that column must send `ordering=name`.
export const SORTABLE_FIELDS = new Set(["area_type_name", "is_active"]);
export const FIELD_TO_ORDERING: Record<string, string> = {
  area_type_name: "name",
  is_active: "is_active",
};

export const LIST_COLUMNS = [
  { field: "state_name", header: "State" },
  { field: "district_name", header: "District" },
  { field: "area_type_name", header: "Area Type" },
  { field: "coordinates", header: "Coordinates" },
];

export const areaTypeColumnBody = (row: AreaTypeListRecord, field: string) =>
  field === "coordinates"
    ? formatCoordinates(row.coordinates as never)
    : displayValue(row[field]);

/** Fetches a page of Area Type list rows. */
export async function loadAreaTypeRows(
  page: number,
  limit: number,
  search: string,
  ordering?: string,
) {
  const response = await areaTypeApi.readAllwithPaginated(page, limit, {
    params: {
      ...(search ? { search } : {}),
      ...(ordering ? { ordering } : {}),
    },
  });
  const rows = toRecordList<AreaTypeListRecord>(response);
  const totalRecords =
    typeof (response as { count?: number })?.count === "number"
      ? (response as { count: number }).count
      : rows.length;
  return { rows, totalRecords };
}

export async function loadAreaTypesForExport() {
  return toRecordList<AreaTypeListRecord>(await areaTypeApi.readAllForExport());
}

export async function updateAreaTypeStatus(id: string, value: boolean) {
  await areaTypeApi.update(id, { is_active: value });
}

export async function deleteAreaType(id: string) {
  await areaTypeApi.delete(id);
}

export function resolveOrdering(sortField: string | undefined, sortOrder: SortOrder) {
  return sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${FIELD_TO_ORDERING[sortField] ?? sortField}`
    : undefined;
}
