import type { CompanyOption, ProjectCreateResponse, ProjectRecord } from "./types";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { companyApi, projectApi } from "@/helpers/admin";


const normalizeIsActive = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return true;
};

const { encSuperAdminMaster: encSuperAdminMasters, encProjectCreation } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encSuperAdminMasters, encProjectCreation);

const parseApiError = (error: unknown, fallback: string) => {
  const axiosError = error as { response?: { data?: unknown } };
  const data = axiosError.response?.data;
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return fallback;

  return Object.entries(data as Record<string, unknown>)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
      return `${key}: ${String(value)}`;
    })
    .join("\n");
};

export default function ProjectForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const companyUniqueIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("company_unique_id");
  }, [location.search]);

  const listPath = useMemo(() => {
    if (!companyUniqueIdFromQuery) return ENC_LIST_PATH;
    return `${ENC_LIST_PATH}?company_unique_id=${encodeURIComponent(companyUniqueIdFromQuery)}`;
  }, [companyUniqueIdFromQuery]);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyUniqueId, setCompanyUniqueId] = useState(companyUniqueIdFromQuery ?? "");
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [gpsApiUrl, setGpsApiUrl] = useState("");
  const [weighmentApiUrl, setWeighmentApiUrl] = useState("");
  const [attendanceApiUrl, setAttendanceApiUrl] = useState("");
  const [attendanceApiKey, setAttendanceApiKey] = useState("");
  const [attendanceApiConfigured, setAttendanceApiConfigured] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminEmployeeName, setAdminEmployeeName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCompanies = useCallback(async () => {
    let cancelled = false;
    try {
      const records = await companyApi.readAll();
      if (cancelled) return;
      const options = records.map((company) => ({
        unique_id: company.unique_id,
        name: company.name,
      }));
      setCompanies(options);
      setCompanyUniqueId((current) => {
        if (!current && options.length === 1) return options[0].unique_id;
        return current;
      });
      setPendingCompanyId((pending) => {
        if (pending && options.some((o) => o.unique_id === pending)) {
          setCompanyUniqueId(pending);
          return null;
        }
        return pending;
      });
    } catch {
      // Some roles may not have company listing permission.
      if (!cancelled) setCompanies([]);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Apply pendingCompanyId once the companies list is loaded.
  // Handles the common case where the project record resolves after companies.
  useEffect(() => {
    if (!pendingCompanyId || companies.length === 0) return;
    const found = companies.some((c) => c.unique_id === pendingCompanyId);
    if (found) {
      setCompanyUniqueId(pendingCompanyId);
      setPendingCompanyId(null);
    }
  }, [pendingCompanyId, companies]);

  useEffect(() => {
    if (!isEdit) return;

    let cancelled = false;

    projectApi.read(id as string)
      .then((response: ProjectRecord | { project?: ProjectRecord }) => {
        if (cancelled) return;
        let record: ProjectRecord | undefined;
        if (response && typeof response === "object" && "project" in response) {
          record = response.project;
        } else {
          record = response as ProjectRecord;
        }
        if (!record) {
          throw new Error("Project not found in response");
        }
        setName(record.name ?? "");
        setDescription(record.description ?? "");
        setGpsApiUrl(record.gps_api_url ?? "");
        setWeighmentApiUrl(record.weighment_api_url ?? "");
        setAttendanceApiUrl(record.attendance_api_url ?? "");
        setAttendanceApiConfigured(Boolean(record.attendance_api_configured));
        setPendingCompanyId(record.company_unique_id ?? null);
        setIsActive(normalizeIsActive(record.is_active));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: parseApiError(error, t("common.load_failed")),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
      });
      return;
    }

    const hasAnyAdmin =
      !!adminUsername.trim() ||
      !!adminPassword.trim() ||
      !!adminEmployeeName.trim() ||
      !!adminEmail.trim();
    const hasAllRequiredAdmin =
      !!adminUsername.trim() && !!adminPassword.trim() && !!adminEmployeeName.trim();

    if (!isEdit && hasAnyAdmin && !hasAllRequiredAdmin) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("admin.project.admin_required_together"),
      });
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await projectApi.update(id as string, {
          name: name.trim(),
          description: description.trim() || null,
          gps_api_url: gpsApiUrl.trim() || null,
          weighment_api_url: weighmentApiUrl.trim() || null,
          attendance_api_url: attendanceApiUrl.trim() || null,
          ...(attendanceApiKey.trim() ? { attendance_api_key: attendanceApiKey.trim() } : {}),
          is_active: isActive,
        });
      } else {
        const payload: Record<string, string | null | boolean> = {
          name: name.trim(),
          description: description.trim() || null,
          gps_api_url: gpsApiUrl.trim() || null,
          weighment_api_url: weighmentApiUrl.trim() || null,
          attendance_api_url: attendanceApiUrl.trim() || null,
          attendance_api_key: attendanceApiKey.trim() || null,
          is_active: isActive,
        };
        if (companyUniqueId.trim()) {
          payload.company_unique_id = companyUniqueId.trim();
        }

        if (hasAllRequiredAdmin) {
          payload.admin_username = adminUsername.trim();
          payload.admin_password = adminPassword.trim();
          payload.admin_employee_name = adminEmployeeName.trim();
          if (adminEmail.trim()) {
            payload.admin_email = adminEmail.trim();
          }
        }

        const response = (await projectApi.create(payload)) as ProjectCreateResponse;
        if (response?.company_admin?.username) {
          Swal.fire({
            icon: "success",
            title: t("common.added_success"),
            text: t("admin.project.company_admin_created", {
              username: response.company_admin.username,
              unique_id: response.company_admin.unique_id,
            }),
          });
          navigate(listPath);
          return;
        }
      }

      Swal.fire({
        icon: "success",
        title: isEdit ? t("common.updated_success") : t("common.added_success"),
        timer: 1500,
        showConfirmButton: false,
      });
      navigate(listPath);
    } catch (error: unknown) {
      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: parseApiError(error, t("common.save_failed_desc")),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.project") })
          : t("common.add_item", { item: t("admin.nav.project") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="projectCompany">{t("admin.nav.company")}</Label>
            <Select
              value={companyUniqueId}
              onValueChange={setCompanyUniqueId}
              disabled={isEdit}
            >
              <SelectTrigger className="input-validate w-full" id="projectCompany">
                <SelectValue
                  placeholder={t("common.select_item_placeholder", {
                    item: t("admin.nav.company"),
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.unique_id} value={company.unique_id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="projectName">
              {t("common.item_name", { item: t("admin.nav.project") })}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", { item: t("admin.nav.project") })}
              required
            />
          </div>

          <div>
            <Label htmlFor="isActive">
              {t("common.status")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={isActive ? "true" : "false"}
              onValueChange={(val) => setIsActive(val === "true")}
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

          <div className="md:col-span-2">
            <Label htmlFor="projectDescription">{t("common.description_optional")}</Label>
            <Textarea
              id="projectDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.description")}
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="gpsApiUrl">{t("admin.project.gps_api_url")}</Label>
            <Input
              id="gpsApiUrl"
              type="url"
              value={gpsApiUrl}
              onChange={(e) => setGpsApiUrl(e.target.value)}
              placeholder="https://api.example.com/getVehicleHistory"
            />
          </div>

          <div>
            <Label htmlFor="weighmentApiUrl">{t("admin.project.weighment_api_url")}</Label>
            <Input
              id="weighmentApiUrl"
              type="url"
              value={weighmentApiUrl}
              onChange={(e) => setWeighmentApiUrl(e.target.value)}
              placeholder="https://example.com/waste_collected_data_api.php"
            />
          </div>

          <div>
            <Label htmlFor="attendanceApiUrl">{t("admin.project.attendance_api_url")}</Label>
            <Input
              id="attendanceApiUrl"
              type="url"
              value={attendanceApiUrl}
              onChange={(e) => setAttendanceApiUrl(e.target.value)}
              placeholder="http://zigfly.in/attendance-api/api/sync/recognized"
            />
          </div>

          <div>
            <Label htmlFor="attendanceApiKey">{t("admin.project.attendance_api_key")}</Label>
            <Input
              id="attendanceApiKey"
              type="password"
              value={attendanceApiKey}
              onChange={(e) => setAttendanceApiKey(e.target.value)}
              placeholder={
                isEdit && attendanceApiConfigured
                  ? "Configured - enter to replace"
                  : "ZIGFLY_SYNC_2025"
              }
              autoComplete="new-password"
            />
            {isEdit && attendanceApiConfigured ? (
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to keep the existing API key.
              </p>
            ) : null}
          </div>

          {!isEdit ? (
            <>
              <div className="md:col-span-2 text-sm text-gray-600">
                {t("admin.project.admin_help_text")}
              </div>

              <div>
                <Label htmlFor="adminEmployeeName">{t("admin.project.admin_employee_name")}</Label>
                <Input
                  id="adminEmployeeName"
                  type="text"
                  value={adminEmployeeName}
                  onChange={(e) => setAdminEmployeeName(e.target.value)}
                  placeholder={t("admin.project.admin_employee_name")}
                />
              </div>

              <div>
                <Label htmlFor="adminUsername">{t("admin.project.admin_username")}</Label>
                <Input
                  id="adminUsername"
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder={t("admin.project.admin_username")}
                />
              </div>

              <div>
                <Label htmlFor="adminPassword">{t("admin.project.admin_password")}</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={t("admin.project.admin_password")}
                />
              </div>

              <div>
                <Label htmlFor="adminEmail">{t("admin.project.admin_email")}</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={t("admin.project.admin_email")}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="submit" disabled={loading}>
            {loading
              ? isEdit
                ? t("common.updating")
                : t("common.saving")
              : isEdit
                ? t("common.update")
                : t("common.save")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => navigate(listPath)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}
