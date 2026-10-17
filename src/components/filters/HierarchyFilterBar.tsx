import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from "react";

import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { useGeoHierarchy, type HierarchyLevel } from "@/hooks/useGeoHierarchy";
import { scopeFieldState, type ScopeLevel } from "@/pages/admin/modules/masters/shared/dataScopeOptions";

export type HierarchyFilterParams = Record<string, string>;

/** One selected level, for "State: Tamil Nadu"-style active-filter chips. */
export type HierarchyFilterLabel = { key: HierarchyClearLevel; label: string; value: string; locked: boolean };
export type HierarchyClearLevel = "state" | "district" | "area_type" | "local_body";

/** Imperative handle — e.g. a chip's ✕ clearing one level (and those below it). */
export type HierarchyFilterBarHandle = { clear: (level?: HierarchyClearLevel) => void };

// Maps each local-body hierarchy level to its Data Scope key.
const LOCAL_BODY_SCOPE_LEVELS: Record<HierarchyLevel, ScopeLevel> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
};

interface HierarchyFilterBarProps {
  /**
   * Called whenever the selection changes with the non-empty subset of
   * `{ state_id, district_id, area_type_id, corporation_id, municipality_id,
   * town_panchayat_id, panchayat_union_id, panchayat_id }` — pass this straight
   * to `readAll({ params })`. The backend (`filter_flat_geo_queryset_by_params`)
   * already honours these keys.
   */
  onChange: (params: HierarchyFilterParams) => void;
  className?: string;
  /** Show the inline "Clear" link next to the Local Body field. Defaults to true. */
  showClear?: boolean;
  /**
   * "row" (default): the five fields side by side, as before.
   * "panel": grouped LOCATION (State / District + Area type) and LOCAL BODY
   * (Type + Name) sections for a compact filter popover.
   */
  layout?: "row" | "panel";
  /** Called with the selected level names whenever the selection changes. */
  onLabelsChange?: (labels: HierarchyFilterLabel[]) => void;
}

/**
 * Reusable State → District → Area Type → Local Body hierarchy filter for list
 * screens (masters + schedule + daily/trip). It reuses {@link useGeoHierarchy},
 * whose master dropdowns are fetched through the scoped master endpoints, so a
 * corporation-scoped user only ever sees their own corporation's subtree
 * (the filter is naturally capped by the caller's StaffDataScope). It also
 * pre-seeds the caller's own corporation/local body from the stored data scope
 * so the list opens already narrowed to what they manage.
 */
const HierarchyFilterBar = forwardRef<HierarchyFilterBarHandle, HierarchyFilterBarProps>(function HierarchyFilterBar(
  { onChange, className, showClear = true, layout = "row", onLabelsChange },
  ref,
) {
  const geo = useGeoHierarchy();
  const seeded = useRef(false);

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that filter shows pre-filled and disabled rather than an editable
  // dropdown — offering a broader choice would be misleading, since they
  // can't see data outside their own scope anyway. Several scoped values (or
  // none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const lockedLocalBody = useMemo(
    () =>
      (Object.keys(LOCAL_BODY_SCOPE_LEVELS) as HierarchyLevel[])
        .map((level) => ({ level, state: scopeFieldState(LOCAL_BODY_SCOPE_LEVELS[level]) }))
        .find((entry) => entry.state.mode === "locked"),
    [],
  );

  // Pre-seed from the logged-in user's own data scope once masters have loaded.
  useEffect(() => {
    if (seeded.current || geo.loading) return;
    seeded.current = true;
    if (stateScope.mode === "locked") geo.setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked") geo.setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked") geo.setAreaTypeId(areaTypeScope.options[0].value);
    if (lockedLocalBody) {
      geo.setHierarchyLevel(lockedLocalBody.level);
      geo.setHierarchyId(lockedLocalBody.state.options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.loading]);

  // Emit the non-empty param subset whenever a selection changes.
  useEffect(() => {
    const payload = geo.buildPayload();
    const params: HierarchyFilterParams = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (value) params[key] = String(value);
    });
    onChange(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.stateId, geo.districtId, geo.areaTypeId, geo.hierarchyLevel, geo.hierarchyId]);

  const clear = () => {
    geo.setStateId("");
  };

  // Clearing a level also clears the ones below it (the cascade setters do
  // that); a level pinned by the user's own Data Scope is never cleared.
  useImperativeHandle(ref, () => ({
    clear: (level) => {
      if ((!level || level === "state") && stateScope.mode !== "locked") return geo.setStateId("");
      if ((!level || level === "district") && districtScope.mode !== "locked") return geo.setDistrictId("");
      if ((!level || level === "area_type") && areaTypeScope.mode !== "locked") return geo.setAreaTypeId("");
      if (!lockedLocalBody) geo.setHierarchyId("");
    },
  }));

  // Names of what is selected, for active-filter chips.
  const optionLabel = (options: { value: string | number; label: ReactNode }[], value: string) =>
    String(options.find((o) => String(o.value) === value)?.label ?? value);
  useEffect(() => {
    if (!onLabelsChange) return;
    const labels: HierarchyFilterLabel[] = [];
    if (geo.stateId) labels.push({ key: "state", label: "State", value: optionLabel(geo.stateOptions, geo.stateId), locked: stateScope.mode === "locked" });
    if (geo.districtId) labels.push({ key: "district", label: "District", value: optionLabel(geo.districtOptions, geo.districtId), locked: districtScope.mode === "locked" });
    if (geo.areaTypeId) labels.push({ key: "area_type", label: "Area type", value: optionLabel(geo.areaTypeOptions, geo.areaTypeId), locked: areaTypeScope.mode === "locked" });
    if (geo.hierarchyId) labels.push({ key: "local_body", label: geo.hierarchyLabel, value: optionLabel(geo.hierarchyOptions, geo.hierarchyId), locked: Boolean(lockedLocalBody) });
    onLabelsChange(labels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.stateId, geo.districtId, geo.areaTypeId, geo.hierarchyId, geo.stateOptions, geo.districtOptions, geo.areaTypeOptions, geo.hierarchyOptions]);

  const stateField = (
      <div>
        <Label>State</Label>
        <Select
          value={geo.stateId}
          onChange={(v) => geo.setStateId(String(v))}
          options={geo.stateOptions}
          placeholder="All states"
          disabled={stateScope.mode === "locked"}
        />
      </div>
  );
  const districtField = (
      <div>
        <Label>District</Label>
        <Select
          value={geo.districtId}
          onChange={(v) => geo.setDistrictId(String(v))}
          options={geo.districtOptions}
          placeholder={geo.stateId ? "All districts" : "Select a state first"}
          disabled={!geo.stateId || districtScope.mode === "locked"}
        />
      </div>
  );
  const areaTypeField = (
      <div>
        <Label>Area Type</Label>
        <Select
          value={geo.areaTypeId}
          onChange={(v) => geo.setAreaTypeId(String(v))}
          options={geo.areaTypeOptions}
          placeholder={geo.districtId ? "All area types" : "Select a district first"}
          disabled={!geo.districtId || areaTypeScope.mode === "locked"}
        />
      </div>
  );
  const lbTypeField = (
      <div>
        <Label>Local Body Type</Label>
        <Select
          value={geo.hierarchyLevel}
          onChange={(v) => geo.setHierarchyLevel(v as ReturnType<typeof useGeoHierarchy>["hierarchyLevel"])}
          options={geo.availableHierarchyLevels}
          placeholder={geo.areaTypeCategory ? "Select type" : "Select an area type first"}
          disabled={!geo.areaTypeCategory || Boolean(lockedLocalBody)}
        />
      </div>
  );
  const lbField = (
      <div>
        <Label>{geo.hierarchyLabel}</Label>
        <div className="flex items-center gap-2">
          <Select
            value={geo.hierarchyId}
            onChange={(v) => geo.setHierarchyId(String(v))}
            options={geo.hierarchyOptions}
            placeholder="All"
            disabled={!geo.areaTypeCategory || Boolean(lockedLocalBody)}
          />
          {showClear && (
            <button
              type="button"
              onClick={clear}
              className="whitespace-nowrap text-sm text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>
  );

  if (layout === "panel") {
    const section = "mb-1.5 mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400";
    return (
      <div className={className ?? "flex flex-col gap-2"}>
        <p className={section}>Location</p>
        {stateField}
        <div className="grid grid-cols-2 gap-2">
          {districtField}
          {areaTypeField}
        </div>
        <p className={`${section} mt-2`}>Local body</p>
        <div className="grid grid-cols-2 gap-2">
          {lbTypeField}
          {lbField}
        </div>
      </div>
    );
  }

  return (
    <div className={className ?? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"}>
      {stateField}
      {districtField}
      {areaTypeField}
      {lbTypeField}
      {lbField}
    </div>
  );
});

export default HierarchyFilterBar;