import type { MainCategoryRecord, SubCategoryEditorProps, SubCategoryPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";

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
import ComponentCard from "@/components/common/ComponentCard";

import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { adminApi } from "@/helpers/admin/registry";


const { encCitizenGrivence, encSubComplaintCategory } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encCitizenGrivence, encSubComplaintCategory);


const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.join(", ");
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

function SubCategoryEditor({
  initialPayload,
  mainList,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
}: SubCategoryEditorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialPayload.name);
  const [mainCategory, setMainCategory] = useState(initialPayload.mainCategory);
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: SubCategoryPayload = {
      name,
      is_active: isActive,
    };

    if (mainCategory) {
      const numeric = Number(mainCategory);
      payload.mainCategory = Number.isNaN(numeric) ? mainCategory : numeric;
    }

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="mainCategory">
            {t("admin.citizen_grievance.sub_category_form.main_category")}{" "}
            <span className="text-red-500">*</span>
          </Label>

          <Select
            value={mainCategory}
            onValueChange={(val) => setMainCategory(val)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="input-validate w-full" id="mainCategory">
              <SelectValue
                placeholder={t("admin.citizen_grievance.sub_category_form.main_category_placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {mainList.map((m) => (
                <SelectItem key={String(m.unique_id)} value={String(m.unique_id)}>
                  {m.main_categoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="name">
            {t("admin.citizen_grievance.sub_category_form.sub_category_name")}{" "}
            <span className="text-red-500">*</span>
          </Label>

          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.citizen_grievance.sub_category_form.sub_category_placeholder")}
            className="input-validate w-full"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="isActive">
            {t("admin.citizen_grievance.sub_category_form.active_status")}{" "}
            <span className="text-red-500">*</span>
          </Label>

          <Select
            value={isActive ? "true" : "false"}
            onValueChange={(val) => setIsActive(val === "true")}
            disabled={isSubmitting}
          >
            <SelectTrigger className="input-validate w-full" id="isActive">
              <SelectValue placeholder={t("admin.citizen_grievance.sub_category_form.status_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("common.active")}</SelectItem>
              <SelectItem value="false">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? t("admin.citizen_grievance.sub_category_form.updating")
              : t("admin.citizen_grievance.sub_category_form.saving")
            : isEdit
              ? t("common.update")
              : t("common.save")}
        </Button>

        <Button type="button" variant="destructive" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

export default function SubComplaintCategoryForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [mainCategoriesList, setMainCategoriesList] = useState<MainCategoryRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- LOAD RECORD (EDIT MODE) ---------------- */
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.subCategory.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire(
          t("common.error"),
          extractErrorMessage(err, t("common.load_failed")),
          "error"
        );
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  /* ---------------- LOAD MAIN CATEGORIES ---------------- */
  useEffect(() => {
    let cancelled = false;
    adminApi.mainCategory.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const arr = Array.isArray(res) ? res : (res?.results ?? []);
        setMainCategoriesList(arr);
      })
      .catch((err: any) => {
        if (cancelled) return;
        Swal.fire(
          t("common.error"),
          extractErrorMessage(err, t("common.load_failed")),
          "error"
        );
      });
    return () => { cancelled = true; };
  }, []);

  const mainList = useMemo(
    () => mainCategoriesList.filter((item) => item.is_active === true),
    [mainCategoriesList]
  );

  const handleSubmit = async (payload: SubCategoryPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.subCategory.update(id as string, payload);
        Swal.fire({
          icon: "success",
          title: t("admin.citizen_grievance.sub_category_form.updated"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.subCategory.create(payload);
        Swal.fire({
          icon: "success",
          title: t("admin.citizen_grievance.sub_category_form.added"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH);
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("admin.citizen_grievance.sub_category_form.save_failed")),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // In edit mode, wait for both the record and the main-category options list before
  // mounting SubCategoryEditor. Mounting earlier with an empty mainList causes the
  // controlled Select to render blank even though mainCategory state is correctly seeded.
  const mainListReady = !isEdit || mainList.length > 0 || !recordData?.mainCategory;

  if (isEdit && (loadingRecord || !mainListReady) && !recordData) {
    return (
      <ComponentCard
        title={t("admin.citizen_grievance.sub_category_form.title_edit")}
      >
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  if (isEdit && recordData && !mainListReady) {
    return (
      <ComponentCard
        title={t("admin.citizen_grievance.sub_category_form.title_edit")}
      >
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  const initialPayload = recordData
    ? {
        name: String(recordData.name ?? ""),
        mainCategory: String(recordData.mainCategory ?? ""),
        is_active: Boolean(recordData.is_active),
      }
    : {
        name: "",
        mainCategory: "",
        is_active: true,
      };

  const formKey = isEdit
    ? String(recordData?.unique_id ?? id)
    : "new-sub-category";

  return (
    <ComponentCard
      title={
        isEdit
          ? t("admin.citizen_grievance.sub_category_form.title_edit")
          : t("admin.citizen_grievance.sub_category_form.title_add")
      }
    >
      <SubCategoryEditor
        key={formKey}
        initialPayload={initialPayload}
        mainList={mainList}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(ENC_LIST_PATH)}
        onSubmit={handleSubmit}
      />
    </ComponentCard>
  );
}
