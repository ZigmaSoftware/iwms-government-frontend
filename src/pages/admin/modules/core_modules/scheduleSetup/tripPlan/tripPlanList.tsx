import type { TripPlanRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { DataTable } from "@/components/common/SafeDataTable";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";
import { tripPlanApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { normalizeList } from "@/utils/forms";
import HierarchyFilterBar, { type HierarchyFilterParams } from "@/components/filters/HierarchyFilterBar";

const SORTABLE_FIELDS = new Set(["display_code", "approval_status"]);

// Local body can live on any one of these fields depending on the plan's
// area type (urban → corporation/municipality/town panchayat, rural →
// panchayat union/panchayat) — show whichever one is actually set.
const HIERARCHY_LOCATION_FIELDS: Array<{ key: string; nameKey: string; label: string }> = [
  { key: "corporation", nameKey: "corporation_name", label: "Corporation" },
  { key: "municipality", nameKey: "municipality_name", label: "Municipality" },
  { key: "town_panchayat", nameKey: "town_panchayat_name", label: "Town Panchayat" },
  { key: "panchayat_union", nameKey: "union_name", label: "Panchayat Union" },
  { key: "panchayat", nameKey: "panchayat_name", label: "Panchayat" },
];

const resolveLocation = (record: TripPlanRecord): string => {
  for (const { key, nameKey, label } of HIERARCHY_LOCATION_FIELDS) {
    const nested = record[key] as Record<string, unknown> | undefined;
    if (!nested) continue;
    const name = String(nested[nameKey] ?? nested.name ?? "");
    if (name) return `${name} (${label})`;
  }
  return "";
};

const formatTime12Hour = (time?: string): string => {
  if (!time) return "";
  const [hourStr, minuteStr = "00"] = time.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${minuteStr.padStart(2, "0")} ${period}`;
};

const extractErrorMessage = (error: unknown): string | null => {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof (data as Record<string, unknown>)?.detail === "string") return (data as Record<string, unknown>).detail as string;
  if (typeof data === "object") {
    const firstValue = Object.values(data as Record<string, unknown>)[0];
    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (typeof firstValue === "string") return firstValue;
  }
  return null;
};

export default function TripPlanList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { encScheduleSetup, encTripPlans } = getEncryptedRoute();
  const { newPath: newPath } = createCrudRoutePaths(encScheduleSetup, encTripPlans);
  const { editPath } = createCrudRoutePaths(encScheduleSetup, encTripPlans);

  const [rawRows, setRawRows] = useState<TripPlanRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [hierarchyParams, setHierarchyParams] = useState<HierarchyFilterParams>({});

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  useEffect(() => {
    setFirst(0);
  }, [hierarchyParams]);

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadRows = (page: number, limit: number, search: string, orderingParam?: string) => {
    let mounted = true;
    setLoading(true);
    tripPlanApi.readAllwithPaginated(page, limit, {
      params: {
        ...hierarchyParams,
        ...(search ? { search } : {}),
        ...(orderingParam ? { ordering: orderingParam } : {}),
      },
    })
      .then((response) => {
        if (!mounted) return;
        setRawRows(normalizeList(response) as TripPlanRecord[]);
        setTotalRecords(typeof response?.count === "number" ? response.count : normalizeList(response).length);
      })
      .catch((error) => Swal.fire(t("common.error"), extractErrorMessage(error) ?? t("common.fetch_failed"), "error"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  };

  useEffect(() => {
    const cleanup = loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, hierarchyParams]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const rows = useMemo(() => rawRows.map((record) => ({
    ...record,
    _location: resolveLocation(record),
    _collection_type:
      record.collection_type === "bin_collection"
        ? "Secondary Collection Point"
        : record.collection_type === "household_collection"
          ? "Household Collection"
          : record.collection_type === "bulk_waste_collection"
            ? "Bulk Waste Collection"
            : "",
    _staff: record.staff_template?.display_code ?? "",
    _vehicle: record.vehicle?.vehicle_no ?? "",
    _waste_type: Array.isArray(record.waste_types_detail)
      ? record.waste_types_detail.map((wt: any) => wt.waste_type_name).filter(Boolean).join(", ")
      : "",
  })), [rawRows]);

  const statusBody = (row: TripPlanRecord) => {
    const updateStatus = async (checked: boolean) => {
      setUpdating(true);
      try {
        await tripPlanApi.update(row.unique_id, { status: checked ? "ACTIVE" : "INACTIVE" });
        setRawRows((current) => current.map((item) => item.unique_id === row.unique_id ? { ...item, status: checked ? "ACTIVE" : "INACTIVE" } : item));
      } catch (error) {
        Swal.fire(t("common.error"), extractErrorMessage(error) ?? t("common.update_status_failed"), "error");
      } finally {
        setUpdating(false);
      }
    };
    return <Switch checked={row.status === "ACTIVE"} disabled={updating} onCheckedChange={updateStatus} />;
  };

  const header = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Trip Plans</h1>
          <p className="text-sm text-gray-500">Manage trip route, staff, vehicle, schedule, and stop list</p>
        </div>
        <div className="flex items-center gap-3">
          <Button label="Add Trip Plan" icon="pi pi-plus" className="p-button-success p-button-sm" onClick={() => navigate(newPath)} />
        </div>
      </div>
      {/* Hierarchy filter — capped to the caller's own corporation subtree */}
      <HierarchyFilterBar onChange={setHierarchyParams} />
      <div className="flex justify-end">
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
          <i className="pi pi-search text-gray-500" />
          <InputText value={globalFilterValue} onChange={(event) => {
            setGlobalFilterValue(event.target.value);
          }} placeholder={t("common.search_placeholder")} className="border-none text-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-3">
      <DataTable
        exportable={false}
        value={rows}
        dataKey="unique_id"
        lazy
        paginator
        first={first}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={onPage}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        loading={loading}
        header={header}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage="No trip plans found"
      >
        <Column header={t("common.s_no")} body={(_, { rowIndex }) => rowIndex + 1} style={{ width: 70 }} />
        <Column field="display_code" header="Plan Code" sortable={SORTABLE_FIELDS.has("display_code")} />
        <Column field="_location" header="Location" />
        <Column field="_collection_type" header="Collection Type" />
        <Column field="_staff" header="Staff Template" />
        <Column field="_vehicle" header="Vehicle" />
        <Column field="_waste_type" header="Waste Type" />
        <Column field="scheduled_time" header="Time" body={(row: TripPlanRecord) => formatTime12Hour(row.scheduled_time)} />
        <Column field="approval_status" header="Approval" sortable={SORTABLE_FIELDS.has("approval_status")} />
        <Column header="Status" body={statusBody} style={{ width: 120 }} />
        <Column header={t("common.actions")} style={{ width: 120 }} body={(row: TripPlanRecord) => (
          <button title={t("common.edit")} onClick={() => navigate(editPath(row.unique_id), { state: { record: row } })} className="text-blue-600 hover:text-blue-800">
            <PencilIcon className="size-5" />
          </button>
        )} />
      </DataTable>
    </div>
  );
}
