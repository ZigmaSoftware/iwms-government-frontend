import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MultiSelect } from "primereact/multiselect";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  areaTypeApi,
  collectionPointApi,
  corporationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  propertiesApi,
  staffCreationApi,
  staffTemplateApi,
  stateApi,
  subPropertiesApi,
  townPanchayatApi,
  tripPlanApi,
  vehicleCreationApi,
  wasteTypeApi,
} from "@/helpers/admin";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";
import { mergeWithScopeOptionExtra } from "../../masters/shared/dataScopeOptions";

type Option = { value: string; label: string };
type ApiRecord = Record<string, any>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

type StopRow = {
  key: string;
  collection_point_id: string;
  bin_id: string;
  is_active: boolean;
};

type CollectionPointOption = Option & { hierarchyField?: HierarchyLevel; hierarchyId?: string };
type BinOption = Option & { collectionPointId?: string; wasteTypeId?: string };

const hierarchyIdFields: HierarchyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];

const SCOPE_LEVEL_BY_HIERARCHY: Record<HierarchyLevel, "corporation" | "municipality" | "town_panchayat" | "panchayat_union" | "panchayat"> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
};

const makeStopKey = (() => {
  let counter = 0;
  return () => `stop-${counter++}`;
})();

const emptyStop = (): StopRow => ({
  key: makeStopKey(),
  collection_point_id: "",
  bin_id: "",
  is_active: true,
});

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

const resolveId = (record: any): string => String(record?.unique_id ?? record?.id ?? "");
const resolveName = (record: any): string =>
  String(
    record?.name ??
      record?.corporation_name ??
      record?.municipality_name ??
      record?.town_panchayat_name ??
      record?.union_name ??
      record?.panchayat_name ??
      resolveId(record),
  );
const toGeoOptions = (records: any[]): Option[] =>
  records.filter((r) => resolveId(r)).map((r) => ({ value: resolveId(r), label: resolveName(r) }));

const collectionTypes = [
  { value: "bin_collection", label: "Secondary Collection Point" },
  { value: "household_collection", label: "Household Collection" },
  { value: "bulk_waste_collection", label: "Bulk Waste Collection" },
];

const WEEKDAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

const toOptions = (items: any[], labelKey: string): Option[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.staff_unique_id ?? item?.id ?? ""),
      label: String(item?.[labelKey] ?? item?.display_code ?? item?.vehicle_no ?? item?.unique_id ?? ""),
    }))
    .filter((item) => item.value);

export default function TripPlanForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleMasters, encTripPlans } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleMasters, encTripPlans);

  const [displayCode, setDisplayCode] = useState("");
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("corporation_id");
  const [hierarchyId, setHierarchyId] = useState("");
  const [staffTemplateId, setStaffTemplateId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [collectionType, setCollectionType] = useState("bin_collection");
  const [propertyId, setPropertyId] = useState("");
  const [subPropertyId, setSubPropertyId] = useState("");
  // Single primary waste type (legacy)
  const [wasteTypeId, setWasteTypeId] = useState("");
  // Multiple waste types
  const [selectedWasteTypes, setSelectedWasteTypes] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState("07:00");
  const [tripTriggerWeightKg, setTripTriggerWeightKg] = useState("");
  const [maxVehicleCapacityKg, setMaxVehicleCapacityKg] = useState("");
  const [isAutoAssign, setIsAutoAssign] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [status, setStatus] = useState("ACTIVE");
  const [approvalStatus, setApprovalStatus] = useState("PENDING");

  const [staffTemplates, setStaffTemplates] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [supervisors, setSupervisors] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [subProperties, setSubProperties] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  // Collection point stops — merged in from the former Trip Plan Collection Point form.
  const [stops, setStops] = useState<StopRow[]>([emptyStop()]);
  const [draggedStopIndex, setDraggedStopIndex] = useState<number | null>(null);
  const [collectionPoints, setCollectionPoints] = useState<CollectionPointOption[]>([]);
  const [bins, setBins] = useState<BinOption[]>([]);

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

  useEffect(() => {
    Promise.all([
      staffTemplateApi.readAll(),
      vehicleCreationApi.readAll(),
      staffCreationApi.readAll(),
      propertiesApi.readAll(),
      subPropertiesApi.readAll(),
      wasteTypeApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
      collectionPointApi.readAll(),
      adminApi.bins.readAll(),
    ]).then(([
      staffRes, vehicleRes, supervisorRes, propertyRes, subPropertyRes, wasteTypeRes,
      stateRes, districtRes, areaTypeRes, corporationRes, municipalityRes, townPanchayatRes, panchayatUnionRes, panchayatRes,
      collectionPointRes, binRes,
    ]) => {
      setStaffTemplates(toOptions(normalizeList(staffRes), "display_code"));
      setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
      setSupervisors(
        normalizeList(supervisorRes).map((item: any) => ({
          value: String(item?.staff_unique_id ?? item?.unique_id ?? ""),
          label: String(item?.employee_name ?? item?.staff_unique_id ?? ""),
        })).filter((o: Option) => o.value)
      );
      setProperties(toOptions(normalizeList(propertyRes), "property_name"));
      setSubProperties(toOptions(normalizeList(subPropertyRes), "sub_property_name"));
      setWasteTypes(toOptions(normalizeList(wasteTypeRes), "waste_type_name"));
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
      setCollectionPoints(
        normalizeList(collectionPointRes).map((item: any) => {
          const field = hierarchyIdFields.find((key) => item?.[key] ?? item?.[key.replace("_id", "")]?.unique_id);
          return {
            value: String(item?.unique_id ?? ""),
            label: String(item?.cp_name ?? item?.unique_id ?? ""),
            hierarchyField: field,
            hierarchyId: field ? String(item?.[field] ?? item?.[field.replace("_id", "")]?.unique_id ?? "") : "",
          };
        }).filter((o: Option) => o.value),
      );
      setBins(
        normalizeList(binRes).map((item: any) => ({
          value: String(item?.unique_id ?? ""),
          label: String(item?.bin_name ?? item?.unique_id ?? ""),
          collectionPointId: String(item?.collection_point_id ?? item?.collection_point ?? ""),
          wasteTypeId: String(item?.wastetype_id ?? item?.waste_type_id ?? item?.waste_type ?? ""),
        })).filter((o: Option) => o.value),
      );
    });
  }, []);

  const filteredDistricts = districts.filter(
    (d) => !stateId || String(d.state_id ?? d.state ?? "") === stateId,
  );
  const filteredAreaTypes = areaTypes.filter(
    (a) => !districtId || String(a.district_id ?? a.district ?? "") === districtId,
  );

  // State/District/Area Type screens may not be permission-granted to this
  // user at all (View gates their own menu/list, not these dropdowns) —
  // their Data Scope from login always supplies their own values regardless.
  const stateOptions = mergeWithScopeOptionExtra(toGeoOptions(states), "state", {});
  const districtOptions = mergeWithScopeOptionExtra(toGeoOptions(filteredDistricts), "district", {});
  const areaTypeOptions = mergeWithScopeOptionExtra(toGeoOptions(filteredAreaTypes), "area_type", {});

  const ensureOption = <T extends Option>(items: T[], value: string, label?: string): T[] => {
    if (!value || items.some((item) => item.value === value)) return items;
    return [{ value, label: label || value } as T, ...items];
  };

  const availableHierarchyLevels = areaTypeCategory
    ? hierarchyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value))
    : hierarchyLevel
      ? [{ value: hierarchyLevel, label: hierarchyLevels.find((item) => item.value === hierarchyLevel)?.label ?? "Local Body" }]
      : [];

  const hierarchyOptions = ensureOption(
    mergeWithScopeOptionExtra(
      toGeoOptions(
        (hierarchyRecords[hierarchyLevel] ?? []).filter(
          (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
        ),
      ),
      SCOPE_LEVEL_BY_HIERARCHY[hierarchyLevel],
      {},
    ),
    hierarchyId,
  );

useEffect(() => {
  if (!areaTypeId || !areaTypes.length) {
    if (!areaTypeId) setAreaTypeCategory("");
    return;
  }

  const selectedAreaType = areaTypes.find((item) => resolveId(item) === areaTypeId);
  if (selectedAreaType) {
    setAreaTypeCategory(areaTypeCategoryFromName(String(selectedAreaType.name ?? "")));
  }
}, [areaTypeId, areaTypes]);

useEffect(() => {
    if (!id) return;
    tripPlanApi.read(id).then((record: ApiRecord) => {
      setDisplayCode(String(record.display_code ?? ""));

      // Geo fields come as nested read-only objects (write via *_id fields)
      setStateId(String(record.state?.unique_id ?? record.state_id ?? ""));
      setDistrictId(String(record.district?.unique_id ?? record.district_id ?? ""));
      const areaTypeName = String(record.area_type?.name ?? "");
      setAreaTypeId(String(record.area_type?.unique_id ?? record.area_type_id ?? ""));
      setAreaTypeCategory(areaTypeCategoryFromName(areaTypeName));

      // Hierarchy — read from nested read-only objects
      const hierarchyMap: Record<HierarchyLevel, string | undefined> = {
        corporation_id: record.corporation?.unique_id,
        municipality_id: record.municipality?.unique_id,
        town_panchayat_id: record.town_panchayat?.unique_id,
        panchayat_union_id: record.panchayat_union?.unique_id,
        panchayat_id: record.panchayat?.unique_id,
      };
      const detectedLevel = hierarchyLevels.find((item) => hierarchyMap[item.value]);
      if (detectedLevel) {
        setHierarchyLevel(detectedLevel.value);
        setHierarchyId(hierarchyMap[detectedLevel.value] ?? "");
      }

      setStaffTemplateId(String(record.staff_template?.unique_id ?? record.staff_template_id ?? ""));
      setVehicleId(String(record.vehicle?.unique_id ?? record.vehicle_id ?? ""));
      setSupervisorId(String(record.supervisor?.unique_id ?? record.supervisor_id ?? ""));
      setCollectionType(String(record.collection_type ?? "bin_collection"));
      setPropertyId(String(record.property?.unique_id ?? record.property_id ?? ""));
      setSubPropertyId(String(record.sub_property?.unique_id ?? record.sub_property_id ?? ""));

      // Primary waste type (legacy FK)
      setWasteTypeId(String(record.waste_type?.unique_id ?? record.waste_type_id ?? ""));

      // Multiple waste types
      if (Array.isArray(record.waste_types_detail) && record.waste_types_detail.length > 0) {
        setSelectedWasteTypes(record.waste_types_detail.map((wt: any) => String(wt.unique_id)));
      } else if (record.waste_type?.unique_id) {
        setSelectedWasteTypes([String(record.waste_type.unique_id)]);
      }

      const timeStr = String(record.scheduled_time ?? "");
      if (timeStr) setScheduledTime(timeStr.slice(0, 5));

      setTripTriggerWeightKg(String(record.trip_trigger_weight_kg ?? ""));
      setMaxVehicleCapacityKg(String(record.max_vehicle_capacity_kg ?? ""));
      setIsAutoAssign(Boolean(record.is_auto_assign));
      setRepeatDays(Array.isArray(record.repeat_days) ? record.repeat_days : []);
      setStatus(String(record.status ?? "ACTIVE"));
      setApprovalStatus(String(record.approval_status ?? "PENDING"));

      if (Array.isArray(record.plan_collection_points)) {
        const loadedStops = record.plan_collection_points
          .filter((stop: ApiRecord) => stop.collection_type === "bin_collection")
          .sort((a: ApiRecord, b: ApiRecord) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))
          .map((stop: ApiRecord) => ({
            key: makeStopKey(),
            collection_point_id: String(stop.collection_point_id ?? ""),
            bin_id: String(stop.bin_id ?? ""),
            is_active: stop.is_active !== false,
          }));
        setStops(loadedStops.length ? loadedStops : [emptyStop()]);
      }
    });
  }, [id]);

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addStop = () => {
    setStops((prev) => [...prev, emptyStop()]);
  };

  const removeStop = (key: string) => {
    setStops((prev) => (prev.length > 1 ? prev.filter((stop) => stop.key !== key) : prev));
  };

  const updateStop = (key: string, patch: Partial<StopRow>) => {
    setStops((prev) => prev.map((stop) => (stop.key === key ? { ...stop, ...patch } : stop)));
  };

  const moveStop = (from: number, to: number) => {
    if (from === to) return;
    setStops((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  // Collection points are scoped to the Trip Plan's own local body (hierarchyLevel/hierarchyId),
  // excluding points already used by other stops.
  const collectionPointsForLocalBody = (currentValue: string) => {
    const filtered = (hierarchyId
      ? collectionPoints.filter((cp) => cp.hierarchyField === hierarchyLevel && cp.hierarchyId === hierarchyId)
      : collectionPoints
    ).filter(
      (cp) => cp.value === currentValue || !stops.some((stop) => stop.collection_point_id === cp.value),
    );
    const current = collectionPoints.find((cp) => cp.value === currentValue);
    return ensureOption(filtered, currentValue, current?.label);
  };

  // Bins are scoped to the selected stop's Collection Point, and to the Trip Plan's selected Waste Types.
  const binsForStop = (collectionPointId: string, currentValue: string) => {
    const filtered = bins.filter((bin) => {
      if (collectionPointId && bin.collectionPointId && bin.collectionPointId !== collectionPointId) return false;
      if (selectedWasteTypes.length > 0 && bin.wasteTypeId && !selectedWasteTypes.includes(bin.wasteTypeId)) return false;
      return true;
    });
    const current = bins.find((bin) => bin.value === currentValue);
    return ensureOption(filtered, currentValue, current?.label);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stateId || !districtId || !hierarchyId || !staffTemplateId || !vehicleId) {
      Swal.fire("Missing details", "State, District, Local Body, Staff Template and Vehicle are required.", "warning");
      return;
    }
    if (selectedWasteTypes.length === 0) {
      Swal.fire("Missing details", "Select at least one Waste Type.", "warning");
      return;
    }
    const triggerWeight = Number(tripTriggerWeightKg);
    const maxCapacity = Number(maxVehicleCapacityKg);
    if (
      tripTriggerWeightKg &&
      maxVehicleCapacityKg &&
      (!Number.isFinite(triggerWeight) || !Number.isFinite(maxCapacity) || triggerWeight >= maxCapacity)
    ) {
      Swal.fire("Warning", "Trigger weight must be less than vehicle capacity.", "warning");
      return;
    }
    if (collectionType === "bin_collection") {
      if (!stops.length) {
        Swal.fire("Missing details", "Add at least one collection point stop.", "warning");
        return;
      }
      if (stops.some((stop) => !stop.collection_point_id || !stop.bin_id)) {
        Swal.fire("Missing details", "Every stop needs a Collection Point and a Bin.", "warning");
        return;
      }
    }
    setSaving(true);
    const payload: Record<string, any> = {
      state_id: stateId,
      district_id: districtId,
      area_type_id: areaTypeId || null,
      corporation_id: null,
      municipality_id: null,
      town_panchayat_id: null,
      panchayat_union_id: null,
      panchayat_id: null,
      [hierarchyLevel]: hierarchyId,
      staff_template_id: staffTemplateId,
      vehicle_id: vehicleId,
      supervisor_id: supervisorId || null,
      collection_type: collectionType,
      property_id: propertyId || null,
      sub_property_id: subPropertyId || null,
      // Primary waste type: first selected (legacy)
      waste_type_id: selectedWasteTypes[0] ?? wasteTypeId ?? null,
      // All selected waste types
      waste_type_ids: selectedWasteTypes,
      scheduled_time: scheduledTime,
      trip_trigger_weight_kg: tripTriggerWeightKg ? Number(tripTriggerWeightKg) : null,
      max_vehicle_capacity_kg: maxVehicleCapacityKg ? Number(maxVehicleCapacityKg) : null,
      is_auto_assign: isAutoAssign,
      repeat_days: isAutoAssign ? repeatDays : [],
      status,
      approval_status: approvalStatus,
      collection_points: collectionType === "bin_collection"
        ? stops.map((stop, index) => ({
            collection_type: collectionType,
            collection_point_id: stop.collection_point_id,
            bin_id: stop.bin_id,
            sequence: index + 1,
            is_active: stop.is_active,
          }))
        : [],
    };
    try {
      if (isEdit && id) await tripPlanApi.update(id, payload);
      else await tripPlanApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Trip Plan" : "Create Trip Plan"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {isEdit && (
          <div>
            <Label>Display Code</Label>
            <Input value={displayCode} disabled />
          </div>
        )}

        <div>
          <Label>State *</Label>
          <Select
            value={stateId}
            onChange={(v) => {
              setStateId(String(v));
              setDistrictId("");
              setAreaTypeId("");
              setAreaTypeCategory("");
              setHierarchyId("");
            }}
            options={stateOptions}
            placeholder="Select State"
          />
        </div>

        <div>
          <Label>District *</Label>
          <Select
            value={districtId}
            onChange={(v) => {
              setDistrictId(String(v));
              setAreaTypeId("");
              setAreaTypeCategory("");
              setHierarchyId("");
            }}
            options={districtOptions}
            placeholder={stateId ? "Select District" : "Select a State first"}
          />
        </div>

        <div>
          <Label>Area Type</Label>
          <Select
            value={areaTypeId}
            onChange={(v) => {
              const selected = filteredAreaTypes.find((a) => resolveId(a) === v);
              setAreaTypeId(String(v));
              setAreaTypeCategory(areaTypeCategoryFromName(String(selected?.name ?? "")));
              setHierarchyId("");
            }}
            options={areaTypeOptions}
            placeholder={districtId ? "Select Area Type" : "Select a District first"}
          />
        </div>

        <div>
          <Label>Local Body Type *</Label>
          <Select
            value={hierarchyLevel}
            onChange={(v) => {
              setHierarchyLevel(v as HierarchyLevel);
              setHierarchyId("");
            }}
            options={availableHierarchyLevels}
            placeholder={areaTypeCategory ? "Select Local Body Type" : "Select an Area Type first"}
          />
        </div>

        <div>
          <Label>
            {hierarchyLevels.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body"} *
          </Label>
          <Select
            value={hierarchyId}
            onChange={(v) => setHierarchyId(String(v))}
            options={hierarchyOptions}
            placeholder="Select"
          />
        </div>

        <div>
          <Label>Staff Template *</Label>
          <Select value={staffTemplateId} onChange={(v) => setStaffTemplateId(String(v))} options={staffTemplates} placeholder="Select Staff Template" />
        </div>

        <div>
          <Label>Vehicle *</Label>
          <Select value={vehicleId} onChange={(v) => setVehicleId(String(v))} options={vehicles} placeholder="Select Vehicle" />
        </div>

        <div>
          <Label>Supervisor</Label>
          <Select value={supervisorId} onChange={(v) => setSupervisorId(String(v))} options={supervisors} placeholder="Select Supervisor" />
        </div>

        <div>
          <Label>Property</Label>
          <Select value={propertyId} onChange={(v) => setPropertyId(String(v))} options={properties} placeholder="Select Property" />
        </div>

        <div>
          <Label>Sub Property</Label>
          <Select value={subPropertyId} onChange={(v) => setSubPropertyId(String(v))} options={subProperties} placeholder="Select Sub Property" />
        </div>

        {/* Multiple Waste Types */}
        <div>
          <Label>Waste Type *</Label>
          <MultiSelect
            value={selectedWasteTypes}
            onChange={(event) => {
              const raw = Array.isArray(event.value) ? event.value : [];
              // PrimeReact MultiSelect sometimes returns objects instead of the optionValue string
              const values = raw.map((v: any) =>
                v && typeof v === "object" ? String(v.value ?? v.unique_id ?? v.id ?? "") : String(v),
              );
              setSelectedWasteTypes(values);
              setStops((current) => current.map((stop) => ({ ...stop, bin_id: "" })));
            }}
            options={wasteTypes}
            optionLabel="label"
            optionValue="value"
            maxSelectedLabels={3}
            placeholder="Select waste types"
            className="!flex !h-10 !w-full !items-center !justify-between !rounded-md !border !border-input !bg-background !px-3 !py-2 !text-sm !shadow-none !ring-offset-background focus:!outline-none focus:!ring-2 focus:!ring-ring focus:!ring-offset-2 disabled:!cursor-not-allowed disabled:!opacity-50"
            pt={{
              labelContainer: { className: "!flex !flex-1 !items-center !overflow-hidden" },
              label: { className: "!m-0 !block !truncate !p-0 !text-sm !leading-5 !text-gray-900" },
              trigger: { className: "!ml-2 !flex !h-4 !w-4 !shrink-0 !items-center !justify-center !text-gray-500" },
              dropdownIcon: { className: "!h-4 !w-4 !opacity-50" },
              panel: { className: "!z-[80] !rounded-md !border !bg-white !shadow-md" },
            }}
            filter
          />
          {selectedWasteTypes.length === 0 && (
            <p className="mt-1 text-xs text-red-500">Select at least one waste type</p>
          )}
        </div>

        <div>
          <Label>Start Time *</Label>
          <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
        </div>

        <div>
          <Label>Trigger Weight (kg)</Label>
          <Input type="number" min={0} value={tripTriggerWeightKg} onChange={(e) => setTripTriggerWeightKg(e.target.value)} placeholder="e.g. 200" />
        </div>

        <div>
          <Label>Max Vehicle Capacity (kg)</Label>
          <Input type="number" min={0} value={maxVehicleCapacityKg} onChange={(e) => setMaxVehicleCapacityKg(e.target.value)} placeholder="e.g. 5000" />
        </div>

        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(v) => setStatus(String(v))} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} placeholder="Select Status" />
        </div>

        <div>
          <Label>Approval Status</Label>
          <Select
            value={approvalStatus}
            onChange={(v) => setApprovalStatus(String(v))}
            options={[{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]}
            placeholder="Select Approval"
          />
        </div>

        {/* Collection Point Stops — merged in from the former Trip Plan Collection Point form */}
        <div className="md:col-span-2 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Collection Points</h2>
              <p className="text-sm text-gray-500">Add all stops for this trip plan before saving.</p>
            </div>
            {collectionType === "bin_collection" && (
              <button
                type="button"
                onClick={addStop}
                className="rounded-lg bg-green-custom px-4 py-2 text-sm font-semibold text-white"
              >
                Add Stop
              </button>
            )}
          </div>

          {collectionType === "bin_collection" ? (
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <div
                  key={stop.key}
                  draggable
                  onDragStart={() => setDraggedStopIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedStopIndex !== null) moveStop(draggedStopIndex, index);
                    setDraggedStopIndex(null);
                  }}
                  onDragEnd={() => setDraggedStopIndex(null)}
                  className="grid cursor-move grid-cols-1 gap-3 rounded-md border border-gray-200 p-3 lg:grid-cols-[72px_minmax(160px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_120px_92px]"
                >
                  <div>
                    <Label>Seq</Label>
                    <Input type="number" min={1} value={index + 1} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={collectionType}
                      onChange={(v) => setCollectionType(String(v))}
                      options={collectionTypes}
                    />
                  </div>
                  <div>
                    <Label>Collection Point</Label>
                    <Select
                      value={stop.collection_point_id}
                      onChange={(v) => updateStop(stop.key, { collection_point_id: String(v), bin_id: "" })}
                      options={collectionPointsForLocalBody(stop.collection_point_id)}
                      placeholder={hierarchyId ? "Select an option" : "Select a Local Body first"}
                    />
                  </div>
                  <div>
                    <Label>Bin</Label>
                    <Select
                      value={stop.bin_id}
                      onChange={(v) => updateStop(stop.key, { bin_id: String(v) })}
                      options={binsForStop(stop.collection_point_id, stop.bin_id)}
                      placeholder={stop.collection_point_id ? "Select an option" : "Select a Collection Point first"}
                    />
                  </div>
                  <div>
                    <Label>Active</Label>
                    <div className="flex h-10 items-center">
                      <Switch checked={stop.is_active} onCheckedChange={(checked) => updateStop(stop.key, { is_active: checked })} />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeStop(stop.key)}
                      disabled={stops.length === 1}
                      className="h-10 w-full rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 p-3 lg:grid-cols-[minmax(160px,240px)_1fr]">
              <div>
                <Label>Type</Label>
                <Select value={collectionType} onChange={(v) => setCollectionType(String(v))} options={collectionTypes} />
              </div>
              <div className="flex items-center rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Household and bulk waste stops are generated automatically for customers under this Trip Plan's local body — no manual stop list is needed here.
              </div>
            </div>
          )}
        </div>

        {/* Auto-assign toggle */}
        <div className="md:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isAutoAssign}
              onChange={(e) => setIsAutoAssign(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            Enable Auto-Assignment
          </label>
        </div>

        {isAutoAssign && (
          <div className="md:col-span-2">
            <Label>Repeat Days</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <label
                  key={day.value}
                  className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${
                    repeatDays.includes(day.value)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={repeatDays.includes(day.value)}
                    onChange={() => toggleRepeatDay(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Update" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
