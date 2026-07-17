import type { StateOption } from "./types";
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
import { stateApi } from "@/helpers/admin";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { mergeWithScopeOption } from "../../masters/shared/dataScopeOptions";

type RecordRow = Record<string, any>;

type StateLeaderInitialPayload = {
  username: string;
  password: string;
  email: string;
  leader_name: string;
  state_id: string;
  is_active: string;
};

type StateLeaderEditorProps = {
  initialPayload: StateLeaderInitialPayload;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  stateOptions: StateOption[];
  loadingStates: boolean;
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

const STATE_LEADER_FIELDS: Record<string, string[]> = {
  state_id: ["state_id"],
  leader_name: ["leader_name"],
  username: ["username"],
  email: ["email"],
  password: ["password"],
  is_active: ["is_active"],
};

function StateLeaderEditor({
  initialPayload,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  stateOptions,
  loadingStates,
}: StateLeaderEditorProps) {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const { showField } = useFieldVisibility("masters", "stateleaders", STATE_LEADER_FIELDS);

  const [formData, setFormData] = useState(initialPayload);
  const [pendingStateId, setPendingStateId] = useState<string | null>(
    initialPayload.state_id || null
  );
  const [stateTakenBy, setStateTakenBy] = useState<string | null>(null);
  const [checkingState, setCheckingState] = useState(false);

  // Apply pending state_id once options are loaded
  useEffect(() => {
    if (!pendingStateId || stateOptions.length === 0) return;
    const match = stateOptions.find((o) => o.value === pendingStateId);
    if (match) {
      setFormData((prev) => ({ ...prev, state_id: pendingStateId }));
      setPendingStateId(null);
    }
  }, [pendingStateId, stateOptions]);

  // Check if selected state already has a leader
  useEffect(() => {
    const sid = formData.state_id;
    if (!sid) {
      setStateTakenBy(null);
      return;
    }

    let cancelled = false;
    setCheckingState(true);

    adminApi.stateLeaders
      .readAll({ params: { state_id: sid } })
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        const existing = rows.find(
          (r) => !r.is_deleted && (!isEdit || r.unique_id !== id)
        );
        setStateTakenBy(
          existing
            ? existing.leader_name || existing.username || "another leader"
            : null
        );
      })
      .catch(() => { if (!cancelled) setStateTakenBy(null); })
      .finally(() => { if (!cancelled) setCheckingState(false); });

    return () => { cancelled = true; };
  }, [formData.state_id, isEdit, id]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id: fieldId, value } = e.target;
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.state_id) {
      Swal.fire({ icon: "warning", title: t("common.warning"), text: "Please select a State." });
      return;
    }
    if (stateTakenBy) {
      Swal.fire({
        icon: "warning",
        title: "State Already Assigned",
        text: `This State already has a leader (${stateTakenBy}). Each State can have only one leader.`,
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
      state_id: formData.state_id,
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
        {showField("state_id") && (
          <div>
            <Label htmlFor="state_id">
              State{" "}
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Select
              value={formData.state_id}
              onValueChange={(v) => {
                setFormData((prev) => ({ ...prev, state_id: v }));
                setPendingStateId(null);
                setStateTakenBy(null);
              }}
              disabled={isSubmitting || loadingStates}
            >
              <SelectTrigger className="w-full" id="state_id">
                <SelectValue
                  placeholder={
                    loadingStates
                      ? "Loading States…"
                      : stateOptions.length === 0
                        ? "No States found"
                        : "Select State"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {checkingState && (
              <p className="mt-1 text-xs text-gray-400">Checking availability…</p>
            )}
            {!checkingState && stateTakenBy && (
              <p className="mt-1 text-xs font-medium text-red-600">
                ⚠ This State already has a leader —{" "}
                <span className="font-semibold">{stateTakenBy}</span>.
              </p>
            )}
            {!checkingState && formData.state_id && !stateTakenBy && (
              <p className="mt-1 text-xs text-green-600">✓ State is available</p>
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
          disabled={isSubmitting || checkingState || Boolean(stateTakenBy)}
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

export default function StateLeaderForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { encLeaderLogin, encStateLeaderCreation } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encLeaderLogin, encStateLeaderCreation);

  const [recordData, setRecordData] = useState<RecordRow | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stateOptions, setStateOptions] = useState<StateOption[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);

  const title = isEdit ? "Edit State Leader" : "Add State Leader";

  // Load state options
  useEffect(() => {
    setLoadingStates(true);

    // The State screen may not be permission-granted to this user at all
    // (View gates the States menu/list, not this dropdown) — their Data
    // Scope from login always supplies their own state regardless.
    setStateOptions((prev) => mergeWithScopeOption(prev, "state"));

    stateApi
      .readAll()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const fetched = list
          .filter((s: any) => s?.is_active !== false && s?.is_deleted !== true)
          .map((s: any) => ({
            value: String(s.unique_id ?? ""),
            label: s.state_name ?? s.name ?? s.unique_id,
          }));
        setStateOptions(mergeWithScopeOption(fetched, "state"));
      })
      .catch(() => setStateOptions((prev) => mergeWithScopeOption(prev, "state")))
      .finally(() => setLoadingStates(false));
  }, []);

  // Load record for edit
  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.stateLeaders
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
          text: extractErrorMessage(err, "Failed to load state leader details."),
        });
      });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const submitLeader = async (payload: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await adminApi.stateLeaders.update(id, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.stateLeaders.create(payload);
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

  const stateId = recordData
    ? typeof recordData.state_id === "object"
      ? String(recordData.state_id?.unique_id ?? "")
      : String(recordData.state_id ?? "")
    : "";

  const initialPayload: StateLeaderInitialPayload = recordData
    ? {
        username: recordData.username ?? "",
        password: "",
        email: recordData.email ?? "",
        leader_name: recordData.leader_name ?? "",
        state_id: stateId,
        is_active: recordData.is_active ? "1" : "0",
      }
    : {
        username: "",
        password: "",
        email: "",
        leader_name: "",
        state_id: "",
        is_active: "1",
      };

  const formKey = isEdit ? String(recordData?.unique_id ?? id) : "new-state-leader";

  return (
    <div className="p-6">
      <ComponentCard
        title={title}
        desc="Manage login credentials for a State leader."
      >
        <StateLeaderEditor
          key={formKey}
          initialPayload={initialPayload}
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onCancel={() => navigate(LIST_PATH)}
          onSubmit={submitLeader}
          stateOptions={stateOptions}
          loadingStates={loadingStates}
        />
      </ComponentCard>
    </div>
  );
}
