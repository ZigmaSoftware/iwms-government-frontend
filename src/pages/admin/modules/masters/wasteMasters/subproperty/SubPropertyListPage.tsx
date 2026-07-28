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
import type { SubPropertyRecord } from "./types";

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

const SUB_PROPERTY_COLUMN_FIELDS: Record<string, string[]> = {
  property_name: ["property_id"],
  sub_property_name: ["sub_property_name"],
  is_active: ["is_active"],
};

const toRecordList = (value: unknown): SubPropertyRecord[] => {
  if (Array.isArray(value)) return value as SubPropertyRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: SubPropertyRecord[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["sub_property_name"]);

export default function SubPropertyList() {
  const { t } = useTranslation();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [subProperties, setSubProperties] = useState<SubPropertyRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const navigate = useNavigate();
  const { encWasteMasters, encSubProperties } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encWasteMasters,
    encSubProperties,
  );

  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "sub-properties",
    SUB_PROPERTY_COLUMN_FIELDS,
  );

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await adminApi.subProperties.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setSubProperties(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
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

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  /* ================= Search ================= */
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

  const onExportRequest = async () => toRecordList(await adminApi.subProperties.readAllForExport());

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.sub_property"),
      }),
    });


  const statusTemplate = (row: SubPropertyRecord) => {
    const updateStatus = async (value: boolean) => {
      try {
        setUpdatingStatusId(String(row.unique_id));
        await adminApi.subProperties.update(
          row.unique_id,
          filterPayload({ is_active: value })
        );
        setSubProperties((current) =>
          current.map((subProperty) =>
            subProperty.unique_id === row.unique_id
              ? { ...subProperty, is_active: value }
              : subProperty
          )
        );
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: t("common.error"),
          text: extractErrorMessage(err, t("common.update_status_failed")),
        });
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

  const actionTemplate = (row: SubPropertyRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(String(row.unique_id)))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: SubPropertyRecord, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  /* ================= UI ================= */
  return (
    <div className="p-3">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.sub_property")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", {
                item: t("admin.nav.sub_property"),
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              label={t("common.add_item", { item: t("admin.nav.sub_property") })}
              icon="pi pi-plus"
              className="p-button-success"
              onClick={() => navigate(ENC_NEW_PATH)}
            />
          </div>
        </div>

        <DataTable
          value={subProperties}
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
            item: t("admin.nav.sub_property"),
          })}
          onExportRequest={onExportRequest}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />

          {showCol("property_name") && (
            <Column
              field="property_name"
              header={t("admin.nav.property")}
              body={(row: SubPropertyRecord) => capitalize(row.property_name)}
            />
          )}

          {showCol("sub_property_name") && (
            <Column
              field="sub_property_name"
              header={t("admin.nav.sub_property")}
              sortable
              body={(row: SubPropertyRecord) => capitalize(row.sub_property_name)}
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
