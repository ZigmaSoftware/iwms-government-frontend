import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
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
import { stateApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";
import { mergeWithScopeOption } from "../shared/dataScopeOptions";
import { districtSchema, type DistrictFormValues } from "@/schemas/masters/district.schema";
import { requireWhenVisible } from "@/schemas/shared/visibility";

type StateOption = {
  value: string;
  label: string;
};

type DistrictPayload = {
  name: string;
  district_name: string;
  district_code?: string;
  state_id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  is_active: boolean;
};

type DistrictInitialPayload = {
  name: string;
  district_code: string;
  state_id: string;
  coordinates: GeoCoordinateDraft[];
  is_active: boolean;
};

type DistrictEditorProps = {
  initialPayload: DistrictInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: DistrictPayload) => Promise<void>;
  states: StateOption[];
};

type RecordRow = Record<string, any>;

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

const DISTRICT_FIELDS: Record<string, string[]> = {
  state_id: ["state_id"],
  district_name: ["district_name"],
  district_code: ["district_code"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

function DistrictEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  states,
}: DistrictEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload } = useFieldVisibility(
    "masters",
    "districts",
    DISTRICT_FIELDS
  );

  const schema = useMemo(() => requireWhenVisible(districtSchema, showField), [showField]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DistrictFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      district_name: initialPayload.name,
      district_code: initialPayload.district_code,
      state_id: initialPayload.state_id,
      coordinates: initialPayload.coordinates,
      is_active: initialPayload.is_active,
    },
  });

  const onValid = async (values: DistrictFormValues) => {
    const rawPayload: DistrictPayload = {
      name: values.district_name.trim(),
      district_name: values.district_name.trim(),
      state_id: values.state_id,
      coordinates: serializeCoordinateDrafts(values.coordinates ?? []),
      is_active: values.is_active,
    };
    if (values.district_code?.trim()) rawPayload.district_code = values.district_code.trim();

    await onSubmit(filterPayload(rawPayload) as DistrictPayload);
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
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger className="input-validate w-full" id="stateId">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError message={errors.state_id?.message} />
          </div>
        )}

        {showField("district_name") && (
          <div>
            <Label htmlFor="districtName">
              District Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="districtName"
              type="text"
              placeholder="Enter District Name"
              className="input-validate w-full"
              disabled={isSubmitting}
              {...register("district_name")}
            />
            <FieldError message={errors.district_name?.message} />
          </div>
        )}

        {showField("district_code") && (
          <div>
            <Label htmlFor="districtCode">District Code</Label>
            <Input
              id="districtCode"
              type="text"
              placeholder="Enter District Code"
              className="w-full"
              disabled={isSubmitting}
              {...register("district_code")}
            />
            <FieldError message={errors.district_code?.message} />
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

export default function DistrictForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encMasters, encDistricts } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encDistricts);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [states, setStates] = useState<StateOption[]>([]);

  const title = isEdit ? "Edit District" : "Add District";

  useEffect(() => {
    let cancelled = false;

    // The State screen may not be permission-granted to this user at all
    // (View gates the States menu/list, not this dropdown) — their Data
    // Scope from login always supplies their own state regardless.
    setStates((prev) => mergeWithScopeOption(prev, "state"));

    stateApi
      .readAll()
      .then((res: unknown) => {
        if (cancelled) return;
        const list = toRecordList(res).map((row) => ({
          value: normalizeNullable(row.unique_id ?? row.id),
          label: textOf(row, "state_name", "name"),
        }));
        const fetched = list.filter((item) => item.value && item.label);
        setStates(mergeWithScopeOption(fetched, "state"));
      })
      .catch(() => {
        if (cancelled) return;
        setStates((prev) => mergeWithScopeOption(prev, "state"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.districts
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
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const submitDistrict = async (payload: DistrictPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.districts.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.districts.create(payload);
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

  const initialPayload: DistrictInitialPayload = recordData
    ? {
        name: textOf(recordData, "district_name", "name"),
        district_code: textOf(recordData, "district_code"),
        state_id: normalizeNullable(recordData.state_id ?? recordData.state),
        coordinates: normalizeCoordinateDrafts(recordData.coordinates),
        is_active: recordData.is_active !== false,
      }
    : {
        name: "",
        district_code: "",
        state_id: "",
        coordinates: normalizeCoordinateDrafts(null),
        is_active: true,
      };

  const formKey = isEdit
    ? String(recordData?.unique_id ?? id)
    : "new-district";

  return (
    <ComponentCard title={title}>
      <DistrictEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={submitDistrict}
        states={states}
      />
    </ComponentCard>
  );
}
