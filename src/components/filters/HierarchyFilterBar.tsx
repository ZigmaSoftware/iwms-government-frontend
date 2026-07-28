import { useEffect, useMemo, useRef } from "react";

import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { useGeoHierarchy, type HierarchyLevel } from "@/hooks/useGeoHierarchy";
import { scopeFieldState, type ScopeLevel } from "@/pages/admin/modules/masters/shared/dataScopeOptions";

export type HierarchyFilterParams = Record<string, string>;

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
export default function HierarchyFilterBar({ onChange, className, showClear = true }: HierarchyFilterBarProps) {
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

  return (
    <div className={className ?? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"}>
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
    </div>
  );
}
