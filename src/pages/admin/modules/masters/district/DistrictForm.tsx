import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { adminApi } from "@/helpers/admin/registry";
import { stateApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

type StateOption = {
  value: string;
  label: string;
  continentId: string;
  countryId: string;
};

type DistrictPayload = {
  name: string;
  district_name: string;
  district_code?: string;
  state_id: string;
  continent_id: string;
  country_id: string;
  is_active: boolean;
};

type DistrictInitialPayload = {
  name: string;
  district_code: string;
  state_id: string;
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
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "districts", DISTRICT_FIELDS);

  const [name, setName] = useState(initialPayload.name);
  const [code, setCode] = useState(initialPayload.district_code);
  const [stateId, setStateId] = useState(initialPayload.state_id);
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldValues: Record<string, unknown> = {
      district_name: name.trim(),
      state_id: stateId,
    };

    if (
      getMissingRequiredFields(
        ["district_name", "state_id"],
        (fieldKey) => fieldValues[fieldKey]
      ).length > 0
    ) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const selectedState = states.find((s) => s.value === stateId);
    if (!selectedState?.continentId || !selectedState?.countryId) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: "Selected state does not have continent and country details.",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const rawPayload: DistrictPayload = {
      name: name.trim(),
      district_name: name.trim(),
      state_id: stateId,
      continent_id: selectedState.continentId,
      country_id: selectedState.countryId,
      is_active: isActive,
    };
    if (code.trim()) rawPayload.district_code = code.trim();

    await onSubmit(filterPayload(rawPayload) as DistrictPayload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {showField("state_id") && (
          <div>
            <Label htmlFor="stateId">
              State <span className="text-red-500">*</span>
            </Label>
            <Select
              value={stateId}
              onValueChange={(value) => setStateId(value)}
              disabled={isSubmitting}
            >
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter District Name"
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {showField("district_code") && (
          <div>
            <Label htmlFor="districtCode">District Code</Label>
            <Input
              id="districtCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter District Code"
              className="w-full"
              disabled={isSubmitting}
            />
          </div>
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

export default function DistrictForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encMasters, encDistricts } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encDistricts);
  const { applyCompanyProjectFromRecord } = useCompanyProjectSelection({ isEdit });

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [states, setStates] = useState<StateOption[]>([]);

  const title = isEdit ? "Edit District" : "Add District";

  useEffect(() => {
    let cancelled = false;
    stateApi
      .readAll()
      .then((res: unknown) => {
        if (cancelled) return;
        const list = toRecordList(res).map((row) => ({
          value: normalizeNullable(row.unique_id ?? row.id),
          label: textOf(row, "state_name", "name"),
          continentId: normalizeNullable(row.continent_id ?? row.continent),
          countryId: normalizeNullable(row.country_id ?? row.country),
        }));
        setStates(list.filter((item) => item.value && item.label));
      })
      .catch(() =>
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: "Failed to load states",
        })
      );
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
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
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
        is_active: recordData.is_active !== false,
      }
    : {
        name: "",
        district_code: "",
        state_id: "",
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
