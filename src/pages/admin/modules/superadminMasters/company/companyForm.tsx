import type { ApiError } from "./types";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { ImageIcon, Upload, X } from "lucide-react";
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


import { companyApi } from "@/helpers/admin";


const { encSuperAdminMaster: encSuperAdminMasters, encCompanyCreation } = getEncryptedRoute();

const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encSuperAdminMasters, encCompanyCreation);
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const resolveMediaUrl = (value?: string | null) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const apiRoot = import.meta.env.VITE_PROD === "true"
    ? import.meta.env.VITE_API_PROD
    : import.meta.env.VITE_API_LOCAL;
  try {
    const origin = new URL(apiRoot).origin;
    return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
  } catch {
    return value;
  }
};

function CompanyListForm() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [isActive, setIsActive] = useState(true); // default active on create
  const [loading, setLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // Fetch existing data if editing
  useEffect(() => {
    if (isEdit) {
      companyApi.read(id as string)
        .then((record) => {
          setName(record.name);
          setIsActive(record.is_active);
          setLogoPreview(resolveMediaUrl(record.company_logo));
        })
        .catch((err) => {
          console.error("Error fetching company:", err);
          Swal.fire({
            icon: "error",
            title: t("common.error"),
            text: err.response?.data?.detail || t("common.load_failed"),
          });
        });
    }
  }, [id, isEdit, t]);

  useEffect(() => {
    if (!logoFile) return;
    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

  // Handle save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🔹 Basic validation BEFORE enabling loading or API call
    if (!name) {
      Swal.fire({
        icon: "warning",
        title: t("common.warning"),
        text: t("common.missing_fields"),
        confirmButtonColor: "#3085d6",
      });
      return; // Stop here if validation fails
    }
    setLoading(true);

    try {
      const payload = { name, is_active: isActive };

      if (isEdit) {
        if (logoFile) {
          const formData = new FormData();
          formData.append("name", name);
          formData.append("is_active", String(isActive));
          formData.append("company_logo", logoFile);
          await companyApi.uploadUpdate(id as string, formData);
        } else {
          await companyApi.update(id as string, payload);
        }
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        if (logoFile) {
          const formData = new FormData();
          formData.append("name", name);
          formData.append("is_active", String(isActive));
          formData.append("company_logo", logoFile);
          await companyApi.upload(formData);
        } else {
          await companyApi.create(payload);
        }
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH);
    } catch (error: unknown) {
      console.error("Failed to save:", error);

      const data = (error as ApiError).response?.data;
      let message = t("common.save_failed_desc");

      if (typeof data === "object" && data !== null) {
        message = Object.entries(data)
          .map(([key, val]) => {
            const value = Array.isArray(val) ? val.join(", ") : String(val);
            return `${key}: ${value}`;
          })
          .join("\n");
      } else if (typeof data === "string") {
        message = data;
      }

      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ComponentCard
      title={
        isEdit
          ? t("common.edit_item", { item: t("admin.nav.company") })
          : t("common.add_item", { item: t("admin.nav.company") })
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Name */}
          <div>
            <Label htmlFor="companyName">
              {t("common.item_name", { item: t("admin.nav.company") })}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("common.enter_item_name", {
                item: t("admin.nav.company"),
              })}
              className="input-validate w-full"
              required
            />
          </div>

          {/* Active Status */}
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

          {/* Company Logo */}
          <div className="md:col-span-2">
            <Label htmlFor="companyLogo">
              {t("admin.company.logo", { defaultValue: "Company Logo" })}
            </Label>

            <div className="mt-2 flex flex-col gap-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 md:flex-row md:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Company logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="companyLogo"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                  >
                    <Upload className="h-4 w-4" />
                    {logoFile ? "Change Logo" : "Upload Logo"}
                  </label>

                  {logoFile ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview("");
                        if (logoInputRef.current) logoInputRef.current.value = "";
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>

                <p className="mt-2 truncate text-sm text-gray-600">
                  {logoFile?.name || "PNG, JPG, JPEG or WEBP up to 2 MB"}
                </p>
              </div>

              <input
                ref={logoInputRef}
                id="companyLogo"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) {
                    setLogoFile(null);
                    return;
                  }

                  if (!file.type.startsWith("image/")) {
                    Swal.fire({
                      icon: "warning",
                      title: t("common.warning"),
                      text: "Please choose a valid image file.",
                    });
                    event.target.value = "";
                    setLogoFile(null);
                    return;
                  }

                  if (file.size > MAX_LOGO_SIZE) {
                    Swal.fire({
                      icon: "warning",
                      title: t("common.warning"),
                      text: "Company logo must be 2 MB or smaller.",
                    });
                    event.target.value = "";
                    setLogoFile(null);
                    return;
                  }

                  setLogoFile(file);
                }}
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
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
          <Button type="button" variant="destructive" onClick={() => navigate(ENC_LIST_PATH)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ComponentCard>
  );
}

export default CompanyListForm;
