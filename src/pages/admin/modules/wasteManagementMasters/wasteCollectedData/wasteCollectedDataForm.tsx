import type { Customer } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import { customerCreationApi, wasteCollectionApi, dailyTripAssignmentApi, tripPlanApi, } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";


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

export default function WasteCollectedForm() {
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

  const { encWasteManagementMaster, encWasteCollectedData } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encWasteManagementMaster, encWasteCollectedData);

  /* ── form fields ── */
  const [customerId, setCustomerId] = useState("");
  const [tripAssignmentId, setTripAssignmentId] = useState("");
  // const [panchayatId, setPanchayatId] = useState("");
  // const [zoneId, setZoneId] = useState("");
  // const [wardId, setWardId] = useState("");
  const [wetWaste, setWetWaste] = useState(0);
  const [dryWaste, setDryWaste] = useState(0);
  const [mixedWaste, setMixedWaste] = useState(0);
  const totalQuantity = wetWaste + dryWaste + mixedWaste;

  /* ── dropdown data ── */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tripAssignments, setTripAssignments] = useState<{ value: string; label: string }[]>([]);
  // const [panchayats, setPanchayats] = useState<{ value: string; label: string }[]>([]);
  // const [zones, setZones] = useState<{ value: string; label: string }[]>([]);
  // const [wards, setWards] = useState<{ value: string; label: string }[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pending values stored from the raw API response — applied once their option
  // lists finish loading (same pendingRecord pattern as panchayat / customer creation)
  const [pendingProjectCandidates, setPendingProjectCandidates] = useState<{
    projectUniqueId: string;
    projectId: string;
    projectName: string;
  } | null>(null);
  const [pendingCustomerCandidates, setPendingCustomerCandidates] = useState<{
    customerUniqueId: string;
    customerId: string;
    customerName: string;
  } | null>(null);
  const [pendingTripAssignmentId, setPendingTripAssignmentId] = useState("");

  // Tracks whether the trip assignment was changed by the user (not by record loading)
  const userChangedTripRef = useRef(false);

  const resolveCustomerId = (c: Customer) => String(c.unique_id ?? c.id);
  /* ── load trip assignments filtered by company + project ── */
  useEffect(() => {
    if (!companyUniqueId) { setTripAssignments([]); return; }
    const params: Record<string, string> = { company_id: companyUniqueId };
    if (projectId) params.project_id = projectId;
    dailyTripAssignmentApi.readAll({ params })
      .then((res: any) => {
        const list: any[] = Array.isArray(res) ? res : res?.results ?? [];
        setTripAssignments(list.map((a) => ({ value: String(a.unique_id), label: String(a.unique_id) })));
      })
      .catch(() => {});
  }, [companyUniqueId, projectId]);

  /* ── load customers filtered by company + project ── */
  useEffect(() => {
    if (!companyUniqueId) { setCustomers([]); return; }
    let cancelled = false;
    setFetchingCustomers(true);
    const params: Record<string, string> = { company_id: companyUniqueId };
    if (projectId) params.project_id = projectId;
    customerCreationApi.readAll({ params })
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.results ?? [];
        setCustomers(list);
      })
      .catch(() => { if (!cancelled) Swal.fire(t("common.error"), t("common.load_failed"), "error"); })
      .finally(() => { if (!cancelled) setFetchingCustomers(false); });
    return () => { cancelled = true; };
  }, [companyUniqueId, projectId, t]);

  /* ── edit mode: load record ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    wasteCollectionApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        // Set waste values immediately (no async dependency)
        setWetWaste(Number(res.wet_waste) || 0);
        setDryWaste(Number(res.dry_waste) || 0);
        setMixedWaste(Number(res.mixed_waste) || 0);
        // Apply company (triggers project list load in the hook)
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
        // Store project & customer identifiers — re-applied once their option lists load
        setPendingProjectCandidates({
          projectUniqueId: String(res.project_unique_id ?? res.project?.unique_id ?? ""),
          projectId: String(res.project_id ?? ""),
          projectName: String(res.project_name ?? res.project?.name ?? ""),
        });
        setPendingCustomerCandidates({
          customerUniqueId: String(res.customer_unique_id ?? res.customer?.unique_id ?? ""),
          customerId: String(res.customer ?? res.customer_id ?? ""),
          customerName: String(res.customer_name ?? res.customer?.customer_name ?? ""),
        });
        const tripId = String(res.trip_assignment_id ?? res.trip_assignment?.unique_id ?? "");
        if (tripId && tripId !== "null") setPendingTripAssignmentId(tripId);     
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? t("common.load_failed") });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord, t]);

  /* ── flush project: re-apply after hook loads project list ── */
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

  /* ── flush trip assignment: re-apply after list loads ── */
  useEffect(() => {
    if (!pendingTripAssignmentId || tripAssignments.length === 0) return;
    if (tripAssignments.some((a) => a.value === pendingTripAssignmentId)) {
      setTripAssignmentId(pendingTripAssignmentId);
      setPendingTripAssignmentId("");
    }
  }, [pendingTripAssignmentId, tripAssignments]);

  /* ── flush customer: re-apply after customers list loads ── */
  useEffect(() => {
    if (!pendingCustomerCandidates || customers.length === 0) return;
    const { customerUniqueId, customerId: rawId, customerName } = pendingCustomerCandidates;
    let match = customers.find((c) => customerUniqueId && resolveCustomerId(c) === customerUniqueId);
    if (!match) match = customers.find((c) => rawId && resolveCustomerId(c) === rawId);
    if (!match && customerName)
      match = customers.find((c) => c.customer_name.toLowerCase() === customerName.toLowerCase());
    if (match) setCustomerId(resolveCustomerId(match));
    setPendingCustomerCandidates(null);
  }, [customers, pendingCustomerCandidates]);

  /* ── autofill customer from trip assignment (only on user-initiated change) ── */
  useEffect(() => {
    if (!tripAssignmentId || tripAssignmentId === "__none__") return;
    if (!userChangedTripRef.current) return;
    userChangedTripRef.current = false;

    dailyTripAssignmentApi.read(tripAssignmentId)
      .then((tripAssignRes: any) => {
        // trip_plan is the read-only SerializerMethodField (trip_plan_id is write-only)
        const tripPlanId = tripAssignRes.trip_plan?.unique_id;
        if (!tripPlanId) return Promise.reject("No trip plan");
        return tripPlanApi.read(tripPlanId);
      })
      .then((tripPlanRes: any) => {
        const collectionPoints: any[] = tripPlanRes.plan_collection_points || [];
        const firstStop = collectionPoints.find((cp: any) => cp.is_active && cp.customer?.unique_id);
        if (firstStop?.customer?.unique_id) {
          const match = customers.find((c) => resolveCustomerId(c) === firstStop.customer.unique_id);
          if (match) setCustomerId(resolveCustomerId(match));
        }
      })
      .catch(() => {});
  }, [tripAssignmentId, customers]);

  const selectedCustomer = customers.find((c) => resolveCustomerId(c) === customerId);

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyUniqueId || !projectId) {
      Swal.fire(t("common.warning"), "Company and project are required", "warning");
      return;
    }
    if (!customerId) {
      Swal.fire(t("common.warning"), t("admin.waste_collected_data.customer_required"), "warning");
      return;
    }

    const payload: Record<string, unknown> = {
      customer: customerId,
      wet_waste: wetWaste,
      dry_waste: dryWaste,
      mixed_waste: mixedWaste,
      total_quantity: totalQuantity,
      trip_assignment_id: tripAssignmentId || null,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await wasteCollectionApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await wasteCollectionApi.create(payload);
        Swal.fire(t("common.success"), t("admin.waste_collected_data.save_success"), "success");
      }
      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (err: any) {
      Swal.fire(t("common.save_failed"), extractError(err) ?? t("common.save_failed_desc"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={isEdit ? t("admin.waste_collected_data.title_edit") : t("admin.waste_collected_data.title_add")}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Company */}
            <div>
              <Label>{t("admin.nav.company")}</Label>
              <select
                value={companyUniqueId}
                onChange={(e) => { onCompanyChange(e.target.value); setCustomerId("");}}
                disabled={Boolean(loggedInCompanyUniqueId) || (!isSuperAdmin && !loggedInCompanyUniqueId) || companies.length === 0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {loggedInCompanyUniqueId
                    ? t("common.company_from_profile")
                    : t("common.select_item_placeholder", { item: t("admin.nav.company") })}
                </option>
                {companies.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div>
              <Label>{t("admin.nav.project")}</Label>
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setCustomerId(""); }}
                disabled={!companyUniqueId || projects.length === 0}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {companyUniqueId
                    ? t("common.select_item_placeholder", { item: t("admin.nav.project") })
                    : "Select a company first"}
                </option>
                {projects.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Customer */}
            <div>
              <Label>
                {t("admin.waste_collected_data.customer")}
                <span className="text-red-500"> *</span>
              </Label>
              <Select
                value={customerId}
                onChange={setCustomerId}
                options={customers.map((c) => ({
                  value: resolveCustomerId(c),
                  label: c.customer_name,
                }))}
                placeholder={fetchingCustomers ? "Loading..." : "Select customer"}
                disabled={fetchingCustomers || !projectId}
              />
            </div>

            {/* Trip Assignment (optional) */}
            <div>
              <Label>Trip Assignment</Label>
              <Select
                value={tripAssignmentId}
                onChange={(v) => { userChangedTripRef.current = true; setTripAssignmentId(v === "__none__" ? "" : v); }}
                options={[{ value: "__none__", label: "None (no assignment)" }, ...tripAssignments]}
                placeholder="Select Trip Assignment (optional)"
                disabled={!projectId}
              />
            </div>
            {/* Address (read-only) */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_address")}</Label>
              <Input
                disabled
                className="bg-gray-100"
                value={
                  selectedCustomer
                    ? [selectedCustomer.building_no, selectedCustomer.street, selectedCustomer.area]
                        .filter(Boolean)
                        .join(", ")
                    : ""
                }
              />
            </div>

            {/* Zone */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_zone")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.zone_name || ""} />
            </div>

            {/* Ward */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_ward")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.ward_name || ""} />
            </div>

            {/* Panchayat (PLB) */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_panchayat")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.panchayat_name || ""} />
            </div>

            {/* City */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_city")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.city_name || ""} />
            </div>

            {/* District */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_district")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.district_name || ""} />
            </div>

            {/* State */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_state")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.state_name || ""} />
            </div>

            {/* Country */}
            <div>
              <Label>{t("admin.waste_collected_data.customer_country")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.country_name || ""} />
            </div>

            {/* Dry Waste */}
            <div>
              <Label>{t("admin.waste_collected_data.dry_waste")}</Label>
              <Input
                type="number"
                min={0}
                value={dryWaste}
                onChange={(e) => setDryWaste(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Wet Waste */}
            <div>
              <Label>{t("admin.waste_collected_data.wet_waste")}</Label>
              <Input
                type="number"
                min={0}
                value={wetWaste}
                onChange={(e) => setWetWaste(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Mixed Waste */}
            <div>
              <Label>{t("admin.waste_collected_data.mixed_waste")}</Label>
              <Input
                type="number"
                min={0}
                value={mixedWaste}
                onChange={(e) => setMixedWaste(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* Total (read-only, auto-calculated) */}
            <div>
              <Label>{t("admin.waste_collected_data.total_quantity")}</Label>
              <Input disabled className="bg-gray-100" value={totalQuantity} />
            </div>

          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || loadingRecord}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => navigate(LIST_PATH, { state: { companyUniqueId, projectId } })}
              className="rounded-lg bg-red-400 px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
