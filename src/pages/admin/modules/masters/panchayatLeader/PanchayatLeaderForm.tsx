import type { PanchayatOption } from "./types";
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
import { panchayatApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

type RecordRow = Record<string, any>;

type PLBInitialPayload = {
  username: string;
  password: string;
  email: string;
  leader_name: string;
  panchayat_id: string;
  is_active: string;
};

type PLBEditorProps = {
  initialPayload: PLBInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  panchayatOptions: PanchayatOption[];
  loadingPanchayats: boolean;
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

const PLB_FIELDS: Record<string, string[]> = {
  panchayat_id: ["panchayat_id"],
  leader_name: ["leader_name"],
  username: ["username"],
  email: ["email"],
  password: ["password"],
  is_active: ["is_active"],
};

function PanchayatLeaderEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  panchayatOptions,
  loadingPanchayats,
}: PLBEditorProps) {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const { showField } = useFieldVisibility("masters", "panchayatleaders", PLB_FIELDS);

  const [formData, setFormData] = useState(initialPayload);
  const [pendingPanchayatId, setPendingPanchayatId] = useState<string | null>(
    initialPayload.panchayat_id || null
  );
  const [panchayatTakenBy, setPanchayatTakenBy] = useState<string | null>(null);
  const [checkingPanchayat, setCheckingPanchayat] = useState(false);

  // Apply pending panchayat_id once options are loaded
  useEffect(() => {
    if (!pendingPanchayatId || panchayatOptions.length === 0) return;
    const match = panchayatOptions.find((o) => o.value === pendingPanchayatId);
    if (match) {
      setFormData((prev) => ({ ...prev, panchayat_id: pendingPanchayatId }));
      setPendingPanchayatId(null);
    }
  }, [pendingPanchayatId, panchayatOptions]);

  // Check if selected panchayat already has a leader
  useEffect(() => {
    const pid = formData.panchayat_id;
    if (!pid) {
      setPanchayatTakenBy(null);
      return;
    }

    let cancelled = false;
    setCheckingPanchayat(true);

    adminApi.panchayatLeaders
      .readAll({ params: { panchayat_id: pid } })
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        const existing = rows.find(
          (r) => !r.is_deleted && (!isEdit || r.unique_id !== id)
        );
        setPanchayatTakenBy(
          existing
            ? existing.leader_name || existing.username || "another leader"
            : null
        );
      })
      .catch(() => { if (!cancelled) setPanchayatTakenBy(null); })
      .finally(() => { if (!cancelled) setCheckingPanchayat(false); });

    return () => { cancelled = true; };
  }, [formData.panchayat_id, isEdit, id]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id: fieldId, value } = e.target;
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.panchayat_id) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: "Please select a PLB." });
      return;
    }
    if (panchayatTakenBy) {
      Swal.fire({
        icon: "warning",
        title: "PLB Already Assigned",
        text: `This PLB already has a leader (${panchayatTakenBy}). Each PLB can have only one leader.`,
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
      panchayat_id: formData.panchayat_id,
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
        {showField("panchayat_id") && (
          <div>
            <Label htmlFor="panchayat_id">
              PLB (Participating Local Bodies){" "}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.panchayat_id}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, panchayat_id: v }));
                setPendingPanchayatId(null);
                setPanchayatTakenBy(null);
              }}
              disabled={isSubmitting || loadingPanchayats}
            >
              <SelectTrigger className="w-full" id="panchayat_id">
                <SelectValue
                  placeholder={
                    loadingPanchayats
                      ? "Loading PLBs…"
                      : panchayatOptions.length === 0
                        ? "No PLBs found"
                        : "Select PLB"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {panchayatOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {checkingPanchayat && (
              <p className="mt-1 text-xs text-gray-400">Checking availability…</p>
            )}
            {!checkingPanchayat && panchayatTakenBy && (
              <p className="mt-1 text-xs font-medium text-red-600">
                ⚠ This PLB already has a leader —{" "}
                <span className="font-semibold">{panchayatTakenBy}</span>.
              </p>
            )}
            {!checkingPanchayat && formData.panchayat_id && !panchayatTakenBy && (
              <p className="mt-1 text-xs text-green-600">✓ PLB is available</p>
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
          disabled={isSubmitting || checkingPanchayat || Boolean(panchayatTakenBy)}
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

export default function PanchayatLeaderForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { encLeaderLogin, encPlbLeaderCreation } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encLeaderLogin, encPlbLeaderCreation);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panchayatOptions, setPanchayatOptions] = useState<PanchayatOption[]>([]);
  const [loadingPanchayats, setLoadingPanchayats] = useState(false);

  const title = isEdit ? "Edit PLB Leader" : "Add PLB Leader";

  // Load panchayat options
  useEffect(() => {
    setLoadingPanchayats(true);
    panchayatApi
      .readAll()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setPanchayatOptions(
          list
            .filter((p: any) => p?.is_active !== false && p?.is_deleted !== true)
            .map((p: any) => ({
              value: String(p.unique_id ?? ""),
              label: p.panchayat_name ?? p.unique_id,
            }))
        );
      })
      .catch(() => setPanchayatOptions([]))
      .finally(() => setLoadingPanchayats(false));
  }, []);

  // Load record for edit
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.panchayatLeaders
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
          text: extractErrorMessage(err, "Failed to load panchayat leader details."),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const submitLeader = async (payload: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.panchayatLeaders.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.panchayatLeaders.create(payload);
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

  const panchayatId = recordData
    ? typeof recordData.panchayat_id === "object"
      ? String(recordData.panchayat_id?.unique_id ?? "")
      : String(recordData.panchayat_id ?? "")
    : "";

  const initialPayload: PLBInitialPayload = recordData
    ? {
        username: recordData.username ?? "",
        password: "",
        email: recordData.email ?? "",
        leader_name: recordData.leader_name ?? "",
        panchayat_id: panchayatId,
        is_active: recordData.is_active ? "1" : "0",
      }
    : {
        username: "",
        password: "",
        email: "",
        leader_name: "",
        panchayat_id: "",
        is_active: "1",
      };

  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-plb";

  return (
    <div className="p-6">
      <ComponentCard
        title={title}
        desc="Manage login credentials for a PLB (Participating Local Bodies) leader."
      >
        <PanchayatLeaderEditor
          key={formKey}
          initialPayload={initialPayload}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onCancel={() => navigate(LIST_PATH)}
          onSubmit={submitLeader}
          panchayatOptions={panchayatOptions}
          loadingPanchayats={loadingPanchayats}
        />
      </ComponentCard>
    </div>
  );
}
