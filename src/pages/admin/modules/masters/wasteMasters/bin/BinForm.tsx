import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  areaTypeApi,
  binApi,
  collectionPointApi,
  corporationApi,
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
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "../../shared/GeoFenceCoordinates";
import {
  mergeWithScopeOptionExtra,
  scopeOption,
} from "../../shared/dataScopeOptions";

type Option = {
  value: string;
  label: string;
  stateId?: string;
  districtId?: string;
  corporation_id?: string;
  municipality_id?: string;
  town_panchayat_id?: string;
  panchayat_union_id?: string;
  panchayat_id?: string;
};
type ApiRecord = Record<string, unknown>;
type HierarchyLevel =
  | "corporation_id"
  | "municipality_id"
  | "town_panchayat_id"
  | "panchayat_union_id"
  | "panchayat_id";
type GeoLocationValue = {
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyLevel: HierarchyLevel | "";
  localBodyId: string;
};

const { encWasteMasters, encBins } = getEncryptedRoute();
const { listPath: LIST_PATH } = createCrudRoutePaths(encWasteMasters, encBins);

const normalizeList = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ApiRecord[] }).results;
  }
  return [];
};

const idOf = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.unique_id ?? record.id ?? record.value ?? "");
  }
  return String(value);
};

const optionOf = (item: ApiRecord, labelKey: string): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: String(item[labelKey] ?? item.name ?? item.unique_id ?? item.id ?? ""),
  districtId: idOf(item.district_id ?? item.district),
  corporation_id: idOf(item.corporation_id ?? item.corporation),
  municipality_id: idOf(item.municipality_id ?? item.municipality),
  town_panchayat_id: idOf(item.town_panchayat_id ?? item.town_panchayat),
  panchayat_union_id: idOf(item.panchayat_union_id ?? item.panchayat_union),
  panchayat_id: idOf(item.panchayat_id ?? item.panchayat),
});

const activeOnly = (items: ApiRecord[]) =>
  items.filter((item) => item.is_active !== false && item.is_deleted !== true);

const toOption = (item: ApiRecord, labelKeys: string[]): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: String(labelKeys.map((key) => item[key]).find(Boolean) ?? item.name ?? item.unique_id ?? ""),
  stateId: idOf(item.state_id ?? item.state),
  districtId: idOf(item.district_id ?? item.district),
});

const BIN_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const hierarchyLevels: Array<{ value: HierarchyLevel; label: string; sourceType: string }> = [
  { value: "corporation_id", label: "Corporation", sourceType: "corporation" },
  { value: "municipality_id", label: "Municipality", sourceType: "municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat", sourceType: "town_panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union", sourceType: "panchayat_union" },
  { value: "panchayat_id", label: "Panchayat / PLB", sourceType: "panchayat" },
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
  const [localBodies, setLocalBodies] = useState<Record<HierarchyLevel, Option[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });

  useEffect(() => {
    let cancelled = false;

    // The State/District/Area Type/local-body screens may not be
    // permission-granted to this user at all (View gates each level's own
    // menu/list, not these dropdowns) — their Data Scope from login always
    // supplies their own hierarchy values regardless.
    const scopedStateId = scopeOption("state")?.value;
    const scopedDistrictId = scopeOption("district")?.value;

    const applyScopeFallback = () => {
      setStates((prev) => mergeWithScopeOptionExtra(prev, "state", {}));
      setDistricts((prev) =>
        mergeWithScopeOptionExtra(prev, "district", scopedStateId ? { stateId: scopedStateId } : {})
      );
      setAreaTypes((prev) =>
        mergeWithScopeOptionExtra(prev, "area_type", scopedDistrictId ? { districtId: scopedDistrictId } : {})
      );
      setLocalBodies((prev) => ({
        corporation_id: mergeWithScopeOptionExtra(prev.corporation_id, "corporation", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        municipality_id: mergeWithScopeOptionExtra(prev.municipality_id, "municipality", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        town_panchayat_id: mergeWithScopeOptionExtra(prev.town_panchayat_id, "town_panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_union_id: mergeWithScopeOptionExtra(prev.panchayat_union_id, "panchayat_union", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_id: mergeWithScopeOptionExtra(prev.panchayat_id, "panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
      }));
    };

    applyScopeFallback();

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
      if (cancelled) return;
      const fetchedStates = activeOnly(normalizeList(stateRes)).map((item) => toOption(item, ["name", "state_name"]));
      const fetchedDistricts = activeOnly(normalizeList(districtRes)).map((item) => toOption(item, ["name", "district_name"]));
      const fetchedAreaTypes = activeOnly(normalizeList(areaTypeRes)).map((item) => toOption(item, ["name", "area_type_name"]));
      const fetchedCorp = activeOnly(normalizeList(corpRes)).map((item) => toOption(item, ["corporation_name", "name"]));
      const fetchedMuni = activeOnly(normalizeList(muniRes)).map((item) => toOption(item, ["municipality_name", "name"]));
      const fetchedTown = activeOnly(normalizeList(townRes)).map((item) => toOption(item, ["town_panchayat_name", "name"]));
      const fetchedUnion = activeOnly(normalizeList(unionRes)).map((item) => toOption(item, ["union_name", "name"]));
      const fetchedPanchayat = activeOnly(normalizeList(panchayatRes)).map((item) => toOption(item, ["panchayat_name", "name"]));

      setStates(mergeWithScopeOptionExtra(fetchedStates, "state", {}));
      setDistricts(mergeWithScopeOptionExtra(fetchedDistricts, "district", scopedStateId ? { stateId: scopedStateId } : {}));
      setAreaTypes(mergeWithScopeOptionExtra(fetchedAreaTypes, "area_type", scopedDistrictId ? { districtId: scopedDistrictId } : {}));
      setLocalBodies({
        corporation_id: mergeWithScopeOptionExtra(fetchedCorp, "corporation", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        municipality_id: mergeWithScopeOptionExtra(fetchedMuni, "municipality", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        town_panchayat_id: mergeWithScopeOptionExtra(fetchedTown, "town_panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_union_id: mergeWithScopeOptionExtra(fetchedUnion, "panchayat_union", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
        panchayat_id: mergeWithScopeOptionExtra(fetchedPanchayat, "panchayat", scopedDistrictId ? { districtId: scopedDistrictId } : {}),
      });
    }).catch(() => {
      if (cancelled) return;
      applyScopeFallback();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedArea = areaTypes.find((item) => item.value === value.areaTypeId);
  const selectedAreaKind = areaKind(selectedArea?.label ?? "");
  const allowedLevels = hierarchyLevels.filter((level) =>
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
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyLevel} onChange={(event) => emit({ localBodyLevel: event.target.value as HierarchyLevel, localBodyId: "" })} disabled={!value.areaTypeId}>
          <option value="">Select Local Body</option>
          {allowedLevels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {value.localBodyLevel && (
        <div>
          <Label>{hierarchyLevels.find((item) => item.value === value.localBodyLevel)?.label} *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={value.localBodyId} onChange={(event) => emit({ localBodyId: event.target.value })}>
            <option value="">Select</option>
            {filteredLocalBodies.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}
    </>
  );
}

export default function BinForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [geo, setGeo] = useState<GeoLocationValue>(emptyGeo);
  const [collectionPointId, setCollectionPointId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [binName, setBinName] = useState("");
  const [binCapacity, setBinCapacity] = useState("");
  const [binType, setBinType] = useState("");
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>(
    normalizeCoordinateDrafts(null),
  );
  const [isActive, setIsActive] = useState(true);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      collectionPointApi.readAll(),
      wasteTypeApi.readAll(),
    ]).then(([cpRes, wasteTypeRes]) => {
      setCollectionPoints(normalizeList(cpRes).map((item) => optionOf(item, "cp_name")));
      setWasteTypes(normalizeList(wasteTypeRes).map((item) => optionOf(item, "waste_type_name")));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    binApi.read(id).then((record: ApiRecord) => {
      const nextGeo: GeoLocationValue = {
        ...emptyGeo,
        stateId: idOf(record.state_id ?? record.state),
        districtId: idOf(record.district_id ?? record.district),
        areaTypeId: idOf(record.area_type_id ?? record.area_type),
      };
      const selectedLevel = hierarchyLevels.find((item) => idOf(record[item.value]));
      if (selectedLevel) {
        const matchedId = idOf(record[selectedLevel.value]);
        nextGeo.localBodyLevel = selectedLevel.value;
        nextGeo.localBodyId = matchedId;
      }
      setGeo(nextGeo);
      setCollectionPointId(idOf(record.collection_point_id ?? record.collection_point));
      setWasteTypeId(idOf(record.wastetype_id ?? record.waste_type_id ?? record.waste_type));
      setBinName(String(record.bin_name ?? ""));
      setBinCapacity(String(record.bin_capacity ?? ""));
      setBinType(String(record.bin_type ?? ""));
      setCoordinates(normalizeCoordinateDrafts(record.coordinates));
      setIsActive(record.is_active !== false);
    });
  }, [id]);

  const filteredCollectionPoints = useMemo(
    () => {
      if (!geo.localBodyLevel || !geo.localBodyId) return [];
      return collectionPoints.filter((item) => {
        if (geo.districtId && item.districtId && item.districtId !== geo.districtId) return false;
        return item[geo.localBodyLevel as HierarchyLevel] === geo.localBodyId;
      });
    },
    [collectionPoints, geo.districtId, geo.localBodyId, geo.localBodyLevel],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!geo.districtId || !geo.areaTypeId || !geo.localBodyLevel || !geo.localBodyId || !collectionPointId || !wasteTypeId || !binName.trim()) {
      Swal.fire("Missing details", "Location, Collection Point, Waste Type and Bin Name are required.", "warning");
      return;
    }
    setSubmitting(true);
    const payload = {
      district_id: geo.districtId,
      collection_point_id: collectionPointId,
      wastetype_id: wasteTypeId,
      bin_name: binName.trim(),
      bin_capacity: binCapacity || null,
      bin_type: binType || null,
      coordinates: serializeCoordinateDrafts(coordinates),
      is_active: isActive,
    };
    try {
      if (isEdit && id) await binApi.update(id, payload);
      else await binApi.create(payload);
      navigate(LIST_PATH);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin" : "Create Bin"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LocationFields value={geo} onChange={(next) => { setGeo(next); setCollectionPointId(""); }} />
        <div>
          <Label>Collection Point *</Label>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={collectionPointId}
            onChange={(e) => setCollectionPointId(e.target.value)}
            disabled={!geo.localBodyLevel || !geo.localBodyId}
          >
            <option value="">
              {geo.localBodyLevel && geo.localBodyId
                ? "Select Collection Point"
                : "Select local body first"}
            </option>
            {filteredCollectionPoints.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Waste Type *</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={wasteTypeId} onChange={(e) => setWasteTypeId(e.target.value)}>
            <option value="">Select Waste Type</option>
            {wasteTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Bin Name *</Label>
          <Input value={binName} onChange={(e) => setBinName(e.target.value)} />
        </div>
        <div>
          <Label>Capacity</Label>
          <Input type="number" value={binCapacity} onChange={(e) => setBinCapacity(e.target.value)} />
        </div>
        <div>
          <Label>Bin Type</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" value={binType} onChange={(e) => setBinType(e.target.value)}>
            <option value="">Select Bin Type</option>
            {BIN_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />
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
