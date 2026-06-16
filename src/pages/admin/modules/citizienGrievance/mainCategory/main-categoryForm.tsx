import type { MainCategoryEditorProps, MainCategoryPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation} from "react-router-dom";
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
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { adminApi } from "@/helpers/admin/registry";


const { encCitizenGrivence, encMainComplaintCategory } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encCitizenGrivence, encMainComplaintCategory);


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

function MainCategoryEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
}: MainCategoryEditorProps) {
  const { t } = useTranslation();
  const [mainCategoryName, setMainCategoryName] = useState(
    initialPayload.main_categoryName ?? ""
  );
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = mainCategoryName.trim();
    if (!name) {
      Swal.fire({
        icon: "warning",
        title: t("admin.citizen_grievance.main_category_form.missing_title"),
        text: t("admin.citizen_grievance.main_category_form.missing_message"),
      });
      return;
    }

    await onSubmit({
      main_categoryName: name,
      is_active: isActive,
      company_id: initialPayload.company_id,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <Label htmlFor="mainCategoryName">
            {t("admin.citizen_grievance.main_category_form.category_name")}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="mainCategoryName"
            type="text"
            required
            value={mainCategoryName}
            onChange={(e) => setMainCategoryName(e.target.value)}
            placeholder={t("admin.citizen_grievance.main_category_form.category_placeholder")}
            className="input-validate w-full"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="isActive">
            {t("admin.citizen_grievance.main_category_form.active_status")}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Select
            value={isActive ? "true" : "false"}
            onValueChange={(val) => setIsActive(val === "true")}
            disabled={isSubmitting}
          >
            <SelectTrigger className="input-validate w-full" id="isActive">
              <SelectValue placeholder={t("admin.citizen_grievance.main_category_form.status_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("common.active")}</SelectItem>
              <SelectItem value="false">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? t("admin.citizen_grievance.main_category_form.updating")
              : t("admin.citizen_grievance.main_category_form.saving")
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

export function MainComplaintCategoryForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const {
    companyUniqueId,
    projectId,
    loggedInCompanyUniqueId,
    isSuperAdmin,
    applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({ isEdit, initialCompanyId: routeState?.companyUniqueId, initialProjectId: routeState?.projectId });

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.mainCategory.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({
          icon: "error",
          title: t("admin.citizen_grievance.main_category_form.load_failed"),
          text: extractErrorMessage(err, t("common.load_failed")),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const handleSubmit = async (payload: MainCategoryPayload) => {
    if (!companyUniqueId) {
      Swal.fire(
        "Error",
        !loggedInCompanyUniqueId && !isSuperAdmin
          ? "Company is not mapped to this login. Only super admin can choose a company."
          : "Company is required",
        "error"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.mainCategory.update(id as string, {
          ...payload,
          company_id: companyUniqueId,
        });
        Swal.fire({
          icon: "success",
          title: t("admin.citizen_grievance.main_category_form.updated"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.mainCategory.create({
          ...payload,
          company_id: companyUniqueId,
        });
        Swal.fire({
          icon: "success",
          title: t("admin.citizen_grievance.main_category_form.added"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("admin.citizen_grievance.main_category_form.save_failed")),
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && loadingRecord && !recordData) {
    return (
      <ComponentCard
        title={t("admin.citizen_grievance.main_category_form.title_edit")}
      >
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  const initialPayload: MainCategoryPayload = recordData
    ? {
        main_categoryName: String(recordData.main_categoryName ?? ""),
        is_active: Boolean(recordData.is_active),
        company_id: companyUniqueId,
      }
    : {
        main_categoryName: "",
        is_active: true,
        company_id: companyUniqueId,
      };

  const formKey = isEdit
    ? String(recordData?.unique_id ?? id)
    : "new-main-category";

  return (
    <ComponentCard
      title={
        isEdit
          ? t("admin.citizen_grievance.main_category_form.title_edit")
          : t("admin.citizen_grievance.main_category_form.title_add")
      }
    >
      <MainCategoryEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
        onSubmit={handleSubmit}
      />
    </ComponentCard>
  );
}
