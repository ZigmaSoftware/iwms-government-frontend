import type { DailyTripLogRecord, WasteTypeBreakdownItem } from "./types";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { Button } from "primereact/button";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";

import { dailyTripLogApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { formatCollectionTime } from "./collectionTime";

const extractError = (error: any): string | null => {
  const data = error?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return null;
};

const computeCollectedWeight = (collectionPoints?: DailyTripLogRecord["collection_points"]): number => {
  return (collectionPoints ?? []).reduce((sum, cp) => {
    if (cp?.collected_weight_kg === null || cp?.collected_weight_kg === undefined) return sum;
    const weight = Number(cp.collected_weight_kg);
    return sum + (Number.isFinite(weight) ? weight : 0);
  }, 0);
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{children}</p>
);

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="flex gap-2 text-sm">
    <span className="text-gray-500 w-40 shrink-0">{label}</span>
    <span className="font-medium text-gray-800">{value ?? "-"}</span>
  </div>
);

const WasteChips = ({ items }: { items?: WasteTypeBreakdownItem[] }) => {
  if (!items || items.length === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <span
          key={`${item.waste_type_name}-${index}`}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
        >
          {item.waste_type_name ?? "—"}
          <span className="font-semibold">
            {item.collected_weight_kg != null ? `${Number(item.collected_weight_kg).toFixed(2)} kg` : "—"}
          </span>
        </span>
      ))}
    </div>
  );
};

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-800",
  Verified: "bg-green-100 text-green-800",
};

const COLLECTION_STATUS_STYLES: Record<string, string> = {
  "Not Started": "bg-red-50 text-red-600",
  "In Progress": "bg-yellow-50 text-yellow-700",
  "Completed": "bg-green-100 text-green-700",
};

const Badge = ({ value }: { value?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-600"
    }`}
  >
    {value ?? "-"}
  </span>
);

const CollectionStatusBadge = ({ value }: { value?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      COLLECTION_STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-500"
    }`}
  >
    {value ?? "-"}
  </span>
);

// Per-stop status, same literal values + styling as dailyTripCollectionPointList.tsx
// (Pending/Collected/Skipped), extended with the other status choices that exist
// on DailyTripCollectionPoint (In Progress, Missed) and DailyTripHouseholdCollection
// (Not Available, Collect Later).
const STOP_STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  Skipped: "bg-red-100 text-red-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Missed: "bg-red-100 text-red-800",
  "Not Available": "bg-red-100 text-red-800",
  "Collect Later": "bg-orange-100 text-orange-800",
};

const StopStatusBadge = ({ value }: { value?: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      STOP_STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-600"
    }`}
  >
    {value ?? "-"}
  </span>
);

/* ─────────────────────────────────────────────────────
   Daily Trip Log — detailed report page (single trip)
───────────────────────────────────────────────────── */
export default function DailyTripLogReportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { encScheduleMasters, encDailyTripLog } = getEncryptedRoute();
  const { listPath } = createCrudRoutePaths(encScheduleMasters, encDailyTripLog);

  const [row, setRow] = useState<DailyTripLogRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (dailyTripLogApi.read(id) as Promise<DailyTripLogRecord>)
      .then((data) => {
        if (mounted) setRow(data);
      })
      .catch((err) => {
        if (mounted)
          Swal.fire({ icon: "error", title: t("common.error"), text: extractError(err) ?? String(err) });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id, t]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading trip report…</div>;
  }

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">Trip log not found.</p>
        <Button label="Back to list" icon="pi pi-arrow-left" onClick={() => navigate(listPath)} />
      </div>
    );
  }

  const cps = row.collection_points ?? [];
  const hhCollections = row.household_collections ?? [];
  // A trip is either a bin-collection trip or a household-collection trip —
  // show whichever list is populated, never both, never an empty table.
  const isHousehold = hhCollections.length > 0;
  const st = row.staff_template;
  const wasteTypeName =
    Array.isArray(row.waste_types_detail) && row.waste_types_detail.length > 0
      ? row.waste_types_detail.map((wt) => wt.waste_type_name).filter(Boolean).join(", ")
      : "-";
  const wasteTypeBreakdown = Array.isArray(row.waste_type_breakdown) ? row.waste_type_breakdown : [];
  const collectedWeightFromPoints = computeCollectedWeight(cps);
  const overallTotal = collectedWeightFromPoints + Number(row.household_collected_weight_kg ?? 0);

  return (
    <div className="p-3">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Trip Log Report</h1>
          <p className="text-sm text-gray-500">{row.unique_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={row.log_status} />
          <CollectionStatusBadge value={row.collection_status} />
        </div>
      </div>

      {/* Trip / Location / Staff summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 mb-6">
        <div className="rounded-xl border p-4">
          <SectionLabel>Trip Details</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <InfoRow label="Trip Assignment" value={row.trip_assignment?.display_code ?? row.trip_assignment_id} />
            <InfoRow label="Date" value={row.trip_date} />
            <InfoRow label="Collection Status" value={row.collection_status} />
            <InfoRow label="Waste Type" value={wasteTypeName} />
            <InfoRow label="Vehicle" value={(row.vehicle as any)?.vehicle_no} />
            <InfoRow label="Start Time" value={row.actual_start_time} />
            <InfoRow label="End Time" value={row.actual_end_time} />
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <SectionLabel>Local Body Hierarchy</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <InfoRow label="State" value={row.location?.state} />
            <InfoRow label="District" value={row.location?.district} />
            <InfoRow label="Classification" value={row.location?.classification} />
            <InfoRow
              label="Local Body"
              value={
                row.location?.local_body_name
                  ? `${row.location.local_body_name}${row.location.local_body_level ? ` (${row.location.local_body_level})` : ""}`
                  : undefined
              }
            />
            <InfoRow label="Ward" value={row.wards_detail?.map((ward) => ward.ward_name).filter(Boolean).join(", ")} />
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <SectionLabel>Staff</SectionLabel>
          {st?.base ? (
            <div className="flex flex-col gap-1.5">
              <InfoRow label="Driver" value={st.base.driver?.employee_name} />
              <InfoRow label="Operator" value={st.base.operator?.employee_name} />
              {st.alt && (
                <>
                  <p className="text-xs text-orange-500 mt-1">Alt: {st.alt.display_code}</p>
                  <InfoRow label="Driver" value={st.alt.driver?.employee_name} />
                  <InfoRow label="Operator" value={st.alt.operator?.employee_name} />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <InfoRow label="Driver" value={row.driver?.employee_name} />
              <InfoRow label="Operator" value={row.operator?.employee_name} />
            </div>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl border p-4 mb-6 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Overall Total</p>
          <p className="text-xl font-bold text-gray-900">{overallTotal.toFixed(2)} kg</p>
        </div>
        {wasteTypeBreakdown.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total by Waste Type</p>
            <WasteChips items={wasteTypeBreakdown} />
          </div>
        )}
      </div>

      {/* Collection Points OR Household Collections — never both */}
      {isHousehold ? (
        <div className="mb-6">
          <SectionLabel>
            Household Collections
            <span className="ml-1 normal-case font-normal text-gray-400">
              — {hhCollections.filter((hh) => hh.is_collected).length} / {hhCollections.length} collected
            </span>
          </SectionLabel>
          <DataTable
            value={hhCollections}
            dataKey="unique_id"
            className="p-datatable-sm"
            paginator
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
            exportable={false}
          >
            <Column field="sequence" header="#" style={{ width: 50 }} />
            <Column
              header="Customer"
              body={(hh: any) => hh.customer_name ?? hh.customer_unique_id ?? "-"}
            />
            <Column
              header="Waste Type Breakdown"
              body={(hh: any) => <WasteChips items={hh.waste_type_breakdown} />}
            />
            <Column
              header="Collection Time"
              style={{ width: 140 }}
              body={(hh: any) => formatCollectionTime(hh.collected_at)}
            />
            <Column
              header="Status"
              style={{ width: 130 }}
              body={(hh: any) => <StopStatusBadge value={hh.status} />}
            />
          </DataTable>
        </div>
      ) : (
        <div className="mb-6">
          <SectionLabel>
            Collection Points
            {cps.length > 0 && (
              <span className="ml-1 normal-case font-normal text-gray-400">
                — {cps.filter((cp) => cp.is_collected).length} / {cps.length} collected
              </span>
            )}
          </SectionLabel>
          <DataTable
            value={cps}
            dataKey="unique_id"
            className="p-datatable-sm"
            emptyMessage="No collection points."
            paginator
            rows={10}
            rowsPerPageOptions={[10, 25, 50]}
            exportable={false}
          >
            <Column field="sequence" header="#" style={{ width: 50 }} />
            <Column field="cp_name" header="Collection Point" />
            <Column
              header="Waste Type Breakdown"
              body={(cp: any) => <WasteChips items={cp.waste_type_breakdown} />}
            />
            <Column
              header="Collection Time"
              style={{ width: 140 }}
              body={(cp: any) => formatCollectionTime(cp.collected_at)}
            />
            <Column
              header="Status"
              style={{ width: 130 }}
              body={(cp: any) => <StopStatusBadge value={cp.status} />}
            />
          </DataTable>
        </div>
      )}

      <div className="mt-6">
        <Button
          label="Back to list"
          icon="pi pi-arrow-left"
          className="p-button-outlined p-button-sm"
          onClick={() => navigate(listPath)}
        />
      </div>
    </div>
  );
}
