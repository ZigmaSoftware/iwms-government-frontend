import type { HierarchyPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
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
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import type { ApiError } from "./types";


const { encMasters, encHierarchies } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encMasters, encHierarchies);

const HIERARCHY_FIELDS: Record<string, string[]> = {
  area_type: ["area_type", "area_type_id"],
  level_name: ["level_name", "name"],
  is_active: ["is_active"],
};

export default function HierarchyForm() {
  const { t } = useTranslation();
  const { showField, filterPayload, getMissingRequiredFields } =
    useFieldVisibility("masters", "hierarchies", HIERARCHY_FIELDS);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [areaTypeId, setAreaTypeId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [areaTypes, setAreaTypes] = useState<{ value: string; label: string }[]>([]);
  const [pendingAreaTypeId, setPendingAreaTypeId] = useState("");

  // Fetch area types list
  useEffect(() => {
    let cancelled = false;
    adminApi.areatypes.readAll()
      .then((res: any) => {
        if (cancelled) return;
        const data: any[] = Array.isArray(res) ? res : [];
        setAreaTypes(
          data
            .filter((record) => record && record.is_active !== false)
            .map((record) => ({
              value: String(record.unique_id),
              label: record.name ?? record.area_type_name ?? String(record.unique_id),
            }))
        );
      })
      .catch(() => {
        if (cancelled) return;
        // silently ignore area types fetch error
      });
    return () => { cancelled = true; };
  }, []);

  // Apply pending area type once the list has loaded
  useEffect(() => {
    if (
      pendingAreaTypeId &&
      areaTypes.length > 0 &&
      areaTypes.some((a) => a.value === pendingAreaTypeId)
    ) {
      setAreaTypeId(pendingAreaTypeId);
      setPendingAreaTypeId("");
    }
  }, [pendingAreaTypeId, areaTypes]);

  // Fetch hierarchy record in edit mode
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.hierarchies.read(id)
      .then((res: any) => {
        if (cancelled) return;
        const record = res;
        setRecordData(record);
        setLoadingRecord(false);

        setName(record.level_name ?? "");
        setIsActive(Boolean(record.is_active));
        if (record.area_type ?? record.area_type_id) {
          setPendingAreaTypeId(String(record.area_type ?? record.area_type_id));
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        const message =
          (err as ApiError)?.response?.data?.detail ||
          t("common.load_failed");
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: message,
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldValues: Record<string, unknown> = {
      level_name: name.trim(),
      area_type: areaTypeId,
    };

    if (
      getMissingRequiredFields(["level_name"], (fieldKey) => fieldValues[fieldKey])
        .length > 0
    ) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
      });
      return;
    }

    if (
      getMissingRequiredFields(["area_type"], (fieldKey) => fieldValues[fieldKey])
        .length > 0
    ) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: "Area Type is required",
      });
      return;
    }

    setLoading(true);
    setIsSubmitting(true);
    try {
      const rawPayload = {
        level_name: name.trim(),
        area_type: areaTypeId,
        is_active: isActive,
      };
      const basePayload = filterPayload(rawPayload) as HierarchyPayload;
      if (isEdit) {
        await adminApi.hierarchies.update(id as string, basePayload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.hierarchies.create(basePayload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }
      navigate(ENC_LIST_PATH);
    } catch (error: unknown) {
      const message =
        (error as ApiError)?.response?.data?.detail ||
        t("common.save_failed_desc");
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: message,
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  if (isEdit && loadingRecord && !recordData) {
    return (
      <ComponentCard
        title={t("common.edit_item", { item: t("admin.nav.hierarchy") })}
      >
        <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
      </ComponentCard>
    );
  }

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.hierarchy") })
          : t("common.add_item", { item: t("admin.nav.hierarchy") })
      }
    >
      <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">{showField("area_type") && (
          <div>
            <Label htmlFor="areaType">
              Area Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={areaTypeId}
              onValueChange={setAreaTypeId}
              disabled={areaTypes.length === 0}
            >
              <SelectTrigger id="areaType">
                <SelectValue placeholder="Select Area Type" />
              </SelectTrigger>
              <SelectContent>
                {areaTypes.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {areaTypes.length === 0 && (
              <p className="mt-1 text-xs text-red-500">No area types found.</p>
            )}
          </div>
        )}

        {showField("level_name") && (
          <div>
            <Label htmlFor="name">
              {t("common.item_name", { item: t("admin.nav.hierarchy") })}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.hierarchy"),
              })}
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
              value={isActive ? "true" : "false"}
              onValueChange={(value) => setIsActive(value === "true")}
            >
              <SelectTrigger id="isActive">
                <SelectValue placeholder={t("common.select_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t("common.active")}</SelectItem>
                <SelectItem value="false">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3">
          <Button type="submit" disabled={loading || isSubmitting}>
            {loading
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
