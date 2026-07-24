import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MultiSelect } from "primereact/multiselect";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  alternativeStaffTemplateApi,
  areaTypeApi,
  corporationApi,
  customerCreationApi,
  dailyTripAssignmentApi,
  dailyTripHouseholdCollectionApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  staffTemplateApi,
  stateApi,
  townPanchayatApi,
  tripPlanApi,
  wardApi,
  wasteTypeApi,
} from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList, staffTemplateLabel, altStaffTemplateLabel } from "@/utils/forms";
import { staffTemplateInHierarchy } from "@/hooks/useGeoHierarchy";
import type { DailyTripCollectionPointInline, DailyTripHouseholdCollectionInline } from "./types";
import { filterLocalBodyLevelsByScope, mergeWithScopeOptionExtra, scopeFieldState } from "../../../masters/shared/dataScopeOptions";
import { dailyTripAssignmentSchema } from "@/schemas/core_modules/dailyOperations/dailyTripAssignment.schema";
import { toSwalMessage } from "@/lib/zodErrors";

type Option = { value: string; label: string; disabled?: boolean };
type ApiRecord = Record<string, any>;
type HierarchyLevel = "corporation_id" | "municipality_id" | "town_panchayat_id" | "panchayat_union_id" | "panchayat_id";

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

const categoryFromLevel = (level: HierarchyLevel): "urban" | "rural" =>
  AREA_TYPE_LEVELS.urban.includes(level) ? "urban" : "rural";

const SCOPE_LEVEL_BY_HIERARCHY: Record<HierarchyLevel, "corporation" | "municipality" | "town_panchayat" | "panchayat_union" | "panchayat"> = {
  corporation_id: "corporation",
  municipality_id: "municipality",
  town_panchayat_id: "town_panchayat",
  panchayat_union_id: "panchayat_union",
  panchayat_id: "panchayat",
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

const STATUS_OPTIONS: Option[] = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

const toOptions = (items: any[], labelKey: string): Option[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.id ?? ""),
      label: String(item?.[labelKey] ?? item?.display_code ?? item?.vehicle_no ?? item?.unique_id ?? ""),
    }))
    .filter((item) => item.value);

// Prepends a synthetic option for an already-selected value so a Select shows
// the correct current label immediately, even before its real options list
// (e.g. a geo-scoped Trip Plan/Staff Template fetch) has finished loading.
const ensureOption = (items: Option[], value: string, label?: string): Option[] => {
  if (!value || items.some((item) => item.value === value)) return items;
  return [{ value, label: label || value }, ...items];
};

const pointLabel = (point: DailyTripCollectionPointInline): string =>
  String(point.collection_point?.cp_name ?? point.collection_point_id ?? "").trim() || "—";

const binLabel = (point: DailyTripCollectionPointInline): string =>
  String(point.bin?.bin_name ?? point.bin_id ?? "").trim() || "—";

const wardLabel = (wards?: { ward_name?: string }[]): string =>
  wards?.map((ward) => ward.ward_name).filter(Boolean).join(", ") || "—";

export default function DailyTripAssignmentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleOperations, encDailyTripAssignment } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleOperations, encDailyTripAssignment);

  const [tripPlanId, setTripPlanId] = useState("");
  const [staffTemplateId, setStaffTemplateId] = useState("");
  const [altStaffTemplateId, setAltStaffTemplateId] = useState("");
  const [selectedWasteTypes, setSelectedWasteTypes] = useState<string[]>([]);
  const [selectedWardIds, setSelectedWardIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [approvalStatus, setApprovalStatus] = useState("PENDING");
  const [remarks, setRemarks] = useState("");
  const [wasteTypeBreakdown, setWasteTypeBreakdown] = useState<
    { waste_type_name?: string; collected_weight_kg?: number | string }[]
  >([]);
  const [tripPlans, setTripPlans] = useState<Option[]>([]);
  const [assignedTripPlanIds, setAssignedTripPlanIds] = useState<string[]>([]);
  const [staffTemplatesRaw, setStaffTemplatesRaw] = useState<ApiRecord[]>([]);
  const [altStaffCache, setAltStaffCache] = useState<ApiRecord[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [wardRecords, setWardRecords] = useState<ApiRecord[]>([]);
  const [saving, setSaving] = useState(false);

  // The record's own nested labels for the selected Trip Plan / Staff Template
  // — used as the `ensureOption` fallback label so the Select shows the
  // correct current value immediately in edit mode, even before the (now
  // geo-scoped) Trip Plan / Staff Template option lists have loaded.
  const [selectedTripPlanLabel, setSelectedTripPlanLabel] = useState("");
  const [selectedStaffTemplateLabel, setSelectedStaffTemplateLabel] = useState("");

  // Full geo hierarchy — auto-filled from the selected Trip Plan, editable afterward.
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [areaTypeId, setAreaTypeId] = useState("");
  const [areaTypeCategory, setAreaTypeCategory] = useState<"urban" | "rural" | "">("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("panchayat_id");
  const [hierarchyId, setHierarchyId] = useState("");
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

  // The selected Trip Plan's full record — used to auto-fill fields and preview its stops.
  const [selectedTripPlan, setSelectedTripPlan] = useState<ApiRecord | null>(null);
  const [tripPlanLoading, setTripPlanLoading] = useState(false);

  // True once the user manually picks a staff template, so we only inherit its
  // geo hierarchy on an explicit change — never during edit load or a Trip Plan
  // auto-fill (which sets the staff template programmatically).
  const staffTemplateSelectedByUser = useRef(false);

  // Generated stops — read from the assignment record, edited inline, saved on Update.
  const [cpStops, setCpStops] = useState<DailyTripCollectionPointInline[]>([]);
  const [householdStops, setHouseholdStops] = useState<DailyTripHouseholdCollectionInline[]>([]);
  const [previewCustomers, setPreviewCustomers] = useState<ApiRecord[]>([]);

  // Cheap, small master lists (5–10 rows each) needed immediately to populate
  // the geo cascade selects and the waste type multiselect. wasteTypeApi has
  // no backend filtering support at all, so it stays a plain unfiltered fetch.
  useEffect(() => {
    Promise.all([
      wasteTypeApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
      wardApi.readAll(),
    ]).then(([
      wasteTypeRes,
      stateRes, districtRes, areaTypeRes, corporationRes, municipalityRes, townPanchayatRes, panchayatUnionRes, panchayatRes,
      wardRes,
    ]) => {
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
      setWardRecords(normalizeList(wardRes));
    });
  }, []);

  // A Trip Plan may only have one active daily assignment per date.
  useEffect(() => {
    if (!tripDate) {
      setAssignedTripPlanIds([]);
      return;
    }
    let cancelled = false;
    dailyTripAssignmentApi.readAll({ params: { date: tripDate } }).then((response) => {
      if (cancelled) return;
      const assigned = normalizeList(response)
        .filter((assignment: ApiRecord) =>
          String(assignment.status ?? "") !== "Cancelled" &&
          String(assignment.unique_id ?? "") !== String(id ?? ""),
        )
        .map((assignment: ApiRecord) =>
          String(assignment.trip_plan?.unique_id ?? assignment.trip_plan_id ?? ""),
        )
        .filter(Boolean);
      setAssignedTripPlanIds(Array.from(new Set(assigned)));
    }).catch(() => {
      if (!cancelled) setAssignedTripPlanIds([]);
    });
    return () => { cancelled = true; };
  }, [tripDate, id]);

  // Trip Plans — left unfiltered: its own backend viewset already auto-scopes
  // by the requester's StaffDataScope for non-superadmin users, and in create
  // mode the geo hierarchy itself is only known AFTER a Trip Plan is picked
  // (see the auto-fill effect below), so gating this fetch on geo state would
  // create a chicken-and-egg problem.
  useEffect(() => {
    let cancelled = false;
    tripPlanApi.readAll().then((tripPlanRes) => {
      if (cancelled) return;
      setTripPlans(toOptions(normalizeList(tripPlanRes), "display_code"));
    });
    return () => { cancelled = true; };
  }, []);

  // Staff Templates / Alternative Staff Templates — scoped by the geo
  // hierarchy once it is known (from either a direct geo selection or the
  // Trip Plan auto-fill, whichever resolves first), since Staff Template
  // selection logically happens after Trip Plan selection in this form's
  // flow. Re-fetches whenever the geo scope changes.
  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = {};
    if (stateId) params.state_id = stateId;
    if (districtId) params.district_id = districtId;
    if (hierarchyId) params[hierarchyLevel] = hierarchyId;
    Promise.all([
      staffTemplateApi.readAll({ params }),
      alternativeStaffTemplateApi.readAll({ params }),
    ]).then(([staffRes, altStaffRes]) => {
      if (cancelled) return;
      setStaffTemplatesRaw(normalizeList(staffRes));
      setAltStaffCache(normalizeList(altStaffRes));
    });
    return () => { cancelled = true; };
  }, [stateId, districtId, hierarchyLevel, hierarchyId]);

  useEffect(() => {
    if (!id) return;
    dailyTripAssignmentApi.read(id).then((record: ApiRecord) => {
      // FK fields are write_only in the serializer; read from nested read objects instead
      setTripPlanId(String(record.trip_plan?.unique_id ?? record.trip_plan_id ?? ""));
      setSelectedTripPlanLabel(String(record.trip_plan?.display_code ?? ""));
      setStaffTemplateId(String(record.staff_template?.unique_id ?? record.staff_template_id ?? ""));
      setSelectedStaffTemplateLabel(staffTemplateLabel(record.staff_template ?? {}));
      setAltStaffTemplateId(String(record.alt_staff_template?.unique_id ?? record.alt_staff_template_id ?? ""));
      if (Array.isArray(record.waste_types_detail) && record.waste_types_detail.length > 0) {
        setSelectedWasteTypes(record.waste_types_detail.map((wt: any) => String(wt.unique_id)));
      }
      if (Array.isArray(record.wards_detail) && record.wards_detail.length > 0) {
        setSelectedWardIds(record.wards_detail.map((w: any) => String(w.unique_id)));
      }
      setWasteTypeBreakdown(Array.isArray(record.waste_type_breakdown) ? record.waste_type_breakdown : []);
      setVehicleId(String(record.vehicle?.unique_id ?? record.vehicle_id ?? ""));
      setTripDate(String(record.trip_date ?? ""));
      setScheduledTime(String(record.scheduled_time ?? "").slice(0, 5));
      setStatus(String(record.status ?? "Scheduled"));
      setApprovalStatus(String(record.approval_status ?? "PENDING"));
      setRemarks(String(record.remarks ?? ""));

      setStateId(String(record.state?.unique_id ?? ""));
      setDistrictId(String(record.district?.unique_id ?? ""));
      const areaTypeName = String(record.area_type?.name ?? "");
      setAreaTypeId(String(record.area_type?.unique_id ?? ""));
      setAreaTypeCategory(areaTypeCategoryFromName(areaTypeName));

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

      setCpStops(
        Array.isArray(record.collection_points)
          ? record.collection_points.map((point: DailyTripCollectionPointInline) => ({
              ...point,
              collected_weight_kg: point.collected_weight_kg ?? "",
              collected_at: point.collected_at ? String(point.collected_at).slice(0, 16) : "",
            }))
          : [],
      );
      setHouseholdStops(
        Array.isArray(record.household_collection_points)
          ? record.household_collection_points.map((stop: DailyTripHouseholdCollectionInline) => ({
              ...stop,
              collected_weight_kg: stop.collected_weight_kg ?? "",
            }))
          : [],
      );
    });
  }, [id]);

  // Auto-fill staff template, waste type, vehicle, scheduled time and the full geo hierarchy from the selected Trip Plan.
  useEffect(() => {
    if (!tripPlanId) {
      setSelectedTripPlan(null);
      return;
    }
    setTripPlanLoading(true);
    tripPlanApi.read(tripPlanId).then((plan: ApiRecord) => {
      setSelectedTripPlan(plan);
      if (plan.display_code) setSelectedTripPlanLabel(String(plan.display_code));
      setStaffTemplateId((prev) => prev || String(plan.staff_template?.unique_id ?? ""));
      if (plan.staff_template) setSelectedStaffTemplateLabel(staffTemplateLabel(plan.staff_template));
      setVehicleId((prev) => prev || String(plan.vehicle?.unique_id ?? ""));
      setSelectedWasteTypes((prev) =>
        prev.length > 0
          ? prev
          : Array.isArray(plan.waste_types_detail)
            ? plan.waste_types_detail.map((wt: any) => String(wt.unique_id))
            : []
      );
      setSelectedWardIds(Array.isArray(plan.wards_detail) ? plan.wards_detail.map((ward: any) => String(ward.unique_id)) : []);
      setScheduledTime((prev) => prev || String(plan.scheduled_time ?? "").slice(0, 5));

      setStateId(String(plan.state?.unique_id ?? ""));
      setDistrictId(String(plan.district?.unique_id ?? ""));
      const areaTypeName = String(plan.area_type?.name ?? "");
      setAreaTypeId(String(plan.area_type?.unique_id ?? ""));
      setAreaTypeCategory(areaTypeCategoryFromName(areaTypeName));

      const hierarchyMap: Record<HierarchyLevel, string | undefined> = {
        corporation_id: plan.corporation?.unique_id,
        municipality_id: plan.municipality?.unique_id,
        town_panchayat_id: plan.town_panchayat?.unique_id,
        panchayat_union_id: plan.panchayat_union?.unique_id,
        panchayat_id: plan.panchayat?.unique_id,
      };
      const detectedLevel = hierarchyLevels.find((item) => hierarchyMap[item.value]);
      if (detectedLevel) {
        setHierarchyLevel(detectedLevel.value);
        setHierarchyId(hierarchyMap[detectedLevel.value] ?? "");
      }
    }).finally(() => setTripPlanLoading(false));
  }, [tripPlanId]);

  // Household stops are expanded from a geographic Trip Plan only when the
  // daily assignment is saved. Fetch the same customers here for a pre-save
  // preview, including the selected ward.
  useEffect(() => {
    if (!tripPlanId || isEdit || !selectedTripPlan) {
      setPreviewCustomers([]);
      return;
    }
    const sourceStops = Array.isArray(selectedTripPlan.plan_collection_points)
      ? selectedTripPlan.plan_collection_points
      : [];
    const effectiveSourceStops = sourceStops.length > 0
      ? sourceStops
      : ["household_collection", "bulk_waste_collection"].includes(String(selectedTripPlan.collection_type))
        ? [{ collection_type: selectedTripPlan.collection_type }]
        : [];
    const needsExpansion = effectiveSourceStops.some((stop: ApiRecord) =>
      ["household_collection", "bulk_waste_collection"].includes(String(stop.collection_type)) && !stop.customer_id,
    );
    if (!needsExpansion && effectiveSourceStops.some((stop: ApiRecord) => stop.customer_id)) {
      setPreviewCustomers([]);
      return;
    }
    const baseParams: Record<string, string> = {};
    if (stateId) baseParams.state_id = stateId;
    if (districtId) baseParams.district_id = districtId;
    if (hierarchyId) baseParams[hierarchyLevel] = hierarchyId;
    const requests = selectedWardIds.length
      ? selectedWardIds.map((wardId) => customerCreationApi.readAll({ params: { ...baseParams, ward_id: wardId } }))
      : [customerCreationApi.readAll({ params: baseParams })];
    let cancelled = false;
    Promise.all(requests).then((responses) => {
      if (cancelled) return;
      const unique = new Map<string, ApiRecord>();
      responses.flatMap((response) => normalizeList(response)).forEach((customer: ApiRecord) => {
        const customerId = resolveId(customer);
        if (customerId) unique.set(customerId, customer);
      });
      setPreviewCustomers(Array.from(unique.values()));
    }).catch(() => {
      if (!cancelled) setPreviewCustomers([]);
    });
    return () => { cancelled = true; };
  }, [tripPlanId, isEdit, selectedTripPlan, stateId, districtId, hierarchyId, hierarchyLevel, selectedWardIds]);

  // When the user picks a Staff Template, inherit its saved geo hierarchy
  // (State → District → Area Type → Local Body Type → Local Body). Values stay
  // editable afterwards. Only runs on an explicit user selection — not during
  // edit load or the Trip Plan auto-fill.
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
      // area type's name (nested or from the master list), else derive it from
      // the detected local-body level (Panchayat Union / Panchayat → rural).
      const areaTypeName = String(
        tpl.area_type?.name ??
          areaTypes.find((a) => resolveId(a) === areaTypeIdValue)?.name ??
          "",
      );
      let category = areaTypeCategoryFromName(areaTypeName);
      if (!category && detectedLevel) category = categoryFromLevel(detectedLevel.value);
      setAreaTypeCategory(category);

      if (detectedLevel) {
        setHierarchyLevel(detectedLevel.value);
        setHierarchyId(String(hierarchyMap[detectedLevel.value] ?? ""));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffTemplateId]);

  // ── Derive Area Type from the selected local body's master record ──────────
  // Older records/plans may have no area_type saved; the local body masters
  // (Corporation/Municipality/.../Panchayat) each carry their own area_type,
  // so fill Area Type + category from there whenever they are missing.
  useEffect(() => {
    if (!hierarchyId) return;
    if (!areaTypeCategory) setAreaTypeCategory(categoryFromLevel(hierarchyLevel));
    if (areaTypeId) return;
    const lb = (hierarchyRecords[hierarchyLevel] ?? []).find((item) => resolveId(item) === hierarchyId);
    const lbAreaType = String(lb?.area_type_id ?? lb?.area_type?.unique_id ?? "");
    if (lbAreaType) setAreaTypeId(lbAreaType);
  }, [hierarchyId, hierarchyLevel, hierarchyRecords, areaTypeId, areaTypeCategory]);

  // Local Body Type options — fall back to the detected level when the area
  // type category is unknown, so the prefilled value is always visible.
  const availableHierarchyLevels = filterLocalBodyLevelsByScope(areaTypeCategory
    ? hierarchyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value))
    : [{ value: hierarchyLevel, label: hierarchyLevels.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body" }]);

  // Local Body options — keep the prefilled value present even when the
  // district filter would hide it. Also fall back to the logged-in user's
  // Data Scope for this level, since the level's own screen may not be
  // permission-granted to this user (View gates their own menu/list, not
  // this dropdown).
  const localBodyOptions = (() => {
    const options = mergeWithScopeOptionExtra(
      toGeoOptions(
        (hierarchyRecords[hierarchyLevel] ?? []).filter(
          (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
        ),
      ),
      SCOPE_LEVEL_BY_HIERARCHY[hierarchyLevel],
      {},
    );
    if (hierarchyId && !options.some((o) => o.value === hierarchyId)) {
      const current = (hierarchyRecords[hierarchyLevel] ?? []).find((item) => resolveId(item) === hierarchyId);
      options.unshift({ value: hierarchyId, label: current ? resolveName(current) : hierarchyId });
    }
    return options;
  })();

  // State/District/Area Type screens may not be permission-granted to this
  // user at all (View gates their own menu/list, not these dropdowns) —
  // their Data Scope from login always supplies their own values regardless.
  const stateOptions = mergeWithScopeOptionExtra(toGeoOptions(states), "state", {});
  const districtOptions = mergeWithScopeOptionExtra(
    toGeoOptions(districts.filter((d) => !stateId || String(d.state_id ?? d.state ?? "") === stateId)),
    "district",
    {},
  );
  const areaTypeOptions = mergeWithScopeOptionExtra(
    toGeoOptions(areaTypes.filter((a) => !districtId || String(a.district_id ?? a.district ?? "") === districtId)),
    "area_type",
    {},
  );

  // When the logged-in user's own Data Scope pins a level to exactly one
  // value, that field shows pre-filled and disabled rather than an editable
  // dropdown — they aren't allowed to place this assignment outside their own
  // scope. Several scoped values (or none) leave the field editable as before.
  const stateScope = scopeFieldState("state");
  const districtScope = scopeFieldState("district");
  const areaTypeScope = scopeFieldState("area_type");
  const hierarchyScope = scopeFieldState(SCOPE_LEVEL_BY_HIERARCHY[hierarchyLevel]);
  const wardScope = scopeFieldState("ward");

  useEffect(() => {
    if (stateScope.mode === "locked" && !stateId) setStateId(stateScope.options[0].value);
    if (districtScope.mode === "locked" && !districtId) setDistrictId(districtScope.options[0].value);
    if (areaTypeScope.mode === "locked" && !areaTypeId) setAreaTypeId(areaTypeScope.options[0].value);
    if (hierarchyScope.mode === "locked" && !hierarchyId) setHierarchyId(hierarchyScope.options[0].value);
    if (availableHierarchyLevels.length === 1 && hierarchyLevel !== availableHierarchyLevels[0].value) setHierarchyLevel(availableHierarchyLevels[0].value);
    if (wardScope.mode === "locked" && selectedWardIds[0] !== wardScope.options[0]?.value) {
      setSelectedWardIds(wardScope.options[0] ? [wardScope.options[0].value] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScope.mode, districtScope.mode, areaTypeScope.mode, hierarchyScope.mode, stateId, districtId, areaTypeId, hierarchyId, wardScope.mode, availableHierarchyLevels.length]);

  const filteredWards = wardRecords.filter(
    (w) =>
      (!districtId || String(w.district_id ?? "") === districtId) &&
      (!hierarchyId || (
        String(w.local_body_type ?? "") === hierarchyLevel.replace("_id", "") &&
        String(w.local_body_id ?? "") === hierarchyId
      )),
  );
  const wardOptions = wardScope.mode === "unrestricted" ? toOptions(filteredWards, "ward_name") : wardScope.options;

  // Trip Plan options — ensures the record's/plan's own selected value is
  // always visibly labeled, even before the (unfiltered but still
  // asynchronous) Trip Plan fetch resolves.
  const tripPlanOptions = useMemo<Option[]>(
    () => ensureOption(
      tripPlans.map((plan) =>
        assignedTripPlanIds.includes(plan.value) && plan.value !== tripPlanId
          ? { ...plan, label: plan.label + " (Assigned)", disabled: true }
          : plan,
      ),
      tripPlanId,
      selectedTripPlanLabel,
    ),
    [tripPlans, tripPlanId, selectedTripPlanLabel, assignedTripPlanIds],
  );

  // Staff templates scoped to the selected local body — keeps the already
  // selected template present even if it falls outside the current filter,
  // and shows its correct label immediately (via ensureOption) while the
  // geo-scoped Staff Template fetch is still in flight.
  const staffTemplates = useMemo<Option[]>(
    () =>
      ensureOption(
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
        staffTemplateId,
        selectedStaffTemplateLabel,
      ),
    [staffTemplatesRaw, hierarchyLevel, hierarchyId, staffTemplateId, selectedStaffTemplateLabel],
  );

  // ── Alternative staff templates for the selected staff template ────────────
  const altTemplateIdOf = (alt: ApiRecord): string =>
    String(alt?.staff_template?.unique_id ?? alt?.staff_template ?? alt?.staff_template_id ?? "");

  const altStaffOptions = useMemo<Option[]>(() => {
    if (!staffTemplateId) return [];
    return altStaffCache
      .filter((alt) => altTemplateIdOf(alt) === staffTemplateId)
      .map((alt) => ({
        value: String(alt?.unique_id ?? ""),
        label: altStaffTemplateLabel(alt),
      }))
      .filter((o) => o.value);
  }, [staffTemplateId, altStaffCache]);

  // Auto-resolved alternative for the trip date (shown in the effective-staff banner)
  const resolvedAltStaff = useMemo(() => {
    if (!staffTemplateId || !tripDate) return null;
    return altStaffCache.find((alt) =>
      altTemplateIdOf(alt) === staffTemplateId &&
      alt.from_date && alt.to_date &&
      alt.from_date <= tripDate && tripDate <= alt.to_date
    ) ?? null;
  }, [staffTemplateId, tripDate, altStaffCache]);

  // Collection-type flags from the selected plan's stops
  // Waste types present on the selected Trip Plan but not currently selected on
  // this assignment. Surfaced as a callout rather than auto-applied, since an
  // assignment's waste types can be intentionally narrowed from its plan.
  const missingPlanWasteTypes: { unique_id: string; waste_type_name: string }[] = Array.isArray(
    selectedTripPlan?.waste_types_detail,
  )
    ? selectedTripPlan.waste_types_detail.filter(
        (wt: any) => wt?.unique_id && !selectedWasteTypes.includes(String(wt.unique_id)),
      )
    : [];

  const planStops: ApiRecord[] = Array.isArray(selectedTripPlan?.plan_collection_points)
    ? selectedTripPlan.plan_collection_points
    : [];
  const hasHouseholdStops = isEdit
    ? householdStops.length > 0
    : planStops.some((s) => ["household_collection", "bulk_waste_collection"].includes(String(s.collection_type))) ||
      ["household_collection", "bulk_waste_collection"].includes(String(selectedTripPlan?.collection_type));
  const previewStops = planStops.filter((s) => s.collection_type === "bin_collection" && s.bin_id);
  const householdPreviewSources = planStops.length > 0
    ? planStops
    : ["household_collection", "bulk_waste_collection"].includes(String(selectedTripPlan?.collection_type))
      ? [{ collection_type: selectedTripPlan?.collection_type }]
      : [];
  const previewHouseholdStops: ApiRecord[] = householdPreviewSources
    .filter((stop) => ["household_collection", "bulk_waste_collection"].includes(String(stop.collection_type)))
    .flatMap((stop) => {
      if (stop.customer_id || stop.customer) return [stop];
      const isBulk = stop.collection_type === "bulk_waste_collection";
      return previewCustomers
        .filter((customer) => Boolean(customer.is_bulkwaste_generator) === isBulk)
        .map((customer, index) => ({
          ...stop,
          unique_id: String(stop.unique_id ?? "preview") + "-" + resolveId(customer),
          customer_id: resolveId(customer),
          customer: {
            unique_id: resolveId(customer),
            customer_name: customer.customer_name,
            building_no: customer.building_no,
            street: customer.street,
            ward_id: customer.ward_id,
            ward_name: customer.ward_name,
          },
          sequence: (stop.sequence ?? 1) + index,
        }));
    });
  // A plan generates exactly one category of daily work — only show the bin
  // collection points section for bin_collection plans, even if stale cpStops
  // data exists from before this constraint was enforced server-side.
  const hasBinStops =
    selectedTripPlan?.collection_type !== "household_collection" &&
    (isEdit ? cpStops.length > 0 : Boolean(tripPlanId));

  const updateCpStop = (key: string | undefined, patch: Partial<DailyTripCollectionPointInline>) =>
    setCpStops((prev) => prev.map((item) =>
      (item.unique_id ?? item.collection_point_id) === key ? { ...item, ...patch } : item
    ));

  const updateHouseholdStop = (key: string | undefined, patch: Partial<DailyTripHouseholdCollectionInline>) =>
    setHouseholdStops((prev) => prev.map((item) =>
      (item.unique_id ?? item.customer_id) === key ? { ...item, ...patch } : item
    ));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = dailyTripAssignmentSchema.safeParse({
      tripPlanId,
      staffTemplateId,
      hierarchyId,
      selectedWasteTypes,
      ward_ids: selectedWardIds,
      tripDate,
      scheduledTime,
    });
    if (!validation.success) {
      Swal.fire("Missing details", toSwalMessage(validation.error), "warning");
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      trip_plan_id: tripPlanId,
      staff_template_id: staffTemplateId,
      alt_staff_template_id: altStaffTemplateId || null,
      state_id: stateId || null,
      district_id: districtId || null,
      area_type_id: areaTypeId || null,
      corporation_id: null,
      municipality_id: null,
      town_panchayat_id: null,
      panchayat_union_id: null,
      panchayat_id: null,
      [hierarchyLevel]: hierarchyId,
      waste_type_ids: selectedWasteTypes,
      ward_ids: selectedWardIds,
      vehicle_id: vehicleId || null,
      trip_date: tripDate,
      scheduled_time: scheduledTime,
      status,
      remarks,
    };
    if (isEdit) {
      payload.collection_points_input = cpStops.map((point, index) => ({
        unique_id: point.unique_id,
        sequence: Number(point.sequence || index + 1),
        is_collected: Boolean(point.is_collected),
        collected_at: point.collected_at || null,
        collected_weight_kg: point.collected_weight_kg || null,
        status: point.status || "Pending",
      }));
    }
    try {
      if (isEdit && id) {
        await dailyTripAssignmentApi.update(id, payload);
        if (householdStops.length > 0) {
          await Promise.all(
            householdStops
              .filter((stop) => stop.unique_id)
              .map((stop) =>
                (dailyTripHouseholdCollectionApi.update(stop.unique_id!, {
                  sequence: stop.sequence,
                  status: stop.status,
                  is_collected: stop.is_collected,
                  collected_weight_kg: stop.collected_weight_kg || null,
                  status_reason: stop.status_reason || null,
                }) as Promise<unknown>).catch(() => null)
              )
          );
        }
      } else {
        await dailyTripAssignmentApi.create(payload);
      }
      navigate(listPath);
    } catch (error: any) {
      const data = error?.response?.data;
      const first = data && typeof data === "object" ? Object.values(data)[0] : null;
      const message = typeof data === "string"
        ? data
        : typeof data?.detail === "string"
          ? data.detail
          : Array.isArray(first)
            ? String(first[0])
            : typeof first === "string"
              ? first
              : "Unable to save the daily trip plan.";
      Swal.fire("Unable to save", message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={isEdit ? "Edit Daily Trip Plan" : "New Daily Trip Plan"}
        desc="Schedule a daily trip with staff, route, and collection points"
      >
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div>
              <Label>Trip Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required />
            </div>

            <div>
              <Label>Start Time <span className="text-red-500">*</span></Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />
            </div>

            <div>
              <Label>Trip Plan <span className="text-red-500">*</span></Label>
              <Select value={tripPlanId} onChange={(v) => setTripPlanId(String(v))} options={tripPlanOptions} placeholder="Select trip plan" />
            </div>

            <div>
              <Label>Staff Template <span className="text-red-500">*</span></Label>
              <Select
                value={staffTemplateId}
                onChange={(v) => {
                  staffTemplateSelectedByUser.current = true;
                  setStaffTemplateId(String(v));
                  setAltStaffTemplateId("");
                }}
                options={staffTemplates}
                placeholder="Select staff template"
              />
            </div>

            {/* Alternative Staff Template — only shown when alternatives exist for the selected staff template */}
            {altStaffOptions.length > 0 && (
              <div className="md:col-span-2">
                <Label>
                  Alternative Staff Template{" "}
                  <span className="text-xs font-normal text-gray-400">(Optional — auto-resolved from date range if left blank)</span>
                </Label>
                <Select
                  value={altStaffTemplateId}
                  onChange={(v) => setAltStaffTemplateId(String(v))}
                  options={altStaffOptions}
                  placeholder="Select alternative staff template"
                />
              </div>
            )}

            {/* Effective Staff Banner */}
            {staffTemplateId && tripDate && (
              <div className="md:col-span-2">
                <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  resolvedAltStaff
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-green-300 bg-green-50 text-green-800"
                }`}>
                  {resolvedAltStaff
                    ? `Alt staff active: ${resolvedAltStaff.display_code ?? resolvedAltStaff.unique_id}`
                    : `Base staff template: ${staffTemplates.find((s) => s.value === staffTemplateId)?.label ?? ""}`}
                </div>
              </div>
            )}

            {/* Full geo hierarchy — auto-filled from the Trip Plan, editable afterward */}
            <div>
              <Label>State</Label>
              <Select
                value={stateId}
                onChange={(v) => { setStateId(String(v)); setDistrictId(""); setAreaTypeId(""); setAreaTypeCategory(""); setHierarchyId(""); }}
                options={stateOptions}
                placeholder="Select State"
                disabled={stateScope.mode === "locked"}
              />
            </div>
            <div>
              <Label>District <span className="text-red-500">*</span></Label>
              <Select
                value={districtId}
                onChange={(v) => { setDistrictId(String(v)); setAreaTypeId(""); setAreaTypeCategory(""); setHierarchyId(""); }}
                options={districtOptions}
                placeholder={stateId ? "Select District" : "Select a State first"}
                disabled={districtScope.mode === "locked"}
              />
            </div>
            <div>
              <Label>Area Type</Label>
              <Select
                value={areaTypeId}
                onChange={(v) => {
                  const filteredAreaTypes = areaTypes.filter((a) => !districtId || String(a.district_id ?? a.district ?? "") === districtId);
                  const selected = filteredAreaTypes.find((a) => resolveId(a) === v);
                  setAreaTypeId(String(v));
                  setAreaTypeCategory(areaTypeCategoryFromName(String(selected?.name ?? "")));
                  setHierarchyId("");
                }}
                options={areaTypeOptions}
                placeholder={districtId ? "Select Area Type" : "Select a District first"}
                disabled={areaTypeScope.mode === "locked"}
              />
            </div>
            <div>
              <Label>Local Body Type <span className="text-red-500">*</span></Label>
              <Select
                value={hierarchyLevel}
                onChange={(v) => { setHierarchyLevel(v as HierarchyLevel); setHierarchyId(""); }}
                options={availableHierarchyLevels}
                placeholder="Select Local Body Type"
                disabled={availableHierarchyLevels.length === 1}
              />
            </div>
            <div>
              <Label>{hierarchyLevels.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body"} <span className="text-red-500">*</span></Label>
              <Select
                value={hierarchyId}
                onChange={(v) => setHierarchyId(String(v))}
                options={localBodyOptions}
                placeholder="Select"
                disabled={hierarchyScope.mode === "locked"}
              />
            </div>

            <div>
              <Label>Waste Type <span className="text-red-500">*</span></Label>
              <MultiSelect
                value={selectedWasteTypes}
                onChange={(event) => {
                  const raw = Array.isArray(event.value) ? event.value : [];
                  const values = raw.map((v: any) =>
                    v && typeof v === "object" ? String(v.value ?? v.unique_id ?? v.id ?? "") : String(v),
                  );
                  setSelectedWasteTypes(values);
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
              {missingPlanWasteTypes.length > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>
                    Trip Plan also has:{" "}
                    {missingPlanWasteTypes.map((wt) => wt.waste_type_name).join(", ")}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 font-medium text-amber-900 underline"
                    onClick={() =>
                      setSelectedWasteTypes((prev) => [
                        ...prev,
                        ...missingPlanWasteTypes.map((wt) => String(wt.unique_id)),
                      ])
                    }
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div>
              <Label>Wards</Label>
              <MultiSelect
                value={selectedWardIds}
                onChange={(event) => {
                  const raw = Array.isArray(event.value) ? event.value : [];
                  // PrimeReact MultiSelect sometimes returns objects instead of the optionValue string
                  const values = raw.map((v: any) =>
                    v && typeof v === "object" ? String(v.value ?? v.unique_id ?? v.id ?? "") : String(v),
                  );
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
                disabled={wardScope.mode === "locked" || !hierarchyId}
              />
            </div>

            {isEdit && (
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(v) => setStatus(String(v))} options={STATUS_OPTIONS} placeholder="Select status" />
              </div>
            )}

            {isEdit && (
              <div>
                <Label>Approval Status</Label>
                <Input value={approvalStatus} disabled className="bg-gray-50" />
              </div>
            )}

            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Optional remarks..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {isEdit && wasteTypeBreakdown.length > 0 && (
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-base font-semibold text-gray-800">Waste Type Breakdown</h2>
                <p className="text-xs text-gray-500">Actual weight collected on this trip, by waste type.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {wasteTypeBreakdown.map((row, index) => (
                  <div key={index} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{row.waste_type_name ?? "—"}</span>
                    <span className="font-medium text-gray-900">
                      {row.collected_weight_kg != null ? `${row.collected_weight_kg} kg` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Daily Trip Collection Points ── */}
          {hasBinStops && (
          <div className="rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Daily Trip Collection Points</h2>
                <p className="text-xs text-gray-500">
                  {isEdit
                    ? "Generated from the selected TripPlan and saved with this daily trip plan."
                    : "Collection points will be generated from the selected TripPlan after saving."}
                </p>
              </div>
              {(cpStops.length > 0 || (!isEdit && tripPlanId)) && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {cpStops.length > 0 ? `${cpStops.length} points` : `${previewStops.length} points (preview)`}
                </span>
              )}
            </div>

            {cpStops.length === 0 ? (
              !isEdit && previewStops.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Seq</th>
                        <th className="px-4 py-3">Collection Point</th>
                        <th className="px-4 py-3">Bin</th>
                        <th className="px-4 py-3">Ward</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {previewStops.map((stop: ApiRecord, i: number) => (
                        <tr key={stop.unique_id ?? i} className="text-gray-500 italic">
                          <td className="px-4 py-3">{stop.sequence ?? i + 1}</td>
                          <td className="px-4 py-3">{stop.collection_point?.cp_name ?? stop.collection_point_id ?? "—"}</td>
                          <td className="px-4 py-3">{stop.bin?.bin_name ?? stop.bin_id ?? "—"}</td>
                          <td className="px-4 py-3">{wardLabel(stop.collection_point_wards)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Pending</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-4 py-2 text-xs text-gray-400 italic">These collection points will be created when you save.</p>
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-gray-500">
                  {tripPlanLoading
                    ? "Loading..."
                    : isEdit
                      ? "No collection points are attached to this daily trip plan."
                      : tripPlanId
                        ? "No bin collection stops found in the selected trip plan."
                        : "Select a trip plan to preview collection points."}
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Seq</th>
                      <th className="px-4 py-3">Collection Point</th>
                      <th className="px-4 py-3">Bin</th>
                      <th className="px-4 py-3">Ward</th>
                      <th className="px-4 py-3">Waste Type</th>
                      <th className="px-4 py-3">Weight (kg)</th>
                      <th className="px-4 py-3">Collected</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {cpStops.map((point, index) => {
                      const ptKey = point.unique_id ?? point.collection_point_id;
                      return (
                        <tr key={ptKey ?? index}>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={1}
                              value={String(point.sequence ?? index + 1)}
                              onChange={(e) => updateCpStop(ptKey, { sequence: Number(e.target.value || 1) })}
                              className="h-9 w-20"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{pointLabel(point)}</td>
                          <td className="px-4 py-3 text-gray-700">{binLabel(point)}</td>
                          <td className="px-4 py-3 text-gray-700">{wardLabel(point.wards)}</td>
                          <td className="px-4 py-3 text-gray-700">{point.waste_type_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={String(point.collected_weight_kg ?? "")}
                              onChange={(e) => updateCpStop(ptKey, { collected_weight_kg: e.target.value })}
                              className="h-9 w-28"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={Boolean(point.is_collected)}
                              onChange={(e) => updateCpStop(ptKey, { is_collected: e.target.checked, status: e.target.checked ? "Collected" : "Pending" })}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={point.status ?? "Pending"}
                              onChange={(e) => updateCpStop(ptKey, { status: e.target.value, is_collected: e.target.value === "Collected" })}
                              className="h-9 rounded-md border border-gray-300 px-2 text-sm"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Collected">Collected</option>
                              <option value="Skipped">Skipped</option>
                              <option value="Missed">Missed</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {/* ── Daily Trip Household Collection Points ── */}
          {hasHouseholdStops && (
            <div className="rounded-lg border border-purple-200">
              <div className="flex items-center justify-between border-b border-purple-200 bg-purple-50 px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-purple-800">Daily Trip Household Collection Points</h2>
                  <p className="text-xs text-purple-600">
                    {isEdit
                      ? "Per-customer household stops generated from the selected Trip Plan."
                      : "Household stops will be generated for customers under this Trip Plan's local body after saving."}
                  </p>
                </div>
                {householdStops.length > 0 && (
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                    {householdStops.length} stops
                  </span>
                )}
              </div>

              {householdStops.length === 0 && !isEdit && previewHouseholdStops.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-purple-100 text-sm">
                    <thead className="bg-purple-50 text-left text-xs font-semibold uppercase text-purple-600">
                      <tr>
                        <th className="px-4 py-3">Seq</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Ward</th>
                        <th className="px-4 py-3">Collection Type</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50 bg-white">
                      {previewHouseholdStops.map((stop, index) => (
                        <tr key={stop.unique_id ?? index} className="text-gray-500 italic">
                          <td className="px-4 py-3">{stop.sequence ?? index + 1}</td>
                          <td className="px-4 py-3">{stop.customer?.customer_name ?? stop.customer_id ?? "—"}</td>
                          <td className="px-4 py-3">{stop.customer?.ward_name ?? "—"}</td>
                          <td className="px-4 py-3">{stop.collection_type === "bulk_waste_collection" ? "Bulk Waste Collection" : "Household Collection"}</td>
                          <td className="px-4 py-3"><span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Pending</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-4 py-2 text-xs text-gray-400 italic">These household stops are previewed and will be created when you save.</p>
                </div>
              ) : householdStops.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">
                  {isEdit
                    ? "No household collection stops are attached to this daily trip plan."
                    : tripPlanLoading
                      ? "Loading customers..."
                      : "No household customers found for the selected wards and local body."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-purple-50 text-left text-xs font-semibold uppercase text-purple-600">
                      <tr>
                        <th className="px-4 py-3">Seq</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Ward</th>
                        <th className="px-4 py-3">Address</th>
                        <th className="px-4 py-3">Weight (kg)</th>
                        <th className="px-4 py-3">Wet (kg)</th>
                        <th className="px-4 py-3">Dry (kg)</th>
                        <th className="px-4 py-3">Mixed (kg)</th>
                        <th className="px-4 py-3">Sanitary (kg)</th>
                        <th className="px-4 py-3">Collected</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {householdStops.map((stop, index) => {
                        const stopKey = stop.unique_id ?? stop.customer_id;
                        return (
                          <tr key={stopKey ?? index}>
                            <td className="px-4 py-3">
                              <Input type="number" min={1} value={String(stop.sequence ?? index + 1)} onChange={(e) => updateHouseholdStop(stopKey, { sequence: Number(e.target.value || 1) })} className="h-9 w-20" />
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800">{stop.customer?.customer_name ?? stop.customer_id ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-700">{stop.customer?.ward_name ?? "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{[stop.customer?.building_no, stop.customer?.street].filter(Boolean).join(", ") || "—"}</td>
                            <td className="px-4 py-3">
                              <Input type="number" min={0} step="0.01" value={String(stop.collected_weight_kg ?? "")} onChange={(e) => updateHouseholdStop(stopKey, { collected_weight_kg: e.target.value })} className="h-9 w-28" />
                            </td>
                            <td className="px-4 py-3 text-gray-700">{stop.wet_waste ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-700">{stop.dry_waste ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-700">{stop.mixed_waste ?? "—"}</td>
                            <td className="px-4 py-3 text-gray-700">{stop.sanitary_waste ?? "—"}</td>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={Boolean(stop.is_collected)} onChange={(e) => updateHouseholdStop(stopKey, { is_collected: e.target.checked, status: e.target.checked ? "Collected" : "Pending" })} className="h-4 w-4 rounded border-gray-300" />
                            </td>
                            <td className="px-4 py-3">
                              <select value={stop.status ?? "Pending"} onChange={(e) => updateHouseholdStop(stopKey, { status: e.target.value, is_collected: e.target.value === "Collected" })} className="h-9 rounded-md border border-purple-200 px-2 text-sm">
                                <option value="Pending">Pending</option>
                                <option value="Collected">Collected</option>
                                <option value="Not Available">Not Available</option>
                                <option value="Collect Later">Collect Later</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                value={String(stop.status_reason ?? "")}
                                onChange={(e) => updateHouseholdStop(stopKey, { status_reason: e.target.value })}
                                placeholder={stop.status === "Not Available" ? "Household not available today..." : stop.status === "Collect Later" ? "I will collect today later..." : "Optional reason"}
                                className="h-9 w-60"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
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
    </div>
  );
}
