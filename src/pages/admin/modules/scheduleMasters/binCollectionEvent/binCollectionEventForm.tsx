import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  areaTypeApi,
  binCollectionEventApi,
  collectionPointApi,
  corporationApi,
  dailyTripAssignmentApi,
  dailyTripCollectionPointApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  stateApi,
  townPanchayatApi,
} from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

type Option = {
  value: string;
  label: string;
  assignmentId?: string;
  collectionPointId?: string;
  binId?: string;
  panchayatId?: string;
  stateId?: string;
  districtId?: string;
  areaTypeId?: string;
  localBodyLevel?: HierarchyLevel;
  localBodyId?: string;
};
type ApiRecord = Record<string, any>;

const idOf = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return String(value.unique_id ?? value.id ?? value.value ?? value.staff_unique_id ?? "");
  }
  return String(value);
};

const textOf = (...values: any[]): string => {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return "";
};

const uniqueOptions = (items: Option[]): Option[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.value || seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
};

const ensureOption = (items: Option[], value: string, label?: string): Option[] => {
  if (!value || items.some((item) => item.value === value)) return items;
  return [{ value, label: label || value }, ...items];
};

const hierarchyIdFields: HierarchyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];

const hierarchyLevels: Array<{ value: HierarchyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat" },
];

const AREA_TYPE_LEVELS: Record<"urban" | "rural", HierarchyLevel[]> = {
  urban: ["corporation_id", "municipality_id", "town_panchayat_id"],
  rural: ["panchayat_union_id", "panchayat_id"],
};

const areaTypeCategoryFromName = (name: string): "urban" | "rural" | "" => {
  const normalized = name.toLowerCase();
  if (normalized.includes("urban")) return "urban";
  if (normalized.includes("rural")) return "rural";
  return "";
};

const assignmentOption = (item: ApiRecord): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: textOf(item.display_code, item.trip_plan?.display_code, item.trip_plan_id?.display_code, item.unique_id),
  panchayatId: idOf(item.panchayat_id ?? item.panchayat),
});

const collectionPointOption = (item: ApiRecord): Option => {
  const collectionPoint = item.collection_point ?? item.collection_point_id;
  const localBodyField = hierarchyIdFields.find(
    (key) => collectionPoint?.[key] ?? collectionPoint?.[key.replace("_id", "")]?.unique_id,
  );

  return {
    value: idOf(item.unique_id ?? item.id),
    label: textOf(
      item.collection_point_name,
      collectionPoint?.cp_name,
      collectionPoint?.name,
      collectionPoint?.unique_id,
      item.unique_id,
    ),
    assignmentId: idOf(item.trip_assignment_id ?? item.trip_assignment),
    collectionPointId: idOf(item.collection_point_id ?? item.collection_point),
    binId: idOf(item.bin_id ?? item.bin),
    panchayatId: idOf(item.panchayat_id ?? item.panchayat ?? collectionPoint?.panchayat_id),
    stateId: idOf(collectionPoint?.state_id ?? collectionPoint?.state),
    districtId: idOf(collectionPoint?.district_id ?? collectionPoint?.district),
    areaTypeId: idOf(collectionPoint?.area_type_id ?? collectionPoint?.area_type),
    localBodyLevel: localBodyField,
    localBodyId: localBodyField ? idOf(collectionPoint?.[localBodyField] ?? collectionPoint?.[localBodyField.replace("_id", "")]?.unique_id) : "",
  };
};

const binOption = (item: ApiRecord): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: textOf(item.bin_name, item.name, item.unique_id),
  collectionPointId: idOf(item.collection_point_id ?? item.collection_point),
  panchayatId: idOf(item.panchayat_id ?? item.panchayat),
});

const panchayatOption = (item: ApiRecord): Option => ({
  value: idOf(item.unique_id ?? item.id),
  label: textOf(item.panchayat_name, item.name, item.unique_id),
});

export default function BinCollectionEventForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleMasters, encBinCollectionEvent } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleMasters, encBinCollectionEvent);

  const [tripAssignmentId, setTripAssignmentId] = useState("");
  const [tripCollectionPointId, setTripCollectionPointId] = useState("");
  const [binId, setBinId] = useState("");
  const [panchayatId, setPanchayatId] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">("");
  const [localBodyLevel, setLocalBodyLevel] = useState<HierarchyLevel>("corporation_id");
  const [collectionDate, setCollectionDate] = useState("");
  const [collectedWeightKg, setCollectedWeightKg] = useState("");
  const [driverLatitude, setDriverLatitude] = useState("");
  const [driverLongitude, setDriverLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [assignments, setAssignments] = useState<Option[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [bins, setBins] = useState<Option[]>([]);
  const [panchayats, setPanchayats] = useState<Option[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [areaTypes, setAreaTypes] = useState<any[]>([]);
  const [hierarchyRecords, setHierarchyRecords] = useState<Record<HierarchyLevel, any[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      dailyTripAssignmentApi.readAll(),
      dailyTripCollectionPointApi.readAll(),
      adminApi.bins.readAll(),
      panchayatApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
    ]).then(([
      assignmentRes,
      cpRes,
      binRes,
      panchayatRes,
      stateRes,
      districtRes,
      areaTypeRes,
      corporationRes,
      municipalityRes,
      townPanchayatRes,
      panchayatUnionRes,
    ]) => {
      setAssignments(uniqueOptions(normalizeList(assignmentRes).map(assignmentOption)));
      setCollectionPoints(uniqueOptions(normalizeList(cpRes).map(collectionPointOption)));
      setBins(uniqueOptions(normalizeList(binRes).map(binOption)));
      setPanchayats(uniqueOptions(normalizeList(panchayatRes).map(panchayatOption)));
      setStates(normalizeList(stateRes));
      setDistricts(normalizeList(districtRes));
      setAreaTypes(normalizeList(areaTypeRes));
      setHierarchyRecords({
        corporation_id: normalizeList(corporationRes),
        municipality_id: normalizeList(municipalityRes),
        town_panchayat_id: normalizeList(townPanchayatRes),
        panchayat_union_id: normalizeList(panchayatUnionRes),
        panchayat_id: normalizeList(panchayatRes),
      });
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    binCollectionEventApi.read(id).then((record: ApiRecord) => {
      const assignmentId = idOf(record.trip_assignment_id ?? record.trip_assignment);
      const tripCollectionPointId = idOf(record.trip_collection_point_id ?? record.trip_collection_point);
      const selectedBinId = idOf(record.bin_id ?? record.bin);
      const selectedPanchayatId = idOf(record.panchayat_id ?? record.panchayat ?? record.bin?.panchayat_id);

      setTripAssignmentId(assignmentId);
      setTripCollectionPointId(tripCollectionPointId);
      setBinId(selectedBinId);
      setPanchayatId(selectedPanchayatId);
      setCollectionDate(String(record.collection_date ?? ""));
      setCollectedWeightKg(String(record.collected_weight_kg ?? ""));
      setDriverLatitude(String(record.driver_latitude ?? ""));
      setDriverLongitude(String(record.driver_longitude ?? ""));
      setNotes(String(record.notes ?? ""));

      setAssignments((items) =>
        ensureOption(
          items,
          assignmentId,
          textOf(record.trip_assignment?.display_code, record.trip_plan?.display_code, assignmentId),
        ),
      );
      setCollectionPoints((items) =>
        ensureOption(
          items,
          tripCollectionPointId,
          textOf(record.collection_point?.cp_name, record.collection_point_name, tripCollectionPointId),
        ),
      );
      setBins((items) => ensureOption(items, selectedBinId, textOf(record.bin?.bin_name, selectedBinId)));
      setPanchayats((items) =>
        ensureOption(items, selectedPanchayatId, textOf(record.panchayat_name, record.panchayat?.panchayat_name, selectedPanchayatId)),
      );

      const selectedTripCollectionPoint = record.trip_collection_point ?? record.trip_collection_point_id ?? record.collection_point ?? record.collection_point_id;
      if (selectedTripCollectionPoint) {
        setStateId(idOf(selectedTripCollectionPoint.state_id ?? selectedTripCollectionPoint.state));
        setDistrictId(idOf(selectedTripCollectionPoint.district_id ?? selectedTripCollectionPoint.district));
        const storedAreaTypeId = idOf(selectedTripCollectionPoint.area_type_id ?? selectedTripCollectionPoint.area_type);
        setAreaTypeId(storedAreaTypeId);
        setAreaTypeCategory(areaTypeCategoryFromName(String(selectedTripCollectionPoint.area_type?.name ?? selectedTripCollectionPoint.area_type_name ?? "")));
        const selectedLocalBodyLevel = hierarchyIdFields.find(
          (key) => selectedTripCollectionPoint?.[key] ?? selectedTripCollectionPoint?.[key.replace("_id", "")]?.unique_id,
        );
        setLocalBodyLevel(selectedLocalBodyLevel ?? "corporation_id");
        setPanchayatId(
          idOf(
            selectedTripCollectionPoint?.[selectedLocalBodyLevel ?? "panchayat_id"] ??
              selectedTripCollectionPoint?.[selectedLocalBodyLevel?.replace("_id", "") ?? "panchayat"]?.unique_id,
          ),
        );
      }
    });
  }, [id]);

  useEffect(() => {
    if (!areaTypeId) {
      setAreaTypeCategory("");
      return;
    }
    const selected = areaTypes.find((item) => String(item.unique_id ?? item.id) === areaTypeId);
    setAreaTypeCategory(areaTypeCategoryFromName(String(selected?.name ?? selected?.area_type_name ?? "")));
  }, [areaTypeId, areaTypes]);

  const selectedCollectionPoint = useMemo(
    () => collectionPoints.find((item) => item.value === tripCollectionPointId),
    [collectionPoints, tripCollectionPointId],
  );

  const stateOptions = useMemo(
    () => states.map((item) => ({ value: idOf(item.unique_id ?? item.id), label: textOf(item.state_name, item.name, item.unique_id) })).filter((item) => item.value),
    [states],
  );

  const districtOptions = useMemo(
    () =>
      districts
        .filter((item) => !stateId || String(item.state_id ?? item.state ?? "") === stateId)
        .map((item) => ({ value: idOf(item.unique_id ?? item.id), label: textOf(item.district_name, item.name, item.unique_id) }))
        .filter((item) => item.value),
    [districts, stateId],
  );

  const areaTypeOptions = useMemo(
    () =>
      areaTypes
        .filter((item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId)
        .map((item) => ({ value: idOf(item.unique_id ?? item.id), label: textOf(item.area_type_name, item.name, item.unique_id) }))
        .filter((item) => item.value),
    [areaTypes, districtId],
  );

  const availableHierarchyLevels = useMemo(
    () =>
      areaTypeCategory
        ? hierarchyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value))
        : [{ value: localBodyLevel, label: hierarchyLevels.find((item) => item.value === localBodyLevel)?.label ?? "Local Body" }],
    [areaTypeCategory, localBodyLevel],
  );

  const localBodyOptions = useMemo(() => {
    const records = hierarchyRecords[localBodyLevel] ?? [];
    const options = records
      .filter((item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId)
      .map((item) => ({
        value: idOf(item.unique_id ?? item.id),
        label: textOf(item.name, item.corporation_name, item.municipality_name, item.town_panchayat_name, item.union_name, item.panchayat_name, item.unique_id),
      }))
      .filter((item) => item.value);
    const selectedLabel = options.find((item) => item.value === panchayatId)?.label;
    return ensureOption(options, panchayatId, selectedLabel);
  }, [hierarchyRecords, localBodyLevel, districtId, panchayatId]);

  const visibleCollectionPoints = useMemo(() => {
    const filtered = tripAssignmentId
      ? collectionPoints.filter((item) => !item.assignmentId || item.assignmentId === tripAssignmentId)
      : collectionPoints;
    return ensureOption(filtered, tripCollectionPointId, selectedCollectionPoint?.label);
  }, [collectionPoints, selectedCollectionPoint?.label, tripAssignmentId, tripCollectionPointId]);

  const visibleBins = useMemo(() => {
    const collectionPointId = selectedCollectionPoint?.collectionPointId;
    const filtered = collectionPointId
      ? bins.filter((item) => !item.collectionPointId || item.collectionPointId === collectionPointId)
      : bins;
    const selectedBin = bins.find((item) => item.value === binId);
    return ensureOption(filtered, binId, selectedBin?.label);
  }, [binId, bins, selectedCollectionPoint?.collectionPointId]);

  const visiblePanchayats = useMemo(() => {
    const selectedPanchayat = panchayats.find((item) => item.value === panchayatId);
    const fallbackLabel = localBodyOptions.find((item) => item.value === panchayatId)?.label;
    return ensureOption(panchayats, panchayatId, selectedPanchayat?.label ?? fallbackLabel);
  }, [localBodyOptions, panchayatId, panchayats]);

  const handleAssignmentChange = (value: string) => {
    setTripAssignmentId(value);
    const assignment = assignments.find((item) => item.value === value);
    if (assignment?.panchayatId) setPanchayatId(assignment.panchayatId);

    const selectedCp = collectionPoints.find((item) => item.value === tripCollectionPointId);
    if (selectedCp?.assignmentId && selectedCp.assignmentId !== value) {
      setTripCollectionPointId("");
      setBinId("");
    }
  };

  const handleCollectionPointChange = (value: string) => {
    setTripCollectionPointId(value);
    const collectionPoint = collectionPoints.find((item) => item.value === value);
    if (collectionPoint?.assignmentId) setTripAssignmentId(collectionPoint.assignmentId);
    if (collectionPoint?.binId) setBinId(collectionPoint.binId);
    setStateId(collectionPoint?.stateId ?? "");
    setDistrictId(collectionPoint?.districtId ?? "");
    setAreaTypeId(collectionPoint?.areaTypeId ?? "");
    setLocalBodyLevel(collectionPoint?.localBodyLevel ?? "corporation_id");
    if (collectionPoint?.panchayatId) setPanchayatId(collectionPoint.panchayatId);
  };

  const handleBinChange = (value: string) => {
    setBinId(value);
    const bin = bins.find((item) => item.value === value);
    if (bin?.panchayatId) setPanchayatId(bin.panchayatId);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripAssignmentId || !tripCollectionPointId || !binId || !collectionDate) {
      Swal.fire("Missing details", "Trip Assignment, Collection Point, Bin and Collection Date are required.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      trip_assignment_id: tripAssignmentId,
      trip_collection_point_id: tripCollectionPointId || null,
      bin_id: binId,
      panchayat_id: panchayatId || null,
      collection_date: collectionDate,
      collected_weight_kg: collectedWeightKg || null,
      driver_latitude: driverLatitude || null,
      driver_longitude: driverLongitude || null,
      notes,
    };
    try {
      if (isEdit && id) await binCollectionEventApi.update(id, payload);
      else await binCollectionEventApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin Collection Event" : "Create Bin Collection Event"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Trip Assignment *</Label>
          <Select value={tripAssignmentId} onChange={handleAssignmentChange} options={assignments} placeholder="Select Assignment" />
        </div>
        <div>
          <Label>Collection Point *</Label>
          <Select value={tripCollectionPointId} onChange={handleCollectionPointChange} options={visibleCollectionPoints} placeholder="Select Collection Point" />
        </div>
        <div>
          <Label>State</Label>
          <Select
            value={stateId}
            onChange={(value) => {
              setStateId(String(value));
              setDistrictId("");
              setAreaTypeId("");
              setAreaTypeCategory("");
              setLocalBodyLevel("corporation_id");
              setPanchayatId("");
            }}
            options={stateOptions}
            placeholder="Select State"
          />
        </div>
        <div>
          <Label>District</Label>
          <Select
            value={districtId}
            onChange={(value) => {
              setDistrictId(String(value));
              setAreaTypeId("");
              setAreaTypeCategory("");
              setLocalBodyLevel("corporation_id");
              setPanchayatId("");
            }}
            options={districtOptions}
            placeholder={stateId ? "Select District" : "Select a State first"}
            disabled={!stateId}
          />
        </div>
        <div>
          <Label>Area Type</Label>
          <Select
            value={areaTypeId}
            onChange={(value) => {
              setAreaTypeId(String(value));
              setLocalBodyLevel("corporation_id");
              setPanchayatId("");
            }}
            options={areaTypeOptions}
            placeholder={districtId ? "Select Area Type" : "Select a District first"}
            disabled={!districtId}
          />
        </div>
        <div>
          <Label>Local Body Type</Label>
          <Select
            value={localBodyLevel}
            onChange={(value) => {
              setLocalBodyLevel(value as HierarchyLevel);
              setPanchayatId("");
            }}
            options={availableHierarchyLevels}
            placeholder={areaTypeId ? "Select Local Body Type" : "Select an Area Type first"}
            disabled={!areaTypeId}
          />
        </div>
        <div>
          <Label>Local Body</Label>
          <Select
            value={panchayatId}
            onChange={(value) => setPanchayatId(String(value))}
            options={localBodyOptions}
            placeholder={localBodyLevel ? "Select Local Body" : "Select a Local Body Type first"}
            disabled={!areaTypeId || !localBodyLevel}
          />
        </div>
        {/* <div>
          <Label>Panchayat</Label>
          <Select value={panchayatId} onChange={(value) => setPanchayatId(String(value))} options={visiblePanchayats} placeholder="Derived from Trip Stop" disabled />
        </div> */}
        <div>
          <Label>Collection Date *</Label>
          <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
        </div>
        <div>
          <Label>Collected Weight Kg</Label>
          <Input type="number" value={collectedWeightKg} onChange={(e) => setCollectedWeightKg(e.target.value)} />
        </div>
        <div>
          <Label>Driver Latitude</Label>
          <Input value={driverLatitude} onChange={(e) => setDriverLatitude(e.target.value)} />
        </div>
        <div>
          <Label>Driver Longitude</Label>
          <Input value={driverLongitude} onChange={(e) => setDriverLongitude(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
