import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation} from "react-router-dom";
import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

import { getEncryptedRoute } from "@/utils/routeCache";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { adminApi } from "@/helpers/admin/registry";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import type { SubPropertyEditorProps, SubPropertyPayload, SubPropertyOptionRecord } from "./types";

const { encMasters, encSubProperties } = getEncryptedRoute();

const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encSubProperties);

const SUB_PROPERTY_FIELDS: Record<string, string[]> = {
  property_id: ["property_id"],
  sub_property_name: ["sub_property_name"],
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

function SubPropertyEditor({
  initialPayload,
  properties,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
}: SubPropertyEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "sub-properties", SUB_PROPERTY_FIELDS);
  const [subPropertyName, setSubPropertyName] = useState(initialPayload.sub_property_name ?? "");
  const [propertyId, setPropertyId] = useState<string>(String(initialPayload.property_id ?? ""));
  const [pendingPropertyId, setPendingPropertyId] = useState<string>(
    initialPayload.property_id ? String(initialPayload.property_id) : ""
  );
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  // Apply pending property id once the list has loaded and the option exists
  useEffect(() => {
    if (
      pendingPropertyId &&
      properties &&
      properties.length > 0 &&
      properties.some((p) => String(p.unique_id) === pendingPropertyId)
    ) {
      setPropertyId(pendingPropertyId);
      setPendingPropertyId("");
    }
  }, [pendingPropertyId, properties]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = subPropertyName.trim();
    const fieldValues: Record<string, unknown> = {
      sub_property_name: trimmedName,
      property_id: propertyId,
    };

    if (
      getMissingRequiredFields(
        ["sub_property_name", "property_id"],
        (fieldKey) => fieldValues[fieldKey],
      ).length > 0
    ) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.all_fields_required"),
      });
      return;
    }

    const rawPayload = {
      sub_property_name: trimmedName,
      property_id: propertyId,
      is_active: isActive,
    };

    await onSubmit(filterPayload(rawPayload) as SubPropertyPayload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {showField("property_id") && (
          <div>
            <Label htmlFor="property">
              {t("admin.nav.property")} *
            </Label>

            <Select
              value={propertyId || ""}
              onValueChange={(val) => setPropertyId(val)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="property" className="input-validate w-full">
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.property"),
                  })}
                />
              </SelectTrigger>

              <SelectContent>
                {properties
                  ?.filter((p) => p.is_active === true)
                  .map((p) => (
                    <SelectItem key={p.unique_id} value={String(p.unique_id)}>
                      {p.property_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showField("sub_property_name") && (
          <div>
            <Label htmlFor="subPropertyName">
              {t("common.item_name", { item: t("admin.nav.sub_property") })} *
            </Label>
            <Input
              id="subPropertyName"
              type="text"
              className="input-validate w-full"
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.sub_property"),
              })}
              value={subPropertyName}
              onChange={(e) => setSubPropertyName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">{t("common.status")} *</Label>

            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(val) => setIsActive(val === "true")}
              disabled={isSubmitting}
            >
              <SelectTrigger id="isActive" className="input-validate w-full">
                <SelectValue placeholder={t("common.select_status")} />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-green-custom text-white px-4 py-2 rounded disabled:opacity-50"
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

export default function SubPropertyForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;
  const { applyCompanyProjectFromRecord, companyUniqueId, projectId } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const [subPropertyData, setSubPropertyData] = useState<any>(null);
  const [properties, setProperties] = useState<SubPropertyOptionRecord[]>([]);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = isEdit
    ? t("common.edit_item", { item: t("admin.nav.sub_property") })
    : t("common.add_item", { item: t("admin.nav.sub_property") });

  useEffect(() => {
    let cancelled = false;
    adminApi.properties.readAll()
      .then((res: any) => {
        if (cancelled) return;
        setProperties(Array.isArray(res) ? res : (res?.results ?? []));
      })
      .catch((error) => {
        if (cancelled) return;
        Swal.fire(
          t("common.error"),
          extractErrorMessage(error, t("common.fetch_failed")),
          "error"
        );
      });
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.subProperties.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setSubPropertyData(res);
        applyCompanyProjectFromRecord(res as unknown as Record<string, unknown>);
      })
      .catch((error) => {
        if (cancelled) return;
        Swal.fire(
          t("common.error"),
          extractErrorMessage(error, t("common.load_failed")),
          "error"
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingRecord(false);
      });
    return () => { cancelled = true; };
  }, [id, isEdit, applyCompanyProjectFromRecord, t]);

  const submitSubProperty = async (payload: SubPropertyPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.subProperties.update(id as string, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1400,
          showConfirmButton: false,
        });
      } else {
        await adminApi.subProperties.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1400,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error: unknown) {
      const message = extractErrorMessage(error, t("common.save_failed_desc"));
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEdit && loadingRecord && !subPropertyData) {
    return (
      <ComponentCard title={title}>
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  const initialPayload: SubPropertyPayload = subPropertyData
    ? {
        sub_property_name: String(subPropertyData.sub_property_name ?? ""),
        property_id: subPropertyData.property_id ?? subPropertyData.property ?? "",
        is_active: Boolean(subPropertyData.is_active),
      }
    : {
        sub_property_name: "",
        property_id: "",
        is_active: true,
      };

  const formKey = isEdit
    ? String(subPropertyData?.unique_id ?? id)
    : "new-sub-property";

  return (
    <ComponentCard title={title}>
      <SubPropertyEditor
        key={formKey}
        initialPayload={initialPayload}
        properties={properties}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(ENC_LIST_PATH, { state: { companyUniqueId, projectId } })}
        onSubmit={submitSubProperty}
      />
    </ComponentCard>
  );
}
