import type { CountryRecord, ErrorWithResponse } from "./types";
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
import { countryApi } from "@/helpers/admin";
import { capitalize } from "@/utils/capitalize";


const COUNTRY_COLUMN_FIELDS: Record<string, string[]> = {
  continent_name: ["continent_id"],
  name: ["name"],
  currency: ["currency"],
  mob_code: ["mob_code"],
  is_active: ["is_active"],
};

const SORTABLE_FIELDS = new Set(["name"]);

const toRecordList = (value: unknown): CountryRecord[] => {
  if (Array.isArray(value)) return value as CountryRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: CountryRecord[] }).results;
  }
  return [];
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as ErrorWithResponse).response?.data;

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");

  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
};

export default function CountryList() {
  const { t } = useTranslation();

  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "common-masters",
    "countries",
    COUNTRY_COLUMN_FIELDS,
  );

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const navigate = useNavigate();

  const { encCommonMasters, encCountries } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encCommonMasters,
    encCountries,
  );

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await countryApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setCountries(toRecordList(response));
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

  const onExportRequest = async () => toRecordList(await countryApi.readAllForExport());

  const updateStatus = async (row: CountryRecord, checked: boolean) => {
    const countryId = String(row.unique_id);
    setPendingStatusId(countryId);
    setIsUpdating(true);

    try {
      await countryApi.update(
        row.unique_id,
        filterPayload({ is_active: checked }) as {
          is_active: boolean;
        }
      );
      setCountries((current) =>
        current.map((item) =>
          item.unique_id === row.unique_id ? { ...item, is_active: checked } : item
        )
      );
    } catch {
      Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
    } finally {
      setPendingStatusId(null);
      setIsUpdating(false);
    }
  };

  const statusTemplate = (row: CountryRecord) => {
    const countryId = String(row.unique_id);
    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === countryId}
        onCheckedChange={(checked) => void updateStatus(row, checked)}
      />
    );
  };

  const actionTemplate = (c: CountryRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(c.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: CountryRecord, options: { rowIndex: number }) =>
    options.rowIndex + 1;

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("common.search_placeholder", {
      item: t("admin.nav.country"),
    }),
  });

  return (
    <div className="p-3">

      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.country")}
          </h1>

          <p className="text-gray-500 text-sm">
            {t("common.manage_item_records", {
              item: t("admin.nav.country"),
            })}
          </p>
        </div>

        <Button
          label={t("common.add_item", { item: t("admin.nav.country") })}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />

      </div>

      <DataTable
        value={countries}
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
        header={header}
        stripedRows
        showGridlines
        onExportRequest={onExportRequest}
        className="p-datatable-sm"
      >

        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />

        {showCol("continent_name") && (
          <Column
            field="continent_name"
            header={t("admin.nav.continent")}
            body={(r) => capitalize(r.continent_name)}
          />
        )}

        {showCol("name") && (
          <Column
            field="name"
            header={t("admin.nav.country")}
            sortable={SORTABLE_FIELDS.has("name")}
            body={(r) => capitalize(r.name)}
          />
        )}

        {showCol("currency") && (
          <Column
            field="currency"
            header={t("common.currency")}
          />
        )}

        {showCol("mob_code") && (
          <Column
            field="mob_code"
            header={t("common.mobile_code")}
          />
        )}

        {showCol("is_active") && (
          <Column
            header={t("common.status")}
            body={statusTemplate}
          />
        )}

        <Column
          header={t("common.actions")}
          body={actionTemplate}
        />

      </DataTable>

    </div>
  );
}
