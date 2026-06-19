import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { Input } from "@/components/ui/input";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";

const feedbackApi = adminApi.feedbacks;

const CATEGORY_OPTIONS = [
  { value: "Excellent", label: "Excellent" },
  { value: "Satisfied", label: "Satisfied" },
  { value: "Not Satisfied", label: "Not Satisfied" },
  { value: "Poor", label: "Poor" },
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

export default function FeedBackForm() {
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

  const { encCitizenGrivence, encFeedback } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encCitizenGrivence, encFeedback);

  /* ── form fields ── */
  const [customerId, setCustomerId] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("Excellent");
  const [feedbackDetails, setFeedbackDetails] = useState("");

  /* ── state ── */
  const [customers, setCustomers] = useState<any[]>([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pending values — applied once their option lists are ready
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

  const resolveCustomerId = (c: any) => String(c.unique_id ?? c.id ?? "");

  /* ── load customers filtered by company + project ── */
  useEffect(() => {
    if (!companyUniqueId) { setCustomers([]); return; }
    let cancelled = false;
    setFetchingCustomers(true);
    const params: Record<string, string> = { company_id: companyUniqueId };
    if (projectId) params.project_id = projectId;
    adminApi.customerCreations.readAll({ params })
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.results ?? [];
        const sorted = [...list].sort((a: any, b: any) =>
          String(a.customer_name ?? "").localeCompare(String(b.customer_name ?? ""))
        );
        setCustomers(sorted);
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
    feedbackApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        // Set simple fields immediately
        setFeedbackCategory(res.category || "Excellent");
        setFeedbackDetails(res.feedback_details || "");
        // Apply company (safe — won't clear project if record has none)
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
        // Store project & customer to re-apply after option lists load
        setPendingProjectCandidates({
          projectUniqueId: String(res.project_unique_id ?? res.project?.unique_id ?? ""),
          projectId: String(res.project_id ?? ""),
          projectName: String(res.project_name ?? ""),
        });
        setPendingCustomerCandidates({
          customerUniqueId: String(res.customer_unique_id ?? res.customer?.unique_id ?? ""),
          customerId: String(res.customer_id ?? res.customer ?? ""),
          customerName: String(res.customer_name ?? ""),
        });
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? t("common.load_failed") });
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord, t]);

  /* ── flush project after hook loads project list ── */
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

  /* ── flush customer after customers list loads ── */
  useEffect(() => {
    if (!pendingCustomerCandidates || customers.length === 0) return;
    const { customerUniqueId, customerId: rawId, customerName } = pendingCustomerCandidates;
    let match = customers.find((c) => customerUniqueId && resolveCustomerId(c) === customerUniqueId);
    if (!match) match = customers.find((c) => rawId && resolveCustomerId(c) === rawId);
    if (!match && customerName)
      match = customers.find((c) =>
        String(c.customer_name ?? "").toLowerCase() === customerName.toLowerCase()
      );
    if (match) setCustomerId(resolveCustomerId(match));
    setPendingCustomerCandidates(null);
  }, [customers, pendingCustomerCandidates]);

  const selectedCustomer = customers.find((c) => resolveCustomerId(c) === customerId);

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      Swal.fire(t("common.warning"), t("admin.citizen_grievance.feedback_form.customer_required"), "warning");
      return;
    }

    const payload = {
      customer: customerId,
      category: feedbackCategory,
      feedback_details: feedbackDetails,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.feedbacks.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await adminApi.feedbacks.create(payload);
        Swal.fire(t("common.success"), t("admin.citizen_grievance.feedback_form.saved"), "success");
      }
      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (err: any) {
      Swal.fire(t("common.error"), extractError(err) ?? t("admin.citizen_grievance.feedback_form.save_failed"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={
          isEdit
            ? t("admin.citizen_grievance.feedback_form.title_edit")
            : t("admin.citizen_grievance.feedback_form.title_add")
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Customer */}
            <div>
              <Label>
                {t("admin.citizen_grievance.feedback_form.customer")}
                <span className="text-red-500"> *</span>
              </Label>
              <Select
                value={customerId}
                onChange={setCustomerId}
                options={customers.map((c) => ({
                  value: resolveCustomerId(c),
                  label: String(c.customer_name ?? ""),
                }))}
                placeholder={fetchingCustomers ? "Loading..." : "Select customer"}
                disabled={fetchingCustomers || !projectId}
              />
            </div>

            {/* Address */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_address")}</Label>
              <Input
                disabled
                className="bg-gray-100"
                value={
                  selectedCustomer
                    ? [selectedCustomer.building_no, selectedCustomer.street, selectedCustomer.area]
                        .filter(Boolean).join(", ")
                    : ""
                }
              />
            </div>

            {/* Zone */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_zone")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.zone_name || ""} />
            </div>

            {/* Ward */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_ward")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.ward_name || ""} />
            </div>

            {/* City */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_city")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.city_name || ""} />
            </div>

            {/* District */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_district")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.district_name || ""} />
            </div>

            {/* State */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_state")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.state_name || ""} />
            </div>

            {/* Country */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.customer_country")}</Label>
              <Input disabled className="bg-gray-100" value={selectedCustomer?.country_name || ""} />
            </div>

            {/* Feedback Category */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.feedback_category")}</Label>
              <Select
                value={feedbackCategory}
                onChange={setFeedbackCategory}
                options={CATEGORY_OPTIONS}
              />
            </div>

            {/* Feedback Details */}
            <div>
              <Label>{t("admin.citizen_grievance.feedback_form.feedback_details")}</Label>
              <Input
                value={feedbackDetails}
                onChange={(e) => setFeedbackDetails(e.target.value)}
              />
            </div>

          </div>

          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || loadingRecord || fetchingCustomers}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting
                ? t("admin.citizen_grievance.feedback_form.saving")
                : isEdit ? t("common.update") : t("common.save")}
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
