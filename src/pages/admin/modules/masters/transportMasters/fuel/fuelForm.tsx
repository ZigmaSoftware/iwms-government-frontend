import type { FuelPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { Input } from "@/components/ui/input";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";


const { encTransportMaster, encFuel } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encFuel);

const FUEL_FIELDS: Record<string, string[]> = {
  fuel_type: ["fuel_type", "fuel"],
  description: ["description"],
  is_active: ["is_active", "active_status", "status"],
};

function FuelForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "transport-master",
    "fuel",
    FUEL_FIELDS
  );

  // ── Record fetch ──────────────────────────────────────────────────────────
  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.fuels.read(id)
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
          title: t("admin.fuel.load_failed_title"),
          text: err?.response?.data?.detail || t("common.request_failed"),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  // ── Submitting state ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Local form state ──────────────────────────────────────────────────────
  const [fuelType, setFuelType] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ── Populate form in edit mode ────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !recordData) return;
    setFuelType(recordData.fuel_type ?? "");
    setDescription(recordData.description ?? "");
    setIsActive(recordData.is_active ?? true);
  }, [isEdit, recordData]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (showField("fuel_type") && !fuelType) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const rawPayload = {
      fuel_type: fuelType,
      description,
      is_active: isActive,
    };
    const payload = filterPayload(rawPayload) as unknown as FuelPayload;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.fuels.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.fuels.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }
      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      const data = error?.response?.data;
      let message = "Something went wrong while saving.";

      if (typeof data === "object" && data !== null) {
        message = Object.entries(data)
          .map(([key, val]) => `${key}: ${(val as string[]).join(", ")}`)
          .join("\n");
      } else if (typeof data === "string") {
        message = data;
      }

      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ComponentCard
      title={isEdit ? t("admin.fuel.title_edit") : t("admin.fuel.title_add")}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fuel Type */}
          {showField("fuel_type") && (
          <div>
            <Label htmlFor="fuelType">
              {t("admin.fuel.fuel_type")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fuelType"
              type="text"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              placeholder={t("admin.fuel.fuel_type_placeholder")}
              className="input-validate w-full"
              required
            />
          </div>
          )}

          {/* Description */}
          {showField("description") && (
          <div>
            <Label htmlFor="fuelDescription">
              {t("common.description")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fuelDescription"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("admin.fuel.description_placeholder")}
              className="input-validate w-full"
              required
            />
          </div>
          )}

          {/* Active Status */}
          {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("admin.fuel.active_status")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Select
              id="isActive"
              value={isActive ? "true" : "false"}
              onChange={(val) => setIsActive(val === "true")}
              options={[
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
              ]}
              className="input-validate w-full"
              required
            />
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

export default FuelForm;
