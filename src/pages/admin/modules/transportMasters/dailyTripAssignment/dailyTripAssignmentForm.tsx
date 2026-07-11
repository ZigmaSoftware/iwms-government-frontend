import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  alternativeStaffTemplateApi,
  areaTypeApi,
  corporationApi,
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
  wasteTypeApi,
} from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList, staffTemplateLabel, altStaffTemplateLabel } from "@/utils/forms";
import { staffTemplateInHierarchy } from "@/hooks/useGeoHierarchy";
import type { DailyTripCollectionPointInline, DailyTripHouseholdCollectionInline } from "./types";

type Option = { value: string; label: string };
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

const pointLabel = (point: DailyTripCollectionPointInline): string =>
  String(point.collection_point?.cp_name ?? point.collection_point_id ?? "").trim() || "—";

const binLabel = (point: DailyTripCollectionPointInline): string =>
  String(point.bin?.bin_name ?? point.bin_id ?? "").trim() || "—";

export default function DailyTripAssignmentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const { encScheduleMasters, encDailyTripAssignment } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleMasters, encDailyTripAssignment);

  const [tripPlanId, setTripPlanId] = useState("");
  const [staffTemplateId, setStaffTemplateId] = useState("");
  const [altStaffTemplateId, setAltStaffTemplateId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [approvalStatus, setApprovalStatus] = useState("PENDING");
  const [remarks, setRemarks] = useState("");
  const [tripPlans, setTripPlans] = useState<Option[]>([]);
  const [staffTemplatesRaw, setStaffTemplatesRaw] = useState<ApiRecord[]>([]);
  const [altStaffCache, setAltStaffCache] = useState<ApiRecord[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    Promise.all([
      tripPlanApi.readAll(),
      staffTemplateApi.readAll(),
      alternativeStaffTemplateApi.readAll(),
      wasteTypeApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ]).then(([
      tripPlanRes, staffRes, altStaffRes, wasteTypeRes,
      stateRes, districtRes, areaTypeRes, corporationRes, municipalityRes, townPanchayatRes, panchayatUnionRes, panchayatRes,
    ]) => {
      setTripPlans(toOptions(normalizeList(tripPlanRes), "display_code"));
      setStaffTemplatesRaw(normalizeList(staffRes));
      setAltStaffCache(normalizeList(altStaffRes));
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
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    dailyTripAssignmentApi.read(id).then((record: ApiRecord) => {
      // FK fields are write_only in the serializer; read from nested read objects instead
      setTripPlanId(String(record.trip_plan?.unique_id ?? record.trip_plan_id ?? ""));
      setStaffTemplateId(String(record.staff_template?.unique_id ?? record.staff_template_id ?? ""));
      setAltStaffTemplateId(String(record.alt_staff_template?.unique_id ?? record.alt_staff_template_id ?? ""));
      setWasteTypeId(String(record.waste_type?.unique_id ?? record.waste_type_id ?? ""));
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
      setStaffTemplateId((prev) => prev || String(plan.staff_template?.unique_id ?? ""));
      setVehicleId((prev) => prev || String(plan.vehicle?.unique_id ?? ""));
      setWasteTypeId((prev) => prev || String(plan.waste_type?.unique_id ?? ""));
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
  const availableHierarchyLevels = areaTypeCategory
    ? hierarchyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value))
    : [{ value: hierarchyLevel, label: hierarchyLevels.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body" }];

  // Local Body options — keep the prefilled value present even when the
  // district filter would hide it.
  const localBodyOptions = (() => {
    const options = toGeoOptions(
      (hierarchyRecords[hierarchyLevel] ?? []).filter(
        (item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId,
      ),
    );
    if (hierarchyId && !options.some((o) => o.value === hierarchyId)) {
      const current = (hierarchyRecords[hierarchyLevel] ?? []).find((item) => resolveId(item) === hierarchyId);
      options.unshift({ value: hierarchyId, label: current ? resolveName(current) : hierarchyId });
    }
    return options;
  })();

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
  const planStops: ApiRecord[] = Array.isArray(selectedTripPlan?.plan_collection_points)
    ? selectedTripPlan.plan_collection_points
    : [];
  const hasHouseholdStops = isEdit
    ? householdStops.length > 0
    : planStops.some((s) => ["household_collection", "bulk_waste_collection"].includes(String(s.collection_type)));
  const previewStops = planStops.filter((s) => s.collection_type === "bin_collection" && s.bin_id);

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
    if (!tripPlanId || !staffTemplateId || !hierarchyId || !wasteTypeId || !tripDate || !scheduledTime) {
      Swal.fire("Missing details", "Trip Plan, Staff Template, Local Body, Waste Type, Date and Time are required.", "warning");
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
      waste_type_id: wasteTypeId,
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
                }) as Promise<unknown>).catch(() => null)
              )
          );
        }
      } else {
        await dailyTripAssignmentApi.create(payload);
      }
      navigate(listPath);
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
              <Select value={tripPlanId} onChange={(v) => setTripPlanId(String(v))} options={tripPlans} placeholder="Select trip plan" />
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
                options={toGeoOptions(states)}
                placeholder="Select State"
              />
            </div>
            <div>
              <Label>District <span className="text-red-500">*</span></Label>
              <Select
                value={districtId}
                onChange={(v) => { setDistrictId(String(v)); setAreaTypeId(""); setAreaTypeCategory(""); setHierarchyId(""); }}
                options={toGeoOptions(districts.filter((d) => !stateId || String(d.state_id ?? d.state ?? "") === stateId))}
                placeholder={stateId ? "Select District" : "Select a State first"}
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
                options={toGeoOptions(areaTypes.filter((a) => !districtId || String(a.district_id ?? a.district ?? "") === districtId))}
                placeholder={districtId ? "Select Area Type" : "Select a District first"}
              />
            </div>
            <div>
              <Label>Local Body Type <span className="text-red-500">*</span></Label>
              <Select
                value={hierarchyLevel}
                onChange={(v) => { setHierarchyLevel(v as HierarchyLevel); setHierarchyId(""); }}
                options={availableHierarchyLevels}
                placeholder="Select Local Body Type"
              />
            </div>
            <div>
              <Label>{hierarchyLevels.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body"} <span className="text-red-500">*</span></Label>
              <Select
                value={hierarchyId}
                onChange={(v) => setHierarchyId(String(v))}
                options={localBodyOptions}
                placeholder="Select"
              />
            </div>

            <div>
              <Label>Waste Type <span className="text-red-500">*</span></Label>
              <Select value={wasteTypeId} onChange={(v) => setWasteTypeId(String(v))} options={wasteTypes} placeholder="Select waste type" />
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

          {/* ── Daily Trip Collection Points ── */}
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
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {previewStops.map((stop: ApiRecord, i: number) => (
                        <tr key={stop.unique_id ?? i} className="text-gray-500 italic">
                          <td className="px-4 py-3">{stop.sequence ?? i + 1}</td>
                          <td className="px-4 py-3">{stop.collection_point?.cp_name ?? stop.collection_point_id ?? "—"}</td>
                          <td className="px-4 py-3">{stop.bin?.bin_name ?? stop.bin_id ?? "—"}</td>
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

              {householdStops.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">
                  {isEdit
                    ? "No household collection stops are attached to this daily trip plan."
                    : "Household stops will be created when you save."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-purple-50 text-left text-xs font-semibold uppercase text-purple-600">
                      <tr>
                        <th className="px-4 py-3">Seq</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Address</th>
                        <th className="px-4 py-3">Weight (kg)</th>
                        <th className="px-4 py-3">Collected</th>
                        <th className="px-4 py-3">Status</th>
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
                            <td className="px-4 py-3 text-xs text-gray-600">{[stop.customer?.building_no, stop.customer?.street].filter(Boolean).join(", ") || "—"}</td>
                            <td className="px-4 py-3">
                              <Input type="number" min={0} step="0.01" value={String(stop.collected_weight_kg ?? "")} onChange={(e) => updateHouseholdStop(stopKey, { collected_weight_kg: e.target.value })} className="h-9 w-28" />
                            </td>
                            <td className="px-4 py-3">
                              <input type="checkbox" checked={Boolean(stop.is_collected)} onChange={(e) => updateHouseholdStop(stopKey, { is_collected: e.target.checked, status: e.target.checked ? "Collected" : "Pending" })} className="h-4 w-4 rounded border-gray-300" />
                            </td>
                            <td className="px-4 py-3">
                              <select value={stop.status ?? "Pending"} onChange={(e) => updateHouseholdStop(stopKey, { status: e.target.value, is_collected: e.target.value === "Collected" })} className="h-9 rounded-md border border-purple-200 px-2 text-sm">
                                <option value="Pending">Pending</option>
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
