import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  customerCreationApi,
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
import { normalizeList, staffTemplateLabel } from "@/utils/forms";
import { staffTemplateInHierarchy } from "@/hooks/useGeoHierarchy";

type Option = { value: string; label: string };
type ApiRecord = Record<string, any>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

type StopRow = {
  key: string;
  collection_type: string;
  collection_point_id: string;
  bin_id: string;
  customer_id: string;
  is_active: boolean;
};

type CollectionPointOption = Option & { hierarchyField?: HierarchyLevel; hierarchyId?: string };
type BinOption = Option & { collectionPointId?: string; wasteTypeId?: string };
type CustomerOption = Option & {
  hierarchyField?: HierarchyLevel;
  hierarchyId?: string;
  address?: string;
  isBulk?: boolean;
};

const hierarchyIdFields: HierarchyLevel[] = ["corporation_id", "municipality_id", "town_panchayat_id", "panchayat_union_id", "panchayat_id"];

const makeStopKey = (() => {
  let counter = 0;
  return () => `stop-${counter++}`;
})();

const emptyStop = (type = "bin_collection"): StopRow => ({
  key: makeStopKey(),
  collection_type: type,
  collection_point_id: "",
  bin_id: "",
  customer_id: "",
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
  // Saved local body captured during edit-load, re-applied once its master
  // records finish loading so the value survives the async option-list race.
  const [pendingHierarchy, setPendingHierarchy] =
    useState<{ level: HierarchyLevel; id: string; name: string } | null>(null);
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

  const [staffTemplatesRaw, setStaffTemplatesRaw] = useState<ApiRecord[]>([]);
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
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // True once the user manually picks a staff template, so we only inherit its
  // geo hierarchy on an explicit change — never while loading an existing plan.
  const staffTemplateSelectedByUser = useRef(false);

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
      setStaffTemplatesRaw(normalizeList(staffRes));
      setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
      setSupervisors(
        normalizeList(supervisorRes)
          // Only supervisor-role government staff (e.g. Corporation Supervisor,
          // District Supervisor) — never the full staff list. The government
          // user type name follows the `govt_<level>_supervisor` convention.
          .filter((item: any) =>
            String(item?.governmentusertype_name ?? "")
              .toLowerCase()
              .includes("supervisor"),
          )
          .map((item: any) => ({
            value: String(item?.staff_unique_id ?? item?.unique_id ?? ""),
            label: String(item?.employee_name ?? item?.staff_unique_id ?? ""),
          }))
          .filter((o: Option) => o.value)
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

  // Customers load on their own so a customer-API failure never blanks the core
  // form fields (State, District, Staff Template, etc.). Only the Household
  // customer dropdown depends on this list.
  useEffect(() => {
    customerCreationApi.readAll().then((customerRes: any) => {
      setCustomers(
        normalizeList(customerRes).map((item: any) => {
          const field = hierarchyIdFields.find((key) => item?.[key]);
          const address = [item?.building_no, item?.street, item?.area]
            .filter(Boolean)
            .join(", ");
          return {
            value: String(item?.unique_id ?? ""),
            label: String(item?.customer_name ?? item?.unique_id ?? ""),
            hierarchyField: field,
            hierarchyId: field ? String(item?.[field] ?? "") : "",
            address,
            isBulk: Boolean(item?.is_bulkwaste_generator),
          };
        }).filter((o: Option) => o.value),
      );
    }).catch(() => {
      // Non-fatal: household stops just won't have customer options until the
      // endpoint recovers.
      setCustomers([]);
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
    // Fall back to the saved local body's name so the selected value always
    // renders, even before its master list arrives or if the district filter
    // would otherwise exclude it.
    pendingHierarchy && pendingHierarchy.id === hierarchyId ? pendingHierarchy.name : undefined,
  );

  // Staff templates scoped to the selected local body — keeps the already
  // selected template present even if it falls outside the current filter.
  const staffTemplates = useMemo<Option[]>(
    () =>
      staffTemplatesRaw
        .filter(
          (tpl) =>
            staffTemplateInHierarchy(tpl, hierarchyLevel, hierarchyId) ||
            String(tpl?.unique_id ?? "") === staffTemplateId,
        )
        .map((tpl) => ({
          value: String(tpl?.unique_id ?? tpl?.id ?? ""),
          label: staffTemplateLabel(tpl),
        }))
        .filter((o) => o.value),
    [staffTemplatesRaw, hierarchyLevel, hierarchyId, staffTemplateId],
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

// Re-apply the saved local body once its master records are available, so the
// prefilled value is never lost to option-list load ordering. Clears the
// pending marker as soon as that level's records have loaded.
useEffect(() => {
  if (!pendingHierarchy) return;
  setHierarchyLevel(pendingHierarchy.level);
  setHierarchyId(pendingHierarchy.id);
  if ((hierarchyRecords[pendingHierarchy.level] ?? []).length > 0) {
    setPendingHierarchy(null);
  }
}, [pendingHierarchy, hierarchyRecords]);

// When the user picks a Staff Template, inherit its saved geo hierarchy
// (State → District → Area Type → Local Body Type → Local Body). Values stay
// editable afterwards. Only runs on an explicit user selection.
useEffect(() => {
  if (!staffTemplateSelectedByUser.current || !staffTemplateId) return;
  let cancelled = false;
  staffTemplateApi.read(staffTemplateId).then((tpl: ApiRecord) => {
    if (cancelled) return;
    setStateId(String(tpl.state?.unique_id ?? tpl.state_id ?? ""));
    setDistrictId(String(tpl.district?.unique_id ?? tpl.district_id ?? ""));
    const areaTypeIdValue = String(tpl.area_type?.unique_id ?? tpl.area_type_id ?? "");
    setAreaTypeId(areaTypeIdValue);

    const hierarchyMap: Record<HierarchyLevel, string | undefined> = {
      corporation_id: tpl.corporation?.unique_id ?? tpl.corporation_id,
      municipality_id: tpl.municipality?.unique_id ?? tpl.municipality_id,
      town_panchayat_id: tpl.town_panchayat?.unique_id ?? tpl.town_panchayat_id,
      panchayat_union_id: tpl.panchayat_union?.unique_id ?? tpl.panchayat_union_id,
      panchayat_id: tpl.panchayat?.unique_id ?? tpl.panchayat_id,
    };
    const detectedLevel = hierarchyLevels.find((item) => hierarchyMap[item.value]);

    // Resolve the ULB/RLB category so the Local Body Type prefills: prefer the
    // area type's name (nested or from the master list), else derive it from the
    // detected local-body level (Panchayat Union / Panchayat → rural, etc.).
    const areaTypeName = String(
      tpl.area_type?.name ??
        areaTypes.find((a) => resolveId(a) === areaTypeIdValue)?.name ??
        "",
    );
    let category = areaTypeCategoryFromName(areaTypeName);
    if (!category && detectedLevel) {
      category = AREA_TYPE_LEVELS.urban.includes(detectedLevel.value) ? "urban" : "rural";
    }
    setAreaTypeCategory(category);

    if (detectedLevel) {
      setHierarchyLevel(detectedLevel.value);
      setHierarchyId(String(hierarchyMap[detectedLevel.value] ?? ""));
    }
  }).catch(() => {});
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [staffTemplateId]);

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
      const hierarchyNested: Record<HierarchyLevel, any> = {
        corporation_id: record.corporation,
        municipality_id: record.municipality,
        town_panchayat_id: record.town_panchayat,
        panchayat_union_id: record.panchayat_union,
        panchayat_id: record.panchayat,
      };
      const detectedLevel = hierarchyLevels.find((item) => hierarchyMap[item.value]);
      if (detectedLevel) {
        setHierarchyLevel(detectedLevel.value);
        setHierarchyId(hierarchyMap[detectedLevel.value] ?? "");
        // Queue for re-application once the local-body master list loads.
        setPendingHierarchy({
          level: detectedLevel.value,
          id: hierarchyMap[detectedLevel.value] ?? "",
          name: resolveName(hierarchyNested[detectedLevel.value] ?? {}),
        });
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
        // Stops can mix types (household + secondary) within one plan, so load
        // them all and keep each stop's own collection_type.
        const loadedStops = record.plan_collection_points
          .sort((a: ApiRecord, b: ApiRecord) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))
          .map((stop: ApiRecord) => ({
            key: makeStopKey(),
            collection_type: String(stop.collection_type ?? "bin_collection"),
            collection_point_id: String(stop.collection_point_id ?? ""),
            bin_id: String(stop.bin_id ?? ""),
            customer_id: String(stop.customer_id ?? ""),
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
    // New rows default to the plan's collection type, but each row's type is
    // editable, so a plan can mix household and secondary-collection stops.
    setStops((prev) => [...prev, emptyStop(collectionType)]);
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
      (cp) =>
        cp.value === currentValue ||
        !stops.some(
          (stop) => stop.collection_type === "bin_collection" && stop.collection_point_id === cp.value,
        ),
    );
    const current = collectionPoints.find((cp) => cp.value === currentValue);
    return ensureOption(filtered, currentValue, current?.label);
  };

  // Household stops pick one customer each. Options are scoped to the Trip Plan's
  // local body, exclude bulk-waste generators (household stops require non-bulk
  // customers), and exclude customers already chosen by another stop.
  const customersForStop = (currentValue: string): CustomerOption[] => {
    const filtered = (hierarchyId
      ? customers.filter(
          (cust) =>
            cust.hierarchyField === hierarchyLevel &&
            cust.hierarchyId === hierarchyId &&
            !cust.isBulk,
        )
      : []
    ).filter(
      (cust) =>
        cust.value === currentValue ||
        !stops.some(
          (stop) => stop.collection_type === "household_collection" && stop.customer_id === cust.value,
        ),
    );
    const current = customers.find((cust) => cust.value === currentValue);
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
    // Stops can mix types within one plan; validate each stop by its own type.
    if (collectionType !== "bulk_waste_collection") {
      if (!stops.length) {
        Swal.fire("Missing details", "Add at least one stop.", "warning");
        return;
      }
      const invalidBin = stops.some(
        (stop) => stop.collection_type === "bin_collection" && (!stop.collection_point_id || !stop.bin_id),
      );
      if (invalidBin) {
        Swal.fire("Missing details", "Every Secondary Collection stop needs a Collection Point and a Bin.", "warning");
        return;
      }
      const invalidHousehold = stops.some(
        (stop) => stop.collection_type === "household_collection" && !stop.customer_id,
      );
      if (invalidHousehold) {
        Swal.fire("Missing details", "Every Household stop needs a Customer.", "warning");
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
      // Plan-level type is a label only — stops carry their own per-stop type.
      // In manual mode use the first stop's type so it reflects the plan content.
      collection_type:
        collectionType === "bulk_waste_collection"
          ? "bulk_waste_collection"
          : stops[0]?.collection_type ?? "bin_collection",
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
      // Each stop carries its own collection_type so household and secondary
      // stops can coexist in one plan.
      collection_points: collectionType === "bulk_waste_collection"
        ? []
        : stops.map((stop, index) => ({
            collection_type: stop.collection_type,
            collection_point_id: stop.collection_type === "bin_collection" ? stop.collection_point_id : null,
            bin_id: stop.collection_type === "bin_collection" ? stop.bin_id : null,
            customer_id: stop.collection_type === "household_collection" ? stop.customer_id : null,
            sequence: index + 1,
            is_active: stop.is_active,
          })),
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
          <Select
            value={staffTemplateId}
            onChange={(v) => {
              staffTemplateSelectedByUser.current = true;
              setStaffTemplateId(String(v));
            }}
            options={staffTemplates}
            placeholder="Select Staff Template"
          />
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
            className="flex! h-10! w-full! items-center! justify-between! rounded-md! border! border-input! bg-background! px-3! py-2! text-sm! shadow-none! ring-offset-background! focus:outline-none! focus:ring-2! focus:ring-ring! focus:ring-offset-2! disabled:cursor-not-allowed! disabled:opacity-50!"
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
            <div className="flex items-end gap-3">
              <div className="w-56">
                <Label>Collection Mode</Label>
                <Select
                  value={collectionType === "bulk_waste_collection" ? "bulk_waste_collection" : "manual"}
                  onChange={(v) =>
                    setCollectionType(String(v) === "bulk_waste_collection" ? "bulk_waste_collection" : "bin_collection")
                  }
                  options={[
                    { value: "manual", label: "Manual Stops" },
                    { value: "bulk_waste_collection", label: "Bulk Waste (Auto)" },
                  ]}
                />
              </div>
              {collectionType !== "bulk_waste_collection" && (
                <button
                  type="button"
                  onClick={addStop}
                  className="rounded-lg bg-green-custom px-4 py-2 text-sm font-semibold text-white"
                >
                  Add Stop
                </button>
              )}
            </div>
          </div>

          {collectionType === "bulk_waste_collection" ? (
            <div className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Bulk waste stops are generated automatically for customers under this Trip Plan's local body — no manual stop list is needed here.
            </div>
          ) : (
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
                      value={stop.collection_type}
                      onChange={(v) =>
                        // Switch this stop's type only; clear the fields that no
                        // longer apply so stale values aren't submitted.
                        updateStop(stop.key, {
                          collection_type: String(v),
                          collection_point_id: "",
                          bin_id: "",
                          customer_id: "",
                        })
                      }
                      // Bulk is a whole-plan mode, so it isn't offered per stop.
                      options={collectionTypes.filter((t) => t.value !== "bulk_waste_collection")}
                    />
                  </div>
                  {stop.collection_type === "household_collection" ? (
                    <div className="lg:col-span-2">
                      <Label>Customer</Label>
                      <Select
                        value={stop.customer_id}
                        onChange={(v) => updateStop(stop.key, { customer_id: String(v) })}
                        options={customersForStop(stop.customer_id)}
                        placeholder={hierarchyId ? "Select an option" : "Select a Local Body first"}
                      />
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
