import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { capitalize } from "@/utils/capitalize";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/form/FieldError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { adminApi } from "@/helpers/admin/registry";
import { stateApi, districtApi, areaTypeApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";
import { getStoredDataScope } from "@/utils/authStorage";
import {
  mergeWithScopeOptionExtra,
  scopeFieldState,
  scopeOption,
} from "../shared/dataScopeOptions";
import {
  wardSchema,
  WARD_LOCAL_BODY_TYPES,
  type WardFormValues,
  type WardLocalBodyType,
} from "@/schemas/masters/ward.schema";
import { requireWhenVisible } from "@/schemas/shared/visibility";

type Option = {
  value: string;
  label: string;
  stateId?: string;
  districtId?: string;
  areaTypeId?: string;
};

type RecordRow = Record<string, any>;

const AREA_TYPE_GROUP: Record<string, "urban" | "rural"> = {
  "Urban Local Body": "urban",
  "Rural Local Body": "rural",
};

const LOCAL_BODY_TYPE_LABELS: Record<WardLocalBodyType, string> = {
  corporation: "Corporation",
  municipality: "Municipality",
  town_panchayat: "Town Panchayat",
  panchayat_union: "Panchayat Union",
  panchayat: "Panchayat",
};

const LOCAL_BODY_TYPES_BY_GROUP: Record<"urban" | "rural", WardLocalBodyType[]> = {
  urban: ["corporation", "municipality", "town_panchayat"],
  rural: ["panchayat_union", "panchayat"],
};

const LOCAL_BODY_API_BY_TYPE: Record<WardLocalBodyType, keyof typeof adminApi> = {
  corporation: "corporations",
  municipality: "municipalities",
  town_panchayat: "townPanchayats",
  panchayat_union: "panchayatUnions",
  panchayat: "panchayats",
};

const LOCAL_BODY_NAME_FIELDS: Record<WardLocalBodyType, string[]> = {
  corporation: ["corporation_name"],
  municipality: ["municipality_name"],
  town_panchayat: ["town_panchayat_name"],
  panchayat_union: ["union_name"],
  panchayat: ["panchayat_name"],
};

type WardInitialPayload = {
  ward_name: string;
  state_id: string;
  district_id: string;
  area_type_id: string;
  local_body_type: WardLocalBodyType;
  local_body_id: string;
  coordinates: GeoCoordinateDraft[];
  is_active: boolean;
};

type WardPayload = Record<string, unknown>;

type WardEditorProps = {
  initialPayload: WardInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: WardPayload) => Promise<void>;
  states: Option[];
  districts: Option[];
  areaTypes: Option[];
};

const normalizeNullable = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object")
    return normalizeNullable(value.unique_id ?? value.id ?? value.value);
  return String(value).trim();
};

const toRecordList = (value: unknown): RecordRow[] => {
  if (Array.isArray(value)) return value as RecordRow[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: RecordRow[] }).results;
  }
  return [];
};

const textOf = (row: RecordRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim())
      return String(value);
  }
  return "";
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(
        ([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const WARD_FIELDS: Record<string, string[]> = {
  state_id: ["state_id"],
  district_id: ["district_id"],
  area_type_id: ["area_type_id"],
  local_body_type: ["local_body_type"],
  local_body_id: ["local_body_id"],
  ward_name: ["ward_name"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

function WardEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  states,
  districts,
  areaTypes,
}: WardEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload } = useFieldVisibility(
    "masters",
    "wards",
    WARD_FIELDS
  );

  const schema = useMemo(() => requireWhenVisible(wardSchema, showField), [showField]);

  const [localBodyOptions, setLocalBodyOptions] = useState<Option[]>([]);
  const [loadingLocalBodies, setLoadingLocalBodies] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WardFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ward_name: initialPayload.ward_name,
      state_id: initialPayload.state_id,
      district_id: initialPayload.district_id,
      area_type_id: initialPayload.area_type_id,
      local_body_type: initialPayload.local_body_type,
      local_body_id: initialPayload.local_body_id,
      coordinates: initialPayload.coordinates,
      is_active: initialPayload.is_active,
    },
  });

  const stateId = watch("state_id");
  const districtId = watch("district_id");
  const areaTypeId = watch("area_type_id");
  const localBodyType = watch("local_body_type");
  const localBodyId = watch("local_body_id");

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that field shows pre-filled and disabled rather than an editable
  // dropdown — they aren't allowed to place this record outside their own
  // scope. Several scoped values (or none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  // The local-body-type field itself isn't locked (a scoped staff may still
  // pick among urban/rural types their area type allows) — only the ID field
  // for whichever type is currently selected locks, when that specific level
  // (corporation/municipality/.../panchayat) has exactly one scoped value.
  const localBodyScope = localBodyType ? scopeFieldState(localBodyType) : null;

  const filteredDistricts = useMemo(() => {
    let result = districts.filter(
      (item) => !stateId || !item.stateId || item.stateId === stateId
    );
    if (districtScope.mode !== "unrestricted") {
      const allowed = new Set(districtScope.options.map((o) => o.value));
      result = result.filter((item) => allowed.has(item.value));
    }
    return result;
  }, [districts, stateId, districtScope]);

  const filteredAreaTypes = useMemo(() => {
    let result = areaTypes.filter(
      (item) =>
        (!stateId || !item.stateId || item.stateId === stateId) &&
        (!districtId || !item.districtId || item.districtId === districtId)
    );
    if (areaTypeScope.mode !== "unrestricted") {
      const allowed = new Set(areaTypeScope.options.map((o) => o.value));
      result = result.filter((item) => allowed.has(item.value));
    }
    return result;
  }, [areaTypes, stateId, districtId, areaTypeScope]);

  const selectedAreaTypeGroup = useMemo(() => {
    const match = filteredAreaTypes.find((item) => item.value === areaTypeId);
    return match ? AREA_TYPE_GROUP[match.label] : undefined;
  }, [filteredAreaTypes, areaTypeId]);

  // Map from local body type name (e.g. "corporation") to the plural Data
  // Scope key that holds every local body of that level the user is scoped to.
  const LOCAL_BODY_TYPE_SCOPE_KEY: Record<string, string> = {
    corporation: "corporations",
    municipality: "municipalities",
    town_panchayat: "town_panchayats",
    panchayat_union: "panchayat_unions",
    panchayat: "panchayats",
  };

  const availableLocalBodyTypes = useMemo(() => {
    let types = selectedAreaTypeGroup
      ? LOCAL_BODY_TYPES_BY_GROUP[selectedAreaTypeGroup]
      : WARD_LOCAL_BODY_TYPES.slice();
    const scope = getStoredDataScope() as Record<string, unknown> | null;
    if (scope) {
      types = types.filter((type) => {
        const key = LOCAL_BODY_TYPE_SCOPE_KEY[type];
        const entries = scope[key];
        return Array.isArray(entries) && entries.length > 0;
      });
    }
    return types;
  }, [selectedAreaTypeGroup]);

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId && !stateId &&
      states.some((item) => item.value === stateScope.options[0].value)) setValue("state_id", stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId && districts.some((item) => item.value === districtScope.options[0].value)) setValue("district_id", districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId && areaTypes.some((item) => item.value === areaTypeScope.options[0].value)) setValue("area_type_id", areaTypeScope.options[0].value);
    if (availableLocalBodyTypes.length === 1 && !localBodyType) {
      setValue("local_body_type", availableLocalBodyTypes[0]);
    }
    if (localBodyScope?.mode === "locked" && !localBodyId && localBodyOptions.some((item) => item.value === localBodyScope.options[0].value)) {
      setValue("local_body_id", localBodyScope.options[0].value);
    }
  }, [
    stateScope.mode,
    districtScope.mode,
    areaTypeScope.mode,
    localBodyScope?.mode,
    stateId,
    districtId,
    areaTypeId,
    localBodyId,
    localBodyType,
    states,
    districts,
    areaTypes,
    localBodyOptions,
    availableLocalBodyTypes,
  ]);

  useEffect(() => {
    if (!localBodyType) return;
    setLoadingLocalBodies(true);
    const api = adminApi[LOCAL_BODY_API_BY_TYPE[localBodyType]];
    const nameFields = LOCAL_BODY_NAME_FIELDS[localBodyType];
    api
      .readAll()
      .then((res: unknown) => {
        const list = toRecordList(res)
          .map((row) => ({
            value: normalizeNullable(row.unique_id ?? row.id),
            label: textOf(row, ...nameFields),
            stateId: normalizeNullable(row.state_id ?? row.state),
            districtId: normalizeNullable(row.district_id ?? row.district),
            areaTypeId: normalizeNullable(row.area_type_id ?? row.area_type),
          }))
          .filter((item) => item.value && item.label);
        const scopedDistrictId = scopeOption("district")?.value;
        setLocalBodyOptions(
          mergeWithScopeOptionExtra(list, localBodyType, scopedDistrictId ? { districtId: scopedDistrictId } : {})
        );
      })
      .catch(() => {
        const scopedDistrictId = scopeOption("district")?.value;
        setLocalBodyOptions((prev) =>
          mergeWithScopeOptionExtra(prev, localBodyType, scopedDistrictId ? { districtId: scopedDistrictId } : {})
        );
      })
      .finally(() => setLoadingLocalBodies(false));
  }, [localBodyType]);

  const filteredLocalBodies = useMemo(
    () =>
      localBodyOptions.filter(
        (item) =>
          (!districtId || !item.districtId || item.districtId === districtId) &&
          (!areaTypeId || !item.areaTypeId || item.areaTypeId === areaTypeId)
      ),
    [localBodyOptions, districtId, areaTypeId]
  );

  const onValid = async (values: WardFormValues) => {
    const rawPayload: WardPayload = {
      ward_name: values.ward_name.trim(),
      state_id: values.state_id,
      district_id: values.district_id,
      area_type_id: values.area_type_id,
      coordinates: serializeCoordinateDrafts(values.coordinates ?? []),
      is_active: values.is_active,
      corporation_id: null,
      municipality_id: null,
      town_panchayat_id: null,
      panchayat_union_id: null,
      panchayat_id: null,
    };
    rawPayload[`${values.local_body_type}_id`] = values.local_body_id;

    await onSubmit(filterPayload(rawPayload) as WardPayload);
  };

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {showField("state_id") && (
          <div>
            <Label htmlFor="stateId">
              State <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="state_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("district_id", "");
                    setValue("area_type_id", "");
                    setValue("local_body_id", "");
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
              )}
            />
            <FieldError message={errors.state_id?.message} />
          </div>
        )}

        {showField("district_id") && (
          <div>
            <Label htmlFor="districtId">
              District <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="district_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("area_type_id", "");
                    setValue("local_body_id", "");
                  }}
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
              )}
            />
            <FieldError message={errors.district_id?.message} />
          </div>
        )}

        {showField("area_type_id") && (
          <div>
            <Label htmlFor="areaTypeId">
              Area Type <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="area_type_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("local_body_type", undefined as unknown as WardLocalBodyType);
                    setValue("local_body_id", "");
                  }}
                  disabled={isSubmitting || !districtId || areaTypeScope.mode === "locked"}
                >
                  <SelectTrigger className="input-validate w-full" id="areaTypeId">
                    <SelectValue placeholder="Select Area Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAreaTypes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {capitalize(item.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.area_type_id?.message} />
          </div>
        )}

        {showField("local_body_type") && (
          <div>
            <Label htmlFor="localBodyType">
              Local Body Type <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="local_body_type"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value as WardLocalBodyType);
                    setValue("local_body_id", "");
                  }}
                  disabled={isSubmitting || !areaTypeId || availableLocalBodyTypes.length === 1}
                >
                  <SelectTrigger className="input-validate w-full" id="localBodyType">
                    <SelectValue placeholder="Select Local Body Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLocalBodyTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {LOCAL_BODY_TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.local_body_type?.message} />
          </div>
        )}

        {showField("local_body_id") && (
          <div>
            <Label htmlFor="localBodyId">
              {localBodyType ? LOCAL_BODY_TYPE_LABELS[localBodyType] : "Local Body"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="local_body_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={
                    isSubmitting ||
                    !localBodyType ||
                    loadingLocalBodies ||
                    localBodyScope?.mode === "locked"
                  }
                >
                  <SelectTrigger className="input-validate w-full" id="localBodyId">
                    <SelectValue
                      placeholder={loadingLocalBodies ? "Loading..." : "Select Local Body"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredLocalBodies.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {capitalize(item.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.local_body_id?.message} />
          </div>
        )}

        {showField("ward_name") && (
          <div>
            <Label htmlFor="wardName">
              Ward Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="wardName"
              type="text"
              placeholder="Enter Ward Name"
              className="input-validate w-full"
              disabled={isSubmitting}
              {...register("ward_name")}
            />
            <FieldError message={errors.ward_name?.message} />
          </div>
        )}

        {showField("coordinates") && (
          <Controller
            control={control}
            name="coordinates"
            render={({ field }) => (
              <GeoFenceCoordinates
                coordinates={field.value ?? []}
                onChange={field.onChange}
                errors={(Array.isArray(errors.coordinates) ? errors.coordinates : []).map(
                  (entry) => ({
                    latitude: entry?.latitude?.message,
                    longitude: entry?.longitude?.message,
                  })
                )}
              />
            )}
          />
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Select
                  value={field.value ? "true" : "false"}
                  onValueChange={(value) => field.onChange(value === "true")}
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
              )}
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

export default function WardForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encMasters, encWards } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encWards);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [areaTypes, setAreaTypes] = useState<Option[]>([]);

  const title = isEdit ? "Edit Ward" : "Add Ward";

  useEffect(() => {
    let cancelled = false;

    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    Promise.all([stateApi.readAll(), districtApi.readAll(), areaTypeApi.readAll()])
      .then(([stateRes, districtRes, areaTypeRes]) => {
        if (cancelled) return;
        const fetchedStates = toRecordList(stateRes)
          .map((row) => ({
            value: normalizeNullable(row.unique_id ?? row.id),
            label: textOf(row, "state_name", "name"),
            stateId: normalizeNullable(row.state_id ?? row.state),
          }))
          .filter((item) => item.value && item.label);
        const fetchedDistricts = toRecordList(districtRes)
          .map((row) => ({
            value: normalizeNullable(row.unique_id ?? row.id),
            label: textOf(row, "district_name", "name"),
            stateId: normalizeNullable(row.state_id ?? row.state),
          }))
          .filter((item) => item.value && item.label);
        const fetchedAreaTypes = toRecordList(areaTypeRes)
          .map((row) => ({
            value: normalizeNullable(row.unique_id ?? row.id),
            label: textOf(row, "area_type_name", "name"),
            stateId: normalizeNullable(row.state_id ?? row.state),
            districtId: normalizeNullable(row.district_id ?? row.district),
          }))
          .filter((item) => item.value && item.label);

        setStates(mergeWithScopeOptionExtra(fetchedStates, "state", {}));
        setDistricts(
          mergeWithScopeOptionExtra(
            fetchedDistricts,
            "district",
            scopedStateId ? { stateId: scopedStateId } : {}
          )
        );
        setAreaTypes(
          mergeWithScopeOptionExtra(fetchedAreaTypes, "area_type", {
            ...(scopedStateId ? { stateId: scopedStateId } : {}),
            ...(scopedDistrictId ? { districtId: scopedDistrictId } : {}),
          })
        );
      })
      .catch(() => {
        if (cancelled) return;
        setStates((prev) => mergeWithScopeOptionExtra(prev, "state", {}));
        setDistricts((prev) =>
          mergeWithScopeOptionExtra(
            prev,
            "district",
            scopedStateId ? { stateId: scopedStateId } : {}
          )
        );
        setAreaTypes((prev) =>
          mergeWithScopeOptionExtra(prev, "area_type", {
            ...(scopedStateId ? { stateId: scopedStateId } : {}),
            ...(scopedDistrictId ? { districtId: scopedDistrictId } : {}),
          })
        );
        if (!scopeOption("state") && !scopeOption("district") && !scopeOption("area_type")) {
          Swal.fire({
            icon: "error",
            title: t("common.error"),
            text: "Failed to load dropdown data",
          });
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.wards
      .read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: extractErrorMessage(err, t("common.load_failed")),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const submitWard = async (payload: WardPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.wards.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.wards.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }
      navigate(LIST_PATH);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: extractErrorMessage(error, t("common.save_failed_desc")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && loadingRecord && !recordData) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  const detectedLocalBodyType = (): WardLocalBodyType => {
    if (!recordData) return "corporation";
    return (
      WARD_LOCAL_BODY_TYPES.find((type) => recordData[`${type}_id`] ?? recordData[type]) ??
      "corporation"
    );
  };

  const initialPayload: WardInitialPayload = recordData
    ? {
        ward_name: textOf(recordData, "ward_name", "name"),
        state_id: normalizeNullable(recordData.state_id ?? recordData.state),
        district_id: normalizeNullable(recordData.district_id ?? recordData.district),
        area_type_id: normalizeNullable(recordData.area_type_id ?? recordData.area_type),
        local_body_type: detectedLocalBodyType(),
        local_body_id: normalizeNullable(
          recordData[`${detectedLocalBodyType()}_id`] ?? recordData[detectedLocalBodyType()]
        ),
        coordinates: normalizeCoordinateDrafts(recordData.coordinates),
        is_active: recordData.is_active !== false,
      }
    : {
        ward_name: "",
        state_id: "",
        district_id: "",
        area_type_id: "",
        local_body_type: undefined as unknown as WardLocalBodyType,
        local_body_id: "",
        coordinates: normalizeCoordinateDrafts(null),
        is_active: true,
      };

  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-ward";

  return (
    <ComponentCard title={title}>
      <WardEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={submitWard}
        states={states}
        districts={districts}
        areaTypes={areaTypes}
      />
    </ComponentCard>
  );
}
