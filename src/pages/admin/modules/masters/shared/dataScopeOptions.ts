import { getStoredDataScope, type DataScope, type DataScopeRef } from "@/utils/authStorage";

export type ScopeOption = {
  value: string;
  label: string;
};

export type ScopeLevel =
  | "state"
  | "district"
  | "area_type"
  | "corporation"
  | "municipality"
  | "town_panchayat"
  | "panchayat_union"
  | "panchayat";

/**
 * The logged-in user's own hierarchy value for `level`, from their Data
 * Scope (set at login regardless of what screen permissions they hold on
 * that level's own master — Screen Permission gates the level's own
 * menu/list page, not what a *different* form's dropdown may show).
 */
export const scopeOption = (level: ScopeLevel): ScopeOption | null => {
  const scope = getStoredDataScope() as Pick<DataScope, ScopeLevel> | null;
  const ref: DataScopeRef = scope?.[level] ?? null;
  if (ref?.unique_id && ref?.name) {
    return { value: ref.unique_id, label: ref.name };
  }
  return null;
};

/**
 * Merge a permission-gated API fetch result with the user's own Data Scope
 * value for that level, so the dropdown always includes at least their own
 * scoped value even when the fetch comes back empty (403/no screen
 * permission on that level) or simply doesn't include it.
 */
export const mergeWithScopeOption = (
  fetched: ScopeOption[],
  level: ScopeLevel,
): ScopeOption[] => {
  const scoped = scopeOption(level);
  if (!scoped) return fetched;
  if (fetched.some((item) => item.value === scoped.value)) return fetched;
  return [scoped, ...fetched];
};

/**
 * Same as `mergeWithScopeOption`, but for option shapes that carry extra
 * parent-id fields (e.g. `{ stateId, districtId }`) used to filter child
 * dropdowns — `extra` supplies those fields on the synthesized scope option
 * so it still participates correctly in that filtering.
 */
export const mergeWithScopeOptionExtra = <T extends ScopeOption>(
  fetched: T[],
  level: ScopeLevel,
  extra: Partial<Omit<T, "value" | "label">>,
): T[] => {
  const scoped = scopeOption(level);
  if (!scoped) return fetched;
  if (fetched.some((item) => item.value === scoped.value)) return fetched;
  return [{ ...scoped, ...extra } as T, ...fetched];
};
