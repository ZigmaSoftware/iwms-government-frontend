import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";
import { Input } from "@/components/ui/input";
import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";
import { adminApi } from "@/helpers/admin/registry";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { PropertyEditorProps, PropertyPayload } from "./types";

const { encMasters, encProperties } = getEncryptedRoute();

const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encProperties);

const PROPERTY_FIELDS: Record<string, string[]> = {
  property_name: ["property_name"],
  is_active: ["is_active"],
};

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

  return fallback;
};

function PropertyEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
}: PropertyEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "properties", PROPERTY_FIELDS);
  const [propertyName, setPropertyName] = useState(initialPayload.property_name ?? "");
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = propertyName.trim();
    const fieldValues: Record<string, unknown> = {
      property_name: trimmedName,
      is_active: isActive,
    };

    if (
      getMissingRequiredFields(["property_name"], (fieldKey) => fieldValues[fieldKey])
        .length > 0
    ) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const rawPayload = {
      property_name: trimmedName,
      is_active: isActive,
    };

    await onSubmit(filterPayload(rawPayload) as PropertyPayload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {showField("property_name") && (
          <div>
            <Label htmlFor="name">
              {t("common.item_name", { item: t("admin.nav.property") })}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="propertyName"
              type="text"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.property"),
              })}
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Select
              id="isActive"
              value={isActive ? "true" : "false"}
              onChange={(val) => setIsActive(val === "true")}
              options={[
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
              ]}
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-custom text-white px-4 py-2 rounded disabled:opacity-50 transition-colors"
        >
          {isSubmitting
            ? isEdit
              ? t("common.updating")
              : t("common.saving")
            : isEdit
              ? t("common.update")
              : t("common.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

function PropertyForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const { applyCompanyProjectFromRecord, companyUniqueId, projectId } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.properties.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
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
  }, [id, isEdit, applyCompanyProjectFromRecord]);

  const title = isEdit
    ? t("common.edit_item", { item: t("admin.nav.property") })
    : t("common.add_item", { item: t("admin.nav.property") });

  const submitProperty = async (payload: PropertyPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.properties.update(id as string, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.properties.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: extractErrorMessage(error, t("common.save_failed_desc")),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && loadingRecord && !recordData) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  const initialPayload: PropertyPayload = recordData
    ? {
        property_name: String(recordData.property_name ?? ""),
        is_active: Boolean(recordData.is_active),
      }
    : {
        property_name: "",
        is_active: true,
      };

  const formKey = isEdit
    ? String(recordData?.unique_id ?? id)
    : "new-property";

  return (
    <ComponentCard title={title}>
      <PropertyEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
        onSubmit={submitProperty}
      />
    </ComponentCard>
  );
}

export default PropertyForm;
