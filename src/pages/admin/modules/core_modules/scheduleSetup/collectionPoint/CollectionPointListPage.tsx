import type { CollectionPointRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import Swal from "@/lib/notify";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { collectionPointApi } from "@/helpers/admin";
import { formatCoordinates } from "../../../masters/shared/formatCoordinates";
import { capitalize } from "@/utils/capitalize";


const toDisplay = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === "" ? "-" : String(value);

const toOptionalString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

const toRecordList = (value: unknown): CollectionPointRecord[] => {
  if (Array.isArray(value)) return value as CollectionPointRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: CollectionPointRecord[] }).results;
  }
  return [];
};

const COLLECTION_POINT_COLUMN_FIELDS: Record<string, string[]> = {
  cp_name: ["cp_name", "collection_point_name", "name"],
  state_name: ["state_id", "state_name"],
  district_name: ["district_id", "district_name"],
  ulb_name: ["corporation_id", "corporation_name", "municipality_id", "municipality_name", "town_panchayat_id", "town_panchayat_name"],
  rlb_name: ["panchayat_union_id", "panchayat_union_name", "panchayat_id", "panchayat_name"],
  ward_names: ["ward_ids", "wards_detail"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

// Local body hierarchy: a collection point belongs to exactly one urban level
// (Corporation/Municipality/Town Panchayat) or one rural level (Panchayat
// Union/Panchayat). Resolve whichever is populated so the list can show a
// single ULB / RLB column regardless of which level the record was mapped to.
const ULB_LEVELS: Array<{ field: string; label: string }> = [
  { field: "corporation_name", label: "Corporation" },
  { field: "municipality_name", label: "Municipality" },
  { field: "town_panchayat_name", label: "Town Panchayat" },
];

const RLB_LEVELS: Array<{ field: string; label: string }> = [
  { field: "panchayat_union_name", label: "Panchayat Union" },
  { field: "panchayat_name", label: "Panchayat" },
];

const resolveLocalBody = (row: CollectionPointRecord, levels: Array<{ field: string; label: string }>) => {
  for (const level of levels) {
    const value = row[level.field];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return { name: String(value), level: level.label };
    }
  }
  return null;
};

const SORTABLE_FIELDS = new Set(["cp_name"]);

export default function CollectionPointListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [rows, setRows] = useState<CollectionPointRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const { encScheduleSetup, encCollectionPoints } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleSetup,
    encCollectionPoints,
  );

  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "collection-points",
    COLLECTION_POINT_COLUMN_FIELDS,
  );

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await collectionPointApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch (error: any) {
      Swal.fire(
        "Error",
        String(error?.response?.data?.detail ?? error?.message ?? "Failed to load Collection Points"),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  const displayRows = rows.map((row) => {
    const ulb = resolveLocalBody(row, ULB_LEVELS);
    const rlb = resolveLocalBody(row, RLB_LEVELS);
    return {
      ...row,
      _ulb_name: ulb?.name ?? "",
      _ulb_level: ulb?.level ?? "",
      _rlb_name: rlb?.name ?? "",
      _rlb_level: rlb?.level ?? "",
      _ward_names: (row.wards_detail ?? []).map((ward) => ward.ward_name).join(", "),
    };
  });

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", { item: t("admin.nav.collection_point") }),
    });

  const indexTemplate = (_: CollectionPointRecord, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  const actionTemplate = (row: CollectionPointRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(String(row.unique_id)))}
        className="text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const statusTemplate = (row: CollectionPointRecord) => {
    const updateStatus = async (value: boolean) => {
      try {
        setPendingStatusId(String(row.unique_id));
        setIsUpdating(true);
        await collectionPointApi.update(
          row.unique_id,
          filterPayload({ is_active: value }) as { is_active: boolean }
        );
        setRows((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (error: any) {
        Swal.fire(
          "Error",
          String(error?.response?.data?.detail ?? error?.message ?? "Failed to update collection point status"),
          "error",
        );
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={isUpdating && pendingStatusId === String(row.unique_id)}
        onCheckedChange={updateStatus}
      />
    );
  };


  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">{t("admin.nav.collection_point")}</h1>
          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", { item: t("admin.nav.collection_point") })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label={t("common.add_item", { item: t("admin.nav.collection_point") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        value={displayRows}
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
        loading={isLoading}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        emptyMessage={t("common.no_items_found", { item: t("admin.nav.collection_point") })}
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
        {showCol("cp_name") && (
          <Column
            field="cp_name"
            header={t("admin.nav.collection_point")}
            sortable={SORTABLE_FIELDS.has("cp_name")}
            body={(row: CollectionPointRecord) => capitalize(toOptionalString(row.cp_name ?? row.collection_point_name))}
          />
        )}
        {showCol("state_name") && (
          <Column
            field="state_name"
            header={t("common.state")}
            body={(row: CollectionPointRecord) => capitalize(toOptionalString(row.state_name))}
          />
        )}
        {showCol("district_name") && (
          <Column
            field="district_name"
            header={t("common.district")}
            body={(row: CollectionPointRecord) => capitalize(toOptionalString(row.district_name))}
          />
        )}
        {showCol("ulb_name") && (
          <Column
            field="_ulb_name"
            header="ULB"
            body={(row: CollectionPointRecord) =>
              row._ulb_name ? (
                <span>
                  {capitalize(String(row._ulb_name))}{" "}
                  <span className="text-xs text-gray-400">({String(row._ulb_level)})</span>
                </span>
              ) : (
                "-"
              )
            }
          />
        )}
        {showCol("rlb_name") && (
          <Column
            field="_rlb_name"
            header="RLB"
            body={(row: CollectionPointRecord) =>
              row._rlb_name ? (
                <span>
                  {capitalize(String(row._rlb_name))}{" "}
                  <span className="text-xs text-gray-400">({String(row._rlb_level)})</span>
                </span>
              ) : (
                "-"
              )
            }
          />
        )}
        {showCol("ward_names") && (
          <Column
            field="_ward_names"
            header="Wards"
            body={(row: CollectionPointRecord) => toDisplay(row._ward_names)}
          />
        )}
        {showCol("latitude") && (
          <Column field="latitude" header="Latitude" body={(row: CollectionPointRecord) => toDisplay(row.latitude)} />
        )}
        {showCol("longitude") && (
          <Column field="longitude" header="Longitude" body={(row: CollectionPointRecord) => toDisplay(row.longitude)} />
        )}
        {showCol("coordinates") && (
          <Column
            field="coordinates"
            header="Coordinates"
            body={(row: CollectionPointRecord) =>
              formatCoordinates(row.coordinates, {
                latitude: row.latitude,
                longitude: row.longitude,
              })
            }
            style={{ minWidth: "240px" }}
          />
        )}
        {showCol("is_active") && (
          <Column header={t("common.status")} body={statusTemplate} style={{ width: "140px" }} />
        )}
        <Column header={t("common.actions")} body={actionTemplate} style={{ width: "150px", textAlign: "center" }} />
      </DataTable>
    </div>
  );
}
