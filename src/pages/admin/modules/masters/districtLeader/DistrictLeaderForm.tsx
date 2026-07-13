import type { DistrictOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PasswordInput from "@/components/form/input/PasswordInput";
import { getEncryptedRoute } from "@/utils/routeCache";
import { adminApi } from "@/helpers/admin/registry";
import { districtApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { mergeWithScopeOption } from "../shared/dataScopeOptions";

type RecordRow = Record<string, any>;

type DistrictLeaderInitialPayload = {
  username: string;
  password: string;
  email: string;
  leader_name: string;
  district_id: string;
  is_active: string;
};

type DistrictLeaderEditorProps = {
  initialPayload: DistrictLeaderInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  districtOptions: DistrictOption[];
  loadingDistricts: boolean;
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object") {
    const errData = data as Record<string, unknown>;
    if (errData.errors) {
      return Object.entries(errData.errors as Record<string, string[]>)
        .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
        .join("\n");
    }
    return Object.entries(errData)
      .map(
        ([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const DISTRICT_LEADER_FIELDS: Record<string, string[]> = {
  district_id: ["district_id"],
  leader_name: ["leader_name"],
  username: ["username"],
  email: ["email"],
  password: ["password"],
  is_active: ["is_active"],
};

function DistrictLeaderEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  districtOptions,
  loadingDistricts,
}: DistrictLeaderEditorProps) {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const { showField } = useFieldVisibility("masters", "districtleaders", DISTRICT_LEADER_FIELDS);

  const [formData, setFormData] = useState(initialPayload);
  const [pendingDistrictId, setPendingDistrictId] = useState<string | null>(
    initialPayload.district_id || null
  );
  const [districtTakenBy, setDistrictTakenBy] = useState<string | null>(null);
  const [checkingDistrict, setCheckingDistrict] = useState(false);

  // Apply pending district_id once options are loaded
  useEffect(() => {
    if (!pendingDistrictId || districtOptions.length === 0) return;
    const match = districtOptions.find((o) => o.value === pendingDistrictId);
    if (match) {
      setFormData((prev) => ({ ...prev, district_id: pendingDistrictId }));
      setPendingDistrictId(null);
    }
  }, [pendingDistrictId, districtOptions]);

  // Check if selected district already has a leader
  useEffect(() => {
    const did = formData.district_id;
    if (!did) {
      setDistrictTakenBy(null);
      return;
    }

    let cancelled = false;
    setCheckingDistrict(true);

    adminApi.districtLeaders
      .readAll({ params: { district_id: did } })
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        const existing = rows.find(
          (r) => !r.is_deleted && (!isEdit || r.unique_id !== id)
        );
        setDistrictTakenBy(
          existing
            ? existing.leader_name || existing.username || "another leader"
            : null
        );
      })
      .catch(() => { if (!cancelled) setDistrictTakenBy(null); })
      .finally(() => { if (!cancelled) setCheckingDistrict(false); });

    return () => { cancelled = true; };
  }, [formData.district_id, isEdit, id]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id: fieldId, value } = e.target;
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.district_id) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: "Please select a District." });
      return;
    }
    if (districtTakenBy) {
      Swal.fire({
        icon: "warning",
        title: "District Already Assigned",
        text: `This District already has a leader (${districtTakenBy}). Each District can have only one leader.`,
      });
      return;
    }
    if (!formData.username.trim()) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: "Username is required." });
      return;
    }
    if (!isEdit && !formData.password.trim()) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: "Password is required when creating a new leader." });
      return;
    }

    const payload: Record<string, unknown> = {
      username: formData.username.trim(),
      email: formData.email.trim() || null,
      leader_name: formData.leader_name.trim() || null,
      district_id: formData.district_id,
      is_active: formData.is_active === "1",
    };

    if (formData.password.trim()) {
      payload.password = formData.password.trim();
    }

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {showField("district_id") && (
          <div>
            <Label htmlFor="district_id">
              District{" "}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.district_id}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, district_id: v }));
                setPendingDistrictId(null);
                setDistrictTakenBy(null);
              }}
              disabled={isSubmitting || loadingDistricts}
            >
              <SelectTrigger className="w-full" id="district_id">
                <SelectValue
                  placeholder={
                    loadingDistricts
                      ? "Loading Districts…"
                      : districtOptions.length === 0
                        ? "No Districts found"
                        : "Select District"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {checkingDistrict && (
              <p className="mt-1 text-xs text-gray-400">Checking availability…</p>
            )}
            {!checkingDistrict && districtTakenBy && (
              <p className="mt-1 text-xs font-medium text-red-600">
                ⚠ This District already has a leader —{" "}
                <span className="font-semibold">{districtTakenBy}</span>.
              </p>
            )}
            {!checkingDistrict && formData.district_id && !districtTakenBy && (
              <p className="mt-1 text-xs text-green-600">✓ District is available</p>
            )}
          </div>
        )}

        {showField("leader_name") && (
          <div>
            <Label htmlFor="leader_name">Leader Name</Label>
            <Input
              id="leader_name"
              value={formData.leader_name}
              onChange={handleInputChange}
              placeholder="Full name of the leader"
              disabled={isSubmitting}
            />
          </div>
        )}

        {showField("username") && (
          <div>
            <Label htmlFor="username">
              Username <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Login username"
              disabled={isSubmitting}
              required
            />
          </div>
        )}

        {showField("email") && (
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Contact email (optional)"
              disabled={isSubmitting}
            />
          </div>
        )}

        {showField("password") && (
          <div>
            <Label htmlFor="password">
              Password{!isEdit && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <PasswordInput
              id="password"
              label=""
              value={formData.password}
              onChange={handleInputChange}
              placeholder={
                isEdit ? "Enter new password to change" : "Set login password"
              }
            />
          </div>
        )}

        {showField("is_active") && (
          <div>
            <Label htmlFor="is_active">{t("common.status")}</Label>
            <Select
              value={formData.is_active}
              onValueChange={(v) =>
                setFormData((prev) => ({ ...prev, is_active: v }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full" id="is_active">
                <SelectValue placeholder={t("common.select_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("common.active")}</SelectItem>
                <SelectItem value="0">{t("common.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || checkingDistrict || Boolean(districtTakenBy)}
        >
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

export default function DistrictLeaderForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { encLeaderLogin, encDistrictLeaderCreation } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encLeaderLogin, encDistrictLeaderCreation);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [districtOptions, setDistrictOptions] = useState<DistrictOption[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const title = isEdit ? "Edit District Leader" : "Add District Leader";

  // Load district options
  useEffect(() => {
    setLoadingDistricts(true);

    // The District screen may not be permission-granted to this user at all
    // (View gates the Districts menu/list, not this dropdown) — their Data
    // Scope from login always supplies their own district regardless.
    setDistrictOptions((prev) => mergeWithScopeOption(prev, "district"));

    districtApi
      .readAll()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const fetched = list
          .filter((d: any) => d?.is_active !== false && d?.is_deleted !== true)
          .map((d: any) => ({
            value: String(d.unique_id ?? ""),
            label: d.district_name ?? d.name ?? d.unique_id,
          }));
        setDistrictOptions(mergeWithScopeOption(fetched, "district"));
      })
      .catch(() => setDistrictOptions((prev) => mergeWithScopeOption(prev, "district")))
      .finally(() => setLoadingDistricts(false));
  }, []);

  // Load record for edit
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.districtLeaders
      .read(id)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: extractErrorMessage(err, "Failed to load district leader details."),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const submitLeader = async (payload: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.districtLeaders.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.districtLeaders.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }
      navigate(LIST_PATH);
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
      <div className="p-6">
        <ComponentCard title={title}>
          <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>
        </ComponentCard>
      </div>
    );
  }

  const districtId = recordData
    ? typeof recordData.district_id === "object"
      ? String(recordData.district_id?.unique_id ?? "")
      : String(recordData.district_id ?? "")
    : "";

  const initialPayload: DistrictLeaderInitialPayload = recordData
    ? {
        username: recordData.username ?? "",
        password: "",
        email: recordData.email ?? "",
        leader_name: recordData.leader_name ?? "",
        district_id: districtId,
        is_active: recordData.is_active ? "1" : "0",
      }
    : {
        username: "",
        password: "",
        email: "",
        leader_name: "",
        district_id: "",
        is_active: "1",
      };

  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-district-leader";

  return (
    <div className="p-6">
      <ComponentCard
        title={title}
        desc="Manage login credentials for a District leader."
      >
        <DistrictLeaderEditor
          key={formKey}
          initialPayload={initialPayload}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onCancel={() => navigate(LIST_PATH)}
          onSubmit={submitLeader}
          districtOptions={districtOptions}
          loadingDistricts={loadingDistricts}
        />
      </ComponentCard>
    </div>
  );
}
