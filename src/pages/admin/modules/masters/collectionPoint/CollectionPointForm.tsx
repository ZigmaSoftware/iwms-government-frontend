import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  areaTypeApi,
  corporationApi,
  collectionPointApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
  wasteTypeApi,
} from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { decryptSegment } from "@/utils/routeCrypto";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../shared/GeoFenceCoordinates";

type ApiRecord = Record<string, unknown>;

const BIN_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const COLLECTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "bin_collection", label: "Secondary Collection Point" },
  { value: "household_collection", label: "Household Collection" },
  { value: "bulk_waste_collection", label: "Bulk Waste Collection" },
];

type BinRow = {
  key: string;
  unique_id: string;
  wastetype_id: string;
  bin_name: string;
  bin_capacity: string;
  bin_type: string;
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
  is_active: true,
});
type LocalBodyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";
type GeoLocationValue = {
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyLevel: LocalBodyLevel | "";
  localBodyId: string;
};
type Option = { value: string; label: string; stateId?: string; districtId?: string };

const { encMasters, encScheduleMasters, encCollectionPoints } = getEncryptedRoute();

// Resolve the correct list path based on which parent module loaded this form.
function useListPath() {
  const { encMaster } = useParams<{ encMaster?: string }>();
  const parent = decryptSegment(encMaster ?? "");
  if (parent === "schedule-masters") {
    return createCrudRoutePaths(encScheduleMasters, encCollectionPoints).listPath;
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

const activeOnly = (items: ApiRecord[]) =>
  items.filter((item) => item.is_active !== false && item.is_deleted !== true);

const toOption = (item: ApiRecord, labelKeys: string[]): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: String(labelKeys.map((key) => item[key]).find(Boolean) ?? item.name ?? item.unique_id ?? ""),
  stateId: idOf(item.state_id ?? item.state),
  districtId: idOf(item.district_id ?? item.district),
});

const LOCAL_BODY_LEVELS: Array<{ value: LocalBodyLevel; label: string; sourceType: string }> = [
  { value: "corporation_id", label: "Corporation", sourceType: "corporation" },
  { value: "municipality_id", label: "Municipality", sourceType: "municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat", sourceType: "town_panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union", sourceType: "panchayat_union" },
  { value: "panchayat_id", label: "Panchayat", sourceType: "panchayat" },
];

const areaKind = (label: string): "urban" | "rural" | "" => {
  const normalized = label.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const emptyGeo: GeoLocationValue = {
  stateId: "",
  districtId: "",
  areaTypeId: "",
  localBodyLevel: "",
  localBodyId: "",
};

function LocationFields({
  value,
  onChange,
}: {
  value: GeoLocationValue;
  onChange: (value: GeoLocationValue) => void;
}) {
  const [states, setStates] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [areaTypes, setAreaTypes] = useState<Option[]>([]);
  const [localBodies, setLocalBodies] = useState<Record<LocalBodyLevel, Option[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });

  useEffect(() => {
    Promise.all([
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ]).then(([stateRes, districtRes, areaTypeRes, corpRes, muniRes, townRes, unionRes, panchayatRes]) => {
      setStates(activeOnly(normalizeList(stateRes)).map((item) => toOption(item, ["name", "state_name"])));
      setDistricts(activeOnly(normalizeList(districtRes)).map((item) => toOption(item, ["name", "district_name"])));
      setAreaTypes(activeOnly(normalizeList(areaTypeRes)).map((item) => toOption(item, ["name", "area_type_name"])));
      setLocalBodies({
        corporation_id: activeOnly(normalizeList(corpRes)).map((item) => toOption(item, ["corporation_name", "name"])),
        municipality_id: activeOnly(normalizeList(muniRes)).map((item) => toOption(item, ["municipality_name", "name"])),
        town_panchayat_id: activeOnly(normalizeList(townRes)).map((item) => toOption(item, ["town_panchayat_name", "name"])),
        panchayat_union_id: activeOnly(normalizeList(unionRes)).map((item) => toOption(item, ["union_name", "name"])),
        panchayat_id: activeOnly(normalizeList(panchayatRes)).map((item) => toOption(item, ["panchayat_name", "name"])),
      });
    });
  }, []);

  const selectedArea = areaTypes.find((item) => item.value === value.areaTypeId);
  const selectedAreaKind = areaKind(selectedArea?.label ?? "");
  const allowedLevels = LOCAL_BODY_LEVELS.filter((level) =>
    selectedAreaKind === "urban"
      ? ["corporation_id", "municipality_id", "town_panchayat_id"].includes(level.value)
      : selectedAreaKind === "rural"
        ? ["panchayat_union_id", "panchayat_id"].includes(level.value)
        : false,
  );
  const filteredDistricts = useMemo(
    () => districts.filter((item) => !value.stateId || item.stateId === value.stateId),
    [districts, value.stateId],
  );
  const filteredAreaTypes = useMemo(
    () => areaTypes.filter((item) => !value.districtId || item.districtId === value.districtId),
    [areaTypes, value.districtId],
  );
  const filteredLocalBodies = value.localBodyLevel
    ? localBodies[value.localBodyLevel].filter((item) => !value.districtId || item.districtId === value.districtId)
    : [];

  const emit = (patch: Partial<GeoLocationValue>) => {
    const next = { ...value, ...patch };
    onChange(next);
  };

  return (
    <>
      <div>
        <Label>State *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.stateId} onChange={(event) => emit({ stateId: event.target.value, districtId: "", areaTypeId: "", localBodyLevel: "", localBodyId: "" })}>
          <option value="">Select State</option>
          {states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>District *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.districtId} onChange={(event) => emit({ districtId: event.target.value, areaTypeId: "", localBodyLevel: "", localBodyId: "" })} disabled={!value.stateId}>
          <option value="">Select District</option>
          {filteredDistricts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Area Type *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.areaTypeId} onChange={(event) => emit({ areaTypeId: event.target.value, localBodyLevel: "", localBodyId: "" })} disabled={!value.districtId}>
          <option value="">Select Area Type</option>
          {filteredAreaTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Local Body *</Label>
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyLevel} onChange={(event) => emit({ localBodyLevel: event.target.value as LocalBodyLevel, localBodyId: "" })} disabled={!value.areaTypeId}>
          <option value="">Select Local Body</option>
          {allowedLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {value.localBodyLevel && (
        <div>
          <Label>{LOCAL_BODY_LEVELS.find((item) => item.value === value.localBodyLevel)?.label} *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyId} onChange={(event) => emit({ localBodyId: event.target.value })}>
            <option value="">Select</option>
            {filteredLocalBodies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}
    </>
  );
}

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
    if (!id) return;
    collectionPointApi.read(id).then((record: ApiRecord) => {
      const localBodyLevel = LOCAL_BODY_LEVELS.find((item) => idOf(record[item.value]))?.value ?? "";
      setGeo({
        ...emptyGeo,
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

      if (Array.isArray(record.bins_detail)) {
        setBins(
          (record.bins_detail as ApiRecord[]).map((bin) => ({
            key: makeBinKey(),
            unique_id: String(bin.unique_id ?? ""),
            wastetype_id: String(bin.wastetype_id ?? ""),
            bin_name: String(bin.bin_name ?? ""),
            bin_capacity: String(bin.bin_capacity ?? ""),
            bin_type: String(bin.bin_type ?? ""),
            is_active: bin.is_active !== false,
          })),
        );
      }
    });
  }, [id]);

  const addBin = () => setBins((prev) => [...prev, emptyBinRow()]);
  const removeBin = (key: string) => setBins((prev) => prev.filter((bin) => bin.key !== key));
  const updateBin = (key: string, patch: Partial<BinRow>) =>
    setBins((prev) => prev.map((bin) => (bin.key === key ? { ...bin, ...patch } : bin)));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!geo.stateId || !geo.districtId || !geo.areaTypeId || !geo.localBodyLevel || !geo.localBodyId || !cpName.trim()) {
      Swal.fire("Missing details", "Location and Collection Point Name are required.", "warning");
      return;
    }
    if (bins.some((bin) => !bin.wastetype_id || !bin.bin_name.trim() || !bin.bin_capacity || !bin.bin_type)) {
      Swal.fire("Missing details", "Every bin needs a Waste Type, Name, Capacity and Type.", "warning");
      return;
    }
    setSubmitting(true);
    const coordinatePayload = serializeCoordinateDrafts(coordinates);
    const firstCoordinate = coordinatePayload[0];
    const payload = {
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
      bins: bins.map((bin) => ({
        ...(bin.unique_id ? { unique_id: bin.unique_id } : {}),
        wastetype_id: bin.wastetype_id,
        bin_name: bin.bin_name.trim(),
        bin_capacity: Number(bin.bin_capacity),
        bin_type: bin.bin_type,
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
        <LocationFields value={geo} onChange={setGeo} />
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
              <div key={bin.key} className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_auto_auto]">
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
