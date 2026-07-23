import type { BinCollectionEventRecord } from "./types";
import type { ApiObject, TripCollectionPointRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { binCollectionEventApi, dailyTripCollectionPointApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import type { SelectOption } from "@/types";
import { toSwalMessage } from "@/lib/zodErrors";
import { collectionMonitoringSchema } from "@/schemas/wasteManagementMasters/pointcollection/collectionMonitoring.schema";


const ShadcnSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  isRequired = true,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  isRequired?: boolean;
  disabled?: boolean;
}) => {
  if (/^(company|project)$/i.test(label.trim())) return null;
  return (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-gray-700">
      {label}
      {isRequired && <span className="text-red-500 ml-1">*</span>}
    </Label>
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500">
        <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {options.length > 0 ? (
          options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        ) : (
          <div className="p-2 text-sm text-gray-500">No options available</div>
        )}
      </SelectContent>
    </Select>
  </div>
);
};

const FormSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mb-8 bg-white rounded-lg">
    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b-2 border-blue-500">
      {title}
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{children}</div>
  </div>
);

const FormInput = ({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  isRequired = true,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  step?: string;
  min?: string;
  isRequired?: boolean;
  disabled?: boolean;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-gray-700">
      {label}
      {isRequired && <span className="text-red-500 ml-1">*</span>}
    </Label>
    <Input
      type={type}
      value={value}
      onChange={onChange}
      step={step}
      min={min}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
      autoComplete="off"
    />
  </div>
);

const normalizeList = (value: unknown): ApiObject[] => {
  if (Array.isArray(value)) return value.filter((item): item is ApiObject => !!item && typeof item === "object");
  if (value && typeof value === "object") {
    const obj = value as { results?: unknown; collections?: unknown };
    if (Array.isArray(obj.results)) return obj.results.filter((item): item is ApiObject => !!item && typeof item === "object");
    if (Array.isArray(obj.collections)) return obj.collections.filter((item): item is ApiObject => !!item && typeof item === "object");
  }
  return [];
};

const idOf = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const obj = value as ApiObject;
    return String(obj.unique_id ?? obj.id ?? "").trim();
  }
  return String(value).trim();
};

const labelOf = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === "" ? "-" : String(value);

const nested = (obj: unknown, keys: string[]): string => {
  if (!obj || typeof obj !== "object") return "";
  const record = obj as ApiObject;
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
};

const errorDetail = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (!data || typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === "string" ? detail : null;
};

function CollectionMonitoringForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const { encWasteManagementMaster, encCollectionMonitoring } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encWasteManagementMaster, encCollectionMonitoring);

  const [tripCollectionPointId, setTripCollectionPointId] = useState("");
  const [tripAssignmentId, setTripAssignmentId] = useState("");
  const [binId, setBinId] = useState("");
  const [collectionPointId, setCollectionPointId] = useState("");
  const [weight, setWeight] = useState("");
  const [driverLatitude, setDriverLatitude] = useState("");
  const [driverLongitude, setDriverLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [tripCollectionPoints, setTripCollectionPoints] = useState<TripCollectionPointRecord[]>([]);
  const [pendingEvent, setPendingEvent] = useState<BinCollectionEventRecord | null>(null);

  const selectedTripCp = useMemo(
    () => tripCollectionPoints.find((item) => item.unique_id === tripCollectionPointId),
    [tripCollectionPointId, tripCollectionPoints],
  );

  const tripCpOptions = useMemo(
    () =>
      tripCollectionPoints.map((item) => {
        const binName = nested(item.bin, ["bin_name", "name"]) || idOf(item.bin_id);
        const cpName = nested(item.collection_point, ["cp_name", "name"]) || idOf(item.collection_point_id);
        const tripLabel = nested(item.trip_assignment, ["trip_plan_display_code", "unique_id"]) || idOf(item.trip_assignment_id);
        return {
          value: item.unique_id,
          label: `${tripLabel} | ${cpName} | ${binName}`,
        };
      }),
    [tripCollectionPoints],
  );

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    dailyTripCollectionPointApi
      .readAll()
      .then((response) => {
        if (cancelled) return;
        const rows = normalizeList(response) as TripCollectionPointRecord[];
        setTripCollectionPoints(rows.filter((row) => row.is_deleted !== true));
      })
      .catch(() => {
        if (!cancelled) setTripCollectionPoints([]);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTripCp) return;
    setTripAssignmentId(idOf(selectedTripCp.trip_assignment_id));
    setBinId(idOf(selectedTripCp.bin_id));
    setCollectionPointId(idOf(selectedTripCp.collection_point_id));
  }, [selectedTripCp]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoading(true);
    binCollectionEventApi.read(id)
      .then((record: BinCollectionEventRecord) => {
        if (cancelled) return;
        setPendingEvent(record);
        setWeight(labelOf(record.collected_weight_kg) === "-" ? "" : String(record.collected_weight_kg));
        setDriverLatitude(labelOf(record.driver_latitude) === "-" ? "" : String(record.driver_latitude));
        setDriverLongitude(labelOf(record.driver_longitude) === "-" ? "" : String(record.driver_longitude));
        setNotes(String(record.notes ?? ""));
        setIsActive(record.is_active !== false);
      })
      .catch(() => Swal.fire(t("common.error"), t("common.load_failed"), "error"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  useEffect(() => {
    if (!pendingEvent) return;
    if (tripCollectionPoints.length === 0) return;
    const eventTripCpId = idOf(pendingEvent.trip_collection_point_id);
    if (eventTripCpId) setTripCollectionPointId(eventTripCpId);
    setTripAssignmentId(idOf(pendingEvent.trip_assignment_id));
    setBinId(idOf(pendingEvent.bin_id));
    setCollectionPointId(idOf(pendingEvent.collection_point_id));
    setPendingEvent(null);
  }, [pendingEvent, tripCollectionPoints]);

  const selectedBinName = nested(selectedTripCp?.bin, ["bin_name", "name"]) || binId;
  const selectedWasteType = (() => {
    const waste = selectedTripCp?.bin && typeof selectedTripCp.bin === "object"
      ? (selectedTripCp.bin.waste_type as ApiObject | undefined)
      : undefined;
    return nested(waste, ["waste_type_name", "name"]) || "-";
  })();
  const selectedCollectionPointName = nested(selectedTripCp?.collection_point, ["cp_name", "name"]) || collectionPointId;
  const selectedTripLabel = nested(selectedTripCp?.trip_assignment, ["trip_plan_display_code", "unique_id"]) || tripAssignmentId;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validation = collectionMonitoringSchema.safeParse({
      tripCollectionPointId,
      weight,
      driverLatitude,
      driverLongitude,
      notes,
    });
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    const parsedWeight = Number.parseFloat(validation.data.weight || "0");
    const payload = {
      trip_assignment_id: tripAssignmentId,
      trip_collection_point_id: validation.data.tripCollectionPointId,
      bin_id: binId,
      collected_weight_kg: Number.isFinite(parsedWeight) ? parsedWeight.toFixed(2) : weight,
      driver_latitude: driverLatitude.trim() || null,
      driver_longitude: driverLongitude.trim() || null,
      notes: notes.trim() || null,
      is_active: isActive,
    };

    setLoading(true);
    try {
      if (isEdit && id) {
        await binCollectionEventApi.update(id, payload);
      } else {
        await binCollectionEventApi.create(payload);
      }

      Swal.fire(
        t("common.success"),
        isEdit ? t("common.updated_success") : t("common.added_success"),
        "success",
      );
      navigate(LIST_PATH);
    } catch (error: unknown) {
      Swal.fire(t("common.save_failed"), errorDetail(error) ?? t("common.save_failed_desc"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.collection_monitoring") })
          : t("common.add_item", { item: t("admin.nav.collection_monitoring") })
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title="Trip Collection Point">
          <ShadcnSelect
            label="Trip Collection Point"
            value={tripCollectionPointId}
            onChange={setTripCollectionPointId}
            options={tripCpOptions}
            placeholder={fetching ? t("common.loading") : "Select trip collection point"}
            disabled={fetching || tripCpOptions.length === 0 || isEdit}
          />
          <FormInput label="Trip Assignment" value={selectedTripLabel} onChange={() => undefined} disabled />
          <FormInput label={t("admin.nav.collection_point")} value={selectedCollectionPointName} onChange={() => undefined} disabled />
          <FormInput label={t("common.item_name", { item: t("admin.nav.bin_master") })} value={selectedBinName} onChange={() => undefined} disabled />
          <FormInput label={t("common.waste_type")} value={selectedWasteType} onChange={() => undefined} disabled isRequired={false} />
        </FormSection>

        <FormSection title="Collection Details">
          <FormInput
            label="Collected Weight (kg)"
            type="number"
            step="0.01"
            min="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <FormInput
            label="Driver Latitude"
            type="number"
            step="0.000001"
            value={driverLatitude}
            onChange={(e) => setDriverLatitude(e.target.value)}
            isRequired={false}
          />
          <FormInput
            label="Driver Longitude"
            type="number"
            step="0.000001"
            value={driverLongitude}
            onChange={(e) => setDriverLongitude(e.target.value)}
            isRequired={false}
          />
          <FormInput
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            isRequired={false}
          />
          <ShadcnSelect
            label={t("common.status")}
            value={isActive ? "true" : "false"}
            onChange={(value) => setIsActive(value === "true")}
            options={[
              { value: "true", label: t("common.active") },
              { value: "false", label: t("common.inactive") },
            ]}
            placeholder={t("common.select_status")}
            isRequired={false}
          />
        </FormSection>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="bg-green-custom text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {loading ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => navigate(LIST_PATH)}
            className="bg-red-400 text-white px-4 py-2 rounded"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}

export default CollectionMonitoringForm;
