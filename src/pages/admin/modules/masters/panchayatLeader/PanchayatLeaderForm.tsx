import type { PanchayatOption } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Swal from "@/lib/notify";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import PasswordInput from "@/components/form/input/PasswordInput";
import { getEncryptedRoute } from "@/utils/routeCache";
import { panchayatLeaderApi, panchayatApi } from "@/helpers/admin";
import { useCompanyProjectSelection } from "@/hooks/useCompanyProjectSelection";


const initialForm = {
  username: "",
  password: "",
  email: "",
  leader_name: "",
  panchayat_id: "",
  is_active: "1",
};

const activeOptions = [
  { value: "1", label: "Active" },
  { value: "0", label: "Inactive" },
];

export default function PanchayatLeaderForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { companyUniqueId?: string; projectId?: string } | null;

  const { encMasters, encPanchayatLeaders } = getEncryptedRoute();
  const { listPath: LIST_PATH } = createCrudRoutePaths(encMasters, encPanchayatLeaders);

  /* ── company / project (same hook used by all forms) ── */
  const {
    companyUniqueId,
    projectId,
    projects,
    companies,
    isSuperAdmin,
    loggedInCompanyUniqueId,
    setProjectId,
    onCompanyChange,
    applyCompanyProjectFromRecord,
  } = useCompanyProjectSelection({
    isEdit,
    initialCompanyId: routeState?.companyUniqueId,
    initialProjectId: routeState?.projectId,
  });

  const [formData, setFormData] = useState(initialForm);
  const [panchayatOptions, setPanchayatOptions] = useState<PanchayatOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Pending panchayat_id — applied once panchayatOptions contains the matching entry
  const [pendingPanchayatId, setPendingPanchayatId] = useState<string | null>(null);

  // Tracks whether the selected panchayat already has a leader
  const [panchayatTakenBy, setPanchayatTakenBy] = useState<string | null>(null);
  const [checkingPanchayat, setCheckingPanchayat] = useState(false);

  /* ── panchayat list: filter by company + project when available ── */
  useEffect(() => {
    const params: Record<string, string> = {};
    if (companyUniqueId) params.company_id = companyUniqueId;
    if (projectId) params.project_id = projectId;

    panchayatApi
      .readAll(Object.keys(params).length ? { params } : undefined)
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
      .catch(() => setPanchayatOptions([]));
  }, [companyUniqueId, projectId]);

  /* ── apply pending panchayat_id once options are loaded (pending prefill pattern) ── */
  useEffect(() => {
    if (!pendingPanchayatId || panchayatOptions.length === 0) return;
    const match = panchayatOptions.find((o) => o.value === pendingPanchayatId);
    if (match) {
      setFormData((prev) => ({ ...prev, panchayat_id: pendingPanchayatId }));
      setPendingPanchayatId(null);
    }
  }, [pendingPanchayatId, panchayatOptions]);

  /* ── check if selected panchayat already has a leader ── */
  useEffect(() => {
    const pid = formData.panchayat_id;
    if (!pid) {
      setPanchayatTakenBy(null);
      return;
    }

    let cancelled = false;
    setCheckingPanchayat(true);

    panchayatLeaderApi
      .readAll({ params: { panchayat_id: pid } })
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        const existing = rows.find(
          (r) =>
            !r.is_deleted &&
            // on edit: ignore the record we're currently editing
            (!isEdit || r.unique_id !== id)
        );
        setPanchayatTakenBy(
          existing
            ? (existing.leader_name || existing.username || "another leader")
            : null
        );
      })
      .catch(() => { if (!cancelled) setPanchayatTakenBy(null); })
      .finally(() => { if (!cancelled) setCheckingPanchayat(false); });

    return () => { cancelled = true; };
  }, [formData.panchayat_id, isEdit, id]);

  /* ── edit: load existing record ── */
  useEffect(() => {
    if (!isEdit || !id) return;
    setFetching(true);
    panchayatLeaderApi.read(id)
      .then((record: any) => {
        const panchayatId =
          typeof record.panchayat_id === "object"
            ? String(record.panchayat_id?.unique_id ?? "")
            : String(record.panchayat_id ?? "");

        setFormData({
          username: record.username ?? "",
          password: record.password ?? "",
          email: record.email ?? "",
          leader_name: record.leader_name ?? "",
          panchayat_id: "",          // cleared — applied via pending after options load
          is_active: record.is_active ? "1" : "0",
        });

        // Store panchayat_id as pending so it's applied only after options are ready
        if (panchayatId) setPendingPanchayatId(panchayatId);

        /* sync company + project via the hook */
        applyCompanyProjectFromRecord(record as unknown as Record<string, unknown>);
      })
      .catch(() =>
        Swal.fire("Error", "Failed to load panchayat leader details.", "error")
      )
      .finally(() => setFetching(false));
  }, [id, isEdit, applyCompanyProjectFromRecord]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id: fieldId, value } = e.target;
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSelectChange = (field: keyof typeof initialForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!companyUniqueId) {
      Swal.fire(
        "Error",
        !loggedInCompanyUniqueId && !isSuperAdmin
          ? "Company is not mapped to this login. Only super admin can choose a company."
          : "Company is required.",
        "error"
      );
      return;
    }

    if (!projectId) {
      Swal.fire("Error", "Project is required.", "error");
      return;
    }

    if (!formData.panchayat_id) {
      Swal.fire("Validation", "Please select a panchayat.", "warning");
      return;
    }
    if (panchayatTakenBy) {
      Swal.fire(
        "Panchayat Already Assigned",
        `This panchayat already has a leader (${panchayatTakenBy}). Each panchayat can have only one leader.`,
        "warning"
      );
      return;
    }
    if (!formData.username.trim()) {
      Swal.fire("Validation", "Username is required.", "warning");
      return;
    }
    if (!isEdit && !formData.password.trim()) {
      Swal.fire("Validation", "Password is required when creating a new leader.", "warning");
      return;
    }

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      username: formData.username.trim(),
      email: formData.email.trim() || null,
      leader_name: formData.leader_name.trim() || null,
      panchayat_id: formData.panchayat_id,
      company_id: companyUniqueId,
      project_id: projectId,
      is_active: formData.is_active === "1",
    };

    if (formData.password.trim()) {
      payload.password = formData.password.trim();
    }

    try {
      if (isEdit && id) {
        await panchayatLeaderApi.update(id, payload);
        Swal.fire("Success", "Panchayat leader updated successfully.", "success");
      } else {
        await panchayatLeaderApi.create(payload);
        Swal.fire("Success", "Panchayat leader created successfully.", "success");
      }
      navigate(LIST_PATH, { state: { companyUniqueId, projectId } });
    } catch (error: any) {
      const errData = error?.response?.data;
      const message =
        typeof errData === "string"
          ? errData
          : errData?.errors
            ? Object.entries(errData.errors as Record<string, string[]>)
                .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
                .join("\n")
            : errData?.detail ?? "Failed to save. Please try again.";

      Swal.fire("Save Failed", message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── company options for display ── */
  const companyOptions = companies.map((c) => ({ value: c.value, label: c.label }));
  const projectOptions = projects.map((p) => ({ value: p.value, label: p.label }));

  return (
    <div className="p-6">
      <ComponentCard
        title={isEdit ? "Edit PLB Leader" : "Add PLB Leader"}
        desc="Manage login credentials for a PLB (Participating Local Bodies) leader."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* ── Panchayat ── */}
            <div>
              <Label htmlFor="panchayat_id">
                PLB (Participating Local Bodies) <span className="text-red-500 ml-1">*</span>
              </Label>
              <Select
                id="panchayat_id"
                value={formData.panchayat_id}
                onChange={(v) => {
                  handleSelectChange("panchayat_id", v);
                  setPanchayatTakenBy(null);
                }}
                options={panchayatOptions}
                placeholder={
                  !companyUniqueId || !projectId
                    ? "Select company & project first"
                    : panchayatOptions.length === 0
                      ? "No PLBs found"
                      : "Select PLB"
                }
                disabled={fetching || !companyUniqueId || !projectId}
              />
              {checkingPanchayat && (
                <p className="mt-1 text-xs text-gray-400">Checking availability…</p>
              )}
              {!checkingPanchayat && panchayatTakenBy && (
                <p className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">
                  <span>⚠</span>
                  This PLB already has a leader —{" "}
                  <span className="font-semibold">{panchayatTakenBy}</span>.
                  Each PLB can have only one leader.
                </p>
              )}
              {!checkingPanchayat && formData.panchayat_id && !panchayatTakenBy && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <span>✓</span> PLB is available
                </p>
              )}
            </div>

            {/* ── Leader Name ── */}
            <div>
              <Label htmlFor="leader_name">Leader Name</Label>
              <Input
                id="leader_name"
                value={formData.leader_name}
                onChange={handleInputChange}
                placeholder="Full name of the leader"
                disabled={fetching}
              />
            </div>

            {/* ── Username ── */}
            <div>
              <Label htmlFor="username">
                Username <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Login username"
                disabled={fetching}
                required
              />
            </div>

            {/* ── Email ── */}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Contact email (optional)"
                disabled={fetching}
              />
            </div>

            {/* ── Password ── */}
            <div>
              <Label htmlFor="password">
                Password{!isEdit && <span className="text-red-500 ml-1">*</span>}
                {/* {isEdit && (
                  <span className="ml-1 text-xs text-gray-400">
                    (leave blank to keep current)
                  </span>
                )} */}
              </Label>
              <PasswordInput
                id="password"
                label=""
                value={formData.password}
                onChange={handleInputChange}
                placeholder={isEdit ? "Enter new password to change" : "Set login password"}
              />
            </div>

            {/* ── Status ── */}
            <div>
              <Label htmlFor="is_active">Status</Label>
              <Select
                id="is_active"
                value={formData.is_active}
                onChange={(v) => handleSelectChange("is_active", v)}
                options={activeOptions}
                placeholder="Select status"
              />
            </div>

          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={submitting || fetching || checkingPanchayat || Boolean(panchayatTakenBy)}
              className="rounded-lg bg-green-custom px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting
                ? isEdit ? "Updating…" : "Saving…"
                : isEdit ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => navigate(LIST_PATH, { state: { companyUniqueId, projectId } })}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </ComponentCard>
    </div>
  );
}
