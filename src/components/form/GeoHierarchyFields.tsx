import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import type { GeoHierarchy } from "@/hooks/useGeoHierarchy";

interface GeoHierarchyFieldsProps {
  geo: GeoHierarchy;
  /** Mark State/District/Local Body as required in the labels. */
  required?: boolean;
  disabled?: boolean;
}

/**
 * Renders the shared State → District → Area Type → Local Body Type → Local Body
 * cascade backed by {@link useGeoHierarchy}. Drop it into any form that needs the
 * geo hierarchy (Staff Template, Alternative Staff Template, …).
 */
export default function GeoHierarchyFields({ geo, required, disabled }: GeoHierarchyFieldsProps) {
  const star = required ? <span className="text-red-500"> *</span> : null;

  return (
    <>
      <div>
        <Label>State{star}</Label>
        <Select
          value={geo.stateId}
          onChange={(v) => geo.setStateId(String(v))}
          options={geo.stateOptions}
          placeholder="Select State"
          disabled={disabled}
        />
      </div>

      <div>
        <Label>District{star}</Label>
        <Select
          value={geo.districtId}
          onChange={(v) => geo.setDistrictId(String(v))}
          options={geo.districtOptions}
          placeholder={geo.stateId ? "Select District" : "Select a State first"}
          disabled={disabled || !geo.stateId}
        />
      </div>

      <div>
        <Label>Area Type</Label>
        <Select
          value={geo.areaTypeId}
          onChange={(v) => geo.setAreaTypeId(String(v))}
          options={geo.areaTypeOptions}
          placeholder={geo.districtId ? "Select Area Type" : "Select a District first"}
          disabled={disabled || !geo.districtId}
        />
      </div>

      <div>
        <Label>Local Body Type{star}</Label>
        <Select
          value={geo.hierarchyLevel}
          onChange={(v) => geo.setHierarchyLevel(v as GeoHierarchy["hierarchyLevel"])}
          options={geo.availableHierarchyLevels}
          placeholder={geo.areaTypeCategory ? "Select Local Body Type" : "Select an Area Type first"}
          disabled={disabled || !geo.areaTypeCategory}
        />
      </div>

      <div>
        <Label>
          {geo.hierarchyLabel}
          {star}
        </Label>
        <Select
          value={geo.hierarchyId}
          onChange={(v) => geo.setHierarchyId(String(v))}
          options={geo.hierarchyOptions}
          placeholder="Select"
          disabled={disabled || !geo.areaTypeCategory}
        />
      </div>
    </>
  );
}
