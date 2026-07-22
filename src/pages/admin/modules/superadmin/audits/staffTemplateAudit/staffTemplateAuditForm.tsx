import type { StaffTemplateAuditRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";

import { staffTemplateAuditLogApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";


export default function StaffTemplateAuditForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const [record, setRecord] = useState<StaffTemplateAuditRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const { encAudits, encStaffTemplateAudit } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encAudits, encStaffTemplateAudit);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    staffTemplateAuditLogApi.read(id)
      .then((res: any) => setRecord(res ?? null))
      .catch(() => {
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  return (
    <div className="p-3">
      <ComponentCard
        title={t("admin.staff_template_audit.title")}
        desc={t("admin.staff_template_audit.subtitle")}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <Label>{t("admin.staff_template_audit.entity_type")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.entity_type ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.staff_template_audit.entity_id")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.entity_id ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.staff_template_audit.action")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.action ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.staff_template_audit.performed_by")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.performed_by_name ?? record?.performed_by ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.staff_template_audit.performed_role")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.performed_role ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.staff_template_audit.change_remarks")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.change_remarks ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.staff_template_audit.performed_at")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={
                record?.performed_at ? new Date(record.performed_at).toLocaleString() : "-"
              }
              readOnly
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(ENC_LIST_PATH)}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-600"
          >
            {t("common.back")}
          </button>
        </div>
      </ComponentCard>
    </div>
  );
}
