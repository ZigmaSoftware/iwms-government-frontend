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
  | "panchayat"
  | "ward";

/** Plural Data Scope key that carries every value at `level`, when one exists. */
const PLURAL_SCOPE_KEY: Partial<Record<ScopeLevel, keyof DataScope>> = {
  corporation: "corporations",
  municipality: "municipalities",
  town_panchayat: "town_panchayats",
  panchayat_union: "panchayat_unions",
  panchayat: "panchayats",
  ward: "wards",
};

/**
 * The logged-in user's own hierarchy value for `level`, from their Data
 * Scope (set at login regardless of what screen permissions they hold on
 * that level's own master — Screen Permission gates the level's own
 * menu/list page, not what a *different* form's dropdown may show).
 *
 * When the staff is scoped to several values at `level`, this returns only
 * the first — use `scopeOptions(level)` when you need the full set (e.g. to
 * decide whether a field should lock to one value or offer a restricted
 * choice among several).
 */
export const scopeOption = (level: ScopeLevel): ScopeOption | null => {
  const scope = getStoredDataScope() as Record<string, unknown> | null;
  const ref = (scope?.[level] as DataScopeRef) ?? null;
  if (ref?.unique_id && ref?.name) {
    return { value: ref.unique_id, label: ref.name };
  }
  return null;
};

/**
 * Every value the logged-in staff is scoped to at `level`. For state/
 * district/area_type (always single) this is just `scopeOption` wrapped in
 * an array. For local-body levels and ward, it returns the full plural list
 * from Data Scope — one entry when the staff has a single value there
 * (matching `scopeOption`), several when they were granted multiple.
 */
export const scopeOptions = (level: ScopeLevel): ScopeOption[] => {
  const scope = getStoredDataScope() as Record<string, unknown> | null;
  const pluralKey = PLURAL_SCOPE_KEY[level];
  const refs = pluralKey ? (scope?.[pluralKey as string] as DataScopeRef[] | undefined) : undefined;
  if (Array.isArray(refs) && refs.length) {
    return refs
      .filter((ref): ref is { unique_id: string; name: string } => Boolean(ref?.unique_id && ref?.name))
      .map((ref) => ({ value: ref.unique_id, label: ref.name }));
  }
  const single = scopeOption(level);
  return single ? [single] : [];
};

export type ScopeFieldMode = "unrestricted" | "locked" | "choices";

/**
 * Decide how a form field for `level` should behave given the staff's own
 * Data Scope: "unrestricted" (no scope value — keep the field as-is, fed by
 * the normal fetched options), "locked" (exactly one scoped value — show it
 * pre-filled and non-editable, as forms have always done), or "choices"
 * (several scoped values — render an editable field restricted to just
 * those options, letting the staff pick among their assigned set).
 */
export const scopeFieldState = (
  level: ScopeLevel,
): { mode: ScopeFieldMode; options: ScopeOption[] } => {
  const options = scopeOptions(level);
  if (options.length === 0) return { mode: "unrestricted", options };
  if (options.length === 1) return { mode: "locked", options };
  return { mode: "choices", options };
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
  const scoped = scopeOptions(level).filter(
    (option) => !fetched.some((item) => item.value === option.value),
  );
  return scoped.length ? [...scoped, ...fetched] : fetched;
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
  const scoped = scopeOptions(level)
    .filter((option) => !fetched.some((item) => item.value === option.value))
    .map((option) => ({ ...option, ...extra }) as T);
  return scoped.length ? [...scoped, ...fetched] : fetched;
};
