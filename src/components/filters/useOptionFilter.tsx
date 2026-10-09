import { Fragment, useState, type ReactNode } from "react";
import { FilterSection, type ActiveFilterChip } from "@/components/common/ListToolbar";
import type { TableFilters } from "@/components/common/SafeDataTable";

/* ─────────────────────────────────────────────────────────────────────
   Building blocks for the list-page Filters panel (SafeDataTable
   `filterPanel`):

     useOptionFilter   one "pick a value" filter (Status, Type …)
     useStatusFilter   the Active / Inactive one → `?is_active=`
     combineFilters    joins parts (incl. useHierarchyFilter) into the
                       panel props

   Every part edits a draft inside the panel; Apply commits all of them.

     const geo = useHierarchyFilter(() => setFirst(0));
     const status = useStatusFilter(() => setFirst(0));
     const params = { ...geo.applied, ...status.applied };   // → API
     <DataTable filterPanel={combineFilters(geo, status)} … />
   ──────────────────────────────────────────────────────────────────── */

export type FilterPart = {
  field: ReactNode;
  chips: ActiveFilterChip[];
  count: number;
  apply: () => void;
  reset: () => void;
};

export const combineFilters = (...parts: FilterPart[]): TableFilters => ({
  content: (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p.field}</Fragment>
      ))}
    </>
  ),
  activeCount: parts.reduce((n, p) => n + p.count, 0),
  chips: parts.flatMap((p) => p.chips),
  onApply: () => parts.forEach((p) => p.apply()),
  onReset: () => parts.forEach((p) => p.reset()),
});

export type FilterOption = { label: string; value: string };

export function useOptionFilter({
  param,
  label,
  section = label,
  options,
  allLabel = "All",
  onAppliedChange,
}: {
  /** query param the applied value is sent as */
  param: string;
  /** chip label */
  label: string;
  /** panel section heading */
  section?: string;
  options: FilterOption[];
  allLabel?: string;
  onAppliedChange?: () => void;
}) {
  const [applied, setApplied] = useState("");
  const [draft, setDraft] = useState("");

  const commit = (value: string) => {
    setDraft(value);
    if (value !== applied) {
      setApplied(value);
      onAppliedChange?.();
    }
  };

  const choices = [{ label: allLabel, value: "" }, ...options];
  const field = (
    <FilterSection label={section}>
      {choices.length <= 5 ? (
        <div role="radiogroup" aria-label={section} className="flex flex-wrap gap-1.5">
          {choices.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              role="radio"
              aria-checked={draft === o.value}
              onClick={() => setDraft(o.value)}
              className={`h-9 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
                draft === o.value
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-100"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={section}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {choices.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FilterSection>
  );

  const selected = options.find((o) => o.value === applied);
  const chips: ActiveFilterChip[] = selected
    ? [{ key: param, label, value: selected.label, onRemove: () => commit("") }]
    : [];

  return {
    /** "" when no value is applied */
    value: applied,
    /** applied value as query params — spread into the API call */
    applied: (applied ? { [param]: applied } : {}) as Record<string, string>,
    field,
    chips,
    count: chips.length,
    apply: () => commit(draft),
    reset: () => commit(""),
  } satisfies FilterPart & Record<string, unknown>;
}

const STATUS_OPTIONS: FilterOption[] = [
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

/** Active / Inactive → `?is_active=true|false`. `matches(row)` filters client-side lists. */
export function useStatusFilter(onAppliedChange?: () => void) {
  const filter = useOptionFilter({ param: "is_active", label: "Status", options: STATUS_OPTIONS, onAppliedChange });
  return {
    ...filter,
    matches: (row: { is_active?: unknown }) => !filter.value || Boolean(row.is_active) === (filter.value === "true"),
  };
}
