import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { getEncryptedRoute } from "@/utils/routeCache";
import { wasteTypeApi } from "@/helpers/admin";

const { encMasters, encWasteTypes } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encWasteTypes);

const toStringOrEmpty = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const WASTE_TYPE_FIELDS: Record<string, string[]> = {
  waste_type_name: ["waste_type_name", "name"],
  is_active: ["is_active"],
};

export default function WasteTypeForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "waste-types", WASTE_TYPE_FIELDS);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
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

  const [wasteTypeName, setWasteTypeName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProjectCandidates, setPendingProjectCandidates] = useState<{
    projectUniqueId: string; projectId: string; projectName: string;
  } | null>(null);

  const extractErr = useCallback(
    (error: unknown): string => {
      const err = error as { response?: { data?: unknown }; message?: string };
      const data = err.response?.data;
      if (typeof data === "string") return data;
      if (data && typeof data === "object") {
        return Object.entries(data as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
          .join("\n");
      }
      if (err.message) return err.message;
      return t("common.unexpected_error");
    },
    [t],
  );

  /* ── edit mode prefill ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    wasteTypeApi.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        setWasteTypeName(
          toStringOrEmpty(res.waste_type_name ?? res.name ?? res.property_name),
        );
        setIsActive(Boolean(res.is_active));
        applyCompanyProjectFromRecord(res as Record<string, unknown>);
        setPendingProjectCandidates({
          projectUniqueId: toStringOrEmpty(res.project_unique_id ?? (res.project as any)?.unique_id ?? ""),
          projectId: toStringOrEmpty(res.project_id ?? ""),
          projectName: toStringOrEmpty(res.project_name ?? ""),
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord, extractErr, t]);

  /* ── re-apply project after hook loads project list ── */
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const missingFields: string[] = [];
    if (!companyUniqueId) missingFields.push(t("admin.nav.company"));
    if (!projectId) missingFields.push(t("admin.nav.project"));
    if (
      getMissingRequiredFields(
        ["waste_type_name"],
        (k) => ({ waste_type_name: wasteTypeName.trim() })[k as "waste_type_name"],
      ).length > 0
    ) {
      missingFields.push(t("common.item_name", { item: t("common.waste_type") }));
    }

    if (missingFields.length > 0) {
      Swal.fire(t("common.warning"), t("admin.bin.missing_fields", { fields: missingFields.join(", ") }), "warning");
      return;
    }

    setIsSubmitting(true);
    const rawPayload = {
      company_id: companyUniqueId,
      project_id: projectId,
      waste_type_name: wasteTypeName.trim(),
      is_active: isActive,
    };
    const payload = filterPayload(rawPayload, ["company_id", "project_id"]) as typeof rawPayload;

    try {
      if (isEdit && id) {
        await wasteTypeApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await wasteTypeApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }
      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error) {
      Swal.fire(t("common.save_failed"), extractErr(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("common.waste_type") })
          : t("common.add_item", { item: t("common.waste_type") })
      }
    >
      <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6" noValidate>
        {/* Company */}
        <div>
          <Label>{t("admin.nav.company")} *</Label>
          <Select
            value={companyUniqueId}
            onValueChange={onCompanyChange}
            disabled={
              Boolean(loggedInCompanyUniqueId) ||
              (!isSuperAdmin && !loggedInCompanyUniqueId) ||
              companies.length === 0
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  loggedInCompanyUniqueId
                    ? "Company from logged-in profile"
                    : isSuperAdmin
                    ? "Select Company"
                    : "Only super admin can select company"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loggedInCompanyUniqueId && !isSuperAdmin && (
            <p className="mt-1 text-xs text-red-500">
              Company is not mapped to this login. Only super admin can view all companies.
            </p>
          )}
        </div>

        {/* Project */}
        <div>
          <Label>{t("admin.nav.project")} *</Label>
          <Select
            value={projectId}
            onValueChange={setProjectId}
            disabled={!companyUniqueId || projects.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {companyUniqueId && projects.length === 0 && (
            <p className="mt-1 text-xs text-red-500">No projects found for this company.</p>
          )}
        </div>

        {/* Waste Type Name */}
        {showField("waste_type_name") && (
          <div>
            <Label>{t("common.item_name", { item: t("common.waste_type") })} *</Label>
            <Input
              value={wasteTypeName}
              onChange={(e) => setWasteTypeName(e.target.value)}
              placeholder={t("common.enter_item_name", { item: t("common.waste_type") })}
              required
            />
          </div>
        )}

        {/* Status */}
        {showField("is_active") && (
          <div>
            <Label>{t("common.status")}</Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting || loadingRecord}>
            {isEdit ? t("common.update") : t("common.save")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
