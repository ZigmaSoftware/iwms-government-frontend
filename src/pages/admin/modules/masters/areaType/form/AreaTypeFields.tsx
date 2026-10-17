import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Select from "@/components/form/Select";
import GeoFenceCoordinates from "../../shared/GeoFenceCoordinates";

import { useAreaTypeFields } from "./useAreaType";
import type {
  AreaTypeFieldsSubmitPayload,
  AreaTypeInitialPayload,
  Option,
} from "./areaType.form.types";

export type AreaTypeFieldsProps = {
  initialPayload: AreaTypeInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: AreaTypeFieldsSubmitPayload) => void | Promise<void>;
  states: Option[];
  districts: Option[];
};

/** Pure input-fields form for creating/editing an Area Type record — no data fetching, no API calls. */
export default function AreaTypeFields({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  states,
  districts,
}: AreaTypeFieldsProps) {
  const { t } = useTranslation();
  const {
    showField,
    name,
    setName,
    stateId,
    setStateId,
    districtId,
    setDistrictId,
    coordinates,
    setCoordinates,
    isActive,
    setIsActive,
    stateScope,
    districtScope,
    filteredDistricts,
    handleFormSubmit,
  } = useAreaTypeFields(initialPayload, states, districts, onSubmit);

  return (
    <form onSubmit={handleFormSubmit} noValidate>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {showField("state_id") && (
          <div>
            <Label htmlFor="stateId">
              State <span className="text-red-500">*</span>
            </Label>
            <Select
              id="stateId"
              value={stateId}
              onChange={(value) => {
                setStateId(value);
                setDistrictId("");
              }}
              options={states}
              placeholder="Select State"
              className="input-validate w-full"
              disabled={isSubmitting || stateScope.mode === "locked"}
              required
            />
          </div>
        )}

        {showField("district_id") && (
          <div>
            <Label htmlFor="districtId">
              District <span className="text-red-500">*</span>
            </Label>
            <Select
              id="districtId"
              value={districtId}
              onChange={setDistrictId}
              options={filteredDistricts}
              placeholder="Select District"
              className="input-validate w-full"
              disabled={isSubmitting || !stateId || districtScope.mode === "locked"}
              required
            />
          </div>
        )}

        {showField("name") && (
          <div>
            <Label htmlFor="areaTypeName">
              Area Type <span className="text-red-500">*</span>
            </Label>
            <Select
              id="areaTypeName"
              value={name}
              onChange={setName}
              options={[
                { value: "Urban Local Body", label: "Urban Local Body" },
                { value: "Rural Local Body", label: "Rural Local Body" },
              ]}
              placeholder="Select Area Type"
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {showField("coordinates") && (
          <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Select
              id="isActive"
              value={isActive ? "true" : "false"}
              onChange={(value) => setIsActive(value === "true")}
              options={[
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
              ]}
              placeholder={t("common.select_status")}
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? t("common.updating")
              : t("common.saving")
            : isEdit
              ? t("common.update")
              : t("common.save")}
        </Button>
        <Button type="button" variant="destructive" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
