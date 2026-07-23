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
import { mainScreenTypeSchema } from "@/schemas/superadmin/screenManagement/mainScreenType.schema";
import { toSwalMessage } from "@/lib/zodErrors";

/* ------------------------------
    ROUTES
------------------------------ */
const { encAdmins, encMainScreenType } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAdmins, encMainScreenType);

const firstErrorMessage = (value: unknown): string | undefined => {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value;
  return undefined;
};

/* ==========================================================
    COMPONENT
========================================================== */
export default function MainScreenTypeForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [typeName, setTypeName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ==========================================================
      EDIT MODE — LOAD RECORD
  ========================================================== */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.mainScreenTypes.read(id)
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
    setTypeName(data.type_name ?? "");
    setIsActive(Boolean(data.is_active));
  }, [recordData]);

  /* ==========================================================
      SUBMIT HANDLER
  ========================================================== */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const result = mainScreenTypeSchema.safeParse({ typeName, isActive });
    if (!result.success) {
      Swal.fire(t("common.warning"), toSwalMessage(result.error), "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        type_name: typeName.trim(),
        is_active: isActive,
      };

      if (isEdit && id) {
        await adminApi.mainScreenTypes.update(id, payload);
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await adminApi.mainScreenTypes.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }

      navigate(ENC_LIST_PATH);
    } catch (err: unknown) {
      const errorData =
        (err as { response?: { data?: Record<string, unknown> } })?.response
          ?.data ?? {};

      const message =
        firstErrorMessage(errorData.type_name) ||
        firstErrorMessage(errorData.detail) ||
        t("common.save_failed_desc");

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
          ? t("common.edit_item", { item: t("admin.nav.main_screen_type") })
          : t("common.add_item", { item: t("admin.nav.main_screen_type") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Type Name */}
          <div>
            <Label>
              {t("common.item_name", {
                item: t("admin.nav.main_screen_type"),
              })}{" "}
              *
            </Label>
            <Input
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.main_screen_type"),
              })}
              className="input-validate w-full"
              required
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

        {/* Buttons */}
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
