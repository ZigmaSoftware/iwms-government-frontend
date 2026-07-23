import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MultiSelect } from "primereact/multiselect";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collectionPointApi, wardApi, wasteTypeApi } from "@/helpers/admin";
import Swal from "@/lib/notify";
import { toSwalMessage } from "@/lib/zodErrors";
import { collectionPointSchema } from "@/schemas/core_modules/scheduleSetup/collectionPoint.schema";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { decryptSegment } from "@/utils/routeCrypto";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../../../masters/shared/GeoFenceCoordinates";
import LocationFields, {
  emptyGeo,
  LOCAL_BODY_LEVELS,
  type GeoLocationValue,
} from "../../../masters/shared/LocationHierarchyFields";

type ApiRecord = Record<string, unknown>;
type Option = { value: string; label: string };

const BIN_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const COLLECTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "bin_collection", label: "Secondary Collection Point" },
  { value: "bulk_waste_collection", label: "Bulk Waste Collection" },
];

type BinRow = {
  key: string;
  unique_id: string;
  wastetype_id: string;
  bin_name: string;
  bin_capacity: string;
  bin_type: string;
  ward_id: string;
  is_active: boolean;
};

const makeBinKey = (() => {
  let counter = 0;
  return () => `bin-${counter++}`;
})();

const emptyBinRow = (): BinRow => ({
  key: makeBinKey(),
  unique_id: "",
  wastetype_id: "",
  bin_name: "",
  bin_capacity: "",
  bin_type: "",
  ward_id: "",
  is_active: true,
});
const { encMasters, encScheduleSetup, encCollectionPoints } = getEncryptedRoute();

// Resolve the correct list path based on which parent module loaded this form.
function useListPath() {
  const { encMaster } = useParams<{ encMaster?: string }>();
  const parent = decryptSegment(encMaster ?? "");
  if (parent === "schedule-setup" || parent === "schedule-masters") {
    return createCrudRoutePaths(encScheduleSetup, encCollectionPoints).listPath;
  }
  return createCrudRoutePaths(encMasters, encCollectionPoints).listPath;
}

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return String(value);
};

const normalizeList = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ApiRecord[] }).results;
  }
  return [];
};

export default function CollectionPointForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const LIST_PATH = useListPath();

  const [geo, setGeo] = useState<GeoLocationValue>(emptyGeo);
  const [cpName, setCpName] = useState("");
  const [collectionType, setCollectionType] = useState("bin_collection");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>(
    normalizeCoordinateDrafts(null),
  );
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Bins — merged in from the standalone Bin form; created/edited inline here.
  const [bins, setBins] = useState<BinRow[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [wardRecords, setWardRecords] = useState<ApiRecord[]>([]);
  const [selectedWardIds, setSelectedWardIds] = useState<string[]>([]);

  useEffect(() => {
    wasteTypeApi.readAll().then((res: unknown) => {
      setWasteTypes(
        normalizeList(res)
          .map((item) => ({ value: idOf(item.unique_id), label: String(item.waste_type_name ?? item.unique_id ?? "") }))
          .filter((option) => option.value),
      );
    });
  }, []);

  useEffect(() => {
    if (!geo.districtId || !geo.localBodyLevel || !geo.localBodyId) {
      setWardRecords([]);
      setSelectedWardIds([]);
      return;
    }
    let cancelled = false;
    wardApi
      .readAll({
        params: {
          district_id: geo.districtId,
          [geo.localBodyLevel]: geo.localBodyId,
        },
      })
      .then((res: unknown) => {
        if (cancelled) return;
        const records = normalizeList(res);
        setWardRecords(records);
        const allowed = new Set(records.map((ward) => idOf(ward.unique_id)));
        setSelectedWardIds((current) => current.filter((wardId) => allowed.has(wardId)));
      });
    return () => {
      cancelled = true;
    };
  }, [geo.districtId, geo.localBodyId, geo.localBodyLevel]);

  useEffect(() => {
    if (!id) return;
    collectionPointApi.read(id).then((record: ApiRecord) => {
      const localBodyLevel = LOCAL_BODY_LEVELS.find((item) => idOf(record[item.value]))?.value ?? "";
      setGeo({
        ...emptyGeo,
        countryId: idOf(record.country_id ?? record.country),
        stateId: idOf(record.state_id ?? record.state),
        districtId: idOf(record.district_id ?? record.district),
        areaTypeId: idOf(record.area_type_id ?? record.area_type),
        localBodyLevel,
        localBodyId: localBodyLevel ? idOf(record[localBodyLevel]) : "",
      });
      setCpName(String(record.cp_name ?? ""));
      setCollectionType(String(record.collection_type ?? "bin_collection"));
      setLatitude(String(record.latitude ?? ""));
      setLongitude(String(record.longitude ?? ""));
      setCoordinates(
        normalizeCoordinateDrafts(record.coordinates, {
          latitude: String(record.latitude ?? ""),
          longitude: String(record.longitude ?? ""),
        }),
      );
      setIsActive(record.is_active !== false);

      if (Array.isArray(record.wards_detail) && (record.wards_detail as ApiRecord[]).length > 0) {
        setSelectedWardIds((record.wards_detail as ApiRecord[]).map((w) => String(w.unique_id)));
      }

      if (Array.isArray(record.bins_detail)) {
        setBins(
          (record.bins_detail as ApiRecord[]).map((bin) => ({
            key: makeBinKey(),
            unique_id: String(bin.unique_id ?? ""),
            wastetype_id: String(bin.wastetype_id ?? ""),
            bin_name: String(bin.bin_name ?? ""),
            bin_capacity: String(bin.bin_capacity ?? ""),
            bin_type: String(bin.bin_type ?? ""),
            ward_id: idOf(bin.ward_id ?? bin.ward),
            is_active: bin.is_active !== false,
          })),
        );
      }
    });
  }, [id]);

  const wardOptions: Option[] = wardRecords
    .map((w) => ({ value: idOf(w.unique_id), label: String(w.ward_name ?? w.unique_id ?? "") }))
    .filter((option) => option.value);

  const addBin = () => setBins((prev) => [...prev, emptyBinRow()]);
  const removeBin = (key: string) => setBins((prev) => prev.filter((bin) => bin.key !== key));
  const updateBin = (key: string, patch: Partial<BinRow>) =>
    setBins((prev) => prev.map((bin) => (bin.key === key ? { ...bin, ...patch } : bin)));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = collectionPointSchema.safeParse({
      geo,
      cp_name: cpName,
      collection_type: collectionType,
      coordinates,
      is_active: isActive,
      bins,
      ward_ids: selectedWardIds,
    });
    if (!result.success) {
      Swal.fire("Invalid details", toSwalMessage(result.error), "warning");
      return;
    }
    setSubmitting(true);
    const coordinatePayload = serializeCoordinateDrafts(coordinates);
    const firstCoordinate = coordinatePayload[0];
    const payload = {
      country_id: geo.countryId,
      state_id: geo.stateId,
      district_id: geo.districtId,
      area_type_id: geo.areaTypeId,
      corporation_id: geo.localBodyLevel === "corporation_id" ? geo.localBodyId : null,
      municipality_id: geo.localBodyLevel === "municipality_id" ? geo.localBodyId : null,
      town_panchayat_id: geo.localBodyLevel === "town_panchayat_id" ? geo.localBodyId : null,
      panchayat_union_id: geo.localBodyLevel === "panchayat_union_id" ? geo.localBodyId : null,
      panchayat_id: geo.localBodyLevel === "panchayat_id" ? geo.localBodyId : null,
      cp_name: cpName.trim(),
      collection_type: collectionType,
      latitude: firstCoordinate?.latitude ?? (latitude || null),
      longitude: firstCoordinate?.longitude ?? (longitude || null),
      coordinates: coordinatePayload,
      is_active: isActive,
      ward_ids: selectedWardIds,
      bins: bins.map((bin) => ({
        ...(bin.unique_id ? { unique_id: bin.unique_id } : {}),
        wastetype_id: bin.wastetype_id,
        bin_name: bin.bin_name.trim(),
        bin_capacity: Number(bin.bin_capacity),
        bin_type: bin.bin_type,
        ward_id: bin.ward_id,
        is_active: bin.is_active,
      })),
    };
    try {
      if (isEdit && id) await collectionPointApi.update(id, payload);
      else await collectionPointApi.create(payload);
      navigate(LIST_PATH);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Collection Point" : "Create Collection Point"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LocationFields
          value={geo}
          onChange={(next) => {
            setGeo(next);
            setSelectedWardIds([]);
            setBins((current) => current.map((bin) => ({ ...bin, ward_id: "" })));
          }}
        />
        <div>
            <Label>Wards *</Label>
          <MultiSelect
            value={selectedWardIds}
            onChange={(event) => {
              const raw = Array.isArray(event.value) ? event.value : [];
              // PrimeReact MultiSelect sometimes returns objects instead of the optionValue string
              const values = raw.map((value: unknown) => {
                if (!value || typeof value !== "object") return String(value);
                const record = value as ApiRecord;
                return String(record.value ?? record.unique_id ?? record.id ?? "");
              });
              setSelectedWardIds(values);
            }}
            options={wardOptions}
            optionLabel="label"
            optionValue="value"
            maxSelectedLabels={3}
            placeholder="Select wards"
            className="flex! h-10! w-full! items-center! justify-between! rounded-md! border! border-input! bg-background! px-3! py-2! text-sm! shadow-none! ring-offset-background! focus:outline-none! focus:ring-2! focus:ring-ring! focus:ring-offset-2! disabled:cursor-not-allowed! disabled:opacity-50!"
            pt={{
              labelContainer: { className: "!flex !flex-1 !items-center !overflow-hidden" },
              label: { className: "!m-0 !block !truncate !p-0 !text-sm !leading-5 !text-gray-900" },
              trigger: { className: "!ml-2 !flex !h-4 !w-4 !shrink-0 !items-center !justify-center !text-gray-500" },
              dropdownIcon: { className: "!h-4 !w-4 !opacity-50" },
              panel: { className: "!z-[80] !rounded-md !border !bg-white !shadow-md" },
            }}
            filter
            disabled={!geo.localBodyId}
          />
        </div>
        <div>
          <Label>Collection Point Name *</Label>
          <Input value={cpName} onChange={(e) => setCpName(e.target.value)} />
        </div>
        <div>
          <Label>Collection Type *</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={collectionType}
            onChange={(e) => setCollectionType(e.target.value)}
          >
            {COLLECTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {/* <div>
          <Label>Latitude</Label>
          <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div> */}
        <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />

        {/* Bins — merged in from the standalone Bin form */}
        <div className="md:col-span-2 rounded-md border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Label>Bins</Label>
            <Button type="button" variant="outline" size="sm" onClick={addBin}>
              + Add Bin
            </Button>
          </div>
          {bins.length === 0 && (
            <p className="text-sm text-gray-500">No bins added yet. Click "Add Bin" to create one for this collection point.</p>
          )}
          <div className="space-y-3">
            {bins.map((bin) => (
              <div key={bin.key} className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_1.5fr_auto_auto]">
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={bin.wastetype_id}
                  onChange={(e) => updateBin(bin.key, { wastetype_id: e.target.value })}
                >
                  <option value="">Select Waste Type</option>
                  {wasteTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={bin.ward_id}
                  onChange={(e) => updateBin(bin.key, { ward_id: e.target.value })}
                  disabled={selectedWardIds.length === 0}
                >
                  <option value="">Bin Ward</option>
                  {wardOptions
                    .filter((option) => selectedWardIds.includes(option.value))
                    .map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <Input
                  placeholder="Bin Name"
                  value={bin.bin_name}
                  onChange={(e) => updateBin(bin.key, { bin_name: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Capacity"
                  value={bin.bin_capacity}
                  onChange={(e) => updateBin(bin.key, { bin_capacity: e.target.value })}
                />
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={bin.bin_type}
                  onChange={(e) => updateBin(bin.key, { bin_type: e.target.value })}
                >
                  <option value="">Bin Type</option>
                  {BIN_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={bin.is_active}
                    onChange={(e) => updateBin(bin.key, { is_active: e.target.checked })}
                  />
                  Active
                </label>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeBin(bin.key)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
