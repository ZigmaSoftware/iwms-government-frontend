import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import ComponentCard from "@/components/common/ComponentCard";
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { getEncryptedRoute } from "@/utils/routeCache";
import { adminApi } from "@/helpers/admin/registry";
import { useTranslation } from "react-i18next";

const FILE_ICON =
  "https://cdn-icons-png.flaticon.com/512/337/337946.png";

export default function ComplaintEditForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("PROGRESSING");
  const [remarks, setRemarks] = useState("");

  const [closeFile, setCloseFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isPreviewImage, setIsPreviewImage] = useState<boolean>(false);
  const [previewName, setPreviewName] = useState<string>("");

  const [data, setData] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingRecord(true);
    adminApi.complaints.read(id)
      .then((res: any) => {
        if (cancelled) return;
        const c = res?.data || res;
        setData(c);
        setStatus(c.status || "PROGRESSING");
        setRemarks(c.action_remarks || "");
        setLoadingRecord(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setLoadingRecord(false);
        Swal.fire(t("common.error"), String(err?.response?.data ?? err?.message ?? t("common.load_failed")), "error");
      });
    return () => { cancelled = true; };
  }, [id]);

  const { encCitizenGrivence, encComplaint } = getEncryptedRoute();

  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encCitizenGrivence, encComplaint);


  const isImageUrl = (url: string) => {
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    );
  };

  const isImageFile = (f: File) =>
    f.type.startsWith("image/") || isImageUrl(f.name || "");

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setCloseFile(f);
    setPreviewName(f.name);

    if (isImageFile(f)) {
      setIsPreviewImage(true);
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setIsPreviewImage(false);
      setPreviewUrl(FILE_ICON);
    }
  };

  const clearFile = () => {
    setCloseFile(null);
    setPreviewUrl("");
    setPreviewName("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append("status", status);
    fd.append("action_remarks", remarks);
    if (closeFile) fd.append("close_image", closeFile);

    setIsSubmitting(true);
    try {
      await adminApi.complaints.update(id || "", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire(
        t("admin.citizen_grievance.complaints_edit.updated_title"),
        t("admin.citizen_grievance.complaints_edit.updated_message"),
        "success"
      );
      navigate(ENC_LIST_PATH);
    } catch (error: any) {
      console.error("Complaint update failed:", error);
      const message =
        error?.response?.data &&
        typeof error.response.data === "object" &&
        !Array.isArray(error.response.data)
          ? JSON.stringify(error.response.data)
          : t("admin.citizen_grievance.complaints_edit.update_failed");
      Swal.fire(t("common.error"), message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // if (!data) return <div>Loading…</div>;

  return (
    <ComponentCard title={t("admin.citizen_grievance.complaints_edit.title")}>
      <form onSubmit={save}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <Label>{t("common.status")}</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v)}
              options={[
                {
                  value: "PROGRESSING",
                  label: t("admin.citizen_grievance.complaints_edit.status_progressing"),
                },
                {
                  value: "CLOSED",
                  label: t("admin.citizen_grievance.complaints_edit.status_closed"),
                },
              ]}
            />
          </div>

          <div>
            <Label>{t("admin.citizen_grievance.complaints_edit.action_remarks")}</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <Label>{t("admin.citizen_grievance.complaints_edit.close_file")}</Label>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
              onChange={upload}
              className="hidden"
              id="closeFileInput"
            />

            {/* Upload Box */}
            <div
              className="border border-gray-300 rounded flex flex-col items-center justify-center p-3 cursor-pointer bg-gray-50 hover:bg-gray-100 relative group transition-all duration-200 w-60 h-32"
              onClick={() =>
                document.getElementById("closeFileInput")?.click()
              }
            >
              {previewUrl ? (
                <>
                  {isPreviewImage ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain rounded"
                    />
                  ) : (
                    <img
                      src={FILE_ICON}
                      alt="File icon"
                      className="w-16 h-16 opacity-80"
                    />
                  )}
                </>
              ) : (
                <>
                  <img
                    src={FILE_ICON}
                    alt="Upload"
                    className="w-10 h-10 opacity-60"
                  />
                  <p className="text-gray-500 text-sm mt-1 text-center">
                    {t("admin.citizen_grievance.complaints_edit.upload_hint")}
                  </p>
                </>
              )}
            </div>

            {/* PREVIEW + REMOVE BUTTONS */}
            {previewUrl && (
              <div className="flex items-center gap-3 mt-3">

                {/* Preview with filename */}
                <button
                  type="button"
                  onClick={() => {
                    if (isPreviewImage) {
                      window.open(previewUrl, "_blank");
                    } else {
                      window.open(
                        closeFile
                          ? URL.createObjectURL(closeFile)
                          : previewUrl,
                        "_blank"
                      );
                    }
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  {t("admin.citizen_grievance.complaints_edit.preview", {
                    name: previewName || t("admin.citizen_grievance.complaints_edit.file"),
                  })}
                </button>

                {/* Remove */}
                <button
                  type="button"
                  onClick={clearFile}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                >
                  {t("common.remove")}
                </button>

              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-green-custom text-white px-4 py-2 rounded"
          >
            {t("common.update")}
          </button>

          <button
            type="button"
            onClick={() => navigate(ENC_LIST_PATH)}
            className="bg-red-400 text-white px-4 py-2 rounded"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </ComponentCard>
  );
}
