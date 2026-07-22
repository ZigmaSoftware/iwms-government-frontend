import type { HierarchyPayload } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { FieldError } from "@/components/form/FieldError";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import { hierarchySchema, type HierarchyFormValues } from "@/schemas/hierarchy.schema";
import { requireWhenVisible } from "@/schemas/visibility";
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
  const { showField, filterPayload } =
    useFieldVisibility("masters", "hierarchies", HIERARCHY_FIELDS);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [areaTypes, setAreaTypes] = useState<{ value: string; label: string }[]>([]);
  const [pendingAreaTypeId, setPendingAreaTypeId] = useState("");

  const schema = useMemo(() => requireWhenVisible(hierarchySchema, showField), [showField]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<HierarchyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      level_name: "",
      area_type: "",
      is_active: true,
    },
  });

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
      setValue("area_type", pendingAreaTypeId);
      setPendingAreaTypeId("");
    }
  }, [pendingAreaTypeId, areaTypes, setValue]);

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

        setValue("level_name", record.level_name ?? "");
        setValue("is_active", Boolean(record.is_active));
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
  }, [id, isEdit, setValue, t]);

  const onValid = async (values: HierarchyFormValues) => {
    setLoading(true);
    setIsSubmitting(true);
    try {
      const rawPayload = {
        level_name: values.level_name.trim(),
        area_type: values.area_type,
        is_active: values.is_active,
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
      <form onSubmit={handleSubmit(onValid)} noValidate className="grid md:grid-cols-2 gap-6">{showField("area_type") && (
          <div>
            <Label htmlFor="areaType">
              Area Type <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="area_type"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
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
              )}
            />
            {areaTypes.length === 0 && (
              <p className="mt-1 text-xs text-red-500">No area types found.</p>
            )}
            <FieldError message={errors.area_type?.message} />
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
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.hierarchy"),
              })}
              {...register("level_name")}
            />
            <FieldError message={errors.level_name?.message} />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Select
                  value={field.value ? "true" : "false"}
                  onValueChange={(value) => field.onChange(value === "true")}
                >
                  <SelectTrigger id="isActive">
                    <SelectValue placeholder={t("common.select_status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("common.active")}</SelectItem>
                    <SelectItem value="false">{t("common.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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
