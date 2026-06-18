import type { DailyTripAssignmentRecord } from "./types";
import type { FormState, SelectOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { MultiSelect } from "primereact/multiselect";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import { adminApi } from "@/helpers/admin/registry";
import { dailyTripAssignmentApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { normalizeList } from "@/utils/forms";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Static options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: SelectOption[] = [
  { value: "Scheduled", label: "Scheduled" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildOptions = (items: any[], labelKey: string | string[]): SelectOption[] =>
  items
    .map((item) => {
      const keys = Array.isArray(labelKey) ? labelKey : [labelKey];
      const label = keys.map((key) => item?.[key]).find((v) => v !== undefined && v !== null && v !== "");
      const value = String(item?.unique_id ?? item?.id ?? "");
      return { value, label: String(label ?? item?.display_code ?? item?.name ?? value) };
    })
    .filter((o) => o.value);

const toEntityId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return toEntityId(record.unique_id ?? record.id ?? record.value);
  }
  return String(value).trim();
};

const filterByCompanyProject = (items: any[], companyId: string, projectId: string) => {
  const hasContext = items.some((item) => item?.company_id || item?.company_unique_id);
  if (!hasContext) return items;
  return items.filter((item) => {
    const c = toEntityId(item?.company_id ?? item?.company_unique_id);
    const p = toEntityId(item?.project_id ?? item?.project_unique_id);
    return (!companyId || c === companyId) && (!projectId || p === projectId);
  });
};

const ensureOption = (options: SelectOption[], value: string, label?: string): SelectOption[] => {
  if (!value) return options;
  if (options.some((o) => String(o.value) === value)) return options;
  return [...options, { value, label: label ?? value }];
};

const getZoneIdFromRecord = (record: any): string =>
  toEntityId(
    record?.zone?.unique_id ??
      record?.zone_id ??
      record?.ward?.zone_id ??
      record?.ward?.zone?.unique_id ??
      record?.trip_plan?.zone?.unique_id ??
      record?.trip_plan?.zone_id ??
      record?.trip_plan?.ward?.zone_id
  );

const getZoneLabelFromRecord = (record: any): string | undefined =>
  String(
    record?.zone?.zone_name ??
      record?.zone?.name ??
      record?.ward?.zone_name ??
      record?.ward?.zone?.zone_name ??
      record?.trip_plan?.zone?.zone_name ??
      record?.trip_plan?.zone?.name ??
      record?.trip_plan?.ward?.zone_name ??
      ""
  ).trim() || undefined;

const getWardIdFromRecord = (record: any): string =>
  toEntityId(record?.ward?.unique_id ?? record?.ward_id ?? record?.trip_plan?.ward?.unique_id ?? record?.trip_plan?.ward_id);

const getWardLabelFromRecord = (record: any): string | undefined =>
  String(
    record?.ward?.ward_name ??
      record?.ward?.name ??
      record?.trip_plan?.ward?.ward_name ??
      record?.trip_plan?.ward?.name ??
      ""
  ).trim() || undefined;

const extractError = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string") return data.error;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyTripAssignmentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const isEdit = Boolean(id);

  const {
    companyUniqueId, projectId, projects, companies,
    isSuperAdmin, loggedInCompanyUniqueId,
    setProjectId, onCompanyChange, applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const { encScheduleMasters, encDailyTripAssignment } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encDailyTripAssignment);

  // ── Form & record state ───────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormState>({
    trip_plan_id: "",
    staff_template_id: "",
    alt_staff_template_id: "",
    zone_id: "",
    panchayat_id: "",
    ward_id: "",
    waste_type_id: "",
    household_waste_type_ids: [],
    trip_date: "",
    scheduled_time: "",
    status: "Scheduled",
    remarks: "",
  });

  // collection-type flags derived from the selected trip plan
  const [hasBinStops, setHasBinStops] = useState(true);
  const [hasHouseholdStops, setHasHouseholdStops] = useState(false);

  const [recordData, setRecordData] = useState<DailyTripAssignmentRecord | null>(null);
  // Holds raw record until lookups are ready — avoids Radix Select blank-value bug
  const [pendingRecord, setPendingRecord] = useState<DailyTripAssignmentRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Dropdown state ────────────────────────────────────────────────────────
  const [fetching, setFetching] = useState(false);
  const [tripPlanRecords, setTripPlanRecords] = useState<any[]>([]);
  const [wardRecords, setWardRecords] = useState<any[]>([]);
  const [tripPlan, setTripPlan] = useState<SelectOption[]>([]);
  const [staffTemplates, setStaffTemplates] = useState<SelectOption[]>([]);
  const [zones, setZones] = useState<SelectOption[]>([]);
  const [panchayats, setPanchayats] = useState<SelectOption[]>([]);
  const [wasteTypes, setWasteTypes] = useState<SelectOption[]>([]);
  const [altStaffCache, setAltStaffCache] = useState<any[]>([]);

  // ── Step 1: Load record — store in pendingRecord, do NOT hydrate form yet ─
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    (dailyTripAssignmentApi.read(id) as Promise<DailyTripAssignmentRecord>)
      .then((res) => {
        if (cancelled) return;
        setRecordData(res);
        setPendingRecord(res);                                     // defer form fill
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
        setLoadingRecord(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? "Failed to load record" });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord, t]);

  // ── Load dropdowns when company + project are set ─────────────────────────
  useEffect(() => {
    if (!companyUniqueId || !projectId) {
      setTripPlan([]);
      setStaffTemplates([]);
      setZones([]);
      setPanchayats([]);
      setTripPlanRecords([]);
      setWardRecords([]);
      setAltStaffCache([]);
      return;
    }
    let cancelled = false;
    setFetching(true);
    const params = { company_id: companyUniqueId, project_id: projectId };
    Promise.all([
      adminApi.tripPlans.readAll({ params }),
      adminApi.staffTemplateCreation.readAll({ params }),
      adminApi.zones.readAll({ params }),
      adminApi.panchayats.readAll({ params }),
      adminApi.wards.readAll({ params }),
      adminApi.wasteTypes.readAll({ params }),
      adminApi.alternativeStaffTemplate.readAll({ params }),
    ])
      .then(([tripRes, staffRes, zoneRes, panchRes, wardRes, wtRes, altRes]) => {
        if (cancelled) return;
        const tripRows = filterByCompanyProject(normalizeList(tripRes), companyUniqueId, projectId);
        const wardRows = filterByCompanyProject(normalizeList(wardRes), companyUniqueId, projectId);
        setTripPlanRecords(tripRows);
        setWardRecords(wardRows);
        setTripPlan(buildOptions(tripRows, "display_code"));
        setStaffTemplates(buildOptions(filterByCompanyProject(normalizeList(staffRes), companyUniqueId, projectId), "display_code"));
        setZones(buildOptions(filterByCompanyProject(normalizeList(zoneRes), companyUniqueId, projectId), ["zone_name", "name"]));
        setPanchayats(buildOptions(filterByCompanyProject(normalizeList(panchRes), companyUniqueId, projectId), "panchayat_name"));
        setWasteTypes(buildOptions(normalizeList(wtRes), ["waste_type_name", "name"]));
        setAltStaffCache(normalizeList(altRes));
      })
      .catch((err: any) => Swal.fire(t("common.error"), extractError(err) ?? t("common.load_failed"), "error"))
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [companyUniqueId, projectId, t]);

  // ── Step 2: Hydrate form once dropdowns are ready ─────────────────────────
  // This fires after the lookup effect resolves and populates at least one list.
  // Using tripPlan.length > 0 as the "lookups ready" signal (same principle as
  // tripPlanForm.tsx) so the Select components always receive their value WITH
  // the matching option present — preventing the Radix blank-value bug.
  useEffect(() => {
    if (!pendingRecord) return;
    const lookupsReady = tripPlan.length > 0 || staffTemplates.length > 0 ||
      zones.length > 0 || panchayats.length > 0 || wardRecords.length > 0 ||
      wasteTypes.length > 0;
    if (!lookupsReady) return;

    const rec = pendingRecord;
    const tripPlanId = rec.trip_plan?.unique_id ?? String(rec.trip_plan_id ?? "");
    const plan = tripPlanRecords.find((item) => toEntityId(item?.unique_id ?? item?.id) === tripPlanId);

    // Restore collection type flags from the saved record
    const ct = rec.collection_types;
    const recHasBin = ct ? ct.has_bin : (rec.trip_plan?.has_bin ?? true);
    const recHasHousehold = ct ? ct.has_household : (rec.trip_plan?.has_household ?? false);
    setHasBinStops(recHasBin || (!recHasBin && !recHasHousehold));
    setHasHouseholdStops(recHasHousehold);

    setFormData({
      trip_plan_id: tripPlanId,
      staff_template_id: rec.staff_template?.unique_id ?? String(rec.staff_template_id ?? ""),
      alt_staff_template_id: "",
      zone_id: getZoneIdFromRecord(rec) || getZoneIdFromRecord(plan),
      panchayat_id: rec.panchayat?.unique_id ?? String(rec.panchayat_id ?? ""),
      ward_id: getWardIdFromRecord(rec) || getWardIdFromRecord(plan),
      waste_type_id: (rec.waste_type as any)?.unique_id ?? String(rec.waste_type_id ?? ""),
      household_waste_type_ids: (rec.household_waste_types ?? [])
        .map((wt: any) => String(wt?.unique_id ?? ""))
        .filter(Boolean),
      trip_date: rec.trip_date ?? "",
      scheduled_time: rec.scheduled_time ?? "",
      status: rec.status ?? "Scheduled",
      remarks: String(rec.remarks ?? ""),
    });
    setPendingRecord(null);   // clear so this effect doesn't re-fire
  }, [pendingRecord, tripPlan, tripPlanRecords, staffTemplates, zones, panchayats, wardRecords, wasteTypes]);

  const handleTripPlanChange = (value: string) => {
    const plan = tripPlanRecords.find((item) => toEntityId(item?.unique_id ?? item?.id) === value);

    // Derive collection types from the plan's collection points
    const stops: any[] = plan?.plan_collection_points ?? [];
    const hasBin = stops.some((s: any) => s?.collection_type === "bin_collection");
    const hasHousehold = stops.some((s: any) => s?.collection_type === "household_collection");
    setHasBinStops(hasBin || (!hasBin && !hasHousehold)); // default to bin if unknown
    setHasHouseholdStops(hasHousehold);

    setFormData((prev) => {
      const next = { ...prev, trip_plan_id: value };
      if (!plan) return next;

      const planStaff = toEntityId(plan?.staff_template?.unique_id ?? plan?.staff_template_id);
      const planWaste = toEntityId(plan?.waste_type?.unique_id ?? plan?.waste_type_id);
      const planPanchayat = toEntityId(plan?.panchayat?.unique_id ?? plan?.panchayat_id);
      const planWard = getWardIdFromRecord(plan);
      const planZone = getZoneIdFromRecord(plan);

      if (planStaff) next.staff_template_id = planStaff;
      if (planWaste && hasBin) next.waste_type_id = planWaste;
      if (planZone) next.zone_id = planZone;
      if (planPanchayat) {
        next.panchayat_id = planPanchayat;
        next.ward_id = "";
      }
      if (planWard) {
        next.ward_id = planWard;
        next.panchayat_id = "";
      }
      if (plan?.scheduled_time) next.scheduled_time = String(plan.scheduled_time).slice(0, 5);
      return next;
    });
  };

  const handleZoneChange = (value: string) => {
    setFormData((prev) => ({ ...prev, zone_id: value, ward_id: "" }));
  };

  // ── Effective alt-staff resolution ───────────────────────────────────────
  const resolvedAltStaff = useMemo(() => {
    if (!formData.staff_template_id || !formData.trip_date) return null;
    return altStaffCache.find((alt) => {
      const templateId = String(alt?.staff_template?.unique_id ?? alt?.staff_template ?? alt?.staff_template_id ?? "");
      return templateId === formData.staff_template_id &&
        alt.from_date <= formData.trip_date &&
        formData.trip_date <= alt.to_date;
    }) ?? null;
  }, [formData.staff_template_id, formData.trip_date, altStaffCache]);

  // ── Alt staff options filtered by selected staff template ────────────────
  const altStaffOptions = useMemo<SelectOption[]>(() => {
    if (!formData.staff_template_id) return [];
    return altStaffCache
      .filter((alt) => {
        const templateId = String(alt?.staff_template?.unique_id ?? alt?.staff_template ?? alt?.staff_template_id ?? "");
        return templateId === formData.staff_template_id;
      })
      .map((alt) => ({
        value: String(alt?.unique_id ?? ""),
        label: String(alt?.display_code ?? alt?.unique_id ?? ""),
      }))
      .filter((o) => o.value);
  }, [formData.staff_template_id, altStaffCache]);

  // ── Ensure saved values appear in option lists ────────────────────────────
  const resolvedTripPlan = useMemo(() =>
    ensureOption(tripPlan, formData.trip_plan_id, recordData?.trip_plan?.display_code),
    [tripPlan, formData.trip_plan_id, recordData]
  );
  const resolvedStaffTemplates = useMemo(() =>
    ensureOption(staffTemplates, formData.staff_template_id, recordData?.staff_template?.display_code),
    [staffTemplates, formData.staff_template_id, recordData]
  );
  const resolvedAltStaffOptions = useMemo(() =>
    ensureOption(
      altStaffOptions,
      formData.alt_staff_template_id,
      recordData?.effective_staff?.display_code,
    ),
    [altStaffOptions, formData.alt_staff_template_id, recordData]
  );
  const resolvedPanchayats = useMemo(() =>
    ensureOption(panchayats, formData.panchayat_id, recordData?.panchayat?.panchayat_name ?? recordData?.panchayat?.name as string | undefined),
    [panchayats, formData.panchayat_id, recordData]
  );
  const resolvedZones = useMemo(() =>
    ensureOption(
      zones,
      formData.zone_id,
      getZoneLabelFromRecord(recordData) ||
        getZoneLabelFromRecord(tripPlanRecords.find((item) => toEntityId(item?.unique_id ?? item?.id) === formData.trip_plan_id))
    ),
    [zones, formData.zone_id, formData.trip_plan_id, recordData, tripPlanRecords]
  );
  const resolvedWards = useMemo(() => {
    const filtered = wardRecords.filter((ward) => {
      if (!formData.zone_id) return true;
      return toEntityId(ward?.zone_id ?? ward?.zone) === formData.zone_id;
    });
    const options = buildOptions(filtered.length ? filtered : wardRecords, ["ward_name", "name"]);
    return ensureOption(
      options,
      formData.ward_id,
      getWardLabelFromRecord(recordData) ||
        getWardLabelFromRecord(tripPlanRecords.find((item) => toEntityId(item?.unique_id ?? item?.id) === formData.trip_plan_id))
    );
  }, [formData.zone_id, formData.ward_id, formData.trip_plan_id, recordData, tripPlanRecords, wardRecords]);
  const resolvedWasteTypes = useMemo(() =>
    ensureOption(wasteTypes, formData.waste_type_id, (recordData?.waste_type as any)?.waste_type_name ?? recordData?.waste_type?.name as string | undefined),
    [wasteTypes, formData.waste_type_id, recordData]
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const binWasteMissing = hasBinStops && !formData.waste_type_id;
    const hhWasteMissing = hasHouseholdStops && formData.household_waste_type_ids.length === 0;
    if (!formData.trip_plan_id || !formData.staff_template_id ||
      (!formData.panchayat_id && !formData.ward_id) ||
      binWasteMissing || hhWasteMissing ||
      !formData.trip_date || !formData.scheduled_time) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }

    const payload: Record<string, unknown> = {
      trip_plan_id: formData.trip_plan_id,
      staff_template_id: formData.staff_template_id,
      panchayat_id: formData.panchayat_id || undefined,
      ward_id: formData.ward_id || undefined,
      waste_type_id: hasBinStops ? formData.waste_type_id : undefined,
      household_waste_type_ids: hasHouseholdStops ? formData.household_waste_type_ids : [],
      trip_date: formData.trip_date,
      scheduled_time: formData.scheduled_time,
      status: formData.status,
      remarks: formData.remarks || undefined,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await dailyTripAssignmentApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await dailyTripAssignmentApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }
      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (err: any) {
      Swal.fire(t("common.save_failed"), extractError(err) ?? t("common.save_failed_desc"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = (field: keyof FormState) => (value: string) =>
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "staff_template_id" ? { alt_staff_template_id: "" } : {}),
    }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <ComponentCard
        title={isEdit ? "Edit Trip Assignment" : "New Trip Assignment"}
        desc="Schedule a daily trip with vehicle, staff, route, and waste collection details"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Trip Date */}
            <div>
              <Label>Trip Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={formData.trip_date}
                onChange={(e) => set("trip_date")(e.target.value)}
                disabled={!projectId}
                required
              />
            </div>

            {/* Scheduled Time */}
            <div>
              <Label>Scheduled Time <span className="text-red-500">*</span></Label>
              <Input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => set("scheduled_time")(e.target.value)}
                disabled={!projectId}
                required
              />
            </div>

            {/* Trip Plan */}
            <div>
              <Label>Trip Plan <span className="text-red-500">*</span></Label>
              <Select
                value={formData.trip_plan_id}
                onChange={handleTripPlanChange}
                options={resolvedTripPlan}
                placeholder="Select trip plan"
                disabled={fetching || !projectId}
              />
            </div>

            {/* Staff Template */}
            <div>
              <Label>Staff Template <span className="text-red-500">*</span></Label>
              <Select
                value={formData.staff_template_id}
                onChange={set("staff_template_id")}
                options={resolvedStaffTemplates}
                placeholder="Select staff template"
                disabled={fetching || !projectId}
              />
            </div>

            {/* Alternative Staff Template */}
            <div className="md:col-span-2">
              <Label>
                Alternative Staff Template{" "}
                <span className="text-xs font-normal text-gray-400">(Optional — auto-resolved from date range if left blank)</span>
              </Label>
              <Select
                value={formData.alt_staff_template_id}
                onChange={set("alt_staff_template_id")}
                options={resolvedAltStaffOptions}
                placeholder="Select staff template first"
                disabled={fetching || !projectId || !formData.staff_template_id}
              />
            </div>

            {/* Effective Staff Banner */}
            {formData.staff_template_id && formData.trip_date && (
              <div className="md:col-span-2">
                <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  resolvedAltStaff
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-green-300 bg-green-50 text-green-800"
                }`}>
                  {resolvedAltStaff
                    ? `Alt staff active: ${resolvedAltStaff.display_code ?? resolvedAltStaff.unique_id}`
                    : `Base staff template: ${staffTemplates.find((s) => s.value === formData.staff_template_id)?.label ?? ""}`}
                </div>
              </div>
            )}

            {/* Zone */}
            <div>
              <Label>Zone</Label>
              <Select
                value={formData.zone_id}
                onChange={handleZoneChange}
                options={resolvedZones}
                placeholder="Select zone"
                disabled={fetching || !projectId}
              />
            </div>

            {/* Ward */}
            <div>
              <Label>Ward</Label>
              <Select
                value={formData.ward_id}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    ward_id: value,
                    panchayat_id: value ? "" : prev.panchayat_id,
                  }))
                }
                options={resolvedWards}
                placeholder="Select ward"
                disabled={fetching || !projectId || Boolean(formData.panchayat_id)}
              />
            </div>

            {/* Panchayat */}
            <div>
              <Label>PLB (Participating Local Bodies) <span className="text-red-500">*</span></Label>
              <Select
                value={formData.panchayat_id}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    panchayat_id: value,
                    ward_id: value ? "" : prev.ward_id,
                  }))
                }
                options={resolvedPanchayats}
                placeholder="Select PLB"
                disabled={fetching || !projectId || Boolean(formData.ward_id)}
              />
            </div>

            {/* Waste Type — single for bin, multi for household */}
            {hasBinStops && (
              <div>
                <Label>
                  Bin Collection Waste Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.waste_type_id}
                  onChange={set("waste_type_id")}
                  options={resolvedWasteTypes}
                  placeholder="Select waste type"
                  disabled={fetching}
                />
              </div>
            )}

            {hasHouseholdStops && (
              <div className={hasBinStops ? "" : "md:col-span-1"}>
                <Label>
                  Household Waste Types <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-gray-400">(select one or more)</span>
                </Label>
                <MultiSelect
                  value={formData.household_waste_type_ids}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      household_waste_type_ids: Array.isArray(e.value) ? e.value.map(String) : [],
                    }))
                  }
                  options={wasteTypes}
                  optionLabel="label"
                  optionValue="value"
                  maxSelectedLabels={3}
                  placeholder="Select waste types"
                  disabled={fetching}
                  className="!flex !h-10 !w-full !items-center !rounded-md !border !border-gray-300 !bg-white !px-3 !py-2 !text-sm !shadow-none focus:!ring-2 focus:!ring-blue-500 disabled:!opacity-50"
                  pt={{
                    labelContainer: { className: "!flex !flex-1 !items-center !overflow-hidden" },
                    label: { className: "!m-0 !block !truncate !p-0 !text-sm !leading-5 !text-gray-900" },
                    trigger: { className: "!ml-2 !flex !h-4 !w-4 !shrink-0 !items-center !justify-center !text-gray-500" },
                    dropdownIcon: { className: "!h-4 !w-4 !opacity-50" },
                  }}
                />
              </div>
            )}

            {/* Status — edit only */}
            {isEdit && (
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onChange={set("status")}
                  options={STATUS_OPTIONS}
                  placeholder="Select status"
                />
              </div>
            )}

            {/* Remarks */}
            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <textarea
                value={formData.remarks}
                onChange={(e) => set("remarks")(e.target.value)}
                rows={3}
                placeholder="Optional remarks..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || loadingRecord || fetching}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => navigate(LIST_PATH, { state: { companyUniqueId, projectId } })}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
