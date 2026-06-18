import type { FormState, SelectOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { adminApi } from "@/helpers/admin/registry";
import {
  tripPlanCollectionPointApi,
  tripPlanApi,
  customerCreationApi,
  zoneApi,
  wardApi,
  panchayatApi,
} from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";
import { useCollectionPointLocationOptions } from "@/hooks/useCollectionPointLocationOptions";


const COLLECTION_TYPES: SelectOption[] = [
  { value: "bin_collection", label: "Bin Collection" },
  { value: "household_collection", label: "Household Collection" },
];


const extractError = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return null;
};

const buildOptions = (items: any[], valueKey: string, labelKeys: string[]): SelectOption[] =>
  items
    .map((item) => ({
      value: String(item?.[valueKey] ?? ""),
      label: labelKeys.map((k) => item?.[k]).find((v) => v) ?? item?.[valueKey] ?? "",
    }))
    .filter((o) => o.value);

const notEmpty = (v: string) => v && v !== "null" && v !== "undefined";

const normalizeCollectionType = (value: unknown): string => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("house")) return "household_collection";
  if (normalized.includes("bin")) return "bin_collection";
  return "";
};

const ensureOption = (options: SelectOption[], value: string, label?: string): SelectOption[] => {
  if (!value) return options;
  if (options.some((o) => o.value === value)) return options;
  return [...options, { value, label: label ?? value }];
};

export default function TripPlanCollectionPointForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const isEdit = Boolean(id);
  const routeState = location.state as {
    companyUniqueId?: string;
    projectId?: string;
    record?: any;
  } | null;

  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    setProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const { encScheduleMasters, encTripPlanCollectionPoints } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encScheduleMasters, encTripPlanCollectionPoints);

  const [form, setForm] = useState<FormState>({
    trip_plan_id: "",
    collection_type: "bin_collection",
    collection_point_id: "",
    bin_id: "",
    customer_id: "",
    sequence: "1",
    is_active: true,
  });

  const [saving, setSaving] = useState(false);
  const [tripPlanOptions, setTripPlanOptions] = useState<SelectOption[]>([]);
  const [binOptions, setBinOptions] = useState<SelectOption[]>([]);

  // ── Bin collection location (reuse existing hook) ──────────────────────────
  const locationOptions = useCollectionPointLocationOptions(companyUniqueId, projectId);
  // Keep a stable ref to call setters inside effects without ESLint dep issues
  const locationOptionsRef = useRef(locationOptions);
  locationOptionsRef.current = locationOptions;

  const collectionPointOptions = locationOptions.collectionPoints;

  // ── Household location state ───────────────────────────────────────────────
  const [hhZoneId, setHhZoneId] = useState("");
  const [hhWardId, setHhWardId] = useState("");
  const [hhPanchayatId, setHhPanchayatId] = useState("");
  const [hhZones, setHhZones] = useState<SelectOption[]>([]);
  const [hhWards, setHhWards] = useState<SelectOption[]>([]);
  const [hhPanchayats, setHhPanchayats] = useState<SelectOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<SelectOption[]>([]);

  // ── Pending IDs ────────────────────────────────────────────────────────────
  const [pendingProjectCandidates, setPendingProjectCandidates] = useState<{
    projectUniqueId: string; projectId: string; projectName: string;
  } | null>(null);
  const [pendingTripPlanId, setPendingTripPlanId] = useState("");
  const [pendingCollectionPointId, setPendingCollectionPointId] = useState("");
  const [pendingBinId, setPendingBinId] = useState("");
  const [pendingCustomerId, setPendingCustomerId] = useState("");
  const [savedCustomerName, setSavedCustomerName] = useState("");

  // Pending location (auto-filled from trip plan)
  const [pendingBinZoneId, setPendingBinZoneId] = useState("");
  const [pendingBinWardId, setPendingBinWardId] = useState("");
  const [pendingBinPanchayatId, setPendingBinPanchayatId] = useState("");
  const [pendingHhZoneId, setPendingHhZoneId] = useState("");
  const [pendingHhWardId, setPendingHhWardId] = useState("");
  const [pendingHhPanchayatId, setPendingHhPanchayatId] = useState("");

  // ── Load trip plans ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyUniqueId) return;
    const params: Record<string, string> = { company_id: companyUniqueId };
    if (projectId) params.project_id = projectId;
    tripPlanApi
      .readAll({ params })
      .then((data) =>
        setTripPlanOptions(
          buildOptions(normalizeList(data) as any[], "unique_id", ["display_code"]),
        ),
      )
      .catch(() => {});
  }, [companyUniqueId, projectId]);

  // ── Auto-fill location when trip plan is selected ──────────────────────────
  useEffect(() => {
    if (!form.trip_plan_id) return;
    tripPlanApi
      .read(form.trip_plan_id)
      .then((tp: any) => {
        // UniqueIdOrPkField returns unique_id strings; nested objects also carry unique_id
        const zoneId = String(tp.zone_id ?? tp.zone?.unique_id ?? "");
        const wardId = String(tp.ward_id ?? tp.ward?.unique_id ?? "");
        const panchayatId = String(tp.panchayat_id ?? tp.panchayat?.unique_id ?? "");

        if (notEmpty(panchayatId)) {
          setPendingBinPanchayatId(panchayatId);
          setPendingHhPanchayatId(panchayatId);
        } else if (notEmpty(zoneId)) {
          setPendingBinZoneId(zoneId);
          setPendingHhZoneId(zoneId);
          if (notEmpty(wardId)) {
            setPendingBinWardId(wardId);
            setPendingHhWardId(wardId);
          }
        }
      })
      .catch(() => {});
  }, [form.trip_plan_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load household zones + panchayats when company/project changes ─────────
  useEffect(() => {
    setHhZoneId("");
    setHhWardId("");
    setHhPanchayatId("");
    if (!companyUniqueId || !projectId) {
      setHhZones([]);
      setHhPanchayats([]);
      return;
    }
    const params = { company_id: companyUniqueId, project_id: projectId };
    Promise.all([zoneApi.readAll({ params }), panchayatApi.readAll({ params })])
      .then(([zRes, pRes]) => {
        setHhZones(buildOptions(normalizeList(zRes) as any[], "unique_id", ["zone_name"]));
        setHhPanchayats(
          buildOptions(normalizeList(pRes) as any[], "unique_id", ["panchayat_name"]),
        );
      })
      .catch(() => {
        setHhZones([]);
        setHhPanchayats([]);
      });
  }, [companyUniqueId, projectId]);

  // ── Load household wards when zone selected ────────────────────────────────
  useEffect(() => {
    setHhWardId("");
    if (!hhZoneId) {
      setHhWards([]);
      return;
    }
    wardApi
      .readAll({
        params: { company_id: companyUniqueId, project_id: projectId, zone_id: hhZoneId },
      })
      .then((res) =>
        setHhWards(buildOptions(normalizeList(res) as any[], "unique_id", ["ward_name"])),
      )
      .catch(() => setHhWards([]));
  }, [companyUniqueId, projectId, hhZoneId]);

  // ── Load customers filtered by household location ──────────────────────────
  useEffect(() => {
    if (!companyUniqueId || form.collection_type !== "household_collection") {
      setCustomerOptions([]);
      return;
    }
    const params: Record<string, string> = { company_id: companyUniqueId };
    if (projectId) params.project_id = projectId;
    if (hhPanchayatId) params.panchayat_id = hhPanchayatId;
    else if (hhWardId) params.ward_id = hhWardId;
    else if (hhZoneId) params.zone_id = hhZoneId;
    customerCreationApi
      .readAll({ params })
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : data?.results ?? [];
        setCustomerOptions(buildOptions(list, "unique_id", ["customer_name"]));
      })
      .catch(() => setCustomerOptions([]));
  }, [companyUniqueId, projectId, form.collection_type, hhZoneId, hhWardId, hhPanchayatId]);

  // ── Load bins when collection point selected ───────────────────────────────
  useEffect(() => {
    if (!form.collection_point_id) {
      setBinOptions([]);
      return;
    }
    const params: Record<string, string> = { collection_point_id: form.collection_point_id };
    if (companyUniqueId) params.company_id = companyUniqueId;
    adminApi.bins
      .readAll({ params })
      .then((data) =>
        setBinOptions(buildOptions(normalizeList(data) as any[], "unique_id", ["bin_name"])),
      )
      .catch(() => {});
  }, [form.collection_point_id, companyUniqueId]);

  // ── Load record for edit ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return;

    const applyRecord = (data: any) => {
      applyCompanyProjectFromRecord(data);
      setPendingProjectCandidates({
        projectUniqueId: String(data.project_unique_id ?? data.project?.unique_id ?? ""),
        projectId: String(data.project_id ?? ""),
        projectName: String(data.project_name ?? ""),
      });
      
      const tripPlanId = String(data.trip_plan?.unique_id ?? data.trip_plan_id ?? "");
      const cpId = String(data.collection_point?.unique_id ?? data.collection_point_id ?? "");
      const binId = String(data.bin?.unique_id ?? data.bin_id ?? "");
      const customerId = String(data.customer?.unique_id ?? data.customer_id ?? "");
      const customerName = String(data.customer?.customer_name ?? "");
      
      // Infer collection type from the data and from actual relationship fields
      let collectionType = normalizeCollectionType(data.collection_type);
      if (!collectionType) {
        if (notEmpty(customerId) && !notEmpty(binId) && !notEmpty(cpId)) {
          collectionType = "household_collection";
        } else if (notEmpty(binId) || notEmpty(cpId)) {
          collectionType = "bin_collection";
        }
      }
      if (!collectionType) {
        collectionType = "bin_collection";
      }
      
      // Set all form data directly
      setForm((f) => ({
        ...f,
        sequence: String(data.sequence ?? "1"),
        is_active: data.is_active !== false,
        collection_type: collectionType,
        trip_plan_id: notEmpty(tripPlanId) ? tripPlanId : "",
        collection_point_id: notEmpty(cpId) ? cpId : "",
        bin_id: notEmpty(binId) ? binId : "",
        customer_id: notEmpty(customerId) ? customerId : "",
      }));
      
      // Save customer name for display
      if (notEmpty(customerName)) {
        setSavedCustomerName(customerName);
      }
      
      // Extract household location fields if available
      if (collectionType === "household_collection") {
        const hhZoneId = String(data.zone?.unique_id ?? data.zone_id ?? "");
        const hhWardId = String(data.ward?.unique_id ?? data.ward_id ?? "");
        const hhPanchayatId = String(data.panchayat?.unique_id ?? data.panchayat_id ?? "");
        
        if (notEmpty(hhPanchayatId)) {
          setPendingHhPanchayatId(hhPanchayatId);
        } else {
          if (notEmpty(hhZoneId)) setPendingHhZoneId(hhZoneId);
          if (notEmpty(hhWardId)) setPendingHhWardId(hhWardId);
        }
      }
      
      // Extract bin collection location fields if available
      if (collectionType === "bin_collection") {
        const binZoneId = String(data.zone?.unique_id ?? data.zone_id ?? "");
        const binWardId = String(data.ward?.unique_id ?? data.ward_id ?? "");
        const binPanchayatId = String(data.panchayat?.unique_id ?? data.panchayat_id ?? "");
        
        if (notEmpty(binPanchayatId)) {
          setPendingBinPanchayatId(binPanchayatId);
        } else if (notEmpty(binZoneId)) {
          setPendingBinZoneId(binZoneId);
          if (notEmpty(binWardId)) {
            setPendingBinWardId(binWardId);
          }
        }
      }
      
      // Still use pending states for IDs/dropdown resolution
      if (notEmpty(tripPlanId)) setPendingTripPlanId(tripPlanId);
      if (notEmpty(cpId)) setPendingCollectionPointId(cpId);
      if (notEmpty(binId)) setPendingBinId(binId);
      if (notEmpty(customerId)) setPendingCustomerId(customerId);
    };

    const stateRecord = routeState?.record;
    if (stateRecord) {
      applyRecord(stateRecord);
    } else {
      tripPlanCollectionPointApi
        .read(id)
        .then((data: any) => applyRecord(data))
        .catch(() => {});
    }
  }, [isEdit, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush project ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingProjectCandidates || projects.length === 0) return;
    const { projectUniqueId, projectId: rawId, projectName } = pendingProjectCandidates;
    let match = projects.find((p) => projectUniqueId && p.value === projectUniqueId);
    if (!match) match = projects.find((p) => rawId && p.value === rawId);
    if (!match && projectName)
      match = projects.find((p) => p.label.toLowerCase() === projectName.toLowerCase());
    if (match) setProjectId(match.value);
    setPendingProjectCandidates(null);
  }, [projects, pendingProjectCandidates, setProjectId]);

  // ── Flush trip plan ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingTripPlanId || tripPlanOptions.length === 0) return;
    if (tripPlanOptions.some((o) => o.value === pendingTripPlanId)) {
      setForm((f) => ({ ...f, trip_plan_id: pendingTripPlanId }));
      setPendingTripPlanId("");
    }
  }, [pendingTripPlanId, tripPlanOptions]);

  // ── Flush bin location: zone → triggers ward + CP load ────────────────────
  const { zones: binZones, wards: binWards, panchayats: binPanchayats } = locationOptions;

  useEffect(() => {
    if (!pendingBinZoneId || binZones.length === 0) return;
    if (binZones.some((z) => z.value === pendingBinZoneId)) {
      locationOptionsRef.current.setZoneId(pendingBinZoneId);
      setPendingBinZoneId("");
    }
  }, [pendingBinZoneId, binZones]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingBinWardId || binWards.length === 0) return;
    if (binWards.some((w) => w.value === pendingBinWardId)) {
      locationOptionsRef.current.setWardId(pendingBinWardId);
      setPendingBinWardId("");
    }
  }, [pendingBinWardId, binWards]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingBinPanchayatId || binPanchayats.length === 0) return;
    if (binPanchayats.some((p) => p.value === pendingBinPanchayatId)) {
      locationOptionsRef.current.setPanchayatId(pendingBinPanchayatId);
      setPendingBinPanchayatId("");
    }
  }, [pendingBinPanchayatId, binPanchayats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush household location ───────────────────────────────────────────────
  useEffect(() => {
    if (!pendingHhZoneId || hhZones.length === 0) return;
    if (hhZones.some((z) => z.value === pendingHhZoneId)) {
      setHhZoneId(pendingHhZoneId);
      setHhPanchayatId("");
      setPendingHhZoneId("");
    }
  }, [pendingHhZoneId, hhZones]);

  useEffect(() => {
    if (!pendingHhWardId || hhWards.length === 0) return;
    if (hhWards.some((w) => w.value === pendingHhWardId)) {
      setHhWardId(pendingHhWardId);
      setPendingHhWardId("");
    }
  }, [pendingHhWardId, hhWards]);

  useEffect(() => {
    if (!pendingHhPanchayatId || hhPanchayats.length === 0) return;
    if (hhPanchayats.some((p) => p.value === pendingHhPanchayatId)) {
      setHhPanchayatId(pendingHhPanchayatId);
      setHhZoneId("");
      setHhWardId("");
      setPendingHhPanchayatId("");
    }
  }, [pendingHhPanchayatId, hhPanchayats]);

  // ── Flush collection point ─────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingCollectionPointId || collectionPointOptions.length === 0) return;
    if (collectionPointOptions.some((o) => o.value === pendingCollectionPointId)) {
      setForm((f) => ({ ...f, collection_point_id: pendingCollectionPointId }));
      setPendingCollectionPointId("");
    }
  }, [pendingCollectionPointId, collectionPointOptions]);

  useEffect(() => {
    if (locationOptions.loading || !form.collection_point_id) return;
    if (!collectionPointOptions.some((option) => option.value === form.collection_point_id)) {
      setForm((current) => ({ ...current, collection_point_id: "", bin_id: "" }));
    }
  }, [collectionPointOptions, form.collection_point_id, locationOptions.loading]);

  // ── Flush bin ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingBinId || binOptions.length === 0) return;
    if (binOptions.some((o) => o.value === pendingBinId)) {
      setForm((f) => ({ ...f, bin_id: pendingBinId }));
      setPendingBinId("");
    }
  }, [pendingBinId, binOptions]);

  // ── Flush customer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingCustomerId || customerOptions.length === 0) return;
    if (customerOptions.some((o) => o.value === pendingCustomerId)) {
      setForm((f) => ({ ...f, customer_id: pendingCustomerId }));
      setPendingCustomerId("");
    }
  }, [pendingCustomerId, customerOptions]);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const set = (field: keyof FormState, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleCollectionTypeChange = (value: string) => {
    setForm((f) => ({
      ...f,
      collection_type: value,
      collection_point_id: "",
      bin_id: "",
      customer_id: "",
    }));
  };

  const handleHhZoneChange = (value: string) => {
    setHhZoneId(value);
    setHhWardId("");
    setHhPanchayatId("");
    setForm((f) => ({ ...f, customer_id: "" }));
  };

  const handleHhWardChange = (value: string) => {
    setHhWardId(value);
    setHhPanchayatId("");
    setForm((f) => ({ ...f, customer_id: "" }));
  };

  const handleHhPanchayatChange = (value: string) => {
    setHhPanchayatId(value);
    if (value) {
      setHhZoneId("");
      setHhWardId("");
    }
    setForm((f) => ({ ...f, customer_id: "" }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.trip_plan_id) {
      Swal.fire(t("common.error"), "Trip Plan is required.", "warning");
      return;
    }
    if (form.collection_type === "bin_collection" && (!form.collection_point_id || !form.bin_id)) {
      Swal.fire(
        t("common.error"),
        "Collection Point and Bin are required for Bin Collection.",
        "warning",
      );
      return;
    }
    if (form.collection_type === "household_collection" && !form.customer_id) {
      Swal.fire(t("common.error"), "Customer is required for Household Collection.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        trip_plan_id: form.trip_plan_id,
        collection_type: form.collection_type,
        sequence: parseInt(form.sequence, 10) || 1,
        is_active: form.is_active,
      };
      if (form.collection_type === "bin_collection") {
        payload.collection_point_id = form.collection_point_id;
        payload.bin_id = form.bin_id;
        payload.customer_id = null;
      } else {
        payload.customer_id = form.customer_id;
        payload.collection_point_id = null;
        payload.bin_id = null;
      }
      if (isEdit && id) {
        await tripPlanCollectionPointApi.update(id, payload);
      } else {
        await tripPlanCollectionPointApi.create(payload);
      }
      Swal.fire({
        icon: "success",
        title: isEdit ? t("common.updated") : t("common.created"),
        timer: 1500,
        showConfirmButton: false,
      });
      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error) {
      Swal.fire(t("common.error"), extractError(error) ?? t("common.save_failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const collectionTypeValue =
    form.collection_type === "bin_collection" || form.collection_type === "household_collection"
      ? form.collection_type
      : form.customer_id
      ? "household_collection"
      : form.collection_point_id || form.bin_id
      ? "bin_collection"
      : "";

  const isBinCollection = collectionTypeValue === "bin_collection";

  // Always include the saved customer in the dropdown even if the current
  // location filter excludes them (e.g. panchayat-filtered reload).
  const resolvedCustomerOptions = ensureOption(customerOptions, form.customer_id, savedCustomerName);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      <ComponentCard
        title={isEdit ? "Edit Trip Plan Collection Point" : "Add Trip Plan Collection Point"}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Collection Type + Trip Plan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Collection Type <span className="text-red-500">*</span></Label>
              <Select
                options={COLLECTION_TYPES}
                value={collectionTypeValue}
                onChange={handleCollectionTypeChange}
                placeholder="Select Collection Type"
              />
            </div>
            <div>
              <Label>Trip Plan <span className="text-red-500">*</span></Label>
              <Select
                options={tripPlanOptions}
                value={form.trip_plan_id}
                onChange={(v) => {
                  set("trip_plan_id", v);
                  // Clear selections so they re-resolve from the new trip plan's location
                  setForm((f) => ({ ...f, trip_plan_id: v, collection_point_id: "", bin_id: "", customer_id: "" }));
                }}
                placeholder="Select Trip Plan"
              />
            </div>
          </div>

          {/* ── Bin Collection fields ──────────────────────────────────────── */}
          {isBinCollection && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Select
                    options={locationOptions.zones}
                    value={locationOptions.zoneId}
                    onChange={locationOptions.setZoneId}
                    placeholder="Select Zone"
                  />
                </div>
                <div>
                  <Label>Ward</Label>
                  <Select
                    options={locationOptions.wards}
                    value={locationOptions.wardId}
                    onChange={locationOptions.setWardId}
                    placeholder="Select Ward"
                    disabled={!locationOptions.zoneId}
                  />
                </div>
                <div>
                  <Label>Panchayat</Label>
                  <Select
                    options={locationOptions.panchayats}
                    value={locationOptions.panchayatId}
                    onChange={locationOptions.setPanchayatId}
                    placeholder="Select Panchayat (rural)"
                  />
                </div>
                <div>
                  <Label>Collection Point <span className="text-red-500">*</span></Label>
                  <Select
                    options={collectionPointOptions}
                    value={form.collection_point_id}
                    onChange={(v) => {
                      set("collection_point_id", v);
                      set("bin_id", "");
                    }}
                    placeholder={
                      locationOptions.loading ? "Loading..." : "Select Collection Point"
                    }
                    disabled={locationOptions.loading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bin <span className="text-red-500">*</span></Label>
                  <Select
                    options={binOptions}
                    value={form.bin_id}
                    onChange={(v) => set("bin_id", v)}
                    placeholder={
                      form.collection_point_id ? "Select Bin" : "Select Collection Point first"
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* ── Household Collection fields ────────────────────────────────── */}
          {!isBinCollection && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Zone</Label>
                <Select
                  options={hhZones}
                  value={hhZoneId}
                  onChange={handleHhZoneChange}
                  placeholder="Select Zone"
                />
              </div>
              <div>
                <Label>Ward</Label>
                <Select
                  options={hhWards}
                  value={hhWardId}
                  onChange={handleHhWardChange}
                  placeholder="Select Ward"
                  disabled={!hhZoneId}
                />
              </div>
              <div>
                <Label>Panchayat</Label>
                <Select
                  options={hhPanchayats}
                  value={hhPanchayatId}
                  onChange={handleHhPanchayatChange}
                  placeholder="Select Panchayat (rural)"
                />
              </div>
              <div>
                <Label>Customer <span className="text-red-500">*</span></Label>
                <Select
                  options={resolvedCustomerOptions}
                  value={form.customer_id}
                  onChange={(v) => set("customer_id", v)}
                  placeholder={
                    !companyUniqueId
                      ? "Select company first"
                      : resolvedCustomerOptions.length === 0
                        ? "No customers found"
                        : "Select Customer"
                  }
                  disabled={!companyUniqueId}
                />
              </div>
            </div>
          )}

          {/* Sequence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sequence <span className="text-red-500">*</span></Label>
              <input
                type="number"
                min={1}
                value={form.sequence}
                onChange={(e) => set("sequence", e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(LIST_PATH, { state: { companyUniqueId, projectId } })}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
