import type { VehicleTypePayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useLocation} from "react-router-dom";
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
import { adminApi } from "@/helpers/admin/registry";


const { encTransportMaster, encVehicleType } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encTransportMaster, encVehicleType);

const toStr = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const VEHICLE_TYPE_FIELDS: Record<string, string[]> = {
  company_id_input: ["company_id_input", "company_id", "company"],
  project_id_input: ["project_id_input", "project_id", "project"],
  vehicleType: ["vehicleType", "vehicle_type", "vehicleTypeName"],
  description: ["description"],
  is_active: ["is_active", "status", "active_status"],
};

export default function VehicleTypeCreationForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { showField, filterPayload } = useFieldVisibility(
    "transport-master",
    "vehicle-type",
    VEHICLE_TYPE_FIELDS
  );

  // ── Company / Project selection (same hook used across all forms) ──────────
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
  } = useCompanyProjectSelection({ isEdit, initialCompanyId: routeState?.companyUniqueId, initialProjectId: routeState?.projectId });

  // ── Local form state ──────────────────────────────────────────────────────
  const [vehicleTypeName, setVehicleTypeName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProjectCandidates, setPendingProjectCandidates] = useState<{
    projectUniqueId: string;
    projectId: string;
    projectName: string;
  } | null>(null);

  // ── Error extractor (mirrors WasteTypeForm pattern) ───────────────────────
  const extractErr = useCallback(
    (error: unknown): string => {
      const err = error as { response?: { data?: unknown }; message?: string };
      const data = err.response?.data;

      if (typeof data === "string") return data;
      if (data && typeof data === "object") {
        return Object.entries(data as Record<string, unknown>)
          .map(([key, value]) =>
            Array.isArray(value)
              ? `${key}: ${value.join(", ")}`
              : `${key}: ${String(value)}`
          )
          .join("\n");
      }
      if (err.message) return err.message;
      return t("common.unexpected_error");
    },
    [t]
  );

  // ── Populate form when editing ────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    adminApi.vehicleTypes.read(id)
      .then((res: any) => {
        if (cancelled) return;
        const data = res as Record<string, unknown>;
        setVehicleTypeName(toStr(data.vehicleType));
        setDescription(toStr(data.description));
        setIsActive(Boolean(data.is_active));
        applyCompanyProjectFromRecord(data);
        // Store project identifiers — re-applied once the project list loads
        setPendingProjectCandidates({
          projectUniqueId: toStr((data.project as any)?.unique_id ?? data.project_unique_id ?? ""),
          projectId: toStr(data.project_id ?? ""),
          projectName: toStr(data.project_name ?? ""),
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(
          t("admin.vehicle_type.load_failed_title"),
          extractErr(err),
          "error"
        );
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord]);

  // ── Re-apply project after hook loads project list ────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const missingFields: string[] = [];
    if (showField("company_id_input") && !companyUniqueId) missingFields.push(t("admin.nav.company"));
    if (showField("project_id_input") && !projectId) missingFields.push(t("admin.nav.project"));
    if (showField("vehicleType") && !vehicleTypeName.trim())
      missingFields.push(t("admin.vehicle_type.label"));

    if (missingFields.length > 0) {
      Swal.fire(
        t("common.warning"),
        `${t("common.please_fill")}: ${missingFields.join(", ")}`,
        "warning"
      );
      return;
    }

    const rawPayload = {
      vehicleType: vehicleTypeName.trim(),
      description: description.trim() || null,
      is_active: isActive,
      company_id_input: companyUniqueId,
      project_id_input: projectId,
    };
    const payload = filterPayload(rawPayload, [
      "company_id_input",
      "project_id_input",
    ]) as unknown as VehicleTypePayload;

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.vehicleTypes.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.vehicleTypes.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }
      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error) {
      Swal.fire(t("common.save_failed"), extractErr(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ComponentCard
      title={
        isEdit
          ? t("admin.vehicle_type.title_edit")
          : t("admin.vehicle_type.title_add")
      }
    >
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        noValidate
      >
        {/* Company */}
        {showField("company_id_input") && (
        <div>
          <Label>
            {t("admin.nav.company")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyUniqueId}
            onValueChange={onCompanyChange}
            disabled={
              Boolean(loggedInCompanyUniqueId) ||
              (!isSuperAdmin && !loggedInCompanyUniqueId) ||
              companies.length === 0
            }
          >
            <SelectTrigger className="input-validate w-full">
              <SelectValue
                placeholder={
                  loggedInCompanyUniqueId
                    ? t("common.company_from_profile")
                    : t("common.select_item_placeholder", {
                        item: t("admin.nav.company"),
                      })
                }
              />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.value} value={company.value}>
                  {company.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* Project */}
        {showField("project_id_input") && (
        <div>
          <Label>
            {t("admin.nav.project")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={projectId}
            onValueChange={setProjectId}
            disabled={!companyUniqueId || projects.length === 0}
          >
            <SelectTrigger className="input-validate w-full">
              <SelectValue
                placeholder={t("common.select_item_placeholder", {
                  item: t("admin.nav.project"),
                })}
              />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.value} value={project.value}>
                  {project.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* Vehicle Type Name */}
        {showField("vehicleType") && (
        <div>
          <Label>
            {t("admin.vehicle_type.label")}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            value={vehicleTypeName}
            onChange={(e) => setVehicleTypeName(e.target.value)}
            placeholder={t("admin.vehicle_type.placeholder")}
            required
          />
        </div>
        )}

        {/* Status */}
        {showField("is_active") && (
        <div>
          <Label>
            {t("common.status")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={isActive ? "true" : "false"}
            onValueChange={(value) => setIsActive(value === "true")}
          >
            <SelectTrigger className="input-validate w-full">
              <SelectValue placeholder={t("common.select_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("common.active")}</SelectItem>
              <SelectItem value="false">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}

        {/* Description */}
        {showField("description") && (
        <div className="md:col-span-2">
          <Label>{t("common.description")}</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("common.description_optional")}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-200 resize-none"
          />
        </div>
        )}

        {/* Actions */}
        <div className="md:col-span-2 flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEdit
                ? t("common.updating")
                : t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
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
