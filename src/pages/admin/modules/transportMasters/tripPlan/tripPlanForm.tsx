import type { FormState, SelectOption, StopRow } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/helpers/admin/registry";
import { tripPlanApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const statusOptions: SelectOption[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

const approvalStatusOptions: SelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const optionLabel = (item: any, keys: string[]) =>
  keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null && value !== "") ??
  item?.display_code ??
  item?.unique_id ??
  "";

const buildOptions = (items: any[], keys: string[]): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.unique_id ?? item?.staff_unique_id ?? ""),
      label: String(optionLabel(item, keys)),
    }))
    .filter((item) => item.value);

const extractErrorMessage = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string") return data.error;
  if (typeof data === "object") {
    const firstValue = Object.values(data)[0];
    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (typeof firstValue === "string") return firstValue;
  }
  return null;
};

export default function TripPlanForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);
  const routeState = location.state as { companyUniqueId?: string; projectId?: string; record?: any } | null;

  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    loggedInCompanyUniqueId,
    setProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const { encScheduleMasters, encTripPlans } = getEncryptedRoute();
  const { listPath: listPath } = createCrudRoutePaths(encScheduleMasters, encTripPlans);

  const [formData, setFormData] = useState<FormState>({
    district_id: "",
    city_id: "",
    zone_id: "",
    panchayat_id: "",
    ward_id: "",
    staff_template_id: "",
    vehicle_id: "",
    supervisor_id: "",
    property_id: "",
    sub_property_id: "",
    waste_type_id: "",
    trip_trigger_weight_kg: "",
    max_vehicle_capacity_kg: "",
    scheduled_time: "",
    approval_status: "PENDING",
    status: "ACTIVE",
  });
  const [stops, setStops] = useState<StopRow[]>([
    { collection_point_id: "", bin_id: "", sequence: 1, is_active: true },
  ]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookups, setLookups] = useState<Record<string, any[]>>({});
  // Holds raw edit record until lookups are ready — avoids Radix Select blank-value bug
  const [pendingRecord, setPendingRecord] = useState<any>(null);

  // Step 1: fetch the record, store it, trigger company/project → which triggers lookup fetch
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoading(true);
    tripPlanApi.read(id)
      .then((record: any) => {
        if (cancelled) return;
        applyCompanyProjectFromRecord(record);
        setPendingRecord(record);
      })
      .catch((error) => Swal.fire(t("common.error"), extractErrorMessage(error) ?? t("common.load_failed"), "error"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord, t]);

  // Step 2: once lookups are populated AND a pending record exists, hydrate the form
  useEffect(() => {
    if (!pendingRecord) return;
    const lookupsReady = (lookups.districts?.length ?? 0) > 0;
    if (!lookupsReady) return;

    const record = pendingRecord;
    setFormData({
      district_id: record.district?.unique_id ?? record.district_id ?? "",
      city_id: record.city?.unique_id ?? record.city_id ?? "",
      zone_id: record.zone?.unique_id ?? record.zone_id ?? "",
      panchayat_id: record.panchayat?.unique_id ?? record.panchayat_id ?? "",
      ward_id: record.ward?.unique_id ?? record.ward_id ?? "",
      staff_template_id: record.staff_template?.unique_id ?? record.staff_template_id ?? "",
      vehicle_id: record.vehicle?.unique_id ?? record.vehicle_id ?? "",
      supervisor_id: record.supervisor?.unique_id ?? record.supervisor_id ?? "",
      property_id: record.property?.unique_id ?? record.property_id ?? "",
      sub_property_id: record.sub_property?.unique_id ?? record.sub_property_id ?? "",
      waste_type_id: record.waste_type?.unique_id ?? record.waste_type_id ?? "",
      trip_trigger_weight_kg: String(record.trip_trigger_weight_kg ?? ""),
      max_vehicle_capacity_kg: String(record.max_vehicle_capacity_kg ?? ""),
      scheduled_time: String(record.scheduled_time ?? "").slice(0, 5),
      approval_status: record.approval_status ?? "PENDING",
      status: record.status ?? "ACTIVE",
    });
    const stopRows = normalizeList(record.plan_collection_points).map((stop: any, index: number) => ({
      collection_point_id: stop.collection_point_id ?? stop.collection_point?.unique_id ?? "",
      bin_id: stop.bin_id ?? stop.bin?.unique_id ?? "",
      sequence: Number(stop.sequence ?? index + 1),
      is_active: stop.is_active !== false,
    }));
    setStops(stopRows.length ? stopRows : [{ collection_point_id: "", bin_id: "", sequence: 1, is_active: true }]);
    setPendingRecord(null);
  }, [pendingRecord, lookups]);

  useEffect(() => {
    if (!companyUniqueId || !projectId) {
      setLookups({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = { company_id: companyUniqueId, project_id: projectId, project: projectId };
    Promise.all([
      adminApi.districts.readAll({ params }),
      adminApi.cities.readAll({ params }),
      adminApi.zones.readAll({ params }),
      adminApi.panchayats.readAll({ params }),
      adminApi.wards.readAll({ params }),
      adminApi.staffTemplateCreation.readAll({ params }),
      adminApi.vehicleCreations.readAll({ params }),
      adminApi.staffCreation.readAll({ params }),
      adminApi.properties.readAll({ params }),
      adminApi.subProperties.readAll({ params }),
      adminApi.wasteTypes.readAll({ params }),
      adminApi.collectionPoints.readAll({ params }),
      adminApi.bins.readAll({ params }),
    ])
      .then(([districts, cities, zones, panchayats, wards, staffTemplates, vehicles, staff, properties, subProperties, wasteTypes, collectionPoints, bins]) => {
        if (cancelled) return;
        setLookups({
          districts: normalizeList(districts),
          cities: normalizeList(cities),
          zones: normalizeList(zones),
          panchayats: normalizeList(panchayats),
          wards: normalizeList(wards),
          staffTemplates: normalizeList(staffTemplates),
          vehicles: normalizeList(vehicles),
          staff: normalizeList(staff),
          properties: normalizeList(properties),
          subProperties: normalizeList(subProperties),
          wasteTypes: normalizeList(wasteTypes),
          collectionPoints: normalizeList(collectionPoints),
          bins: normalizeList(bins),
        });
      })
      .catch((error) => Swal.fire(t("common.error"), extractErrorMessage(error) ?? t("common.load_failed"), "error"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyUniqueId, projectId, t]);

  const options = useMemo(() => ({
    districts: buildOptions(lookups.districts ?? [], ["name", "district_name"]),
    cities: buildOptions(
      (lookups.cities ?? []).filter((item) =>
        !formData.district_id || String(item?.district_id ?? "") === formData.district_id
      ),
      ["name", "city_name"]
    ),
    zones: buildOptions(
      (lookups.zones ?? []).filter((item) =>
        !formData.city_id || String(item?.city_id ?? "") === formData.city_id
      ),
      ["name", "zone_name"]
    ),
    panchayats: buildOptions(
      (lookups.panchayats ?? []).filter((item) =>
        !formData.city_id || String(item?.city_id ?? "") === formData.city_id
      ),
      ["panchayat_name", "name"]
    ),
    wards: buildOptions(
      (lookups.wards ?? []).filter((item) =>
        !formData.zone_id || String(item?.zone_id ?? "") === formData.zone_id
      ),
      ["ward_name", "name"]
    ),
    staffTemplates: buildOptions(lookups.staffTemplates ?? [], ["display_code"]),
    vehicles: buildOptions(lookups.vehicles ?? [], ["vehicle_no"]),
    staff: buildOptions(lookups.staff ?? [], ["employee_name", "username"]),
    properties: buildOptions(lookups.properties ?? [], ["property_name"]),
    subProperties: buildOptions(
      (lookups.subProperties ?? []).filter((item) => !formData.property_id || String(item?.property_id ?? item?.property?.unique_id ?? "") === formData.property_id),
      ["sub_property_name"]
    ),
    wasteTypes: buildOptions(lookups.wasteTypes ?? [], ["waste_type_name", "name"]),
    collectionPoints: buildOptions(
      (lookups.collectionPoints ?? []).filter((item) => {
        if (formData.panchayat_id) return String(item?.panchayat_id ?? item?.panchayat?.unique_id ?? "") === formData.panchayat_id;
        if (formData.ward_id) return String(item?.ward_id ?? item?.ward?.unique_id ?? "") === formData.ward_id;
        return true;
      }),
      ["cp_name", "collection_point_name", "name"]
    ),
  }), [formData.district_id, formData.city_id, formData.zone_id, formData.panchayat_id, formData.ward_id, formData.property_id, lookups]);

  const binOptionsFor = (collectionPointId: string) =>
    buildOptions(
      (lookups.bins ?? []).filter((bin) => String(bin?.collection_point_id ?? bin?.collection_point?.unique_id ?? "") === collectionPointId),
      ["bin_name"]
    );

  const setField = (field: keyof FormState) => (value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      // Cascade: district → clear city + everything below
      ...(field === "district_id" ? { city_id: "", zone_id: "", panchayat_id: "", ward_id: "" } : {}),
      // Cascade: city → clear zone + panchayat + ward
      ...(field === "city_id" ? { zone_id: "", panchayat_id: "", ward_id: "" } : {}),
      // Cascade: zone → clear ward
      ...(field === "zone_id" ? { ward_id: "" } : {}),
      // Mutual exclusion: panchayat ↔ ward
      ...(field === "panchayat_id" && value ? { ward_id: "" } : {}),
      ...(field === "ward_id" && value ? { panchayat_id: "" } : {}),
      // Cascade: property → clear sub-property
      ...(field === "property_id" ? { sub_property_id: "" } : {}),
    }));
    if (field === "panchayat_id" || field === "ward_id") {
      setStops([{ collection_point_id: "", bin_id: "", sequence: 1, is_active: true }]);
    }
  };

  const setStop = (index: number, patch: Partial<StopRow>) => {
    setStops((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const triggerWeight = Number(formData.trip_trigger_weight_kg);
    const maxCapacity = Number(formData.max_vehicle_capacity_kg);
    const validStops = stops.filter((stop) => stop.collection_point_id && stop.bin_id);

    const missingFields: string[] = [];
    if (!companyUniqueId) missingFields.push("Company");
    if (!projectId) missingFields.push("Project");
    if (!formData.district_id) missingFields.push("District");
    if (!formData.city_id) missingFields.push("City");
    if (!formData.staff_template_id) missingFields.push("Staff Template");
    if (!formData.vehicle_id) missingFields.push("Vehicle");
    if (!formData.supervisor_id) missingFields.push("Supervisor");
    if (!formData.property_id) missingFields.push("Property");
    if (!formData.sub_property_id) missingFields.push("Sub Property");
    if (!formData.waste_type_id) missingFields.push("Waste Type");
    if (!formData.scheduled_time) missingFields.push("Scheduled Time");
    if (missingFields.length) {
      Swal.fire(t("common.warning"), `Please fill: ${missingFields.join(", ")}`, "warning");
      return;
    }
    if (!formData.panchayat_id && !formData.ward_id) {
      Swal.fire(t("common.warning"), "Select either panchayat or ward.", "warning");
      return;
    }
    if (!Number.isFinite(triggerWeight) || !Number.isFinite(maxCapacity) || triggerWeight >= maxCapacity) {
      Swal.fire(t("common.warning"), "Trigger weight must be less than vehicle capacity.", "warning");
      return;
    }

    const payload = {
      company_id_input: companyUniqueId,
      project_id_input: projectId,
      ...formData,
      zone_id: formData.zone_id || null,
      panchayat_id: formData.panchayat_id || null,
      ward_id: formData.ward_id || null,
      trip_trigger_weight_kg: triggerWeight,
      max_vehicle_capacity_kg: maxCapacity,
      collection_points: validStops.map((stop, index) => ({
        ...stop,
        sequence: index + 1,
      })),
    };

    setSubmitting(true);
    try {
      if (isEdit && id) await tripPlanApi.update(id, payload);
      else await tripPlanApi.create(payload);
      Swal.fire(t("common.success"), isEdit ? t("common.updated_success") : t("common.added_success"), "success");
      navigate(listPath, { state: { companyUniqueId, projectId } });
    } catch (error: any) {
      Swal.fire(t("common.save_failed"), extractErrorMessage(error) ?? t("common.save_failed_desc"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard title={isEdit ? "Edit Trip Plan" : "New Trip Plan"} desc="Configure route geography, staff, vehicle, schedule, and stop list">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <Label>{t("admin.nav.company")}</Label>
              <select value={companyUniqueId} onChange={(e) => onCompanyChange(e.target.value)} disabled={Boolean(loggedInCompanyUniqueId) || (!isSuperAdmin && !loggedInCompanyUniqueId) || companies.length === 0} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">{t("common.select_item_placeholder", { item: t("admin.nav.company") })}</option>
                {companies.map((company) => <option key={company.value} value={company.value}>{company.label}</option>)}
              </select>
            </div>
            <div>
              <Label>{t("admin.nav.project")}</Label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!companyUniqueId || projects.length === 0} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">{t("common.select_item_placeholder", { item: t("admin.nav.project") })}</option>
                {projects.map((project) => <option key={project.value} value={project.value}>{project.label}</option>)}
              </select>
            </div>
            <div><Label>District</Label><Select value={formData.district_id} onChange={setField("district_id")} options={options.districts} disabled={loading || !projectId} /></div>
            <div><Label>City</Label><Select value={formData.city_id} onChange={setField("city_id")} options={options.cities} disabled={loading || !formData.district_id} /></div>
            <div><Label>Zone</Label><Select value={formData.zone_id} onChange={setField("zone_id")} options={options.zones} disabled={loading || !formData.city_id || Boolean(formData.panchayat_id)} /></div>
            <div><Label>PLB (Participating Local Bodies)</Label><Select value={formData.panchayat_id} onChange={setField("panchayat_id")} options={options.panchayats} disabled={loading || !formData.city_id || Boolean(formData.ward_id)} /></div>
            <div><Label>Ward</Label><Select value={formData.ward_id} onChange={setField("ward_id")} options={options.wards} disabled={loading || !formData.zone_id || Boolean(formData.panchayat_id)} /></div>
            <div><Label>Staff Template</Label><Select value={formData.staff_template_id} onChange={setField("staff_template_id")} options={options.staffTemplates} disabled={loading || !projectId} /></div>
            <div><Label>Vehicle</Label><Select value={formData.vehicle_id} onChange={setField("vehicle_id")} options={options.vehicles} disabled={loading || !projectId} /></div>
            <div><Label>Supervisor</Label><Select value={formData.supervisor_id} onChange={setField("supervisor_id")} options={options.staff} disabled={loading || !projectId} /></div>
            <div><Label>Property</Label><Select value={formData.property_id} onChange={setField("property_id")} options={options.properties} disabled={loading || !projectId} /></div>
            <div><Label>Sub Property</Label><Select value={formData.sub_property_id} onChange={setField("sub_property_id")} options={options.subProperties} disabled={loading || !formData.property_id} /></div>
            <div><Label>Waste Type</Label><Select value={formData.waste_type_id} onChange={setField("waste_type_id")} options={options.wasteTypes} disabled={loading || !projectId} /></div>
            <div><Label>Scheduled Time</Label><Input type="time" value={formData.scheduled_time} onChange={(e) => setField("scheduled_time")(e.target.value)} disabled={!projectId} /></div>
            <div><Label>Trigger Weight (kg)</Label><Input type="number" min={0} value={formData.trip_trigger_weight_kg} onChange={(e) => setField("trip_trigger_weight_kg")(e.target.value)} /></div>
            <div><Label>Max Vehicle Capacity (kg)</Label><Input type="number" min={0} value={formData.max_vehicle_capacity_kg} onChange={(e) => setField("max_vehicle_capacity_kg")(e.target.value)} /></div>
            <div><Label>Status</Label><Select value={formData.status} onChange={setField("status")} options={statusOptions} disabled={loading} /></div>
            <div><Label>Approval Status</Label><Select value={formData.approval_status} onChange={setField("approval_status")} options={approvalStatusOptions} disabled={loading} /></div>
          </div>


          <div className="flex justify-end gap-3">
            <button type="submit" disabled={submitting || loading} className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
            <button type="button" onClick={() => navigate(listPath, { state: { companyUniqueId, projectId } })} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
