import type { SelectOption, ZonePropertyLoadTrackerFormState } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const toOptions = (items: any[], valueKey: string, labelKey: string): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: String(item?.[labelKey] ?? item?.[valueKey] ?? ""),
    }))
    .filter((option) => option.value);

export default function ZonePropertyLoadTrackerForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [zones, setZones] = useState<SelectOption[]>([]);
  const [vehicles, setVehicles] = useState<SelectOption[]>([]);
  const [properties, setProperties] = useState<SelectOption[]>([]);
  const [subProperties, setSubProperties] = useState<SelectOption[]>([]);

  const [formData, setFormData] = useState<ZonePropertyLoadTrackerFormState>({
    zone_id: "",
    vehicle_id: "",
    property_id: "",
    sub_property_id: "",
    current_weight_kg: "",
  });

  const { encTransportMaster, encZonePropertyLoadTracker } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encZonePropertyLoadTracker);
  const stateRecord = (location.state as { record?: Partial<ZonePropertyLoadTrackerFormState> } | null)?.record;

  // ── Fetch dropdown lists ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    Promise.all([
      adminApi.zones.readAll(),
      adminApi.vehicleCreations.readAll(),
      adminApi.properties.readAll(),
      adminApi.subProperties.readAll(),
    ])
      .then(([zonesRes, vehiclesRes, propertiesRes, subPropertiesRes]) => {
        if (cancelled) return;
        setZones(toOptions(normalizeList(zonesRes), "unique_id", "name"));
        setVehicles(toOptions(normalizeList(vehiclesRes), "unique_id", "vehicle_no"));
        setProperties(toOptions(normalizeList(propertiesRes), "unique_id", "property_name"));
        setSubProperties(toOptions(normalizeList(subPropertiesRes), "unique_id", "sub_property_name"));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Populate form from state record (fast path) ───────────────────────────
  useEffect(() => {
    if (!isEdit || !stateRecord) return;

    setFormData({
      zone_id: stateRecord?.zone_id ?? "",
      vehicle_id: stateRecord?.vehicle_id ?? "",
      property_id: stateRecord?.property_id ?? "",
      sub_property_id: stateRecord?.sub_property_id ?? "",
      current_weight_kg:
        stateRecord?.current_weight_kg !== undefined && stateRecord?.current_weight_kg !== null
          ? String(stateRecord.current_weight_kg)
          : "",
    });
  }, [isEdit, stateRecord]);

  // ── Fetch record in edit mode ─────────────────────────────────────────────
  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.zonePropertyLoadTrackers.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire(
          t("common.error"),
          String(err?.response?.data ?? err?.message ?? t("common.load_failed")),
          "error"
        );
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  useEffect(() => {
    if (!recordData) return;
    setFormData({
      zone_id: recordData?.zone_details?.unique_id ?? "",
      vehicle_id: recordData?.vehicle_details?.unique_id ?? "",
      property_id: recordData?.property_details?.unique_id ?? "",
      sub_property_id: recordData?.sub_property_details?.unique_id ?? "",
      current_weight_kg: recordData?.current_weight_kg !== undefined && recordData?.current_weight_kg !== null ? String(recordData.current_weight_kg) : "",
    });
  }, [recordData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      !formData.zone_id ||
      !formData.vehicle_id ||
      !formData.property_id ||
      !formData.sub_property_id ||
      formData.current_weight_kg === ""
    ) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        zone_id: formData.zone_id,
        vehicle_id: formData.vehicle_id,
        property_id: formData.property_id,
        sub_property_id: formData.sub_property_id,
        current_weight_kg: Number(formData.current_weight_kg),
      };

      if (isEdit && id) {
        await adminApi.zonePropertyLoadTrackers.update(id, payload);
      } else {
        await adminApi.zonePropertyLoadTrackers.create(payload);
      }

      Swal.fire(t("common.success"), isEdit ? t("common.updated_success") : t("common.added_success"), "success");
      navigate(ENC_LIST_PATH);
    } catch (err: any) {
      Swal.fire(
        t("common.save_failed"),
        String(err?.response?.data ?? err?.message ?? t("common.save_failed_desc")),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.zone_property_load_tracker.title_edit")
            : t("admin.zone_property_load_tracker.title_add")
        }
        desc={t("admin.zone_property_load_tracker.subtitle")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>{t("admin.zone_property_load_tracker.zone")}</Label>
              <Select
                value={formData.zone_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, zone_id: value }))}
                options={zones}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>

            <div>
              <Label>{t("admin.zone_property_load_tracker.vehicle")}</Label>
              <Select
                value={formData.vehicle_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, vehicle_id: value }))}
                options={vehicles}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>

            <div>
              <Label>{t("admin.zone_property_load_tracker.property")}</Label>
              <Select
                value={formData.property_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, property_id: value }))}
                options={properties}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>

            <div>
              <Label>{t("admin.zone_property_load_tracker.sub_property")}</Label>
              <Select
                value={formData.sub_property_id}
                onChange={(value) => setFormData((prev) => ({ ...prev, sub_property_id: value }))}
                options={subProperties}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>

            <div>
              <Label>{t("admin.zone_property_load_tracker.current_weight")}</Label>
              <Input
                type="number"
                min={0}
                value={formData.current_weight_kg}
                onChange={(e) => setFormData((prev) => ({ ...prev, current_weight_kg: e.target.value }))}
                placeholder={t("admin.zone_property_load_tracker.current_weight")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || fetching || loadingRecord}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>

            <button
              type="button"
              onClick={() => navigate(ENC_LIST_PATH)}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
