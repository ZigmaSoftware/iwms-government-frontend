import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

  const [wasteTypeName, setWasteTypeName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const missingFields: string[] = [];
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
      waste_type_name: wasteTypeName.trim(),
      is_active: isActive,
    };
    const payload = filterPayload(rawPayload) as typeof rawPayload;

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
