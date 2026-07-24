import type { CollectionPointRecord, TableFilters } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { collectionPointApi } from "@/helpers/admin";
import { formatCoordinates } from "../../../masters/shared/formatCoordinates";
import { capitalize } from "@/utils/capitalize";


const toDisplay = (value: unknown): string =>
  value === null || value === undefined || String(value).trim() === "" ? "-" : String(value);

const toOptionalString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

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

export default function CollectionPointListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [records, setRecords] = useState<CollectionPointRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    cp_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    state_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    district_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    ulb_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    rlb_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    ward_names: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

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

  useEffect(() => {
    let mounted = true;

    const loadCollectionPoints = async () => {
      setIsLoading(true);
      try {
        const data = await collectionPointApi.readAll();
        if (mounted) setRecords(data as CollectionPointRecord[]);
      } catch (error) {
        console.error("Failed to fetch collection points", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadCollectionPoints();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = (Array.isArray(records) ? records : []).map((row) => {
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

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
  };

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
        setRecords((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch (error) {
        console.error("Failed to update collection point status", error);
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
        value={rows}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        className="p-datatable-sm"
        globalFilterFields={[
          "unique_id",
          "cp_name",
          "state_id",
          "state_name",
          "district_id",
          "district_name",
          "_ulb_name",
          "_rlb_name",
          "_ward_names",
        ]}
        emptyMessage={t("common.no_items_found", { item: t("admin.nav.collection_point") })}
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
        {showCol("cp_name") && (
          <Column
            field="cp_name"
            header={t("admin.nav.collection_point")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: CollectionPointRecord) => capitalize(toOptionalString(row.cp_name ?? row.collection_point_name))}
          />
        )}
        {showCol("state_name") && (
          <Column
            field="state_name"
            header={t("common.state")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: CollectionPointRecord) => capitalize(toOptionalString(row.state_name))}
          />
        )}
        {showCol("district_name") && (
          <Column
            field="district_name"
            header={t("common.district")}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: CollectionPointRecord) => capitalize(toOptionalString(row.district_name))}
          />
        )}
        {showCol("ulb_name") && (
          <Column
            field="_ulb_name"
            header="ULB"
            sortable
            filter
            showFilterMatchModes={false}
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
            sortable
            filter
            showFilterMatchModes={false}
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
            sortable
            filter
            showFilterMatchModes={false}
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
