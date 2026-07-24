import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { toSwalMessage } from "@/lib/zodErrors";
import { requireWhenVisible } from "@/schemas/shared/visibility";
import { wasteTypeSchema } from "@/schemas/masters/wasteMasters/wasteType.schema";

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

import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { getEncryptedRoute } from "@/utils/routeCache";
import { wasteTypeApi } from "@/helpers/admin";
import { complaintPriorityApi, complaintTeamApi } from "@/features/complaintTicketing/api";
import { asArray } from "@/pages/admin/modules/core_modules/complaintManagement/utils";
import type { ComplaintPriority, ComplaintTeam } from "@/features/complaintTicketing/types";
import { capitalize } from "@/utils/capitalize";

const { encWasteMasters, encWasteTypes } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encWasteMasters, encWasteTypes);

const toStringOrEmpty = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const WASTE_TYPE_FIELDS: Record<string, string[]> = {
  waste_type_name: ["waste_type_name", "name"],
  is_active: ["is_active"],
  default_team: ["default_team"],
  default_priority: ["default_priority"],
  assign_within_minutes: ["assign_within_minutes"],
  resolve_within_minutes: ["resolve_within_minutes"],
  working_hours_only: ["working_hours_only"],
};

export default function WasteTypeForm() {
  const { t } = useTranslation();
  const { showField, filterPayload } =
    useFieldVisibility("masters", "waste-types", WASTE_TYPE_FIELDS);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [wasteTypeName, setWasteTypeName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [teams, setTeams] = useState<ComplaintTeam[]>([]);
  const [priorities, setPriorities] = useState<ComplaintPriority[]>([]);
  const [defaultTeam, setDefaultTeam] = useState("");
  const [defaultPriority, setDefaultPriority] = useState("");
  const [assignWithinMinutes, setAssignWithinMinutes] = useState("");
  const [resolveWithinMinutes, setResolveWithinMinutes] = useState("");
  const [workingHoursOnly, setWorkingHoursOnly] = useState(false);
  const schema = useMemo(
    () => requireWhenVisible(wasteTypeSchema, showField),
    [showField],
  );

  useEffect(() => {
    complaintTeamApi.readAll().then((res) => setTeams(asArray(res))).catch(() => {});
    complaintPriorityApi.readAll().then((res) => setPriorities(asArray(res))).catch(() => {});
  }, []);

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
        setDefaultTeam(toStringOrEmpty(res.default_team));
        setDefaultPriority(toStringOrEmpty(res.default_priority));
        setAssignWithinMinutes(toStringOrEmpty(res.assign_within_minutes));
        setResolveWithinMinutes(toStringOrEmpty(res.resolve_within_minutes));
        setWorkingHoursOnly(Boolean(res.working_hours_only));
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire(t("common.error"), extractErr(err), "error");
      });
    return () => { cancelled = true; };
  }, [id, isEdit, extractErr, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const rawPayload = {
      waste_type_name: wasteTypeName.trim(),
      is_active: isActive,
      default_team: defaultTeam || null,
      default_priority: defaultPriority || null,
      assign_within_minutes: assignWithinMinutes ? Number(assignWithinMinutes) : null,
      resolve_within_minutes: resolveWithinMinutes ? Number(resolveWithinMinutes) : null,
      working_hours_only: workingHoursOnly,
    };
    const validation = schema.safeParse(rawPayload);
    if (!validation.success) {
      Swal.fire(t("common.warning"), toSwalMessage(validation.error), "warning");
      return;
    }

    setIsSubmitting(true);
    const payload = filterPayload(validation.data) as typeof validation.data;

    try {
      if (isEdit && id) {
        await wasteTypeApi.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await wasteTypeApi.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }
      navigate(ENC_LIST_PATH);
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

        {/* Public grievance routing: team/priority/SLA this waste type is assigned to */}
        {showField("default_team") && (
          <div>
            <Label>Default Team</Label>
            <Select value={defaultTeam || "__none__"} onValueChange={(v) => setDefaultTeam(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.unique_id} value={team.unique_id}>{capitalize(team.team_name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("default_priority") && (
          <div>
            <Label>Default Priority</Label>
            <Select value={defaultPriority || "__none__"} onValueChange={(v) => setDefaultPriority(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {priorities.map((priority) => (
                  <SelectItem key={priority.unique_id} value={priority.unique_id}>{capitalize(priority.priority_name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("assign_within_minutes") && (
          <div>
            <Label>Assign Within (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={assignWithinMinutes}
              onChange={(e) => setAssignWithinMinutes(e.target.value)}
              placeholder="e.g. 60"
            />
          </div>
        )}

        {showField("resolve_within_minutes") && (
          <div>
            <Label>Resolve Within (minutes)</Label>
            <Input
              type="number"
              min={0}
              value={resolveWithinMinutes}
              onChange={(e) => setResolveWithinMinutes(e.target.value)}
              placeholder="e.g. 1440"
            />
          </div>
        )}

        {showField("working_hours_only") && (
          <div>
            <Label>Count Only Working Hours</Label>
            <Select value={workingHoursOnly ? "true" : "false"} onValueChange={(v) => setWorkingHoursOnly(v === "true")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
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
            onClick={() => navigate(ENC_LIST_PATH)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
