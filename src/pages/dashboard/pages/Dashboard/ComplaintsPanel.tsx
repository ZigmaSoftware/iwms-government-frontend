import { useEffect, useMemo, useState } from "react";
import { DataCard } from "@/components/ui/DataCard";
import type { ComplaintData } from "@/types";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { getEncryptedRoute } from "@/utils/routeCache";
import { complaintApi } from "@/helpers/admin";
import { useTranslation } from "react-i18next";

export function ComplaintsPanel() {
  const { t, i18n } = useTranslation();
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { encDashboardGrievances } = getEncryptedRoute();
  const grievancesPath = `/dashboard/${encDashboardGrievances}`;
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });

  useEffect(() => {
    let isMounted = true;
    const fetchComplaints = async () => {
      try {
        const response = await complaintApi.readAll();
        const rows = Array.isArray(response) ? response : [];
        const deduped = new Map<string, ComplaintRecord>();

        rows.forEach((row: Record<string, any>, index: number) => {
          const id = String(
            row.unique_id ?? row.id ?? row.complaint_id ?? index
          ).trim();
          if (!id) return;

          const createdRaw =
            row.created ??
            row.created_at ??
            row.complaint_created_at ??
            row.date ??
            "";
          const createdDate = createdRaw ? new Date(createdRaw) : null;
          const normalizedStatus = normalizeStatus(row.status);
          const normalizedPriority = normalizePriority(
            row.priority ?? row.risk ?? row.severity
          );
          const title =
            row.main_category ??
            row.sub_category ??
            row.category ??
            row.details ??
            t("dashboard.home.complaint_fallback");

          const mapped: ComplaintRecord = {
            id,
            title: String(title),
            status: normalizedStatus,
            priority: normalizedPriority,
            timestamp: createdDate ? createdDate.toISOString() : "-",
            createdAt: createdDate ? createdDate.getTime() : undefined,
            year: createdDate ? String(createdDate.getFullYear()) : "-",
          };

          const existing = deduped.get(id);
          if (!existing) {
            deduped.set(id, mapped);
            return;
          }

          if (!mapped.createdAt) return;
          const existingDate = existing.createdAt ?? 0;
          if (!existingDate || mapped.createdAt > existingDate) {
            deduped.set(id, mapped);
          }
        });

        const priorityRank: Record<ComplaintData["priority"], number> = {
          High: 0,
          Medium: 1,
          Low: 2,
        };

        const sorted = Array.from(deduped.values()).sort((a, b) => {
          const rankDiff = priorityRank[a.priority] - priorityRank[b.priority];
          if (rankDiff !== 0) return rankDiff;

          const aDate = a.createdAt ?? 0;
          const bDate = b.createdAt ?? 0;
          return bDate - aDate;
        });

        if (isMounted) {
          setComplaints(sorted.slice(0, 10));
        }
      } catch (error) {
        console.error("Failed to fetch complaints:", error);
        if (isMounted) {
          setComplaints([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchComplaints();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute totals
  const summary = useMemo(() => {
    const total = complaints.length;
    const inProgress = complaints.filter(
      (c) => c.status === "In Progress"
    ).length;
    const resolved = complaints.filter((c) => c.status === "Resolved").length;

    return { total, inProgress, resolved };
  }, [complaints]);

  const shouldScroll = complaints.length > 3;

  const CARD_STYLE =
    "flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 dark:border-gray-700";

  const priorityStyles: Record<ComplaintData["priority"], string> = {
    High: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-200",
    Medium:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200",
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-200",
  };

  const getStatusMeta = (status: ComplaintData["status"]) => {
    switch (status) {
      case "Open":
        return {
          icon: <AlertTriangle className="w-3 h-3 text-rose-500" />,
          ring: "bg-rose-50 dark:bg-rose-900/30",
        };
      case "In Progress":
        return {
          icon: <Info className="w-3 h-3 text-blue-500" />,
          ring: "bg-blue-50 dark:bg-blue-900/30",
        };
      default:
        return {
          icon: <CheckCircle className="w-3 h-3 text-emerald-500" />,
          ring: "bg-emerald-50 dark:bg-emerald-900/30",
        };
    }
  };

  const getStatusLabel = (status: ComplaintData["status"]) => {
    if (status === "In Progress") return t("common.status_in_progress");
    if (status === "Resolved") return t("common.status_resolved");
    return t("common.status_open");
  };

  const getPriorityLabel = (priority: ComplaintData["priority"]) => {
    if (priority === "High") return t("common.priority_high");
    if (priority === "Low") return t("common.priority_low");
    return t("common.priority_medium");
  };

  const formatTimeAgo = (createdAt?: number) => {
    if (!createdAt) return "-";
    const diffMs = Date.now() - createdAt;
    const diffSec = Math.max(Math.floor(diffMs / 1000), 0);
    const formatWithUnit = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
      rtf.format(-value, unit);

    if (diffSec < 60) return formatWithUnit(diffSec, "second");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return formatWithUnit(diffMin, "minute");
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return formatWithUnit(diffHr, "hour");
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return formatWithUnit(diffDay, "day");
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return formatWithUnit(diffMonth, "month");
    const diffYear = Math.floor(diffMonth / 12);
    return formatWithUnit(diffYear, "year");
  };

  return (
    <DataCard
      title={t("dashboard.home.grievances_title")}
      compact
      accent="brand-secondary"
      icon={<AlertTriangle className="w-3.5 h-3.5 text-(--brand-secondary)" />}
      className="h-60 flex flex-col overflow-hidden"
      action={
        <Link
          to={grievancesPath}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t("common.view_all")}
        </Link>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col">
        {loading && !complaints.length ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {t("dashboard.home.grievances_loading")}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <div className={`${CARD_STYLE} bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50`}>
            <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              {t("common.total")}
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 leading-none mt-0.5">
              {summary.total}
            </div>
          </div>

          <div className={`${CARD_STYLE} bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50`}>
            <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              {t("common.status_in_progress")}
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 leading-none mt-0.5">
              {summary.inProgress}
            </div>
          </div>

          <div className={`${CARD_STYLE} bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50`}>
            <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              {t("common.status_resolved")}
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-none mt-0.5">
              {summary.resolved}
            </div>
          </div>
        </div>

        <div className="mt-3 flex-1 min-h-0 space-y-2 pr-1 overflow-y-auto">
          {!loading && !complaints.length && (
            <div className="text-xs text-muted-foreground">
              {t("dashboard.home.grievances_none")}
            </div>
          )}
          {complaints.map((complaint, idx) => {
            const meta = getStatusMeta(complaint.status);
            const statusLabel = getStatusLabel(complaint.status);
            const priorityLabel = getPriorityLabel(complaint.priority);
            return (
              <div key={complaint.id} className="flex gap-2">
                <div className="flex flex-col items-center">
                  <div className={`p-1 rounded-full ${meta.ring}`}>
                    {meta.icon}
                  </div>
                  {idx < complaints.length - 1 && (
                    <div className="w-px h-full bg-gray-200 dark:bg-gray-700 my-1" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                      {complaint.title}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityStyles[complaint.priority]}`}
                    >
                      {priorityLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {statusLabel} • {formatTimeAgo(complaint.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DataCard>
  );
}

function normalizeStatus(raw: unknown): ComplaintData["status"] {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("close") || value.includes("resolved")) return "Resolved";
  if (value.includes("progress") || value.includes("ongoing")) return "In Progress";
  return "Open";
}

function normalizePriority(raw: unknown): ComplaintData["priority"] {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("high") || value.includes("critical")) return "High";
  if (value.includes("low")) return "Low";
  return "Medium";
}

type ComplaintRecord = ComplaintData & { createdAt?: number };
