import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";

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
import { useTranslation } from "react-i18next";

import { adminApi } from "@/helpers/admin/registry";

/* ------------------------------
    ROUTES
------------------------------ */
const { encAdmins, encUserScreenAction } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAdmins, encUserScreenAction);

const firstErrorMessage = (value: unknown): string | undefined => {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value;
  return undefined;
};

/* ==========================================================
    COMPONENT
========================================================== */
export default function UserScreenActionForm() {
  const { t } = useTranslation();
  const [actionName, setActionName] = useState("");
  const [variableName, setVariableName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ==========================================================
      FETCH EDIT DATA
  ========================================================== */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.userScreenActions.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: String(err?.response?.data ?? err?.message ?? "Load failed") });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  useEffect(() => {
    if (!recordData) return;
    const data = recordData;
    setActionName(data.action_name || "");
    setVariableName(data.variable_name || "");
    setIsActive(Boolean(data.is_active));
  }, [recordData]);

  /* ==========================================================
      SUBMIT HANDLER
  ========================================================== */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!actionName.trim() || !variableName.trim()) {
      Swal.fire(t("common.warning"), t("common.missing_fields"), "warning");
      return;
    }

    const payload = {
      action_name: actionName.trim(),
      variable_name: variableName.trim(),
      is_active: isActive,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.userScreenActions.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await adminApi.userScreenActions.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }

      navigate(ENC_LIST_PATH);
    } catch (err: unknown) {
      const errorData =
        (err as { response?: { data?: Record<string, unknown> } })?.response
          ?.data ?? {};

      const message =
        firstErrorMessage(errorData.action_name) ||
        firstErrorMessage(errorData.variable_name) ||
        firstErrorMessage(errorData.detail) ||
        t("common.unexpected_error");

      Swal.fire(t("common.save_failed"), message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ==========================================================
      JSX
  ========================================================== */
  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.user_screen_action") })
          : t("common.add_item", { item: t("admin.nav.user_screen_action") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action Name */}
          <div>
            <Label>{t("common.action_name")} *</Label>
            <Input
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              placeholder={t("admin.user_screen_action.action_placeholder")}
              required
              className="input-validate w-full"
            />
          </div>

          {/* Variable Name */}
          <div>
            <Label>{t("common.variable_name")} *</Label>
            <Input
              value={variableName}
              onChange={(e) => setVariableName(e.target.value)}
              placeholder={t("admin.user_screen_action.variable_placeholder")}
              required
              className="input-validate w-full"
            />
          </div>

          {/* Status */}
          <div>
            <Label>{t("common.status")} *</Label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(v) => setIsActive(v === "true")}
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
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
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
            onClick={() => navigate(ENC_LIST_PATH)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
