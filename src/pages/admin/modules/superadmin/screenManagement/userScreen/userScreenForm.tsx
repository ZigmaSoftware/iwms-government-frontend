import type { MainScreenOption } from "./types";
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
import { userScreenSchema } from "@/schemas/superadmin/screenManagement/userScreen.schema";
import { toSwalMessage } from "@/lib/zodErrors";
import { capitalize } from "@/utils/capitalize";

/* -----------------------------------------
   ROUTES
----------------------------------------- */
const { encAdmins, encUserScreen } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAdmins, encUserScreen);


const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const firstErrorMessage = (value: unknown): string | undefined => {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  if (typeof value === "string") return value;
  return undefined;
};

/* =========================================
    FORM COMPONENT
========================================= */
export default function UserScreenForm() {
  const { t } = useTranslation();

  const [mainscreenId, setMainscreenId] = useState("");
  const [userScreenName, setUserScreenName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [mainScreensList, setMainScreensList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* =========================================
      FETCH MAIN SCREENS (dropdown)
  ========================================= */
  useEffect(() => {
    let cancelled = false;
    adminApi.mainScreens.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setMainScreensList(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* =========================================
      EDIT MODE — LOAD EXISTING RECORD
  ========================================= */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.userScreens.read(id)
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
    setUserScreenName(data.userscreen_name ?? "");
    setFolderName(data.folder_name ?? "");
    setOrderNo(String(data.order_no ?? ""));
    setDescription(data.description ?? "");
    setIsActive(Boolean(data.is_active));
  }, [recordData]);

  // Prefill the Select only once both the record AND the options list are ready
  // to avoid the race where the list arrives after the record (value renders blank).
  useEffect(() => {
    if (!recordData || mainScreensList.length === 0) return;
    setMainscreenId(String(recordData.mainscreen_id ?? ""));
  }, [recordData, mainScreensList]);

  const mainScreens = useMemo<MainScreenOption[]>(
    () =>
      mainScreensList
        .filter((x) => Boolean(x.is_active))
        .map((x) => ({
          value: toText(x.unique_id),
          label: toText(x.mainscreen_name),
        })),
    [mainScreensList]
  );

  /* =========================================
      SUBMIT HANDLER
  ========================================= */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const result = userScreenSchema.safeParse({
      mainscreenId,
      userScreenName,
      folderName,
      orderNo,
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
        mainscreen_id: mainscreenId,
        userscreen_name: userScreenName.trim(),
        folder_name: folderName.trim(),
        description: description.trim(),
        is_active: isActive,
      };

      if (isEdit && id) {
        await adminApi.userScreens.update(id, { ...payload, order_no: Number(orderNo) || 0 });
        Swal.fire(t("common.success"), t("common.updated_success"), "success");
      } else {
        await adminApi.userScreens.create(payload);
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
          firstErrorMessage(errorData.userscreen_name) ||
          t("common.save_failed_desc"),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================================
      JSX
  ========================================= */
  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.user_screen") })
          : t("common.add_item", { item: t("admin.nav.user_screen") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mainscreen */}
          <div>
            <Label>{t("admin.nav.main_screen")} *</Label>
            <Select
              value={mainscreenId}
              onValueChange={(val) => setMainscreenId(val)}
            >
              <SelectTrigger className="input-validate w-full">
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.main_screen"),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {mainScreens.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {capitalize(opt.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Screen Name */}
          <div>
            <Label>
              {t("common.item_name", { item: t("admin.nav.user_screen") })} *
            </Label>
            <Input
              value={userScreenName}
              onChange={(e) => setUserScreenName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.user_screen"),
              })}
              required
              className="input-validate w-full"
            />
          </div>

          {/* Folder Name */}
          <div>
            <Label>{t("common.folder_path")} *</Label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={t("common.folder_path_placeholder")}
              required
              className="input-validate w-full"
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
