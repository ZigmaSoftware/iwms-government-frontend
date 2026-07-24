import type { VehicleCreationPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { getEncryptedRoute } from "@/utils/routeCache";
import { filterActiveRecords } from "@/utils/customerUtils";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import { vehicleCreationSchema } from "@/schemas/masters/transportMasters/vehicleCreation.schema";
import { toSwalMessage } from "@/lib/zodErrors";
import LocationFields, {
  emptyGeo,
  LOCAL_BODY_LEVELS,
  type GeoLocationValue,
} from "../../shared/LocationHierarchyFields";
import { capitalize } from "@/utils/capitalize";


const { encTransportMaster, encVehicleCreation } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encVehicleCreation);
const FILE_ICON = "/images/pdfimage/download.png";

const VEHICLE_CREATION_FIELDS: Record<string, string[]> = {
  country_id: ["country_id"],
  state_id: ["state_id"],
  district_id: ["district_id"],
  area_type_id: ["area_type_id"],
  corporation_id: ["corporation_id"],
  municipality_id: ["municipality_id"],
  town_panchayat_id: ["town_panchayat_id"],
  panchayat_union_id: ["panchayat_union_id"],
  panchayat_id: ["panchayat_id"],
  vehicle_no: ["vehicle_no", "vehicleNo"],
  vehicle_type_id: ["vehicle_type_id", "vehicle_type"],
  fuel_type_id: ["fuel_type_id", "fuel_type"],
  capacity: ["capacity"],
  mileage_per_liter: ["mileage_per_liter", "mileage"],
  service_record: ["service_record"],
  vehicle_insurance: ["vehicle_insurance"],
  insurance_expiry_date: ["insurance_expiry_date"],
  vehicle_condition: ["vehicle_condition"],
  fuel_tank_capacity: ["fuel_tank_capacity"],
  is_active: ["is_active", "status", "active_status"],
  rc_upload: ["rc_upload"],
  vehicle_insurance_file: ["vehicle_insurance_file"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toStr = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const isImageUrl = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
};

const resolveId = (item: { unique_id?: string; id?: string | number }) =>
  String(item?.unique_id ?? item?.id ?? "");

// ─── Component ────────────────────────────────────────────────────────────────

export default function VehicleCreationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "transport-master",
    "vehicle-creation",
    VEHICLE_CREATION_FIELDS
  );

  // ── Record fetch ──────────────────────────────────────────────────────────
  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.vehicleCreations.read(id)
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
          title: t("common.load_failed"),
          text: String(err?.response?.data ?? err?.message ?? t("common.request_failed")),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // ── Dropdown data fetch ───────────────────────────────────────────────────
  const [vehicleTypeData, setVehicleTypeData] = useState<any[]>([]);
  const [fuelTypeData, setFuelTypeData] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    adminApi.vehicleTypes.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setVehicleTypeData(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminApi.fuels.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setFuelTypeData(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Pending IDs — set when the record loads; applied once options are available
  const [pendingVehicleTypeId, setPendingVehicleTypeId] = useState<string | null>(null);
  const [pendingFuelTypeId, setPendingFuelTypeId] = useState<string | null>(null);

  // ── Submitting state ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Government hierarchy the vehicle belongs to ───────────────────────────
  const [geo, setGeo] = useState<GeoLocationValue>(emptyGeo);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    vehicleNo: "",
    vehicleTypeId: "",
    fuelTypeId: "",
    capacity: "",
    mileagePerLiter: "",
    serviceRecord: "",
    vehicleInsurance: "",
    insuranceExpiryDate: "",
    vehicleCondition: "NEW",
    fuelTankCapacity: "",
    isActive: "true",
  });

  const [rcFile, setRcFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [existingRcFile, setExistingRcFile] = useState<string | null>(null);
  const [existingInsuranceFile, setExistingInsuranceFile] = useState<string | null>(null);
  const [rcPreviewUrl, setRcPreviewUrl] = useState("");
  const [insurancePreviewUrl, setInsurancePreviewUrl] = useState("");
  const [isRcPreviewImage, setIsRcPreviewImage] = useState(false);
  const [isInsurancePreviewImage, setIsInsurancePreviewImage] = useState(false);
  const [removeRcFile, setRemoveRcFile] = useState(false);
  const [removeInsuranceFile, setRemoveInsuranceFile] = useState(false);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Populate form in edit mode ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !recordData) return;

    const res = recordData as Record<string, unknown>;
    const vehicleTypeId = toStr(res.vehicle_type_id);
    const fuelTypeId = toStr(res.fuel_type_id);

    if (vehicleTypeId) setPendingVehicleTypeId(vehicleTypeId);
    if (fuelTypeId) setPendingFuelTypeId(fuelTypeId);

    const localBodyLevel = LOCAL_BODY_LEVELS.find((item) => toStr(res[item.value]))?.value ?? "";
    setGeo({
      countryId: toStr(res.country_id),
      stateId: toStr(res.state_id),
      districtId: toStr(res.district_id),
      areaTypeId: toStr(res.area_type_id),
      localBodyLevel,
      localBodyId: localBodyLevel ? toStr(res[localBodyLevel]) : "",
    });

    setForm({
      vehicleNo: toStr(res.vehicle_no),
      vehicleTypeId,
      fuelTypeId,
      capacity: toStr(res.capacity),
      mileagePerLiter: toStr(res.mileage_per_liter),
      serviceRecord: toStr(res.service_record),
      vehicleInsurance: toStr(res.vehicle_insurance),
      insuranceExpiryDate: toStr(res.insurance_expiry_date),
      vehicleCondition: toStr(res.vehicle_condition) || "NEW",
      fuelTankCapacity: toStr(res.fuel_tank_capacity),
      isActive: String(res.is_active ?? true),
    });

    const rcUrl = toStr(res.rc_upload) || null;
    const insUrl = toStr(res.vehicle_insurance_file) || null;

    setExistingRcFile(rcUrl);
    setExistingInsuranceFile(insUrl);

    if (rcUrl) {
      setRcPreviewUrl(rcUrl);
      setIsRcPreviewImage(isImageUrl(rcUrl));
    }
    if (insUrl) {
      setInsurancePreviewUrl(insUrl);
      setIsInsurancePreviewImage(isImageUrl(insUrl));
    }
    setRemoveRcFile(false);
    setRemoveInsuranceFile(false);
  }, [isEdit, recordData]);

  // ── Cleanup blob URLs on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rcPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(rcPreviewUrl);
      if (insurancePreviewUrl.startsWith("blob:"))
        URL.revokeObjectURL(insurancePreviewUrl);
    };
  }, [rcPreviewUrl, insurancePreviewUrl]);

  // ── Error extractor ────────────────────────────────────────────────────────
  const extractErr = useCallback(
    (error: unknown): string => {
      const err = error as { response?: { data?: unknown }; message?: string };
      const data = err.response?.data;
      if (typeof data === "string") return data;
      if (data && typeof data === "object") {
        return Object.entries(data as Record<string, unknown>)
          .map(([key, value]) =>
            Array.isArray(value)
              ? `${key}: ${value.join(", ")}`
              : `${key}: ${String(value)}`
          )
          .join("\n");
      }
      if (err.message) return err.message;
      return t("common.request_failed");
    },
    [t]
  );

  // ── Dropdown options ───────────────────────────────────────────────────────
  const vehicleTypeOptions = useMemo(() => {
    return filterActiveRecords(vehicleTypeData, form.vehicleTypeId ? [form.vehicleTypeId] : []).map(
      (item) => ({ value: resolveId(item), label: capitalize(item.vehicleType) })
    );
  }, [vehicleTypeData, form.vehicleTypeId]);

  const fuelTypeOptions = useMemo(() => {
    return filterActiveRecords(fuelTypeData, form.fuelTypeId ? [form.fuelTypeId] : []).map(
      (item) => ({ value: resolveId(item), label: capitalize(item.fuel_type) })
    );
  }, [fuelTypeData, form.fuelTypeId]);

  const conditionOptions = [
    { value: "NEW", label: t("admin.vehicle_creation.condition_new") },
    { value: "SECOND_HAND", label: t("admin.vehicle_creation.condition_second_hand") },
  ];

  // Apply pending IDs once the corresponding options array is populated
  useEffect(() => {
    if (pendingVehicleTypeId && vehicleTypeOptions.length > 0 && vehicleTypeOptions.some((o) => o.value === pendingVehicleTypeId)) {
      setForm((prev) => ({ ...prev, vehicleTypeId: pendingVehicleTypeId }));
      setPendingVehicleTypeId(null);
    }
  }, [pendingVehicleTypeId, vehicleTypeOptions]);

  useEffect(() => {
    if (pendingFuelTypeId && fuelTypeOptions.length > 0 && fuelTypeOptions.some((o) => o.value === pendingFuelTypeId)) {
      setForm((prev) => ({ ...prev, fuelTypeId: pendingFuelTypeId }));
      setPendingFuelTypeId(null);
    }
  }, [pendingFuelTypeId, fuelTypeOptions]);

  // ── File helpers ───────────────────────────────────────────────────────────
  const handleFileChange = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreviewUrl: (url: string) => void,
    setIsPreviewImage: (v: boolean) => void,
    existingUrl: string | null,
    currentPreviewUrl: string
  ) => {
    if (file) {
      if (currentPreviewUrl.startsWith("blob:"))
        URL.revokeObjectURL(currentPreviewUrl);
      setFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsPreviewImage(file.type.startsWith("image/"));
      return;
    }
    setFile(null);
    if (existingUrl) {
      setPreviewUrl(existingUrl);
      setIsPreviewImage(isImageUrl(existingUrl));
    } else {
      setPreviewUrl("");
      setIsPreviewImage(false);
    }
  };

  const clearPreview = (options: {
    previewUrl: string;
    setPreviewUrl: (url: string) => void;
    setFile: (f: File | null) => void;
    setIsPreviewImage: (v: boolean) => void;
    setExistingFile?: (v: string | null) => void;
    setRemoveFlag?: (v: boolean) => void;
    inputId?: string;
  }) => {
    const {
      previewUrl,
      setPreviewUrl,
      setFile,
      setIsPreviewImage,
      setExistingFile,
      setRemoveFlag,
      inputId,
    } = options;
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    if (inputId) {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      if (input) input.value = "";
    }
    setFile(null);
    setPreviewUrl("");
    setIsPreviewImage(false);
    setExistingFile?.(null);
    setRemoveFlag?.(true);
  };

  const extractFileName = (url: string) => {
    const cleaned = url.split("?")[0];
    return cleaned.substring(cleaned.lastIndexOf("/") + 1) || cleaned;
  };

  const renderFileActions = (
    previewUrl: string,
    file: File | null,
    onPreview: () => void,
    onRemove: () => void
  ) => {
    if (!previewUrl) return null;
    const label = file?.name ?? extractFileName(previewUrl);
    return (
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onPreview}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
        >
          {t("admin.vehicle_creation.preview_label")} ({label})
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="bg-red-500 text-white px-3 py-1 rounded text-sm"
        >
          {t("common.remove")}
        </button>
      </div>
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = vehicleCreationSchema(showField).safeParse({
      vehicle_no: form.vehicleNo.trim(),
      country_id: geo.countryId,
      state_id: geo.stateId,
      district_id: geo.districtId,
      area_type_id: geo.areaTypeId,
      local_body_level: geo.localBodyLevel,
      local_body_id: geo.localBodyId,
    });
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    const rawPayload = {
      country_id: geo.countryId || null,
      state_id: geo.stateId || null,
      district_id: geo.districtId || null,
      area_type_id: geo.areaTypeId || null,
      corporation_id: geo.localBodyLevel === "corporation_id" ? geo.localBodyId : null,
      municipality_id: geo.localBodyLevel === "municipality_id" ? geo.localBodyId : null,
      town_panchayat_id: geo.localBodyLevel === "town_panchayat_id" ? geo.localBodyId : null,
      panchayat_union_id: geo.localBodyLevel === "panchayat_union_id" ? geo.localBodyId : null,
      panchayat_id: geo.localBodyLevel === "panchayat_id" ? geo.localBodyId : null,
      vehicle_no: form.vehicleNo.trim(),
      vehicle_type_id: form.vehicleTypeId || null,
      fuel_type_id: form.fuelTypeId || null,
      capacity: form.capacity || null,
      mileage_per_liter: form.mileagePerLiter || null,
      service_record: form.serviceRecord || null,
      vehicle_insurance: form.vehicleInsurance || null,
      insurance_expiry_date: form.insuranceExpiryDate || null,
      vehicle_condition: form.vehicleCondition,
      fuel_tank_capacity: form.fuelTankCapacity || null,
      is_active: form.isActive === "true",
    };
    const basePayload = filterPayload(rawPayload) as unknown as VehicleCreationPayload;

    const hasFiles = Boolean(
      (showField("rc_upload") && rcFile) ||
        (showField("vehicle_insurance_file") && insuranceFile)
    );

    setIsSubmitting(true);
    try {
      if (hasFiles) {
        // Build FormData for file uploads
        const formBody = new FormData();
        Object.entries(basePayload).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") return;
          formBody.append(key, String(value));
        });
        if (showField("rc_upload") && rcFile) formBody.append("rc_upload", rcFile);
        if (showField("vehicle_insurance_file") && insuranceFile) {
          formBody.append("vehicle_insurance_file", insuranceFile);
        }

        if (isEdit && id) {
          await adminApi.vehicleCreations.update(id, formBody);
        } else {
          await adminApi.vehicleCreations.create(formBody);
        }
      } else if (isEdit && id) {
        // JSON update — include file removal flags if needed
        const removalPayload = {
          ...basePayload,
          ...(showField("rc_upload") && removeRcFile ? { rc_upload: null } : {}),
          ...(showField("vehicle_insurance_file") && removeInsuranceFile
            ? { vehicle_insurance_file: null }
            : {}),
        };
        await adminApi.vehicleCreations.update(id, removalPayload);
      } else {
        await adminApi.vehicleCreations.create(basePayload);
      }

      Swal.fire({
        icon: "success",
        title: isEdit ? t("common.updated_success") : t("admin.vehicle_creation.save_success"),
        timer: 1500,
        showConfirmButton: false,
      });
      navigate(ENC_LIST_PATH);
    } catch (error) {
      Swal.fire(t("common.save_failed"), extractErr(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ComponentCard
      title={
        isEdit
          ? t("admin.vehicle_creation.title_edit")
          : t("admin.vehicle_creation.title_add")
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Government hierarchy the vehicle belongs to */}
          <LocationFields value={geo} onChange={setGeo} />

          {/* Vehicle No */}
          {showField("vehicle_no") && (
          <div>
            <Label htmlFor="vehicleNo">
              {t("admin.vehicle_creation.vehicle_no")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="vehicleNo"
              value={form.vehicleNo}
              onChange={(e) => update("vehicleNo", e.target.value)}
              placeholder={t("admin.vehicle_creation.vehicle_no_placeholder")}
              className="input-validate w-full"
              required
            />
          </div>
          )}

          {/* Status */}
          {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">{t("common.status")}</Label>
            <Select
              id="isActive"
              value={form.isActive}
              onChange={(value) => update("isActive", value)}
              options={[
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
              ]}
              placeholder={t("common.select_status")}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Vehicle Type */}
          {showField("vehicle_type_id") && (
          <div>
            <Label htmlFor="vehicleType">
              {t("admin.vehicle_creation.vehicle_type")}
            </Label>
            <Select
              id="vehicleType"
              value={form.vehicleTypeId}
              onChange={(value) => update("vehicleTypeId", value)}
              options={vehicleTypeOptions}
              placeholder={t("common.select_item_placeholder", {
                item: t("admin.vehicle_creation.vehicle_type"),
              })}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Fuel Type */}
          {showField("fuel_type_id") && (
          <div>
            <Label htmlFor="fuelType">
              {t("admin.vehicle_creation.fuel_type")}
            </Label>
            <Select
              id="fuelType"
              value={form.fuelTypeId}
              onChange={(value) => update("fuelTypeId", value)}
              options={fuelTypeOptions}
              placeholder={t("common.select_item_placeholder", {
                item: t("admin.vehicle_creation.fuel_type"),
              })}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Capacity */}
          {showField("capacity") && (
          <div>
            <Label htmlFor="capacity">
              {t("admin.vehicle_creation.capacity")}
            </Label>
            <Input
              id="capacity"
              value={form.capacity}
              onChange={(e) => update("capacity", e.target.value)}
              placeholder={t("admin.vehicle_creation.capacity_placeholder")}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Mileage Per Liter */}
          {showField("mileage_per_liter") && (
          <div>
            <Label htmlFor="mileagePerLiter">
              {t("admin.vehicle_creation.mileage_per_liter")}
            </Label>
            <Input
              id="mileagePerLiter"
              value={form.mileagePerLiter}
              onChange={(e) => update("mileagePerLiter", e.target.value)}
              placeholder={t("admin.vehicle_creation.mileage_placeholder")}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Fuel Tank Capacity */}
          {showField("fuel_tank_capacity") && (
          <div>
            <Label htmlFor="fuelTankCapacity">
              {t("admin.vehicle_creation.fuel_tank_capacity")}
            </Label>
            <Input
              id="fuelTankCapacity"
              value={form.fuelTankCapacity}
              onChange={(e) => update("fuelTankCapacity", e.target.value)}
              placeholder={t("admin.vehicle_creation.fuel_tank_capacity_placeholder")}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Vehicle Condition */}
          {showField("vehicle_condition") && (
          <div>
            <Label htmlFor="vehicleCondition">
              {t("admin.vehicle_creation.vehicle_condition")}
            </Label>
            <Select
              id="vehicleCondition"
              value={form.vehicleCondition}
              onChange={(value) => update("vehicleCondition", value)}
              options={conditionOptions}
              placeholder={t("common.select_item_placeholder", {
                item: t("admin.vehicle_creation.vehicle_condition"),
              })}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Service Record */}
          {showField("service_record") && (
          <div className="md:col-span-2">
            <Label htmlFor="serviceRecord">
              {t("admin.vehicle_creation.service_record")}
            </Label>
            <Textarea
              id="serviceRecord"
              value={form.serviceRecord}
              onChange={(e) => update("serviceRecord", e.target.value)}
              placeholder={t("admin.vehicle_creation.service_record_placeholder")}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Vehicle Insurance */}
          {showField("vehicle_insurance") && (
          <div>
            <Label htmlFor="vehicleInsurance">
              {t("admin.vehicle_creation.vehicle_insurance")}
            </Label>
            <Input
              id="vehicleInsurance"
              value={form.vehicleInsurance}
              onChange={(e) => update("vehicleInsurance", e.target.value)}
              placeholder={t("admin.vehicle_creation.vehicle_insurance_placeholder")}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* Insurance Expiry Date */}
          {showField("insurance_expiry_date") && (
          <div>
            <Label htmlFor="insuranceExpiryDate">
              {t("admin.vehicle_creation.insurance_expiry_date")}
            </Label>
            <Input
              id="insuranceExpiryDate"
              type="date"
              value={form.insuranceExpiryDate}
              onChange={(e) => update("insuranceExpiryDate", e.target.value)}
              className="input-validate w-full"
            />
          </div>
          )}

          {/* RC Upload */}
          {showField("rc_upload") && (
          <div>
            <Label htmlFor="rcUpload">
              {t("admin.vehicle_creation.rc_upload")}
            </Label>
            <input
              id="rcUpload"
              type="file"
              hidden
              onChange={(e) => {
                setRemoveRcFile(false);
                handleFileChange(
                  e.target.files?.[0] ?? null,
                  setRcFile,
                  setRcPreviewUrl,
                  setIsRcPreviewImage,
                  existingRcFile,
                  rcPreviewUrl
                );
              }}
            />
            <div
              className="border rounded p-4 cursor-pointer bg-gray-50"
              onClick={() => document.getElementById("rcUpload")?.click()}
            >
              {rcPreviewUrl ? (
                <img
                  src={isRcPreviewImage ? rcPreviewUrl : FILE_ICON}
                  alt={t("admin.vehicle_creation.rc_upload")}
                  className="w-full h-24 object-contain"
                />
              ) : (
                <img src={FILE_ICON} className="w-12 h-12 mx-auto opacity-60" />
              )}
            </div>
            {renderFileActions(
              rcPreviewUrl,
              rcFile,
              () => window.open(rcPreviewUrl, "_blank", "noopener,noreferrer"),
              () =>
                clearPreview({
                  previewUrl: rcPreviewUrl,
                  setPreviewUrl: setRcPreviewUrl,
                  setFile: setRcFile,
                  setIsPreviewImage: setIsRcPreviewImage,
                  setExistingFile: setExistingRcFile,
                  setRemoveFlag: setRemoveRcFile,
                  inputId: "rcUpload",
                })
            )}
          </div>
          )}

          {/* Insurance File */}
          {showField("vehicle_insurance_file") && (
          <div>
            <Label htmlFor="insuranceFile">
              {t("admin.vehicle_creation.vehicle_insurance_file")}
            </Label>
            <input
              id="insuranceFile"
              type="file"
              hidden
              onChange={(e) => {
                setRemoveInsuranceFile(false);
                handleFileChange(
                  e.target.files?.[0] ?? null,
                  setInsuranceFile,
                  setInsurancePreviewUrl,
                  setIsInsurancePreviewImage,
                  existingInsuranceFile,
                  insurancePreviewUrl
                );
              }}
            />
            <div
              className="border rounded p-4 cursor-pointer bg-gray-50"
              onClick={() => document.getElementById("insuranceFile")?.click()}
            >
              {insurancePreviewUrl ? (
                <img
                  src={isInsurancePreviewImage ? insurancePreviewUrl : FILE_ICON}
                  alt={t("admin.vehicle_creation.vehicle_insurance_file")}
                  className="w-full h-24 object-contain"
                />
              ) : (
                <img src={FILE_ICON} className="w-12 h-12 mx-auto opacity-60" />
              )}
            </div>
            {renderFileActions(
              insurancePreviewUrl,
              insuranceFile,
              () =>
                window.open(insurancePreviewUrl, "_blank", "noopener,noreferrer"),
              () =>
                clearPreview({
                  previewUrl: insurancePreviewUrl,
                  setPreviewUrl: setInsurancePreviewUrl,
                  setFile: setInsuranceFile,
                  setIsPreviewImage: setIsInsurancePreviewImage,
                  setExistingFile: setExistingInsuranceFile,
                  setRemoveFlag: setRemoveInsuranceFile,
                  inputId: "insuranceFile",
                })
            )}
          </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="submit"
            disabled={isSubmitting || loadingRecord}
            className="bg-green-custom text-white px-4 py-2 rounded disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? isEdit
                ? t("common.updating")
                : t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => navigate(ENC_LIST_PATH)}
            className="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
