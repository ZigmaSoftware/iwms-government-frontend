import type { ContinentPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
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

import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import type { ContinentEditorProps } from "./types";
import GeoFenceCoordinates, {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
  type GeoCoordinateDraft,
} from "@/pages/admin/modules/masters/shared/GeoFenceCoordinates";

const { encCommonMasters, encContinents } = getEncryptedRoute();

const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encCommonMasters, encContinents);

const CONTINENT_FIELDS: Record<string, string[]> = {
  name: ["name"],
  coordinates: ["coordinates"],
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

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

function ContinentEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
}: ContinentEditorProps) {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("common-masters", "continents", CONTINENT_FIELDS);
  const [name, setName] = useState(initialPayload.name);
  const [coordinates, setCoordinates] = useState<GeoCoordinateDraft[]>(
    normalizeCoordinateDrafts(initialPayload.coordinates),
  );
  const [isActive, setIsActive] = useState(initialPayload.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const fieldValues: Record<string, unknown> = {
      name: trimmedName,
      is_active: isActive,
    };

    if (getMissingRequiredFields(["name"], (fieldKey) => fieldValues[fieldKey]).length > 0) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const rawPayload = {
      name: trimmedName,
      coordinates: serializeCoordinateDrafts(coordinates),
      is_active: isActive,
    };

    await onSubmit(filterPayload(rawPayload) as ContinentPayload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {showField("name") && (
          <div>
            <Label htmlFor="continentName">
              {t("common.item_name", { item: t("admin.nav.continent") })}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="continentName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.continent"),
              })}
              className="input-validate w-full"
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {showField("coordinates") && (
          <GeoFenceCoordinates coordinates={coordinates} onChange={setCoordinates} />
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(value) => setIsActive(value === "true")}
              disabled={isSubmitting}
            >
              <SelectTrigger className="input-validate w-full" id="isActive">
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

      <div className="mt-6 flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? t("common.updating")
              : t("common.saving")
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

function ContinentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = isEdit
    ? t("common.edit_item", { item: t("admin.nav.continent") })
    : t("common.add_item", { item: t("admin.nav.continent") });

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.continents.read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: extractErrorMessage(err, t("common.load_failed")) });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const submitContinent = async (payload: ContinentPayload) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        await adminApi.continents.update(id as string, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.continents.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH);
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

  const initialPayload: ContinentPayload = recordData
    ? {
        name: String(recordData.name ?? ""),
        coordinates: serializeCoordinateDrafts(
          normalizeCoordinateDrafts(recordData.coordinates),
        ),
        is_active: Boolean(recordData.is_active),
      }
    : {
        name: "",
        coordinates: [],
        is_active: true,
      };

  const formKey = isEdit
    ? String(recordData?.unique_id ?? id)
    : "new-continent";

  return (
    <ComponentCard title={title}>
      <ContinentEditor
        key={formKey}
        initialPayload={initialPayload}
        isEdit={isEdit}
        isSubmitting={isSubmitting}
        onCancel={() => navigate(ENC_LIST_PATH)}
        onSubmit={submitContinent}
      />
    </ComponentCard>
  );
}

export default ContinentForm;
