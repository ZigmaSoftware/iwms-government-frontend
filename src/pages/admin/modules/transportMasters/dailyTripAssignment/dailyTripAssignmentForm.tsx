import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ComponentCard from "@/components/common/ComponentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import {
  alternativeStaffTemplateApi,
  dailyTripAssignmentApi,
  panchayatApi,
  staffTemplateApi,
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
  const [panchayatId, setPanchayatId] = useState("");
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
  const [panchayats, setPanchayats] = useState<Option[]>([]);
  const [wasteTypes, setWasteTypes] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      tripPlanApi.readAll(),
      staffTemplateApi.readAll(),
      alternativeStaffTemplateApi.readAll(),
      panchayatApi.readAll(),
      wasteTypeApi.readAll(),
      vehicleCreationApi.readAll(),
    ]).then(([tripPlanRes, staffRes, altStaffRes, panchayatRes, wasteTypeRes, vehicleRes]) => {
      setTripPlans(toOptions(normalizeList(tripPlanRes), "display_code"));
      setStaffTemplates(toOptions(normalizeList(staffRes), "display_code"));
      setAltStaffTemplates(toOptions(normalizeList(altStaffRes), "display_code"));
      setPanchayats(toOptions(normalizeList(panchayatRes), "panchayat_name"));
      setWasteTypes(toOptions(normalizeList(wasteTypeRes), "waste_type_name"));
      setVehicles(toOptions(normalizeList(vehicleRes), "vehicle_no"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    dailyTripAssignmentApi.read(id).then((record: ApiRecord) => {
      // FK fields are write_only in the serializer; read from nested read objects instead
      setTripPlanId(String(record.trip_plan?.unique_id ?? record.trip_plan_id ?? ""));
      setStaffTemplateId(String(record.staff_template?.unique_id ?? record.staff_template_id ?? ""));
      setAltStaffTemplateId(String(record.alt_staff_template?.unique_id ?? record.alt_staff_template_id ?? ""));
      // Panchayat comes from the hierarchy read field
      const hierarchy: ApiRecord = (record.hierarchy as ApiRecord) ?? {};
      setPanchayatId(String(
        record.panchayat?.unique_id ??
        hierarchy.panchayat_id ??
        record.panchayat_id ?? ""
      ));
      setWasteTypeId(String(record.waste_type?.unique_id ?? record.waste_type_id ?? ""));
      setVehicleId(String(record.vehicle?.unique_id ?? record.vehicle_id ?? ""));
      setTripDate(String(record.trip_date ?? ""));
      setScheduledTime(String(record.scheduled_time ?? ""));
      setStatus(String(record.status ?? "Scheduled"));
      setApprovalStatus(String(record.approval_status ?? "PENDING"));
      setRemarks(String(record.remarks ?? ""));
    });
  }, [id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripPlanId || !staffTemplateId || !panchayatId || !wasteTypeId || !vehicleId || !tripDate || !scheduledTime) {
      Swal.fire("Missing details", "Trip Plan, Staff Template, Panchayat, Waste Type, Vehicle, Date and Time are required.", "warning");
      return;
    }
    setSaving(true);
    const payload = {
      trip_plan_id: tripPlanId,
      staff_template_id: staffTemplateId,
      alt_staff_template_id: altStaffTemplateId || null,
      panchayat_id: panchayatId,
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
        <div><Label>Panchayat *</Label><Select value={panchayatId} onChange={(v) => setPanchayatId(String(v))} options={panchayats} placeholder="Select Panchayat" /></div>
        <div><Label>Waste Type *</Label><Select value={wasteTypeId} onChange={(v) => setWasteTypeId(String(v))} options={wasteTypes} placeholder="Select Waste Type" /></div>
        <div><Label>Vehicle *</Label><Select value={vehicleId} onChange={(v) => setVehicleId(String(v))} options={vehicles} placeholder="Select Vehicle" /></div>
        <div><Label>Trip Date *</Label><Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} /></div>
        <div><Label>Scheduled Time *</Label><Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} /></div>
        <div><Label>Status</Label><Select value={status} onChange={(v) => setStatus(String(v))} options={[{ value: "Scheduled", label: "Scheduled" }, { value: "In Progress", label: "In Progress" }, { value: "Completed", label: "Completed" }, { value: "Cancelled", label: "Cancelled" }]} placeholder="Select Status" /></div>
        <div><Label>Approval Status</Label><Select value={approvalStatus} onChange={(v) => setApprovalStatus(String(v))} options={[{ value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]} placeholder="Select Approval" /></div>
        <div className="md:col-span-2"><Label>Remarks</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(listPath)}>Cancel</Button>
        </div>
      </form>
    </ComponentCard>
  );
}
