import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  corporationApi,
  districtApi,
  municipalityApi,
  panchayatApi,
  panchayatUnionApi,
  propertiesApi,
  staffTemplateApi,
  subPropertiesApi,
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
  const [districtId, setDistrictId] = useState("");
  const [hierarchyLevel, setHierarchyLevel] = useState<HierarchyLevel>("corporation_id");
  const [hierarchyId, setHierarchyId] = useState("");
  const [staffTemplateId, setStaffTemplateId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [subPropertyId, setSubPropertyId] = useState("");
  const [wasteTypeId, setWasteTypeId] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [approvalStatus, setApprovalStatus] = useState("PENDING");
  const [maxVehicleCapacityKg, setMaxVehicleCapacityKg] = useState("");
  const [districts, setDistricts] = useState<Option[]>([]);
  const [hierarchyOptions, setHierarchyOptions] = useState<Record<HierarchyLevel, Option[]>>({
    corporation_id: [],
    municipality_id: [],
    town_panchayat_id: [],
    panchayat_union_id: [],
    panchayat_id: [],
  });
  const [staffTemplates, setStaffTemplates] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [subProperties, setSubProperties] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      districtApi.readAll(),
      corporationApi.readAll(),
      municipalityApi.readAll(),
      townPanchayatApi.readAll(),
      panchayatUnionApi.readAll(),
      panchayatApi.readAll(),
      staffTemplateApi.readAll(),
      vehicleCreationApi.readAll(),
      propertiesApi.readAll(),
      subPropertiesApi.readAll(),
      wasteTypeApi.readAll(),
    ]).then(([districtRes, corporationRes, municipalityRes, townRes, unionRes, panchayatRes, staffRes, vehicleRes, propertyRes, subPropertyRes, wasteTypeRes]) => {
      setDistricts(toOptions(normalizeList(districtRes), "district_name"));
      setHierarchyOptions({
        corporation_id: toOptions(normalizeList(corporationRes), "corporation_name"),
        municipality_id: toOptions(normalizeList(municipalityRes), "municipality_name"),
        town_panchayat_id: toOptions(normalizeList(townRes), "town_panchayat_name"),
        panchayat_union_id: toOptions(normalizeList(unionRes), "union_name"),
        panchayat_id: toOptions(normalizeList(panchayatRes), "panchayat_name"),
      });
      setStaffTemplates(toOptions(normalizeList(staffRes), "display_code"));
      setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
      setProperties(toOptions(normalizeList(propertyRes), "property_name"));
      setSubProperties(toOptions(normalizeList(subPropertyRes), "sub_property_name"));
      setWasteTypes(toOptions(normalizeList(wasteTypeRes), "waste_type_name"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    tripPlanApi.read(id).then((record: ApiRecord) => {
      setDisplayCode(String(record.display_code ?? ""));
      setDistrictId(String(record.district_id ?? record.district?.unique_id ?? ""));
      const selectedLevel = hierarchyLevels.find((item) => String(record[item.value] ?? ""));
      if (selectedLevel) {
        setHierarchyLevel(selectedLevel.value);
        setHierarchyId(String(record[selectedLevel.value] ?? ""));
      }
      setStaffTemplateId(String(record.staff_template_id ?? ""));
      setVehicleId(String(record.vehicle_id ?? ""));
      setPropertyId(String(record.property_id ?? ""));
      setSubPropertyId(String(record.sub_property_id ?? ""));
      setWasteTypeId(String(record.waste_type_id ?? ""));
      setScheduledTime(String(record.scheduled_time ?? ""));
      setStatus(String(record.status ?? "ACTIVE"));
      setApprovalStatus(String(record.approval_status ?? "PENDING"));
      setMaxVehicleCapacityKg(String(record.max_vehicle_capacity_kg ?? ""));
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!districtId || !hierarchyId || !staffTemplateId || !vehicleId || !wasteTypeId || !scheduledTime) {
      Swal.fire("Missing details", "District, Hierarchy, Staff Template, Vehicle, Waste Type and Scheduled Time are required.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      district_id: districtId,
      corporation_id: null,
      municipality_id: null,
      town_panchayat_id: null,
      panchayat_union_id: null,
      panchayat_id: null,
      [hierarchyLevel]: hierarchyId,
      staff_template_id: staffTemplateId,
      vehicle_id: vehicleId,
      property_id: propertyId || null,
      sub_property_id: subPropertyId || null,
      waste_type_id: wasteTypeId,
      scheduled_time: scheduledTime,
      status,
      approval_status: approvalStatus,
      max_vehicle_capacity_kg: maxVehicleCapacityKg || null,
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
        <div><Label>Display Code</Label><Input value={displayCode} onChange={(e) => setDisplayCode(e.target.value)} disabled={!isEdit} /></div>
        <div><Label>District *</Label><Select value={districtId} onChange={(v) => setDistrictId(String(v))} options={districts} placeholder="Select District" /></div>
        <div><Label>Hierarchy Level *</Label><Select value={hierarchyLevel} onChange={(v) => { setHierarchyLevel(String(v) as HierarchyLevel); setHierarchyId(""); }} options={hierarchyLevels} placeholder="Select Hierarchy Level" /></div>
        <div><Label>{hierarchyLevels.find((item) => item.value === hierarchyLevel)?.label} *</Label><Select value={hierarchyId} onChange={(v) => setHierarchyId(String(v))} options={hierarchyOptions[hierarchyLevel]} placeholder="Select Hierarchy" /></div>
        <div><Label>Staff Template *</Label><Select value={staffTemplateId} onChange={(v) => setStaffTemplateId(String(v))} options={staffTemplates} placeholder="Select Staff Template" /></div>
        <div><Label>Vehicle *</Label><Select value={vehicleId} onChange={(v) => setVehicleId(String(v))} options={vehicles} placeholder="Select Vehicle" /></div>
        <div><Label>Property</Label><Select value={propertyId} onChange={(v) => setPropertyId(String(v))} options={properties} placeholder="Select Property" /></div>
        <div><Label>Sub Property</Label><Select value={subPropertyId} onChange={(v) => setSubPropertyId(String(v))} options={subProperties} placeholder="Select Sub Property" /></div>
        <div><Label>Waste Type *</Label><Select value={wasteTypeId} onChange={(v) => setWasteTypeId(String(v))} options={wasteTypes} placeholder="Select Waste Type" /></div>
        <div><Label>Scheduled Time *</Label><Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} /></div>
        <div><Label>Status</Label><Select value={status} onChange={(v) => setStatus(String(v))} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} placeholder="Select Status" /></div>
        <div><Label>Approval Status</Label><Select value={approvalStatus} onChange={(v) => setApprovalStatus(String(v))} options={[{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]} placeholder="Select Approval" /></div>
        <div><Label>Max Vehicle Capacity Kg</Label><Input type="number" value={maxVehicleCapacityKg} onChange={(e) => setMaxVehicleCapacityKg(e.target.value)} /></div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
