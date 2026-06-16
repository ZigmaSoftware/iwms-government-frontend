import type { BinLoadLogFormState, SelectOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const sourceTypeOptions: SelectOption[] = [
  { value: "WEIGHBRIDGE", label: "Weighbridge" },
  { value: "SENSOR", label: "Sensor" },
  { value: "MANUAL", label: "Manual" },
];

const toOptions = (items: any[], valueKey: string, labelKey: string): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: String(item?.[labelKey] ?? item?.[valueKey] ?? ""),
    }))
    .filter((option) => option.value);

const toDateTimeLocal = (value?: string | null) =>
  value ? String(value).slice(0, 16) : "";

export default function BinLoadLogForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const binLoadLogApi = adminApi.binLoadLogs;
  const zoneApi = adminApi.zones;
  const vehicleApi = adminApi.vehicleCreations;
  const propertyApi = adminApi.properties;
  const subPropertyApi = adminApi.subProperties;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [zones, setZones] = useState<SelectOption[]>([]);
  const [vehicles, setVehicles] = useState<SelectOption[]>([]);
  const [properties, setProperties] = useState<SelectOption[]>([]);
  const [subProperties, setSubProperties] = useState<SelectOption[]>([]);

  // Pending IDs — set when the record loads; applied once options are available
  const [pendingZoneId, setPendingZoneId] = useState<string | null>(null);
  const [pendingVehicleId, setPendingVehicleId] = useState<string | null>(null);
  const [pendingPropertyId, setPendingPropertyId] = useState<string | null>(null);
  const [pendingSubPropertyId, setPendingSubPropertyId] = useState<string | null>(null);

  const [formData, setFormData] = useState<BinLoadLogFormState>({
    zone_id: "",
    vehicle_id: "",
    property_id: "",
    sub_property_id: "",
    weight_kg: "",
    source_type: "",
    event_time: "",
  });

  const { encTransportMaster, encBinLoadLog } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encBinLoadLog);

  useEffect(() => {
    setFetching(true);
    Promise.all([
      zoneApi.readAll(),
      vehicleApi.readAll(),
      propertyApi.readAll(),
      subPropertyApi.readAll(),
    ])
      .then(([zoneRes, vehicleRes, propertyRes, subPropertyRes]) => {
        setZones(toOptions(normalizeList(zoneRes), "unique_id", "name"));
        setVehicles(toOptions(normalizeList(vehicleRes), "unique_id", "vehicle_no"));
        setProperties(toOptions(normalizeList(propertyRes), "unique_id", "property_name"));
        setSubProperties(toOptions(normalizeList(subPropertyRes), "unique_id", "sub_property_name"));
      })
      .catch(() => {
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      })
      .finally(() => setFetching(false));
  }, [propertyApi, subPropertyApi, t, vehicleApi, zoneApi]);

  useEffect(() => {
    if (!isEdit || !id) return;

    binLoadLogApi.read(id)
      .then((res: any) => {
        const zoneId = res?.zone_details?.unique_id ?? res?.zone_id ?? "";
        const vehicleId = res?.vehicle_details?.unique_id ?? res?.vehicle_id ?? "";
        const propertyId = res?.property_details?.unique_id ?? res?.property_id ?? "";
        const subPropertyId = res?.sub_property_details?.unique_id ?? res?.sub_property_id ?? "";

        setPendingZoneId(zoneId);
        setPendingVehicleId(vehicleId);
        setPendingPropertyId(propertyId);
        setPendingSubPropertyId(subPropertyId);

        setFormData({
          zone_id: zoneId,
          vehicle_id: vehicleId,
          property_id: propertyId,
          sub_property_id: subPropertyId,
          weight_kg: res?.weight_kg ? String(res.weight_kg) : "",
          source_type: res?.source_type ?? "",
          event_time: toDateTimeLocal(res?.event_time),
        });
      })
      .catch(() => {
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      });
  }, [binLoadLogApi, id, isEdit, t]);

  // Apply pending IDs once the corresponding options array is populated
  useEffect(() => {
    if (pendingZoneId && zones.length > 0 && zones.some((o) => o.value === pendingZoneId)) {
      setFormData((prev) => ({ ...prev, zone_id: pendingZoneId }));
      setPendingZoneId(null);
    }
  }, [pendingZoneId, zones]);

  useEffect(() => {
    if (pendingVehicleId && vehicles.length > 0 && vehicles.some((o) => o.value === pendingVehicleId)) {
      setFormData((prev) => ({ ...prev, vehicle_id: pendingVehicleId }));
      setPendingVehicleId(null);
    }
  }, [pendingVehicleId, vehicles]);

  useEffect(() => {
    if (pendingPropertyId && properties.length > 0 && properties.some((o) => o.value === pendingPropertyId)) {
      setFormData((prev) => ({ ...prev, property_id: pendingPropertyId }));
      setPendingPropertyId(null);
    }
  }, [pendingPropertyId, properties]);

  useEffect(() => {
    if (pendingSubPropertyId && subProperties.length > 0 && subProperties.some((o) => o.value === pendingSubPropertyId)) {
      setFormData((prev) => ({ ...prev, sub_property_id: pendingSubPropertyId }));
      setPendingSubPropertyId(null);
    }
  }, [pendingSubPropertyId, subProperties]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      !formData.zone_id ||
      !formData.vehicle_id ||
      !formData.property_id ||
      !formData.sub_property_id ||
      !formData.weight_kg ||
      !formData.source_type ||
      !formData.event_time
    ) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        zone_id: formData.zone_id,
        vehicle_id: formData.vehicle_id,
        property_id: formData.property_id,
        sub_property_id: formData.sub_property_id,
        weight_kg: Number(formData.weight_kg),
        source_type: formData.source_type,
        event_time: formData.event_time,
      };

      if (isEdit && id) {
        await binLoadLogApi.update(id, payload);
      } else {
        await binLoadLogApi.create(payload);
      }

      Swal.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success"
      );
      navigate(ENC_LIST_PATH);
    } catch {
      Swal.fire(t("common.save_failed"), t("common.save_failed_desc"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.bin_load_log.title_edit")
            : t("admin.bin_load_log.title_add")
        }
        desc={t("admin.bin_load_log.subtitle")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>{t("admin.bin_load_log.zone")}</Label>
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
              <Label>{t("admin.bin_load_log.vehicle")}</Label>
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
              <Label>{t("admin.bin_load_log.property")}</Label>
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
              <Label>{t("admin.bin_load_log.sub_property")}</Label>
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
              <Label>{t("admin.bin_load_log.weight_kg")}</Label>
              <Input
                type="number"
                min={0}
                value={formData.weight_kg}
                onChange={(e) => setFormData((prev) => ({ ...prev, weight_kg: e.target.value }))}
                placeholder={t("admin.bin_load_log.weight_kg")}
              />
            </div>

            <div>
              <Label>{t("admin.bin_load_log.source_type")}</Label>
              <Select
                value={formData.source_type}
                onChange={(value) => setFormData((prev) => ({ ...prev, source_type: value }))}
                options={sourceTypeOptions}
                placeholder={t("common.select_option")}
                disabled={fetching}
                required
              />
            </div>

            <div>
              <Label>{t("admin.bin_load_log.event_time")}</Label>
              <Input
                type="datetime-local"
                value={formData.event_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, event_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={loading || fetching}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
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
