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
import { continentApi, countryApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "@/pages/admin/modules/masters/shared/GeoFenceCoordinates";

type ContinentOption = {
  value: string;
  label: string;
};

type CountryOption = {
  value: string;
  label: string;
  continentId?: string;
};

type StatePayload = {
  state_name: string;
  state_code?: string;
  continent_id: string;
  country_id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  is_active: boolean;
};

type StateInitialPayload = {
  state_name: string;
  state_code: string;
  continent_id: string;
  country_id: string;
  coordinates: GeoCoordinateDraft[];
  is_active: boolean;
};

type StateEditorProps = {
  initialPayload: StateInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: StatePayload) => Promise<void>;
  continents: ContinentOption[];
  countries: CountryOption[];
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

const STATE_FIELDS: Record<string, string[]> = {
  continent_id: ["continent_id"],
  country_id: ["country_id"],
  state_name: ["state_name"],
  state_code: ["state_code"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

function StateEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  continents,
  countries,
}: StateEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("common-masters", "states", STATE_FIELDS);

  const [name, setName] = useState(initialPayload.state_name);
  const [code, setCode] = useState(initialPayload.state_code);
  const [continentId, setContinentId] = useState(initialPayload.continent_id);
  const [countryId, setCountryId] = useState(initialPayload.country_id);
  const [coordinates, setCoordinates] = useState(initialPayload.coordinates);
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  // Countries belong to a continent — narrow the list to the selected continent.
  const filteredCountries = useMemo(
    () =>
      countries.filter(
        (item) => !continentId || !item.continentId || item.continentId === continentId
      ),
    [countries, continentId]
  );

  const handleContinentChange = (value: string) => {
    setContinentId(value);
    // Clear a country that doesn't belong to the newly selected continent.
    const stillValid = countries.some(
      (item) => item.value === countryId && (!item.continentId || item.continentId === value)
    );
    if (!stillValid) setCountryId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fieldValues: Record<string, unknown> = {
      state_name: name.trim(),
      continent_id: continentId,
      country_id: countryId,
    };

    if (
      getMissingRequiredFields(
        ["state_name", "continent_id", "country_id"],
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

    const rawPayload: StatePayload = {
      state_name: name.trim(),
      continent_id: continentId,
      country_id: countryId,
      coordinates: serializeCoordinateDrafts(coordinates),
      is_active: isActive,
    };
    if (code.trim()) rawPayload.state_code = code.trim();

    await onSubmit(filterPayload(rawPayload) as StatePayload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {showField("continent_id") && (
          <div>
            <Label htmlFor="continentId">
              Continent <span className="text-red-500">*</span>
            </Label>
            <Select
              value={continentId}
              onValueChange={handleContinentChange}
              disabled={isSubmitting}
            >
              <SelectTrigger className="input-validate w-full" id="continentId">
                <SelectValue placeholder="Select Continent" />
              </SelectTrigger>
              <SelectContent>
                {continents.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("country_id") && (
          <div>
            <Label htmlFor="countryId">
              Country <span className="text-red-500">*</span>
            </Label>
            <Select
              value={countryId}
              onValueChange={(value) => setCountryId(value)}
              disabled={isSubmitting || !continentId}
            >
              <SelectTrigger className="input-validate w-full" id="countryId">
                <SelectValue
                  placeholder={continentId ? "Select Country" : "Select a continent first"}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredCountries.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("state_name") && (
          <div>
            <Label htmlFor="stateName">
              State Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stateName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter State Name"
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {showField("state_code") && (
          <div>
            <Label htmlFor="stateCode">State Code</Label>
            <Input
              id="stateCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter State Code"
              className="w-full"
              disabled={isSubmitting}
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

export default function StateForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encCommonMasters, encStates } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encCommonMasters, encStates);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [continents, setContinents] = useState<ContinentOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);

  const title = isEdit ? "Edit State" : "Add State";

  useEffect(() => {
    let cancelled = false;

    Promise.all([continentApi.readAll(), countryApi.readAll()])
      .then(([continentRes, countryRes]) => {
        if (cancelled) return;
        setContinents(
          toRecordList(continentRes)
            .map((row) => ({
              value: normalizeNullable(row.unique_id ?? row.id),
              label: textOf(row, "continent_name", "name"),
            }))
            .filter((item) => item.value && item.label)
        );
        setCountries(
          toRecordList(countryRes)
            .map((row) => ({
              value: normalizeNullable(row.unique_id ?? row.id),
              label: textOf(row, "country_name", "name"),
              continentId: normalizeNullable(row.continent_id ?? row.continent),
            }))
            .filter((item) => item.value && item.label)
        );
      })
      .catch(() => {
        if (cancelled) return;
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: t("common.load_failed"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.states
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

  const submitState = async (payload: StatePayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.states.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.states.create(payload);
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

  const initialPayload: StateInitialPayload = recordData
    ? {
        state_name: textOf(recordData, "state_name", "name"),
        state_code: textOf(recordData, "state_code", "label"),
        continent_id: normalizeNullable(recordData.continent_id ?? recordData.continent),
        country_id: normalizeNullable(recordData.country_id ?? recordData.country),
        coordinates: normalizeCoordinateDrafts(recordData.coordinates),
        is_active: recordData.is_active !== false,
      }
    : {
        state_name: "",
        state_code: "",
        continent_id: "",
        country_id: "",
        coordinates: normalizeCoordinateDrafts(null),
        is_active: true,
      };

  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-state";

  return (
    <ComponentCard title={title}>
      <StateEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={submitState}
        continents={continents}
        countries={countries}
      />
    </ComponentCard>
  );
}
