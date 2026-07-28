import type { DailyTripCollectionPointRecord } from "./types";
import type { NamedRef } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { PencilIcon } from "@/icons";
import { dailyTripCollectionPointApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";


const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700",
  Collected: "bg-green-100 text-green-800",
  Skipped: "bg-red-100 text-red-800",
};

const Badge = ({ value }: { value?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[value ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
    {value ?? "-"}
  </span>
);

const text = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === ""
    ? "-"
    : String(value);

const nestedText = (obj: NamedRef, keys: string[]): string => {
  if (!obj || typeof obj !== "object") return "-";
  for (const key of keys) {
    const value = obj[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "-";
};

const extractError = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data !== "object") return null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  return typeof first === "string" ? first : null;
};

const toRecordList = (value: unknown): DailyTripCollectionPointRecord[] => {
  if (Array.isArray(value)) return value as DailyTripCollectionPointRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: DailyTripCollectionPointRecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["sequence", "status"]);

export default function DailyTripCollectionPointList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encDailyOperations, encDailyTripCollectionPoint } = getEncryptedRoute();
  const { newPath: NEW_PATH } = createCrudRoutePaths(encDailyOperations, encDailyTripCollectionPoint);
  const { editPath: EDIT_PATH } = createCrudRoutePaths(
    encDailyOperations,
    encDailyTripCollectionPoint,
  );

  const [rawRows, setRawRows] = useState<DailyTripCollectionPointRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setLoading(true);
    try {
      const response = await dailyTripCollectionPointApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRawRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (error: unknown) {
      setRawRows([]);
      Swal.fire(t("common.error"), extractError(error) ?? t("common.load_failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const rows = useMemo(
    () =>
      rawRows
        .map((row) => {
          const tripAssign = row.trip_assignment as NamedRef;
          const tripPlan = (tripAssign?.trip_plan as NamedRef) ?? (tripAssign?.trip_plan_id as NamedRef);
          const collectionPt = row.collection_point as NamedRef;
          const binObj = row.bin as NamedRef;
          const wasteType = (binObj?.waste_type as NamedRef) ?? null;

          return {
            ...row,
            _trip: nestedText(tripPlan, ["display_code", "unique_id"]) !== "-"
              ? nestedText(tripPlan, ["display_code", "unique_id"])
              : nestedText(tripAssign, ["unique_id"]) !== "-" ? nestedText(tripAssign, ["unique_id"]) : text(row.trip_assignment_id),
            _collection_point: nestedText(collectionPt, ["cp_name", "collection_point_name", "name"]) !== "-"
              ? nestedText(collectionPt, ["cp_name", "collection_point_name", "name"])
              : text(row.collection_point_id),
            _bin: nestedText(binObj, ["bin_name", "name"]) !== "-"
              ? nestedText(binObj, ["bin_name", "name"])
              : text(row.bin_id),
            _ward: Array.isArray(collectionPt?.wards)
              ? collectionPt.wards.map((ward: NamedRef) => nestedText(ward, ["ward_name"])).join(", ")
              : text(row.ward_name),
            _waste_type: nestedText(wasteType, ["waste_type_name", "name"]),
          };
        }),
    [rawRows],
  );

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const onGlobalFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(event.target.value);
  };

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Daily Trip Collection Points</h1>
          <p className="text-sm text-gray-500">Manage collection points assigned to daily trips</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label="New Collection Point"
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
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
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading}
        header={
          <div className="flex justify-end items-center">
            <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
              <i className="pi pi-search text-gray-500" />
              <InputText
                value={globalFilterValue}
                onChange={onGlobalFilterChange}
                placeholder="Search trip collection points..."
                className="p-inputtext-sm !border-0 !shadow-none !outline-none"
              />
            </div>
          </div>
        }
        stripedRows
        showGridlines
        emptyMessage="No daily trip collection points found."
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={(_, options: { rowIndex: number }) => options.rowIndex + 1} style={{ width: 60 }} />
        <Column field="unique_id" header="ID" style={{ minWidth: 150 }} />
        <Column field="_trip" header="Trip" style={{ minWidth: 170 }} />
        <Column field="_collection_point" header="Collection Point" style={{ minWidth: 180 }} />
        <Column field="_ward" header="Ward" style={{ minWidth: 140 }} />
        <Column field="_bin" header="Bin" />
        <Column field="_waste_type" header="Waste Type" />
        <Column field="sequence" header="Seq" sortable={SORTABLE_FIELDS.has("sequence")} style={{ width: 90 }} />
        <Column field="collected_weight_kg" header="Weight (kg)" body={(row: DailyTripCollectionPointRecord) => text(row.collected_weight_kg)} />
        <Column field="status" header="Status" body={(row: DailyTripCollectionPointRecord) => <Badge value={row.status} />} sortable={SORTABLE_FIELDS.has("status")} />
        <Column
          header={t("common.actions")}
          body={(row: DailyTripCollectionPointRecord) => (
            <div className="flex justify-center">
              <button
                onClick={() => navigate(EDIT_PATH(row.unique_id))}
                className="text-blue-600 hover:text-blue-800"
                title={t("common.edit")}
              >
                <PencilIcon className="size-5" />
              </button>
            </div>
          )}
          style={{ width: 120 }}
        />
      </DataTable>
    </div>
  );
}
