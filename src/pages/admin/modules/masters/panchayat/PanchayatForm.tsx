import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { capitalize } from "@/utils/capitalize";
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
import { stateApi, districtApi, areaTypeApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { panchayatSchema } from "@/schemas/masters/panchayat.schema";
import { requireWhenVisible } from "@/schemas/shared/visibility";
import { toSwalMessage } from "@/lib/zodErrors";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";
import {
  mergeWithScopeOptionExtra,
  scopeFieldState,
  scopeOption,
} from "../shared/dataScopeOptions";

type Option = {
  value: string;
  label: string;
  stateId?: string;
  districtId?: string;
};

type RecordRow = Record<string, any>;

type PanchayatInitialPayload = {
  name: string;
  state_id: string;
  district_id: string;
  area_type_id: string;
  coordinates: GeoCoordinateDraft[];
  is_active: boolean;
};

type PanchayatPayload = {
  panchayat_name: string;
  state_id: string;
  district_id: string;
  area_type_id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  is_active: boolean;
};

type PanchayatEditorProps = {
  initialPayload: PanchayatInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: PanchayatPayload) => Promise<void>;
  states: Option[];
  districts: Option[];
  areaTypes: Option[];
};

const AREA_TYPE_FILTER = "Rural Local Body";

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

const PANCHAYAT_FIELDS: Record<string, string[]> = {
  state_id: ["state_id"],
  district_id: ["district_id"],
  area_type_id: ["area_type_id"],
  panchayat_name: ["panchayat_name"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

function PanchayatEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  states,
  districts,
  areaTypes,
}: PanchayatEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload } =
    useFieldVisibility("masters", "panchayats", PANCHAYAT_FIELDS);

  const [name, setName] = useState(initialPayload.name);
  const [stateId, setStateId] = useState(initialPayload.state_id);
  const [districtId, setDistrictId] = useState(initialPayload.district_id);
  const [areaTypeId, setAreaTypeId] = useState(initialPayload.area_type_id);
  const [coordinates, setCoordinates] = useState(initialPayload.coordinates);
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that field shows pre-filled and non-editable rather than an
  // editable dropdown. Several scoped values (or none) leave the field
  // editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId) setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId) setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId) setAreaTypeId(areaTypeScope.options[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, areaTypeScope.mode, stateId, districtId, areaTypeId]);

  const filteredDistricts = useMemo(
    () =>
      districts.filter(
        (item) => !stateId || !item.stateId || item.stateId === stateId
      ),
    [districts, stateId]
  );

  const filteredAreaTypes = useMemo(
    () =>
      areaTypes.filter(
        (item) =>
          (!stateId || !item.stateId || item.stateId === stateId) &&
          (!districtId || !item.districtId || item.districtId === districtId) &&
          (!AREA_TYPE_FILTER || item.label === AREA_TYPE_FILTER)
      ),
    [areaTypes, stateId, districtId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = requireWhenVisible(panchayatSchema, showField).safeParse({
      panchayat_name: name.trim(),
      state_id: stateId,
      district_id: districtId,
      area_type_id: areaTypeId,
      coordinates,
      is_active: isActive,
    });

    if (!result.success) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: toSwalMessage(result.error),
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const rawPayload: PanchayatPayload = {
      panchayat_name: name.trim(),
      state_id: stateId,
      district_id: districtId,
      area_type_id: areaTypeId,
      coordinates: serializeCoordinateDrafts(coordinates),
      is_active: isActive,
    };

    await onSubmit(filterPayload(rawPayload) as PanchayatPayload);
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
              onValueChange={(value) => {
                setStateId(value);
                setDistrictId("");
                setAreaTypeId("");
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
              onValueChange={(value) => {
                setDistrictId(value);
                setAreaTypeId("");
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
          </div>
        )}

        {showField("area_type_id") && (
          <div>
            <Label htmlFor="areaTypeId">
              Area Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={areaTypeId}
              onValueChange={setAreaTypeId}
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
          </div>
        )}

        {showField("panchayat_name") && (
          <div>
            <Label htmlFor="panchayatName">
              Panchayat Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="panchayatName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Panchayat Name"
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

export default function PanchayatForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { encMasters, encPanchayats } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encPanchayats);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [areaTypes, setAreaTypes] = useState<Option[]>([]);

  const title = isEdit ? "Edit Panchayat" : "Add Panchayat";

  useEffect(() => {
    let cancelled = false;

    // The State/District/Area Type screens may not be permission-granted to
    // this user at all (View gates their own menu/list, not these
    // dropdowns) — their Data Scope from login always supplies their own
    // state/district/area type regardless.
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
          mergeWithScopeOptionExtra(
            fetchedAreaTypes,
            "area_type",
            {
              ...(scopedStateId ? { stateId: scopedStateId } : {}),
              ...(scopedDistrictId ? { districtId: scopedDistrictId } : {}),
            }
          )
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
        if (
          !scopeOption("state") &&
          !scopeOption("district") &&
          !scopeOption("area_type")
        ) {
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
    adminApi.panchayats
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

  const submitPanchayat = async (payload: PanchayatPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.panchayats.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.panchayats.create(payload);
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

  const initialPayload: PanchayatInitialPayload = recordData
    ? {
        name: textOf(recordData, "panchayat_name", "name"),
        state_id: normalizeNullable(recordData.state_id ?? recordData.state),
        district_id: normalizeNullable(recordData.district_id ?? recordData.district),
        area_type_id: normalizeNullable(recordData.area_type_id ?? recordData.area_type),
        coordinates: normalizeCoordinateDrafts(recordData.coordinates),
        is_active: recordData.is_active !== false,
      }
    : {
        name: "",
        state_id: "",
        district_id: "",
        area_type_id: "",
        coordinates: normalizeCoordinateDrafts(null),
        is_active: true,
      };

  const formKey = isEdit
    ? String(recordData?.unique_id ?? id)
    : "new-panchayat";

  return (
    <ComponentCard title={title}>
      <PanchayatEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(LIST_PATH)}
        onSubmit={submitPanchayat}
        states={states}
        districts={districts}
        areaTypes={areaTypes}
      />
    </ComponentCard>
  );
}
