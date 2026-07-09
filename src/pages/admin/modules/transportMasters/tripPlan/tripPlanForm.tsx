import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Option = { value: string; label: string };
type ApiRecord = Record<string, any>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

type StopRow = {
  key: string;
  collection_point_id: string;
  bin_id: string;
  sequence: string;
  is_active: boolean;
};

type CollectionPointOption = Option & { hierarchyField?: HierarchyLevel; hierarchyId?: string };
type BinOption = Option & { collectionPointId?: string; wasteTypeId?: string };

const hierarchyIdFields: HierarchyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];

const makeStopKey = (() => {
  let counter = 0;
  return () => `stop-${counter++}`;
})();

const emptyStop = (sequence: number): StopRow => ({
  key: makeStopKey(),
  collection_point_id: "",
  bin_id: "",
  sequence: String(sequence),
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

// Convert 24h "HH:MM" to { hour12: "HH", minute: "MM", period: "AM"|"PM" }
function to12h(time24: string): { hour12: string; minute: string; period: "AM" | "PM" } {
  if (!time24) return { hour12: "12", minute: "00", period: "AM" };
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour12: String(h).padStart(2, "0"), minute: (mStr ?? "00").slice(0, 2), period };
}

// Convert 12h + period to 24h "HH:MM"
function to24h(hour12: string, minute: string, period: "AM" | "PM"): string {
  let h = parseInt(hour12, 10);
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

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
  // Time stored as 24h internally
  const [timeHour, setTimeHour] = useState("07");
  const [timeMinute, setTimeMinute] = useState("00");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
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
  const [stops, setStops] = useState<StopRow[]>([]);
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
    toGeoOptions(
      (hierarchyRecords[hierarchyLevel] ?? []).filter(
        (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
      ),
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

      // Parse time to 12h AM/PM
      const timeStr = String(record.scheduled_time ?? "");
      if (timeStr) {
        const parsed = to12h(timeStr.slice(0, 5));
        setTimeHour(parsed.hour12);
        setTimeMinute(parsed.minute);
        setTimePeriod(parsed.period);
      }

      setTripTriggerWeightKg(String(record.trip_trigger_weight_kg ?? ""));
      setMaxVehicleCapacityKg(String(record.max_vehicle_capacity_kg ?? ""));
      setIsAutoAssign(Boolean(record.is_auto_assign));
      setRepeatDays(Array.isArray(record.repeat_days) ? record.repeat_days : []);
      setStatus(String(record.status ?? "ACTIVE"));
      setApprovalStatus(String(record.approval_status ?? "PENDING"));

      if (Array.isArray(record.plan_collection_points)) {
        setStops(
          record.plan_collection_points
            .filter((stop: ApiRecord) => stop.collection_type === "bin_collection")
            .map((stop: ApiRecord) => ({
              key: makeStopKey(),
              collection_point_id: String(stop.collection_point_id ?? ""),
              bin_id: String(stop.bin_id ?? ""),
              sequence: String(stop.sequence ?? "1"),
              is_active: stop.is_active !== false,
            })),
        );
      }
    });
  }, [id]);

  const toggleWasteType = (uid: string) => {
    setSelectedWasteTypes((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addStop = () => {
    setStops((prev) => [...prev, emptyStop(prev.length + 1)]);
  };

  const removeStop = (key: string) => {
    setStops((prev) => prev.filter((stop) => stop.key !== key));
  };

  const updateStop = (key: string, patch: Partial<StopRow>) => {
    setStops((prev) => prev.map((stop) => (stop.key === key ? { ...stop, ...patch } : stop)));
  };

  // Collection points are scoped to the Trip Plan's own local body (hierarchyLevel/hierarchyId).
  const collectionPointsForLocalBody = (currentValue: string) => {
    const filtered = hierarchyId
      ? collectionPoints.filter((cp) => cp.hierarchyField === hierarchyLevel && cp.hierarchyId === hierarchyId)
      : collectionPoints;
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
    if (collectionType === "bin_collection") {
      if (stops.some((stop) => !stop.collection_point_id || !stop.bin_id)) {
        Swal.fire("Missing details", "Every stop needs a Collection Point and a Bin.", "warning");
        return;
      }
      const sequences = stops.map((stop) => stop.sequence);
      if (new Set(sequences).size !== sequences.length) {
        Swal.fire("Missing details", "Stop sequences must be unique.", "warning");
        return;
      }
    }
    const scheduledTime = to24h(timeHour, timeMinute, timePeriod);
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
        ? stops.map((stop) => ({
            collection_type: collectionType,
            collection_point_id: stop.collection_point_id,
            bin_id: stop.bin_id,
            sequence: Number(stop.sequence),
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

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

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
            options={toGeoOptions(states)}
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
            options={toGeoOptions(filteredDistricts)}
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
            options={toGeoOptions(filteredAreaTypes)}
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
          <Label>Collection Type *</Label>
          <Select value={collectionType} onChange={(v) => setCollectionType(String(v))} options={collectionTypes} placeholder="Select Collection Type" />
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
        <div className="md:col-span-2">
          <Label>Waste Types * (select one or more)</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {wasteTypes.map((wt) => (
              <label
                key={wt.value}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  selectedWasteTypes.includes(wt.value)
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-green-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedWasteTypes.includes(wt.value)}
                  onChange={() => toggleWasteType(wt.value)}
                />
                {wt.label}
              </label>
            ))}
          </div>
          {selectedWasteTypes.length === 0 && (
            <p className="mt-1 text-xs text-red-500">Select at least one waste type</p>
          )}
        </div>

        {/* Scheduled Time — 12h IST format */}
        <div>
          <Label>Scheduled Time (IST) *</Label>
          <div className="flex gap-2">
            <select
              className="h-10 flex-1 rounded-md border border-gray-300 px-2 text-sm focus:border-green-400 focus:outline-none"
              value={timeHour}
              onChange={(e) => setTimeHour(e.target.value)}
            >
              {hours.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <span className="flex items-center text-gray-500">:</span>
            <select
              className="h-10 w-20 rounded-md border border-gray-300 px-2 text-sm focus:border-green-400 focus:outline-none"
              value={timeMinute}
              onChange={(e) => setTimeMinute(e.target.value)}
            >
              {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="h-10 w-20 rounded-md border border-gray-300 px-2 text-sm focus:border-green-400 focus:outline-none"
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value as "AM" | "PM")}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Trip Trigger Weight (kg)</Label>
          <Input type="number" value={tripTriggerWeightKg} onChange={(e) => setTripTriggerWeightKg(e.target.value)} placeholder="e.g. 200" />
        </div>

        <div>
          <Label>Max Vehicle Capacity (kg)</Label>
          <Input type="number" value={maxVehicleCapacityKg} onChange={(e) => setMaxVehicleCapacityKg(e.target.value)} placeholder="e.g. 5000" />
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
        {collectionType === "bin_collection" && (
          <div className="md:col-span-2 rounded-md border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Label>Collection Point Stops</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStop}>
                + Add Stop
              </Button>
            </div>
            {stops.length === 0 && (
              <p className="text-sm text-gray-500">No stops added yet. Click "Add Stop" to attach a collection point and bin.</p>
            )}
            <div className="space-y-3">
              {stops.map((stop) => (
                <div key={stop.key} className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto_auto]">
                  <Select
                    value={stop.collection_point_id}
                    onChange={(v) => updateStop(stop.key, { collection_point_id: String(v), bin_id: "" })}
                    options={collectionPointsForLocalBody(stop.collection_point_id)}
                    placeholder={hierarchyId ? "Collection Point" : "Select a Local Body first"}
                  />
                  <Select
                    value={stop.bin_id}
                    onChange={(v) => updateStop(stop.key, { bin_id: String(v) })}
                    options={binsForStop(stop.collection_point_id, stop.bin_id)}
                    placeholder={stop.collection_point_id ? "Bin" : "Select a Collection Point first"}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={stop.sequence}
                    onChange={(e) => updateStop(stop.key, { sequence: e.target.value })}
                    placeholder="Seq"
                  />
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={stop.is_active}
                      onChange={(e) => updateStop(stop.key, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeStop(stop.key)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {["household_collection", "bulk_waste_collection"].includes(collectionType) && (
          <div className="md:col-span-2 rounded-md border bg-gray-50 p-4 text-sm text-gray-700">
            Household and bulk waste stops are generated automatically for customers under this Trip Plan's local body — no manual stop list is needed here.
          </div>
        )}

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

        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
