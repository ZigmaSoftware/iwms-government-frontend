import { useEffect, useState } from "react";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { ProjectSelectorBar } from "@/components/common/ProjectSelectorBar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Scale,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/* =========================================================
   API CONFIG (UNCHANGED)
========================================================= */
const API_KEY = "ZIGMA-DELHI-WEIGHMENT-2025-SECURE";

/* =========================================================
   TYPES (UNCHANGED)
========================================================= */
type StatusType = "all" | "normal" | "warning" | "critical";

type WeighbridgeRow = {
  id: number;
  vehicle: string;
  time: string;
  expected: string;
  actual: string;
  difference: string;
  status: "normal" | "warning" | "critical";
  zone: string;
};

/* =========================================================
   STATUS STYLES (UNCHANGED)
========================================================= */
const statusStyles = {
  normal: {
    row: "bg-emerald-50/40 dark:bg-emerald-950/20",
    diff: "text-emerald-600 dark:text-emerald-300",
    badge:
      "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    button:
      "border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
  },
  warning: {
    row: "bg-amber-50/40 dark:bg-amber-950/20",
    diff: "text-amber-600 dark:text-amber-300",
    badge:
      "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    button:
      "border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40",
  },
  critical: {
    row: "bg-rose-50/40 dark:bg-rose-950/20",
    diff: "text-rose-600 dark:text-rose-300",
    badge:
      "border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    button:
      "border-rose-300 text-rose-600 hover:bg-rose-100 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40",
  },
} as const;

/* =========================================================
   COMPONENT
========================================================= */
export default function Weighbridge() {
  const { t } = useTranslation();
  const { weighmentApiUrl } = useProjectSelector();
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const today = formatDate(new Date());

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<WeighbridgeRow[]>([]);
  const [activeStatus, setActiveStatus] = useState<StatusType>("all");

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  /* ================= FETCH (UNCHANGED) ================= */
  useEffect(() => {
    if (!weighmentApiUrl) { setData([]); return; }
    const url = `${weighmentApiUrl}?action=day_wise_data&from_date=${fromDate}&to_date=${toDate}&key=${API_KEY}`;

    fetch(url)
      .then(res => res.json())
      .then(json => {
        const rows = Array.isArray(json.data) ? json.data : [];
        if (!rows.length) {
          setData([]);
          setPage(1);
          setActiveStatus("all");
          return;
        }

        const EXPECTED = 500;

        const mapped = rows.map((r: any, i: number) => {
          const actualKg = Number(String(r.Net_Wt ?? "0").replace(/,/g, ""));
          const diffPct = ((actualKg - EXPECTED) / EXPECTED) * 100;

          let status: WeighbridgeRow["status"] = "normal";
          if (Math.abs(diffPct) > 10) status = "critical";
          else if (Math.abs(diffPct) > 5) status = "warning";

          return {
            id: i + 1,
            vehicle: r.Vehicle_No ?? "--",
            time: r.Date?.split(" ")[1]?.slice(0, 5) ?? "--",
            zone: r.Zone ?? "Delhi",
            expected: (EXPECTED / 1000).toFixed(1),
            actual: (actualKg / 1000).toFixed(1),
            difference: `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(0)}%`,
            status,
          };
        });

        setData(mapped);
        setPage(1);
        setActiveStatus("all");
      })
      .catch(() => setData([]));
  }, [fromDate, toDate, weighmentApiUrl]);

  const filtered =
    activeStatus === "all" ? data : data.filter(d => d.status === activeStatus);

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const pageData = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const tonsLabel = t("common.tons");
  const statusLabels: Record<WeighbridgeRow["status"], string> = {
    normal: t("dashboard.weighbridge.status.normal"),
    warning: t("dashboard.weighbridge.status.warning"),
    critical: t("dashboard.weighbridge.status.critical"),
  };
  const formatStatusLabel = (status: WeighbridgeRow["status"]) =>
    statusLabels[status] ?? status;

  /* ================= RENDER ================= */

  if (!weighmentApiUrl) {
    return (
      <div className="p-6 space-y-6 bg-white dark:bg-slate-950 min-h-screen">
        <ProjectSelectorBar />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <p className="text-base font-medium">Weighment API not configured for this project.</p>
          <p className="text-sm mt-1">Set a Weighment API URL in the project settings to enable weighbridge data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-slate-950 min-h-screen">
      <ProjectSelectorBar />

      {/* HEADER (UNCHANGED) */}
      <div className="flex items-center justify-between p-6 rounded-2xl border bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900 dark:border-slate-800">
        <div>
          <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {t("dashboard.weighbridge.title")}
          </h2>
          <p className="text-muted-foreground">
            {t("dashboard.weighbridge.subtitle")}
          </p>
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white"
        >
          <RefreshCcw className="h-4 w-4" />
          {t("dashboard.weighbridge.refresh")}
        </Button>
      </div>

      {/* STATS — COLOR ADDED HERE ONLY */}
      <div className="grid md:grid-cols-4 gap-4">
        <Stat
          title={t("dashboard.weighbridge.stats.total_entries")}
          value={data.length}
          icon={Scale}
          active={activeStatus === "all"}
          onClick={() => setActiveStatus("all")}
          gradient="from-white to-blue-100 dark:from-slate-900 dark:to-blue-950/40"
        />
        <Stat
          title={t("dashboard.weighbridge.stats.within_tolerance")}
          value={data.filter(d => d.status === "normal").length}
          icon={CheckCircle}
          active={activeStatus === "normal"}
          onClick={() => setActiveStatus("normal")}
          gradient="from-white to-emerald-100 dark:from-slate-900 dark:to-emerald-950/40"
        />
        <Stat
          title={t("dashboard.weighbridge.stats.minor_deviations")}
          value={data.filter(d => d.status === "warning").length}
          icon={Clock}
          active={activeStatus === "warning"}
          onClick={() => setActiveStatus("warning")}
          gradient="from-white to-amber-100 dark:from-slate-900 dark:to-amber-950/40"
        />
        <Stat
          title={t("dashboard.weighbridge.stats.critical_mismatch")}
          value={data.filter(d => d.status === "critical").length}
          icon={AlertTriangle}
          active={activeStatus === "critical"}
          onClick={() => setActiveStatus("critical")}
          gradient="from-white to-rose-100 dark:from-slate-900 dark:to-rose-950/40"
        />
      </div>

      {/* TABLE (UNCHANGED) */}
      <Card className="rounded-2xl bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle>{t("dashboard.weighbridge.table_title")}</CardTitle>
            <CardDescription>
              {t("dashboard.weighbridge.table_subtitle")}
            </CardDescription>
          </div>

          {/* CALENDAR (UNCHANGED) */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-9 rounded-md border bg-white dark:bg-slate-950 dark:border-slate-700 px-3 text-sm"
            />
            <span className="text-sm font-medium dark:text-slate-300">
              {t("dashboard.weighbridge.to")}
            </span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-9 rounded-md border bg-white dark:bg-slate-950 dark:border-slate-700 px-3 text-sm"
            />
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100 dark:bg-slate-800">
                <TableHead>{t("dashboard.weighbridge.headers.time")}</TableHead>
                <TableHead>{t("dashboard.weighbridge.headers.vehicle")}</TableHead>
                <TableHead>{t("dashboard.weighbridge.headers.zone")}</TableHead>
                <TableHead>{t("dashboard.weighbridge.headers.expected")}</TableHead>
                <TableHead>{t("dashboard.weighbridge.headers.actual")}</TableHead>
                <TableHead>{t("dashboard.weighbridge.headers.difference")}</TableHead>
                <TableHead>{t("dashboard.weighbridge.headers.status")}</TableHead>
                <TableHead className="text-right">{t("dashboard.weighbridge.headers.action")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageData.map(row => {
                const s = statusStyles[row.status];
                return (
                  <TableRow key={row.id} className={s.row}>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.vehicle}</TableCell>
                    <TableCell>{row.zone}</TableCell>
                    <TableCell>{row.expected} {tonsLabel}</TableCell>
                    <TableCell className="font-semibold">
                      {row.actual} {tonsLabel}
                    </TableCell>
                    <TableCell className={s.diff}>{row.difference}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.badge}>
                        {formatStatusLabel(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className={s.button}>
                        {row.status === "critical"
                          ? t("dashboard.weighbridge.action_investigate")
                          : t("dashboard.weighbridge.action_view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* PAGINATION (UNCHANGED) */}
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-2 text-sm">
              {t("dashboard.weighbridge.rows_per_page")}
              <select
                value={rowsPerPage}
                onChange={e => setRowsPerPage(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-950 dark:border-slate-700"
              >
                {[10, 20, 50].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" disabled={page === 1}
                onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {t("dashboard.weighbridge.page_of", { page, totalPages })}
              <Button size="icon" variant="ghost" disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TOLERANCE (UNCHANGED) */}
      <Card className="rounded-2xl bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle>{t("dashboard.weighbridge.tolerance_title")}</CardTitle>
          <CardDescription>
            {t("dashboard.weighbridge.tolerance_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <ToleranceCard
            title={t("dashboard.weighbridge.tolerance_normal_title")}
            value="±5%"
            description={t("dashboard.weighbridge.tolerance_normal_desc")}
          />
          <ToleranceCard
            title={t("dashboard.weighbridge.tolerance_warning_title")}
            value="±10%"
            description={t("dashboard.weighbridge.tolerance_warning_desc")}
          />
          <ToleranceCard
            title={t("dashboard.weighbridge.tolerance_critical_title")}
            value=">10%"
            description={t("dashboard.weighbridge.tolerance_critical_desc")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================================================
   STAT CARD (COLOR ONLY HERE)
========================================================= */
function Stat({ title, value, icon: Icon, active, onClick, gradient }: any) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border bg-gradient-to-br transition",
        gradient,
        active && "ring-2 ring-blue-400"
      )}
    >
      <CardContent className="flex justify-between items-center p-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <Icon className="h-6 w-6 text-slate-600 dark:text-slate-400" />
      </CardContent>
    </Card>
  );
}
/* =========================================================
   TOLERANCE CARD (UNCHANGED)
========================================================= */
function ToleranceCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-950 dark:border-slate-800 p-6 shadow-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-2">{description}</p>
    </div>
  );
}
