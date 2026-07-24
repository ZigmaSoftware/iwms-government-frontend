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
  wardApi,
} from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import { mergeWithScopeOptionExtra, scopeFieldState } from "../../../masters/shared/dataScopeOptions";
import { binCollectionEventSchema } from "@/schemas/core_modules/dailyOperations/binCollectionEvent.schema";
import { toSwalMessage } from "@/lib/zodErrors";

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
  // Only populated on assignment options — the assignment's own local body,
  // used to filter the Trip Assignment dropdown by the form's selected local body.
  assignmentLocalBodyByLevel?: Partial<Record<HierarchyLevel, string>>;
  // Only populated on assignment options — whether the assignment's trip plan
  // includes a bin-collection stop, used to scope the Trip Assignment dropdown
  // to bin-type trips only.
  assignmentHasBin?: boolean;
  wardIds?: string[];
  // Only populated on assignment options — used to filter the Trip Assignment
  // dropdown by the form's selected Collection Date, alongside cancellation status.
  tripDate?: string;
  status?: string;
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

const SCOPE_LEVEL_BY_HIERARCHY: Record<HierarchyLevel, "corporation" | "municipality" | "town_panchayat" | "panchayat_union" | "panchayat"> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
};

const hierarchyLevels: Array<{ value: HierarchyLevel; label: string }> = [
  { value: "corporation_id", label: "Corporation" },
  { value: "municipality_id", label: "Municipality" },
  { value: "town_panchayat_id", label: "Town Panchayat" },
  { value: "panchayat_union_id", label: "Panchayat Union" },
  { value: "panchayat_id", label: "Panchayat" },
];

const COLLECTION_STATUS_OPTIONS = [
  { value: "Collected", label: "Collected" },
  { value: "Not Collected", label: "Not Collected" },
  { value: "Collect Later", label: "Collect Later" },
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
  // Lead with the assignment's own trip code (unique per daily instance) — the
  // shared Trip Plan display_code repeats across every daily assignment that
  // reuses the same driver/vehicle route, which made same-route entries
  // indistinguishable in the dropdown.
  label: textOf(item.unique_id, item.display_code, item.trip_plan?.display_code, item.trip_plan_id?.display_code),
  panchayatId: idOf(item.panchayat_id ?? item.panchayat),
  assignmentLocalBodyByLevel: {
    corporation_id: idOf(item.corporation?.unique_id ?? item.corporation),
    municipality_id: idOf(item.municipality?.unique_id ?? item.municipality),
    town_panchayat_id: idOf(item.town_panchayat?.unique_id ?? item.town_panchayat),
    panchayat_union_id: idOf(item.panchayat_union?.unique_id ?? item.panchayat_union),
    panchayat_id: idOf(item.panchayat?.unique_id ?? item.panchayat),
  },
  assignmentHasBin: Boolean(
    item.collection_types?.has_bin ||
    (Array.isArray(item.collection_points) && item.collection_points.length > 0),
  ),
  wardIds: Array.isArray(item.wards_detail)
    ? item.wards_detail.map((ward: any) => idOf(ward)).filter(Boolean)
    : Array.isArray(item.trip_plan?.wards_detail)
      ? item.trip_plan.wards_detail.map((ward: any) => idOf(ward)).filter(Boolean)
      : [],
  tripDate: String(item.trip_date ?? ""),
  status: String(item.status ?? ""),
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

type EditorInitial = {
  tripAssignmentId: string;
  tripCollectionPointId: string;
  binId: string;
  stateId: string;
  districtId: string;
  areaTypeId: string;
  localBodyLevel: HierarchyLevel;
  panchayatId: string;
  collectionDate: string;
  collectedWeightKg: string;
  collectionStatus: string;
  statusReason: string;
  driverLatitude: string;
  driverLongitude: string;
  notes: string;
  wardId: string;
  // Display labels for the selected geo values, taken straight from the record
  // so the selects show the right text before the master lists arrive.
  stateLabel: string;
  districtLabel: string;
  areaTypeLabel: string;
  localBodyLabel: string;
  assignmentLabel: string;
  collectionPointLabel: string;
};

type EditorData = {
  panchayats: Option[];
  states: any[];
  districts: any[];
  areaTypes: any[];
  hierarchyRecords: Record<HierarchyLevel, any[]>;
  wards: any[];
};

const EMPTY_INITIAL: EditorInitial = {
  tripAssignmentId: "",
  tripCollectionPointId: "",
  binId: "",
  stateId: "",
  districtId: "",
  areaTypeId: "",
  localBodyLevel: "corporation_id",
  panchayatId: "",
  collectionDate: "",
  collectedWeightKg: "",
  collectionStatus: "Collected",
  statusReason: "",
  driverLatitude: "",
  driverLongitude: "",
  notes: "",
  wardId: "",
  stateLabel: "",
  districtLabel: "",
  areaTypeLabel: "",
  localBodyLabel: "",
  assignmentLabel: "",
  collectionPointLabel: "",
};

const LOCAL_BODY_NAME_KEY: Record<HierarchyLevel, string> = {
  corporation_id: "corporation_name",
  municipality_id: "municipality_name",
  town_panchayat_id: "town_panchayat_name",
  panchayat_union_id: "panchayat_union_name",
  panchayat_id: "panchayat_name",
};

// Build the editor's initial field values from a loaded event record. Geo comes
// from the event's own stored `*_id` fields; the local body sits in whichever
// level column is populated.
const initialFromRecord = (record: ApiRecord): EditorInitial => {
  const localBodyLevel =
    (hierarchyIdFields.find((key) => idOf(record[key])) as HierarchyLevel | undefined) ??
    "corporation_id";
  const localBodyId = hierarchyIdFields.some((key) => idOf(record[key]))
    ? idOf(record[localBodyLevel])
    : idOf(record.panchayat_id ?? record.panchayat ?? record.bin?.panchayat_id);
  return {
    tripAssignmentId: idOf(record.trip_assignment_id ?? record.trip_assignment),
    tripCollectionPointId: idOf(record.trip_collection_point_id ?? record.trip_collection_point),
    binId: idOf(record.bin_id ?? record.bin),
    stateId: idOf(record.state_id ?? record.state),
    districtId: idOf(record.district_id ?? record.district),
    areaTypeId: idOf(record.area_type_id ?? record.area_type),
    localBodyLevel,
    panchayatId: localBodyId,
    collectionDate: String(record.collection_date ?? ""),
    collectedWeightKg: String(record.collected_weight_kg ?? ""),
    collectionStatus: String(record.status ?? "Collected"),
    statusReason: String(record.status_reason ?? ""),
    driverLatitude: String(record.driver_latitude ?? ""),
    driverLongitude: String(record.driver_longitude ?? ""),
    notes: String(record.notes ?? ""),
    wardId: idOf(record.ward_id ?? record.ward),
    stateLabel: textOf(record.state_name),
    districtLabel: textOf(record.district_name),
    areaTypeLabel: textOf(record.area_type_name),
    localBodyLabel: textOf(record[LOCAL_BODY_NAME_KEY[localBodyLevel]], record.panchayat_name),
    assignmentLabel: textOf(record.trip_assignment?.display_code, record.trip_plan?.display_code),
    collectionPointLabel: textOf(record.collection_point?.cp_name, record.collection_point_name),
  };
};

type EditorProps = EditorData & {
  initial: EditorInitial;
  isEdit: boolean;
  id?: string;
  listPath: string;
  onDone: () => void;
};

// Inner editor — mounted (via a `key` on the record id) only once the record is
// loaded, so every field's `useState` initialises from the record and the
// prefill can never be lost to async option-list load ordering.
function BinCollectionEventEditor({
  initial,
  isEdit,
  id,
  listPath,
  onDone,
  states,
  districts,
  areaTypes,
  hierarchyRecords,
  wards,
}: EditorProps) {
  const [tripAssignmentId, setTripAssignmentId] = useState(initial.tripAssignmentId);
  const [tripCollectionPointId, setTripCollectionPointId] = useState(initial.tripCollectionPointId);
  const [binId, setBinId] = useState(initial.binId);
  const [panchayatId, setPanchayatId] = useState(initial.panchayatId);
  const [wardId, setWardId] = useState(initial.wardId);
  const [stateId, setStateId] = useState(initial.stateId);
  const [districtId, setDistrictId] = useState(initial.districtId);
  const [areaTypeId, setAreaTypeId] = useState(initial.areaTypeId);
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">(() => {
    const selected = areaTypes.find((item: any) => idOf(item.unique_id ?? item.id) === initial.areaTypeId);
    return selected ? areaTypeCategoryFromName(String(selected.name ?? selected.area_type_name ?? "")) : "";
  });
  const [localBodyLevel, setLocalBodyLevel] = useState<HierarchyLevel>(initial.localBodyLevel);
  const [collectionDate, setCollectionDate] = useState(initial.collectionDate);
  const [collectedWeightKg, setCollectedWeightKg] = useState(initial.collectedWeightKg);
  const [collectionStatus, setCollectionStatus] = useState(initial.collectionStatus);
  const [statusReason, setStatusReason] = useState(initial.statusReason);
  const [driverLatitude, setDriverLatitude] = useState(initial.driverLatitude);
  const [driverLongitude, setDriverLongitude] = useState(initial.driverLongitude);
  const [notes, setNotes] = useState(initial.notes);
  const [saving, setSaving] = useState(false);

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that field shows pre-filled and disabled rather than an editable
  // dropdown — they aren't allowed to place this event outside their own
  // scope. Several scoped values (or none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const localBodyScope = scopeFieldState(SCOPE_LEVEL_BY_HIERARCHY[localBodyLevel]);

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId) setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId) setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId) setAreaTypeId(areaTypeScope.options[0].value);
    if (localBodyScope.mode === "locked" && !panchayatId) setPanchayatId(localBodyScope.options[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, areaTypeScope.mode, localBodyScope.mode, stateId, districtId, areaTypeId, panchayatId]);

  // Trip Assignments / Collection Points / Bins — fetched here (not in the
  // parent) scoped to the selected Local Body, since these tables are large
  // and their serializers are heavy. Re-fetches whenever the Local Body
  // changes; stays empty until one is chosen (already populated immediately
  // in edit mode, since `panchayatId` initialises from the record).
  const [assignments, setAssignments] = useState<Option[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<Option[]>([]);
  const [bins, setBins] = useState<Option[]>([]);

  useEffect(() => {
    if (!panchayatId) {
      setAssignments([]);
      setCollectionPoints([]);
      setBins([]);
      return;
    }
    let cancelled = false;
    const params = { [localBodyLevel]: panchayatId };
    const assignmentParams = {
      ...params,
      ...(collectionDate ? { trip_date: collectionDate } : {}),
      ...(wardId ? { ward_id: wardId } : {}),
    };
    Promise.all([
      dailyTripAssignmentApi.readAll({ params: assignmentParams }),
      dailyTripCollectionPointApi.readAll({ params }),
      adminApi.bins.readAll({ params }),
    ]).then(([assignmentRes, cpRes, binRes]) => {
      if (cancelled) return;
      // The backend already scopes this response to the selected local body,
      // date and ward via assignmentParams above — trust it and map every
      // record through, the same way wasteCollectedDataForm does. Re-deriving
      // and re-checking the local-body/ward match here duplicated backend
      // logic and was fragile to API field-naming differences (e.g. `panchayat`
      // vs `panchayat_id`), which silently dropped otherwise-matching rows.
      const matchingAssignments = normalizeList(assignmentRes).filter(
        (assignment: ApiRecord) => String(assignment.status ?? "") !== "Cancelled",
      );
      setAssignments(uniqueOptions(matchingAssignments.map(assignmentOption)));
      const assignmentStops = matchingAssignments.flatMap((assignment: ApiRecord) =>
        Array.isArray(assignment.collection_points)
          ? assignment.collection_points.map((stop: ApiRecord) => ({
              ...stop,
              trip_assignment_id: assignment.unique_id,
            }))
          : [],
      );
      setCollectionPoints(uniqueOptions([
        ...assignmentStops.map(collectionPointOption),
        ...normalizeList(cpRes).map(collectionPointOption),
      ]));
      setBins(uniqueOptions(normalizeList(binRes).map(binOption)));
    }).catch((err) => {
      console.error("Failed to load trip assignments/collection points/bins", err);
    });
    return () => { cancelled = true; };
  }, [localBodyLevel, panchayatId, collectionDate, wardId]);

  // Keep the area-type category in sync when the area type changes or its
  // master list finishes loading.
  useEffect(() => {
    if (!areaTypeId) {
      setAreaTypeCategory("");
      return;
    }
    const selected = areaTypes.find((item: any) => String(item.unique_id ?? item.id) === areaTypeId);
    if (selected) {
      setAreaTypeCategory(areaTypeCategoryFromName(String(selected.name ?? selected.area_type_name ?? "")));
    }
  }, [areaTypeId, areaTypes]);

  const selectedCollectionPoint = useMemo(
    () => collectionPoints.find((item) => item.value === tripCollectionPointId),
    [collectionPoints, tripCollectionPointId],
  );

  const stateOptions = useMemo(
    () =>
      ensureOption(
        mergeWithScopeOptionExtra(
          states.map((item) => ({ value: idOf(item.unique_id ?? item.id), label: textOf(item.state_name, item.name, item.unique_id) })).filter((item) => item.value),
          "state",
          {},
        ),
        stateId,
        stateId === initial.stateId ? initial.stateLabel : undefined,
      ),
    [states, stateId, initial.stateId, initial.stateLabel],
  );

  const districtOptions = useMemo(
    () =>
      ensureOption(
        mergeWithScopeOptionExtra(
          districts
            .filter((item) => !stateId || String(item.state_id ?? item.state ?? "") === stateId)
            .map((item) => ({ value: idOf(item.unique_id ?? item.id), label: textOf(item.district_name, item.name, item.unique_id) }))
            .filter((item) => item.value),
          "district",
          {},
        ),
        districtId,
        districtId === initial.districtId ? initial.districtLabel : undefined,
      ),
    [districts, stateId, districtId, initial.districtId, initial.districtLabel],
  );

  const areaTypeOptions = useMemo(
    () =>
      ensureOption(
        mergeWithScopeOptionExtra(
          areaTypes
            .filter((item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId)
            .map((item) => ({ value: idOf(item.unique_id ?? item.id), label: textOf(item.area_type_name, item.name, item.unique_id) }))
            .filter((item) => item.value),
          "area_type",
          {},
        ),
        areaTypeId,
        areaTypeId === initial.areaTypeId ? initial.areaTypeLabel : undefined,
      ),
    [areaTypes, districtId, areaTypeId, initial.areaTypeId, initial.areaTypeLabel],
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
    const scoped = mergeWithScopeOptionExtra(
      options,
      SCOPE_LEVEL_BY_HIERARCHY[localBodyLevel],
      {},
    );
    const selectedLabel =
      scoped.find((item) => item.value === panchayatId)?.label ??
      (panchayatId === initial.panchayatId ? initial.localBodyLabel : undefined);
    return ensureOption(scoped, panchayatId, selectedLabel);
  }, [hierarchyRecords, localBodyLevel, districtId, panchayatId, initial.panchayatId, initial.localBodyLabel]);

  const wardOptions = useMemo(() => ensureOption(
    wards.filter((ward) => (!districtId || idOf(ward.district_id ?? ward.district) === districtId)
      && (!panchayatId || (
        String(ward.local_body_type ?? "") === localBodyLevel.replace("_id", "") &&
        idOf(ward.local_body_id) === panchayatId
      )))
      .map((ward) => ({ value: idOf(ward), label: textOf(ward.ward_name, ward.name, ward.unique_id) })),
    wardId,
  ), [wards, districtId, panchayatId, localBodyLevel, wardId]);

  // Scoped to bin-collection trips, and once a Local Body is selected, only
  // Trip Assignments belonging to that exact local body — keeps the
  // (potentially long) assignment list scoped to where the operator is
  // actually working.
  const visibleAssignments = useMemo(() => {
    const binOnly = assignments.filter((item) => item.assignmentHasBin);
    const filtered = panchayatId
      ? binOnly.filter((item) => item.assignmentLocalBodyByLevel?.[localBodyLevel] === panchayatId)
      : binOnly;
    const wardFiltered = wardId ? filtered.filter((item) => (item.wardIds ?? []).includes(wardId)) : filtered;
    const label =
      wardFiltered.find((item) => item.value === tripAssignmentId)?.label ??
      assignments.find((item) => item.value === tripAssignmentId)?.label ??
      (tripAssignmentId === initial.tripAssignmentId ? initial.assignmentLabel : undefined);
    return ensureOption(wardFiltered, tripAssignmentId, label);
  }, [assignments, tripAssignmentId, localBodyLevel, panchayatId, wardId, initial.tripAssignmentId, initial.assignmentLabel]);

  const visibleCollectionPoints = useMemo(() => {
    const filtered = tripAssignmentId
      ? collectionPoints.filter((item) => !item.assignmentId || item.assignmentId === tripAssignmentId)
      : collectionPoints;
    const label =
      selectedCollectionPoint?.label ??
      (tripCollectionPointId === initial.tripCollectionPointId ? initial.collectionPointLabel : undefined);
    return ensureOption(filtered, tripCollectionPointId, label);
  }, [collectionPoints, selectedCollectionPoint?.label, tripAssignmentId, tripCollectionPointId, initial.tripCollectionPointId, initial.collectionPointLabel]);

  const visibleBins = useMemo(() => {
    const collectionPointId = selectedCollectionPoint?.collectionPointId;
    const filtered = collectionPointId
      ? bins.filter((item) => !item.collectionPointId || item.collectionPointId === collectionPointId)
      : bins;
    const selectedBin = bins.find((item) => item.value === binId);
    return ensureOption(filtered, binId, selectedBin?.label);
  }, [binId, bins, selectedCollectionPoint?.collectionPointId]);

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
    // Collection Point is scoped by the selected Trip Assignment (see
    // visibleCollectionPoints), which is itself scoped by the Local Body the
    // user picked — so picking a Collection Point must not reverse-drive the
    // geography fields back from the point's own location.
    setTripCollectionPointId(value);
    const collectionPoint = collectionPoints.find((item) => item.value === value);
    if (collectionPoint?.binId) setBinId(collectionPoint.binId);
  };

  const handleBinChange = (value: string) => {
    setBinId(value);
    const bin = bins.find((item) => item.value === value);
    if (bin?.panchayatId) setPanchayatId(bin.panchayatId);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = binCollectionEventSchema.safeParse({
      tripAssignmentId,
      tripCollectionPointId,
      binId,
      collectionDate,
      collectionStatus,
      collectedWeightKg,
      statusReason,
    });
    if (!validation.success) {
      Swal.fire("Missing details", toSwalMessage(validation.error), "warning");
      return;
    }
    setSaving(true);
    const payload = {
      trip_assignment_id: tripAssignmentId,
      trip_collection_point_id: tripCollectionPointId || null,
      bin_id: binId,
      // Geo scope — persist the form's explicit selections. The local body id
      // is sent under the key matching the selected Local Body Type; the other
      // level keys are cleared so the record reflects exactly one local body.
      state_id: stateId || null,
      district_id: districtId || null,
      area_type_id: areaTypeId || null,
      corporation_id: localBodyLevel === "corporation_id" ? panchayatId || null : null,
      municipality_id: localBodyLevel === "municipality_id" ? panchayatId || null : null,
      town_panchayat_id: localBodyLevel === "town_panchayat_id" ? panchayatId || null : null,
      panchayat_union_id: localBodyLevel === "panchayat_union_id" ? panchayatId || null : null,
      panchayat_id: localBodyLevel === "panchayat_id" ? panchayatId || null : null,
      ward_id: wardId || null,
      collection_date: collectionDate,
      collected_weight_kg: collectionStatus === "Collected" ? collectedWeightKg || null : null,
      status: collectionStatus,
      status_reason: statusReason || null,
      driver_latitude: driverLatitude || null,
      driver_longitude: driverLongitude || null,
      notes,
    };
    try {
      if (isEdit && id) await binCollectionEventApi.update(id, payload);
      else await binCollectionEventApi.create(payload);
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Bin Collection Event" : "Create Bin Collection Event"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              setWardId("");
            }}
            options={stateOptions}
            placeholder="Select State"
            disabled={stateScope.mode === "locked"}
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
              setWardId("");
            }}
            options={districtOptions}
            placeholder={stateId ? "Select District" : "Select a State first"}
            disabled={!stateId || districtScope.mode === "locked"}
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
              setWardId("");
            }}
            options={areaTypeOptions}
            placeholder={districtId ? "Select Area Type" : "Select a District first"}
            disabled={!districtId || areaTypeScope.mode === "locked"}
          />
        </div>
        <div>
          <Label>Local Body Type</Label>
          <Select
            value={localBodyLevel}
            onChange={(value) => {
              setLocalBodyLevel(value as HierarchyLevel);
              setPanchayatId("");
              setWardId("");
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
            onChange={(value) => { setPanchayatId(String(value)); setWardId(""); }}
            options={localBodyOptions}
            placeholder={localBodyLevel ? "Select Local Body" : "Select a Local Body Type first"}
            disabled={!areaTypeId || !localBodyLevel || localBodyScope.mode === "locked"}
          />
        </div>
        <div>
          <Label>Ward</Label>
          <Select value={wardId} onChange={(value) => { setWardId(String(value)); setTripAssignmentId(""); }} options={wardOptions} placeholder="Select Ward" disabled={!panchayatId} />
        </div>
        <div>
          <Label>Collection Date *</Label>
          <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
        </div>
        <div>
          <Label>Trip Assignment *</Label>
          <Select value={tripAssignmentId} onChange={handleAssignmentChange} options={visibleAssignments} placeholder="Select Assignment" />
        </div>
        <div>
          <Label>Collection Point *</Label>
          <Select value={tripCollectionPointId} onChange={handleCollectionPointChange} options={visibleCollectionPoints} placeholder="Select Collection Point" />
        </div>
        <div>
          <Label>Status *</Label>
          <Select
            value={collectionStatus}
            onChange={(value) => {
              const nextStatus = String(value);
              setCollectionStatus(nextStatus);
              if (nextStatus !== "Collected") setCollectedWeightKg("");
            }}
            options={COLLECTION_STATUS_OPTIONS}
            placeholder="Select Status"
          />
        </div>
        <div>
          <Label>Collected Weight Kg{collectionStatus === "Collected" ? " *" : ""}</Label>
          <Input
            type="number"
            value={collectedWeightKg}
            onChange={(e) => setCollectedWeightKg(e.target.value)}
            disabled={collectionStatus !== "Collected"}
          />
        </div>
        <div>
          <Label>Reason{collectionStatus !== "Collected" ? " *" : ""}</Label>
          <Input
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            placeholder={
              collectionStatus === "Not Collected"
                ? "I do not collect today..."
                : collectionStatus === "Collect Later"
                  ? "I will collect today later..."
                  : "Optional note"
            }
          />
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
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}

export default function BinCollectionEventForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleOperations, encBinCollectionEvent } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleOperations, encBinCollectionEvent);

  const [data, setData] = useState<EditorData>({
    panchayats: [],
    states: [],
    districts: [],
    areaTypes: [],
    hierarchyRecords: {
      corporation_id: [],
      municipality_id: [],
      town_panchayat_id: [],
      panchayat_union_id: [],
      panchayat_id: [],
    },
    wards: [],
  });
  const [record, setRecord] = useState<ApiRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEdit);

  // Reference/master lists only — small tables, safe to load in full up front.
  // Trip Assignments / Collection Points / Bins are NOT loaded here: those
  // tables are large and their serializers are heavy, so the editor below
  // fetches them itself, scoped to the selected Local Body.
  useEffect(() => {
    Promise.all([
      panchayatApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      wardApi.readAll(),
    ]).then(([
      panchayatRes,
      stateRes,
      districtRes,
      areaTypeRes,
      corporationRes,
      municipalityRes,
      townPanchayatRes,
      panchayatUnionRes,
      wardRes,
    ]) => {
      setData({
        panchayats: uniqueOptions(normalizeList(panchayatRes).map(panchayatOption)),
        states: normalizeList(stateRes),
        districts: normalizeList(districtRes),
        areaTypes: normalizeList(areaTypeRes),
        hierarchyRecords: {
          corporation_id: normalizeList(corporationRes),
          municipality_id: normalizeList(municipalityRes),
          town_panchayat_id: normalizeList(townPanchayatRes),
          panchayat_union_id: normalizeList(panchayatUnionRes),
          panchayat_id: normalizeList(panchayatRes),
        },
        wards: normalizeList(wardRes),
      });
    }).catch((err) => {
      console.error("Failed to load bin collection event options", err);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoadingRecord(true);
    binCollectionEventApi.read(id)
      .then((res: ApiRecord) => setRecord(res))
      .catch((err) => {
        console.error("Failed to load bin collection event", err);
        Swal.fire("Load failed", "Could not load this bin collection event.", "error");
      })
      .finally(() => setLoadingRecord(false));
  }, [id]);

  // Mount the editor as soon as the record loads (a fast single fetch). The
  // selected values render pre-filled from the record's own labels, so nothing
  // looks empty; the full dropdown option lists stream in afterwards for when
  // the user wants to change a value.
  if (isEdit && (loadingRecord || !record)) {
    return (
      <ComponentCard title="Edit Bin Collection Event">
        <div className="p-6 text-sm text-gray-500">Loading...</div>
      </ComponentCard>
    );
  }

  const initial = isEdit && record ? initialFromRecord(record) : EMPTY_INITIAL;
  const editorKey = isEdit ? String(record?.unique_id ?? id) : "new";

  return (
    <BinCollectionEventEditor
      key={editorKey}
      initial={initial}
      isEdit={isEdit}
      id={id}
      listPath={listPath}
      onDone={() => navigate(listPath)}
      {...data}
    />
  );
}
