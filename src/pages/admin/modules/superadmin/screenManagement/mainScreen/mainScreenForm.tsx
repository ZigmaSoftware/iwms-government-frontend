import type { MainScreenTypeOption } from "./types";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { mainScreenSchema } from "@/schemas/superadmin/screenManagement/mainScreen.schema";
import { toSwalMessage } from "@/lib/zodErrors";

/* ------------------------------
    ROUTES
------------------------------ */
const { encAdmins, encMainScreen: encMainScreens } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAdmins, encMainScreens);


const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const firstErrorMessage = (value: unknown): string | undefined => {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value;
  return undefined;
};

/* ==========================================================
    COMPONENT
========================================================== */
export default function MainScreenForm() {
  const { t } = useTranslation();

  const [mainscreenName, setMainScreenName] = useState("");
  const [orderNo, setOrderNo] = useState<number | string>("");
  const [description, setDescription] = useState("");
  const [mainscreenTypeId, setMainScreenTypeId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [mainScreenTypesList, setMainScreenTypesList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ==========================================================
      FETCH MAIN SCREEN TYPES (dropdown)
  ========================================================== */
  useEffect(() => {
    let cancelled = false;
    adminApi.mainScreenTypes.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setMainScreenTypesList(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* ==========================================================
      EDIT MODE — LOAD RECORD
  ========================================================== */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.mainScreens.read(id)
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

  // Prefill plain fields as soon as the record arrives.
  useEffect(() => {
    if (!recordData) return;
    const data = recordData;
    setMainScreenName(data.mainscreen_name ?? "");
    setOrderNo(data.order_no ?? "");
    setDescription(data.description ?? "");
    setIsActive(Boolean(data.is_active));
  }, [recordData]);

  // Prefill the Select only once both the record AND the options list are ready
  // to avoid the race where the list arrives after the record (value renders blank).
  useEffect(() => {
    if (!recordData || mainScreenTypesList.length === 0) return;
    setMainScreenTypeId(String(recordData.mainscreentype_id ?? ""));
  }, [recordData, mainScreenTypesList]);

  const mainScreenTypes = useMemo<MainScreenTypeOption[]>(
    () =>
      mainScreenTypesList
        .filter((x) => Boolean(x.is_active))
        .map((x) => ({
          value: toText(x.unique_id),
          label: toText(x.type_name),
        })),
    [mainScreenTypesList]
  );

  /* ==========================================================
      SUBMIT
  ========================================================== */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const result = mainScreenSchema.safeParse({
      mainscreenTypeId,
      mainscreenName,
      orderNo: String(orderNo),
      description,
      isActive,
    });
    if (!result.success) {
      Swal.fire(t("common.warning"), toSwalMessage(result.error), "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        mainscreen_name: mainscreenName.trim(),
        description: description.trim(),
        mainscreentype_id: mainscreenTypeId,
        is_active: isActive,
      };

      if (isEdit && id) {
        await adminApi.mainScreens.update(id, { ...payload, order_no: Number(orderNo) || 0 });
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await adminApi.mainScreens.create(payload);
        Swal.fire(t("common.success"), t("common.added_success"), "success");
      }

      navigate(ENC_LIST_PATH);
    } catch (err: unknown) {
      const errorData =
        (err as { response?: { data?: Record<string, unknown> } })?.response
          ?.data ?? {};

      Swal.fire(
        t("common.save_failed"),
        firstErrorMessage(errorData.detail) ||
          firstErrorMessage(errorData.mainscreen_name) ||
          t("common.save_failed_desc"),
        "error"
      );
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
          ? t("common.edit_item", { item: t("admin.nav.main_screen") })
          : t("common.add_item", { item: t("admin.nav.main_screen") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MainScreen Type */}
          <div>
            <Label>{t("admin.nav.main_screen_type")} *</Label>
            <Select
              value={mainscreenTypeId}
              onValueChange={(v) => setMainScreenTypeId(v)}
            >
              <SelectTrigger className="input-validate w-full">
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.main_screen_type"),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {mainScreenTypes.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {!loadingRecord
                      ? t("common.no_items_found", {
                          item: t("admin.nav.main_screen_type"),
                        })
                      : t("common.loading")}
                  </div>
                ) : (
                  mainScreenTypes.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div>
            <Label>
              {t("common.item_name", { item: t("admin.nav.main_screen") })} *
            </Label>
            <Input
              value={mainscreenName}
              onChange={(e) => setMainScreenName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.main_screen"),
              })}
              className="input-validate w-full"
              required
            />
          </div>

          {/* Order No (edit only — backend auto-assigns on create) */}
          {isEdit ? (
            <div>
              <Label>{t("common.order_no")}</Label>
              <Input
                type="number"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder={t("common.order_no_placeholder")}
                className="input-validate w-full"
              />
            </div>
          ) : null}

          {/* Description */}
          <div className="md:col-span-2">
            <Label>{t("common.description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.description_optional")}
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
