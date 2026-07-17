import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEncryptedRoute } from "@/utils/routeCache";
import { adminApi } from "@/helpers/admin/registry";

const { encAdmins, encUserType } = getEncryptedRoute();
const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAdmins, encUserType);

export default function UserTypeForm() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const navigate = useNavigate();
  const { id } = useParams();
  const userTypeId = id;
  const isEdit = Boolean(userTypeId);

  const [recordData, setRecordData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* -----------------------------------------------------------
     LOAD RECORD FOR EDIT
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!isEdit || !userTypeId) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.userTypes.read(userTypeId)
      .then((res: any) => {
        if (cancelled) return;
        setRecordData(res);
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire({ icon: "error", title: t("common.error"), text: String(err?.response?.data ?? err?.message ?? "Load failed") });
      });
    return () => { cancelled = true; };
  }, [userTypeId, isEdit]);

  useEffect(() => {
    if (!recordData) return;
    const data = recordData;
    setName(String((data as any).name ?? ""));
    setIsActive(Boolean((data as any).is_active));
  }, [recordData]);

  /* -----------------------------------------------------------
     SUBMIT HANDLER
  ----------------------------------------------------------- */
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const payload = {
      name,
      is_active: isActive,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && userTypeId) {
        await adminApi.userTypes.update(userTypeId, payload);
        Swal.fire({
          icon: "success",
          title: t("common.updated_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await adminApi.userTypes.create(payload);
        Swal.fire({
          icon: "success",
          title: t("common.added_success"),
          timer: 1500,
          showConfirmButton: false,
        });
      }

      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      const message =
        error?.response?.data?.name?.[0] ||
        error?.response?.data?.detail ||
        t("common.save_failed_desc");

      Swal.fire({
        icon: "error",
        title: t("common.save_failed"),
        text: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* -----------------------------------------------------------
     RENDER UI
  ----------------------------------------------------------- */
  return (
    <div className="p-8">
      <div className=" mx-auto bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit
              ? t("common.edit_item", { item: t("admin.nav.user_type") })
              : t("common.add_item", { item: t("admin.nav.user_type") })}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* User Type Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("common.item_name", { item: t("admin.nav.user_type") })}{" "}
                <span className="text-red-500">*</span>
              </label>

              <Input
                type="text"
                placeholder={t("common.enter_item_name", {
                  item: t("admin.nav.user_type"),
                })}
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Active Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("common.status")} <span className="text-red-500">*</span>
              </label>

              <select
                value={isActive ? "true" : "false"}
                onChange={(e) => setIsActive(e.target.value === "true")}
                className="w-full px-3 py-2 border border-green-400 rounded-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="true">{t("common.active")}</option>
                <option value="false">{t("common.inactive")}</option>
              </select>
            </div>

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={isSubmitting} >
               {isSubmitting
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
              // className="bg-red-500 text-white font-medium px-6 py-2 rounded hover:bg-red-600 transition"
            >
              {t("common.cancel")}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
