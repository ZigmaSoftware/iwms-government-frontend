import { useCallback, useState } from "react";
import { FilterMatchMode } from "primereact/api";
import type { DataTableFilterMeta } from "primereact/datatable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import type { StatusFilterValue } from "@/components/common/FilterBar";

/**
 * useFilterBarFilters
 * ====================
 * Optional convenience hook that manages a `DataTableFilterMeta` state object
 * the same way ZoneListPage.tsx / projectListPage.tsx already do by hand:
 *   - `global`: FilterMatchMode.CONTAINS, driven by the search box.
 *   - an optional status field (default `is_active`): FilterMatchMode.EQUALS,
 *     `null` when "all" (no filtering), boolean when active/inactive — this
 *     is additive to whatever per-column filters (STARTS_WITH, etc.) the page
 *     already declares via `initialFilters`.
 *
 * Returns exactly the shape SafeDataTable's `DataTable` expects: `filters` +
 * `onFilter` map straight onto the table's `filters`/`onFilter` props,
 * unchanged from how both reference pages wire them today.
 *
 * Pair this with the <FilterBar /> component (src/components/common/FilterBar.tsx)
 * for the matching UI, or wire the returned values into your own markup.
 */
export interface UseFilterBarFiltersOptions {
  /** Extra/per-column filters to seed the state with (e.g. STARTS_WITH columns). */
  initialFilters?: DataTableFilterMeta;
  /** Column name the status filter applies to. Defaults to "is_active". */
  statusField?: string;
  /** Include the status filter key at all. Defaults to true. Set false for entities with no status column. */
  withStatusFilter?: boolean;
  defaultStatus?: StatusFilterValue;
}

export function useFilterBarFilters(options?: UseFilterBarFiltersOptions) {
  const statusField = options?.statusField ?? "is_active";
  const withStatusFilter = options?.withStatusFilter ?? true;
  const defaultStatus = options?.defaultStatus ?? "all";

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [statusValue, setStatusValue] = useState<StatusFilterValue>(
    defaultStatus,
  );
  const [filters, setFilters] = useState<DataTableFilterMeta>(() => ({
    ...(options?.initialFilters ?? {}),
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    ...(withStatusFilter
      ? {
          [statusField]: {
            value:
              defaultStatus === "all" ? null : defaultStatus === "active",
            matchMode: FilterMatchMode.EQUALS,
          },
        }
      : {}),
  }));

  const onGlobalFilterChange = useCallback((value: string) => {
    setGlobalFilterValue(value);
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  }, []);

  const onStatusFilterChange = useCallback(
    (value: StatusFilterValue) => {
      setStatusValue(value);
      setFilters((prev) => ({
        ...prev,
        [statusField]: {
          value: value === "all" ? null : value === "active",
          matchMode: FilterMatchMode.EQUALS,
        },
      }));
    },
    [statusField],
  );

  const onFilter = useCallback((e: DataTableFilterEvent) => {
    setFilters(e.filters);
  }, []);

  return {
    filters,
    setFilters,
    onFilter,
    globalFilterValue,
    onGlobalFilterChange,
    statusValue,
    onStatusFilterChange,
  };
}
