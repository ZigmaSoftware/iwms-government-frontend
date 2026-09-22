import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capitalize } from "@/utils/capitalize";
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
              value={stateId}
              onValueChange={(value) => {
                setStateId(value);
                setDistrictId("");
              }}
              disabled={isSubmitting || stateScope.mode === "locked"}
            >
              <SelectTrigger className="input-validate w-full" id="stateId">
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {states.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {capitalize(item.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("district_id") && (
          <div>
            <Label htmlFor="districtId">
              District <span className="text-red-500">*</span>
            </Label>
            <Select
              value={districtId}
              onValueChange={setDistrictId}
              disabled={isSubmitting || !stateId || districtScope.mode === "locked"}
            >
              <SelectTrigger className="input-validate w-full" id="districtId">
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {capitalize(item.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("name") && (
          <div>
            <Label htmlFor="areaTypeName">
              Area Type <span className="text-red-500">*</span>
            </Label>
            <Select value={name} onValueChange={setName} disabled={isSubmitting}>
              <SelectTrigger className="input-validate w-full" id="areaTypeName">
                <SelectValue placeholder="Select Area Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Urban Local Body">Urban Local Body</SelectItem>
                <SelectItem value="Rural Local Body">Rural Local Body</SelectItem>
              </SelectContent>
            </Select>
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
              value={isActive ? "true" : "false"}
              onValueChange={(value) => setIsActive(value === "true")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="input-validate w-full" id="isActive">
                <SelectValue placeholder={t("common.select_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
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
