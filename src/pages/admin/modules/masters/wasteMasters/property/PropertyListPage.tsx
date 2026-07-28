import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import { capitalize } from "@/utils/capitalize";
import type { PropertyRecord } from "./types";

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.join(", ");
  }

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  return fallback;
};

const toRecordList = (value: unknown): PropertyRecord[] => {
  if (Array.isArray(value)) return value as PropertyRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: PropertyRecord[] }).results;
  }
  return [];
};

const PROPERTY_COLUMN_FIELDS: Record<string, string[]> = {
  property_name: ["property_name"],
  is_active: ["is_active"],
};

const SORTABLE_FIELDS = new Set(["property_name"]);

export default function PropertyList() {
  const { t } = useTranslation();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const navigate = useNavigate();

  const { encWasteMasters, encProperties } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encWasteMasters,
    encProperties,
  );

  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "properties",
    PROPERTY_COLUMN_FIELDS,
  );

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  const loadProperties = async (page: number, limit: number, search: string, order?: string) => {
    setIsLoading(true);
    try {
      const response = await adminApi.properties.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(order ? { ordering: order } : {}),
        },
      });
      const list = toRecordList(response);
      setProperties(list);
      setTotalRecords(
        typeof response?.count === "number" ? response.count : list.length,
      );
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.fetch_failed")),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProperties(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

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

  const onExportRequest = async () => {
    const all = await adminApi.properties.readAllForExport();
    return toRecordList(all);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.property"),
      }),
    });


  const statusTemplate = (row: PropertyRecord) => {
    const updateStatus = async (value: boolean) => {
      try {
        setUpdatingStatusId(String(row.unique_id));
        await adminApi.properties.update(
          row.unique_id,
          filterPayload({ is_active: value })
        );
        setProperties((current) =>
          current.map((property) =>
            property.unique_id === row.unique_id
              ? { ...property, is_active: value }
              : property
          )
        );
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: extractErrorMessage(err, t("common.update_status_failed")),
        });
      } finally {
        setUpdatingStatusId(null);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        disabled={updatingStatusId === String(row.unique_id)}
        onCheckedChange={updateStatus}
      />
    );
  };

  const actionTemplate = (row: PropertyRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(String(row.unique_id)))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
{/*
      <button
        onClick={() => handleDelete(row.unique_id)}
        className="text-red-600 hover:text-red-800"
      >
        <TrashBinIcon className="size-5" />
      </button> */}
    </div>
  );

  const indexTemplate = (_: PropertyRecord, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  return (
    <div className="p-3">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.property")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", { item: t("admin.nav.property") })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              label={t("common.add_item", { item: t("admin.nav.property") })}
              icon="pi pi-plus"
              className="p-button-success"
              onClick={() => navigate(ENC_NEW_PATH)}
            />
          </div>
        </div>

        <DataTable
          value={properties}
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
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.property"),
          })}
          onExportRequest={onExportRequest}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />

          {showCol("property_name") && (
            <Column
              field="property_name"
              header={t("common.item_name", { item: t("admin.nav.property") })}
              sortable={SORTABLE_FIELDS.has("property_name")}
              body={(row: PropertyRecord) => capitalize(row.property_name)}
            />
          )}

          {showCol("is_active") && (
            <Column
              header={t("common.status")}
              body={statusTemplate}
              style={{ width: "140px" }}
            />
          )}

          <Column
            header={t("common.actions")}
            body={actionTemplate}
            style={{ width: "150px", textAlign: "center" }}
          />
        </DataTable>

    </div>
  );
}
