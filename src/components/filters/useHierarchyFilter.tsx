import { useMemo, useRef, useState } from "react";
import HierarchyFilterBar, {
  type HierarchyFilterBarHandle,
  type HierarchyFilterLabel,
  type HierarchyFilterParams,
} from "@/components/filters/HierarchyFilterBar";
import type { ActiveFilterChip } from "@/components/common/ListToolbar";
import type { TableFilters } from "@/components/common/SafeDataTable";

const LOCAL_BODY_PARAM_KEYS = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];
const levelPresent = (level: HierarchyFilterLabel["key"], params: HierarchyFilterParams) =>
  level === "local_body" ? LOCAL_BODY_PARAM_KEYS.some((k) => params[k]) : Boolean(params[`${level}_id`]);

/**
 * State → District → Area type → Local body filter for the list-page filter
 * panel (SafeDataTable `filterPanel` prop). The panel edits a draft; `apply()`
 * commits it to `applied`, which is what the page sends to its API.
 *
 *   const geo = useHierarchyFilter(() => setFirst(0));
 *   <DataTable filterPanel={geo.panel} … />          // location only
 *   <DataTable filterPanel={{ content: <>{geo.field}<FilterSection …/></>,
 *     activeCount: geo.count + n, onApply: …, onReset: …, chips: […geo.chips, …] }} … />
 */
export function useHierarchyFilter(onAppliedChange?: () => void) {
  const [applied, setApplied] = useState<HierarchyFilterParams>({});
  const [draft, setDraft] = useState<HierarchyFilterParams>({});
  const [labels, setLabels] = useState<HierarchyFilterLabel[]>([]);
  const [appliedLabels, setAppliedLabels] = useState<HierarchyFilterLabel[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const ref = useRef<HierarchyFilterBarHandle>(null);
  const applyNext = useRef(false);
  const seeded = useRef(false);

  const commit = (params: HierarchyFilterParams, names: HierarchyFilterLabel[]) => {
    setApplied(params);
    setAppliedLabels(names);
    onAppliedChange?.();
  };

  const field = (
    <HierarchyFilterBar
      key={resetKey}
      ref={ref}
      layout="panel"
      showClear={false}
      onLabelsChange={(next) => {
        setLabels(next);
        // a level pre-filled from the user's own data scope applies on load
        if (!seeded.current && next.length && next.every((l) => l.locked)) {
          seeded.current = true;
          setAppliedLabels(next);
        }
      }}
      onChange={(params) => {
        setDraft(params);
        if (!seeded.current && Object.keys(params).length) {
          // first emission = data-scope pre-seed: the list opens narrowed
          setApplied(params);
        }
        if (applyNext.current) {
          applyNext.current = false;
          setApplied(params);
          onAppliedChange?.();
        }
      }}
    />
  );

  const chips: ActiveFilterChip[] = useMemo(
    () =>
      appliedLabels
        .filter((l) => levelPresent(l.key, applied))
        .map((l) => ({
          key: l.key,
          label: l.label,
          value: l.value,
          // a level pinned by the user's own data scope can't be removed
          onRemove: l.locked
            ? undefined
            : () => {
                applyNext.current = true;
                ref.current?.clear(l.key);
              },
        })),
    [appliedLabels, applied],
  );

  const apply = () => commit(draft, labels);
  const reset = () => {
    seeded.current = false;
    setDraft({});
    setLabels([]);
    commit({}, []);
    setResetKey((k) => k + 1);
  };

  return {
    /** applied params — send these to the API */
    applied,
    /** the whole filter panel, for lists filtered by location only */
    panel: { content: field, activeCount: chips.length, onApply: apply, onReset: reset, chips } satisfies TableFilters,
    /** the panel field group */
    field,
    chips,
    count: chips.length,
    apply,
    reset,
  };
}
