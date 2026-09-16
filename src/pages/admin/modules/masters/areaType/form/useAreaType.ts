import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import notify from "@/lib/notify";

import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { areaTypeSchema } from "@/schemas/masters/areaType.schema";
import { requireWhenVisible } from "@/schemas/shared/visibility";
import { toSwalMessage } from "@/lib/zodErrors";
import { scopeFieldState } from "../../shared/dataScopeOptions";
import { extractErrorMessage } from "../../shared/recordHelpers";

import {
  AREA_TYPE_FIELDS,
  loadAreaTypeRecord,
  loadFormLookups,
  submitAreaType,
  toAreaTypePayload,
  toInitialPayload,
} from "./areaType.form.functionality";
import type {
  AreaTypeFieldsSubmitPayload,
  AreaTypeInitialPayload,
  Option,
  RecordRow,
} from "./areaType.form.types";

/** Loads dropdown lookups + (when editing) the existing record for the Area Type form page. */
export function useAreaTypePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encMasters, encAreaTypes } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encAreaTypes);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);

  const title = isEdit ? "Edit Area Type" : "Add Area Type";

  useEffect(() => {
    let cancelled = false;
    void loadFormLookups().then((result) => {
      if (cancelled) return;
      setStates(result.states);
      setDistricts(result.districts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    loadAreaTypeRecord(id)
      .then((record) => {
        if (cancelled) return;
        setRecordData(record);
        setLoadingRecord(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadingRecord(false);
        notify.fire({
          icon: "error",
          title: t("common.error"),
          text: extractErrorMessage(err, t("common.load_failed")),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  const handleSubmit = async (payload: AreaTypeFieldsSubmitPayload) => {
    setIsSubmitting(true);
    try {
      const apiPayload = toAreaTypePayload(payload);
      await submitAreaType(apiPayload, isEdit, id);
      notify.fire({
        icon: "success",
        title: isEdit ? t("common.updated_success") : t("common.added_success"),
        timer: 1500,
        showConfirmButton: false,
      });
      navigate(LIST_PATH);
    } catch (error) {
      notify.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: extractErrorMessage(error, t("common.save_failed_desc")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialPayload = useMemo(() => toInitialPayload(recordData), [recordData]);
  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-areatype";

  return {
    t,
    title,
    isEdit,
    isReady: !(isEdit && loadingRecord && !recordData),
    isSubmitting,
    states,
    districts,
    initialPayload,
    formKey,
    onCancel: () => navigate(LIST_PATH),
    onSubmit: handleSubmit,
  };
}

/** Field-visibility + scoped-dropdown state used inside the Area Type input fields. */
export function useAreaTypeFields(
  initialPayload: AreaTypeInitialPayload,
  states: Option[],
  districts: Option[],
  onSubmit: (payload: AreaTypeFieldsSubmitPayload) => void | Promise<void>,
) {
  const { t } = useTranslation();
  const { showField, filterPayload } = useFieldVisibility(
    "masters",
    "areatypes",
    AREA_TYPE_FIELDS,
  );

  const [name, setName] = useState(initialPayload.name);
  const [stateId, setStateId] = useState(initialPayload.state_id);
  const [districtId, setDistrictId] = useState(initialPayload.district_id);
  const [coordinates, setCoordinates] = useState(initialPayload.coordinates);
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that field shows pre-filled and non-editable rather than an
  // editable dropdown. Several scoped values (or none) leave the field
  // editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");

  useEffect(() => {
    if (
      stateScope.mode === "locked" &&
      !stateId &&
      states.some((item) => item.value === stateScope.options[0].value)
    ) {
      setStateId(stateScope.options[0].value);
    }
    if (
      districtScope.mode === "locked" &&
      !districtId &&
      districts.some((item) => item.value === districtScope.options[0].value)
    ) {
      setDistrictId(districtScope.options[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, stateId, districtId, states, districts]);

  const filteredDistricts = useMemo(() => {
    let result = districts.filter(
      (item) => !stateId || !item.stateId || item.stateId === stateId,
    );
    if (districtScope.mode !== "unrestricted") {
      const allowed = new Set(districtScope.options.map((o) => o.value));
      result = result.filter((item) => allowed.has(item.value));
    }
    return result;
  }, [districts, stateId, districtScope]);

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const result = requireWhenVisible(areaTypeSchema, showField).safeParse({
      name: name.trim(),
      state_id: stateId,
      district_id: districtId,
      coordinates,
      is_active: isActive,
    });

    if (!result.success) {
      notify.fire({
        icon: "warning",
        title: t("common.warning"),
        text: toSwalMessage(result.error),
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    // filterPayload matches keys against AREA_TYPE_FIELDS, which are named
    // after the API payload's snake_case fields — filter in that shape, then
    // translate back to the camelCase shape the parent onSubmit expects.
    const filtered = filterPayload({
      name: name.trim(),
      state_id: stateId,
      district_id: districtId,
      coordinates,
      is_active: isActive,
    } satisfies AreaTypeInitialPayload) as Partial<AreaTypeInitialPayload>;

    void onSubmit({
      name: filtered.name ?? "",
      stateId: filtered.state_id ?? "",
      districtId: filtered.district_id ?? "",
      coordinates: filtered.coordinates ?? [],
      isActive: filtered.is_active ?? isActive,
    });
  };

  return {
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
  };
}
