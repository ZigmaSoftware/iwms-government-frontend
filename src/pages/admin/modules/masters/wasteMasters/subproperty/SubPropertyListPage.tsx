import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
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

export default function SubPropertyList() {
  const { t } = useTranslation();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [subProperties, setSubProperties] = useState<SubPropertyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    property_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    sub_property_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

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

  const loadSubProperties = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.subProperties.readAll();
      setSubProperties(
        (Array.isArray(response)
          ? response
          : ((response as { results?: SubPropertyRecord[] })?.results ?? [])) as SubPropertyRecord[]
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
    void loadSubProperties();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters);
  };

  /* ================= Search ================= */
  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      global: { ...filters.global, value },
    });
    setGlobalFilterValue(value);
  };

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.sub_property"),
      }),
    });

  const cap = (s?: string | null) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

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
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          loading={isLoading}
          filters={filters}
          onFilter={onFilter}
          header={renderHeader()}
          stripedRows
          showGridlines
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.sub_property"),
          })}
          globalFilterFields={[
            "sub_property_name",
            "property_name",
          ]}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />

          {showCol("property_name") && (
            <Column
              field="property_name"
              header={t("admin.nav.property")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row: SubPropertyRecord) => cap(row.property_name)}
            />
          )}

          {showCol("sub_property_name") && (
            <Column
              field="sub_property_name"
              header={t("admin.nav.sub_property")}
              sortable
              filter
              showFilterMatchModes={false}
              body={(row: SubPropertyRecord) => cap(row.sub_property_name)}
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
