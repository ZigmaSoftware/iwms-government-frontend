import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import HierarchyNodeSelect, { type HierarchyLegacyValues } from "@/components/common/HierarchyNodeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  propertiesApi,
  staffCreationApi,
  staffTemplateApi,
  subPropertiesApi,
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
  const [locationNodeId, setLocationNodeId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("corporation_id");
  const [hierarchyId, setHierarchyId] = useState("");
  const [legacyMatch, setLegacyMatch] = useState<{ field: keyof HierarchyLegacyValues; value: string } | null>(null);
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

  useEffect(() => {
    Promise.all([
      staffTemplateApi.readAll(),
      vehicleCreationApi.readAll(),
      staffCreationApi.readAll(),
      propertiesApi.readAll(),
      subPropertiesApi.readAll(),
      wasteTypeApi.readAll(),
    ]).then(([staffRes, vehicleRes, supervisorRes, propertyRes, subPropertyRes, wasteTypeRes]) => {
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
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    tripPlanApi.read(id).then((record: ApiRecord) => {
      setDisplayCode(String(record.display_code ?? ""));

      // district comes as nested object (district_id is write_only in serializer)
      setDistrictId(String(record.district?.unique_id ?? record.district_id ?? ""));

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
        const matchedId = hierarchyMap[detectedLevel.value] ?? "";
        setHierarchyId(matchedId);
        setLegacyMatch({ field: detectedLevel.value, value: matchedId });
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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!districtId || !hierarchyId || !staffTemplateId || !vehicleId) {
      Swal.fire("Missing details", "District, Hierarchy, Staff Template and Vehicle are required.", "warning");
      return;
    }
    if (selectedWasteTypes.length === 0) {
      Swal.fire("Missing details", "Select at least one Waste Type.", "warning");
      return;
    }
    const scheduledTime = to24h(timeHour, timeMinute, timePeriod);
    setSaving(true);
    const payload: Record<string, any> = {
      district_id: districtId,
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

        <div className="md:col-span-2">
          <HierarchyNodeSelect
            value={locationNodeId}
            legacyMatch={legacyMatch}
            allowedSourceTypes={["corporation", "municipality", "town_panchayat", "panchayat_union", "panchayat"]}
            label="Operational Hierarchy"
            placeholder="Select corporation / municipality / town panchayat / panchayat union / panchayat"
            onChange={(nodeId, legacy) => {
              setLocationNodeId(nodeId);
              setDistrictId(legacy.district_id ?? "");
              const selected = hierarchyLevels.find((item) => legacy[item.value]);
              setHierarchyLevel(selected?.value ?? "corporation_id");
              setHierarchyId(selected ? legacy[selected.value] ?? "" : "");
            }}
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
