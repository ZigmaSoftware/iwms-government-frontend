import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  alternativeStaffTemplateApi,
  areaTypeApi,
  corporationApi,
  dailyTripAssignmentApi,
  dailyTripCollectionPointApi,
  dailyTripHouseholdCollectionApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  staffTemplateApi,
  stateApi,
  townPanchayatApi,
  tripPlanApi,
  vehicleCreationApi,
  wasteTypeApi,
} from "@/helpers/admin";
import Swal from "@/lib/notify";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { normalizeList } from "@/utils/forms";

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

const CP_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Collected", label: "Collected" },
  { value: "Skipped", label: "Skipped" },
  { value: "Missed", label: "Missed" },
];

const nestedText = (obj: ApiRecord | null | undefined, keys: string[]): string => {
  if (!obj || typeof obj !== "object") return "-";
  for (const key of keys) {
    const value = obj[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
  }
  return "-";
};

const toOptions = (items: any[], labelKey: string): Option[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.id ?? ""),
      label: String(item?.[labelKey] ?? item?.display_code ?? item?.vehicle_no ?? item?.unique_id ?? ""),
    }))
    .filter((item) => item.value);

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
  const [staffTemplates, setStaffTemplates] = useState<Option[]>([]);
  const [altStaffTemplates, setAltStaffTemplates] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
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

  // Generated stops — merged in from the former Daily Trip Collection Point / Household Collection forms.
  const [cpStops, setCpStops] = useState<ApiRecord[]>([]);
  const [householdStops, setHouseholdStops] = useState<ApiRecord[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [savingStopId, setSavingStopId] = useState("");

  const loadStops = () => {
    if (!id) return;
    setStopsLoading(true);
    Promise.all([
      dailyTripCollectionPointApi.readAll({ params: { trip_assignment_id: id } }),
      dailyTripHouseholdCollectionApi.readAll({ params: { trip_assignment_id: id } }),
    ])
      .then(([cpRes, householdRes]) => {
        setCpStops(normalizeList(cpRes));
        setHouseholdStops(normalizeList(householdRes));
      })
      .finally(() => setStopsLoading(false));
  };

  useEffect(() => {
    loadStops();
  }, [id]);

  const updateCpStop = async (stopId: string, patch: Record<string, any>) => {
    setSavingStopId(stopId);
    try {
      await dailyTripCollectionPointApi.update(stopId, patch);
      setCpStops((prev) => prev.map((stop) => (String(stop.unique_id) === stopId ? { ...stop, ...patch } : stop)));
    } catch (error) {
      Swal.fire("Error", "Could not update the collection point stop.", "error");
    } finally {
      setSavingStopId("");
    }
  };

  const updateHouseholdStop = async (stopId: string, patch: Record<string, any>) => {
    setSavingStopId(stopId);
    try {
      await dailyTripHouseholdCollectionApi.update(stopId, patch);
      setHouseholdStops((prev) => prev.map((stop) => (String(stop.unique_id) === stopId ? { ...stop, ...patch } : stop)));
    } catch (error) {
      Swal.fire("Error", "Could not update the household collection stop.", "error");
    } finally {
      setSavingStopId("");
    }
  };

  useEffect(() => {
    Promise.all([
      tripPlanApi.readAll(),
      staffTemplateApi.readAll(),
      alternativeStaffTemplateApi.readAll(),
      wasteTypeApi.readAll(),
      vehicleCreationApi.readAll(),
      stateApi.readAll(),
      districtApi.readAll(),
      areaTypeApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
    ]).then(([
      tripPlanRes, staffRes, altStaffRes, wasteTypeRes, vehicleRes,
      stateRes, districtRes, areaTypeRes, corporationRes, municipalityRes, townPanchayatRes, panchayatUnionRes, panchayatRes,
    ]) => {
      setTripPlans(toOptions(normalizeList(tripPlanRes), "display_code"));
      setStaffTemplates(toOptions(normalizeList(staffRes), "display_code"));
      setAltStaffTemplates(toOptions(normalizeList(altStaffRes), "display_code"));
      setWasteTypes(toOptions(normalizeList(wasteTypeRes), "waste_type_name"));
      setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
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
      setScheduledTime(String(record.scheduled_time ?? ""));
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
      setStaffTemplateId(String(plan.staff_template?.unique_id ?? ""));
      setVehicleId(String(plan.vehicle?.unique_id ?? ""));
      setWasteTypeId(String(plan.waste_type?.unique_id ?? ""));
      setScheduledTime(String(plan.scheduled_time ?? "").slice(0, 5));

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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripPlanId || !staffTemplateId || !hierarchyId || !wasteTypeId || !vehicleId || !tripDate || !scheduledTime) {
      Swal.fire("Missing details", "Trip Plan, Staff Template, Local Body, Waste Type, Vehicle, Date and Time are required.", "warning");
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
      vehicle_id: vehicleId,
      trip_date: tripDate,
      scheduled_time: scheduledTime,
      status,
      approval_status: approvalStatus,
      remarks,
    };
    try {
      if (isEdit && id) await dailyTripAssignmentApi.update(id, payload);
      else await dailyTripAssignmentApi.create(payload);
      navigate(listPath);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ComponentCard title={isEdit ? "Edit Daily Trip Assignment" : "Create Daily Trip Assignment"}>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div><Label>Trip Plan *</Label><Select value={tripPlanId} onChange={(v) => setTripPlanId(String(v))} options={tripPlans} placeholder="Select Trip Plan" /></div>
        <div><Label>Staff Template *</Label><Select value={staffTemplateId} onChange={(v) => setStaffTemplateId(String(v))} options={staffTemplates} placeholder="Select Staff Template" /></div>
        <div><Label>Alternative Staff Template</Label><Select value={altStaffTemplateId} onChange={(v) => setAltStaffTemplateId(String(v))} options={altStaffTemplates} placeholder="Select Alternative Staff" /></div>
        <div><Label>Waste Type *</Label><Select value={wasteTypeId} onChange={(v) => setWasteTypeId(String(v))} options={wasteTypes} placeholder="Select Waste Type" /></div>
        <div><Label>Vehicle *</Label><Select value={vehicleId} onChange={(v) => setVehicleId(String(v))} options={vehicles} placeholder="Select Vehicle" /></div>
        <div><Label>Trip Date *</Label><Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} /></div>
        <div><Label>Scheduled Time *</Label><Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} /></div>

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
          <Label>District *</Label>
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
          <Label>Local Body Type *</Label>
          <Select
            value={hierarchyLevel}
            onChange={(v) => { setHierarchyLevel(v as HierarchyLevel); setHierarchyId(""); }}
            options={areaTypeCategory ? hierarchyLevels.filter((level) => AREA_TYPE_LEVELS[areaTypeCategory].includes(level.value)) : []}
            placeholder={areaTypeCategory ? "Select Local Body Type" : "Select an Area Type first"}
          />
        </div>
        <div>
          <Label>{hierarchyLevels.find((l) => l.value === hierarchyLevel)?.label ?? "Local Body"} *</Label>
          <Select
            value={hierarchyId}
            onChange={(v) => setHierarchyId(String(v))}
            options={toGeoOptions((hierarchyRecords[hierarchyLevel] ?? []).filter((item) => !districtId || String(item.district_id ?? item.district ?? "") === districtId))}
            placeholder="Select"
          />
        </div>

        <div><Label>Status</Label><Select value={status} onChange={(v) => setStatus(String(v))} options={[{ value: "Scheduled", label: "Scheduled" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "Cancelled", label: "Cancelled" }]} placeholder="Select Status" /></div>
        <div><Label>Approval Status</Label><Select value={approvalStatus} onChange={(v) => setApprovalStatus(String(v))} options={[{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]} placeholder="Select Approval" /></div>
        <div className="md:col-span-2"><Label>Remarks</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>

        {/* Read-only preview of the selected Trip Plan's collection point stops */}
        {tripPlanId && (
          <div className="md:col-span-2 rounded-md border p-4">
            <Label>Collection Point Stops (from Trip Plan)</Label>
            {tripPlanLoading && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
            {!tripPlanLoading && Array.isArray(selectedTripPlan?.plan_collection_points) && selectedTripPlan.plan_collection_points.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">This Trip Plan has no collection point stops.</p>
            )}
            {!tripPlanLoading && Array.isArray(selectedTripPlan?.plan_collection_points) && selectedTripPlan.plan_collection_points.length > 0 && (
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="p-2">Seq</th>
                      <th className="p-2">Collection Point</th>
                      <th className="p-2">Bin / Customer</th>
                      <th className="p-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTripPlan.plan_collection_points.map((stop: ApiRecord) => {
                      const typeLabel = stop.collection_type === "household_collection"
                        ? "Household"
                        : stop.collection_type === "bulk_waste_collection"
                          ? "Bulk Waste"
                          : "Bin Collection";
                      return (
                        <tr key={String(stop.unique_id)} className="border-t">
                          <td className="p-2">{String(stop.sequence ?? "-")}</td>
                          <td className="p-2">{nestedText(stop.collection_point as ApiRecord, ["cp_name", "collection_point_name"])}</td>
                          <td className="p-2">
                            {stop.collection_type === "bin_collection"
                              ? nestedText(stop.bin as ApiRecord, ["bin_name"])
                              : nestedText(stop.customer as ApiRecord, ["customer_name"]) }
                          </td>
                          <td className="p-2">{typeLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              These stops will be generated automatically as Collection Point / Household Collection records once this assignment is saved.
            </p>
          </div>
        )}

        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>

      {isEdit && (
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="mb-2 text-base font-semibold text-gray-800">Collection Point Stops</h3>
            {stopsLoading && <p className="text-sm text-gray-500">Loading...</p>}
            {!stopsLoading && cpStops.length === 0 && (
              <p className="text-sm text-gray-500">No collection point stops generated for this assignment.</p>
            )}
            {cpStops.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="p-2">Seq</th>
                      <th className="p-2">Collection Point</th>
                      <th className="p-2">Bin</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Collected Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cpStops.map((stop) => {
                      const stopId = String(stop.unique_id);
                      return (
                        <tr key={stopId} className="border-t">
                          <td className="p-2">{String(stop.sequence ?? "-")}</td>
                          <td className="p-2">{nestedText(stop.collection_point as ApiRecord, ["cp_name", "collection_point_name"])}</td>
                          <td className="p-2">{nestedText(stop.bin as ApiRecord, ["bin_name"])}</td>
                          <td className="p-2 min-w-[140px]">
                            <Select
                              value={String(stop.status ?? "Pending")}
                              onChange={(v) => updateCpStop(stopId, { status: String(v) })}
                              options={CP_STATUS_OPTIONS}
                              placeholder="Status"
                              disabled={savingStopId === stopId}
                            />
                          </td>
                          <td className="p-2 min-w-[120px]">
                            <Input
                              type="number"
                              defaultValue={stop.collected_weight_kg != null ? String(stop.collected_weight_kg) : ""}
                              onBlur={(e) => updateCpStop(stopId, { collected_weight_kg: e.target.value || null })}
                              disabled={savingStopId === stopId}
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

          <div>
            <h3 className="mb-2 text-base font-semibold text-gray-800">Household Collection Stops</h3>
            {stopsLoading && <p className="text-sm text-gray-500">Loading...</p>}
            {!stopsLoading && householdStops.length === 0 && (
              <p className="text-sm text-gray-500">No household collection stops generated for this assignment.</p>
            )}
            {householdStops.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="p-2">Seq</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Collected Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {householdStops.map((stop) => {
                      const stopId = String(stop.unique_id);
                      return (
                        <tr key={stopId} className="border-t">
                          <td className="p-2">{String(stop.sequence ?? "-")}</td>
                          <td className="p-2">{nestedText(stop.customer as ApiRecord, ["customer_name"])}</td>
                          <td className="p-2">{stop.collection_type === "bulk_waste_collection" ? "Bulk Waste" : "Household"}</td>
                          <td className="p-2 min-w-[140px]">
                            <Select
                              value={String(stop.status ?? "Pending")}
                              onChange={(v) => updateHouseholdStop(stopId, { status: String(v) })}
                              options={CP_STATUS_OPTIONS}
                              placeholder="Status"
                              disabled={savingStopId === stopId}
                            />
                          </td>
                          <td className="p-2 min-w-[120px]">
                            <Input
                              type="number"
                              defaultValue={stop.collected_weight_kg != null ? String(stop.collected_weight_kg) : ""}
                              onBlur={(e) => updateHouseholdStop(stopId, { collected_weight_kg: e.target.value || null })}
                              disabled={savingStopId === stopId}
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
        </div>
      )}
    </ComponentCard>
  );
}
