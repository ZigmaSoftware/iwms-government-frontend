import type { SupervisorZoneAccessAuditRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import Label from "@/components/form/Label";

import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";


const buildLookup = (items: any[], key: string, label: string) =>
  items.reduce<Record<string, string>>((acc, item) => {
    const lookupKey = item?.[key];
    if (lookupKey !== undefined && lookupKey !== null) {
      acc[String(lookupKey)] = String(item?.[label] ?? lookupKey);
    }
    return acc;
  }, {});

export default function SupervisorZoneAccessAuditForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const auditApi = adminApi.supervisorZoneAccessAudits;
  const zoneApi = adminApi.zones;
  const userCreationApi = adminApi.usersCreation;

  const [record, setRecord] = useState<SupervisorZoneAccessAuditRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [userLookup, setUserLookup] = useState<Record<string, string>>({});

  const { encStaffMasters, encSupervisorZoneAccessAudit } = getEncryptedRoute();
  const { listPath: ENC_LIST_PATH } = createCrudRoutePaths(encStaffMasters, encSupervisorZoneAccessAudit);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([auditApi.read(id), zoneApi.readAll(), userCreationApi.readAll()])
      .then(([auditRes, zoneRes, userRes]) => {
        setRecord(auditRes ?? null);
        setZoneLookup(buildLookup(normalizeList(zoneRes), "unique_id", "name"));

        const users = normalizeList(userRes).filter(
          (u: any) => u?.user_type_name?.toLowerCase() === "staff"
        );
        setUserLookup(buildLookup(users, "unique_id", "staff_name"));
      })
      .catch(() => {
        Swal.fire(t("common.error"), t("common.load_failed"), "error");
      })
      .finally(() => setLoading(false));
  }, [auditApi, id, t, userCreationApi, zoneApi]);

  const resolveUser = (userId?: string | null) =>
    userId ? userLookup[userId] ?? userId : "-";

  const resolveZones = (zoneIds?: Array<number | string> | null) => {
    if (!Array.isArray(zoneIds) || zoneIds.length === 0) return "-";
    return zoneIds.map((zoneId) => zoneLookup[String(zoneId)] ?? zoneId).join(", ");
  };

  return (
    <div className="p-3">
      <ComponentCard
        title={t("admin.supervisor_zone_access_audit.title")}
        desc={t("admin.supervisor_zone_access_audit.subtitle")}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <Label>{t("admin.supervisor_zone_access_audit.supervisor")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={resolveUser(record?.supervisor_id)}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.supervisor_zone_access_audit.performed_by")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={resolveUser(record?.performed_by)}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.supervisor_zone_access_audit.performed_role")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.performed_role ?? "-"}
              readOnly
            />
          </div>

          <div>
            <Label>{t("admin.supervisor_zone_access_audit.created_at")}</Label>
            <input
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.created_at ? new Date(record.created_at).toLocaleString() : "-"}
              readOnly
            />
          </div>

          <div className="md:col-span-2">
            <Label>{t("admin.supervisor_zone_access_audit.old_zones")}</Label>
            <textarea
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={resolveZones(record?.old_zone_ids)}
              readOnly
            />
          </div>

          <div className="md:col-span-2">
            <Label>{t("admin.supervisor_zone_access_audit.new_zones")}</Label>
            <textarea
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={resolveZones(record?.new_zone_ids)}
              readOnly
            />
          </div>

          <div className="md:col-span-2">
            <Label>{t("admin.supervisor_zone_access_audit.remarks")}</Label>
            <textarea
              className="w-full rounded border border-gray-200 bg-gray-100 p-2 text-sm"
              value={record?.remarks ?? "-"}
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

