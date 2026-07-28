import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Switch } from "@/components/ui/switch";
import { adminApi } from "@/helpers/admin/registry";
import { getEncryptedRoute } from "@/utils/routeCache";
import { PencilIcon } from "@/icons";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import type { ContinentRecord } from "./types";


const { encCommonMasters, encContinents } = getEncryptedRoute();

const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(

  encCommonMasters,

  encContinents,

);

const CONTINENT_COLUMN_FIELDS: Record<string, string[]> = {
  name: ["name"],
  is_active: ["is_active"],
};

const SORTABLE_FIELDS = new Set(["name"]);

const toRecordList = (value: unknown): ContinentRecord[] => {
  if (Array.isArray(value)) return value as ContinentRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: ContinentRecord[] }).results;
  }
  return [];
};

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

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export default function ContinentList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [continents, setContinents] = useState<ContinentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "common-masters",
    "continents",
    CONTINENT_COLUMN_FIELDS,
  );

  const loadContinents = async (
    page: number,
    limit: number,
    search: string,
    ordering?: string,
  ) => {
    setIsLoading(true);
    try {
      const response = await adminApi.continents.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setContinents(toRecordList(response));
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
    void loadContinents(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);
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

  const onExportRequest = async () => toRecordList(await adminApi.continents.readAllForExport());

  const updateStatus = async (
    continent: ContinentRecord,
    checked: boolean
  ) => {
    const continentId = String(continent.unique_id);

    setPendingStatusId(continentId);

    try {
      await adminApi.continents.update(
        continent.unique_id,
        filterPayload({ is_active: checked })
      );
      setContinents((current) =>
        current.map((row) =>
          row.unique_id === continent.unique_id
            ? { ...row, is_active: checked }
            : row
        )
      );
    } catch (error) {
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.update_status_failed")),
        "error"
      );
    } finally {
      setPendingStatusId(null);
    }
  };

  const statusBodyTemplate = (row: ContinentRecord) => {
    const continentId = String(row.unique_id);

    return (
      <Switch
        checked={row.is_active}
        disabled={
          pendingStatusId === continentId
        }
        onCheckedChange={(checked) => {
          void updateStatus(row, checked);
        }}
      />
    );
  };

  const actionBodyTemplate = (row: ContinentRecord) => (
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

  const indexTemplate = (
    _: ContinentRecord,
    options: { rowIndex: number }
  ) => options.rowIndex + 1;

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("common.search_placeholder", {
      item: t("admin.nav.continent"),
    }),
  });

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {t("admin.nav.continent")}
          </h1>

          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", {
              item: t("admin.nav.continent"),
            })}
          </p>
        </div>

        <Button
          label={t("common.add_item", { item: t("admin.nav.continent") })}
          icon="pi pi-plus"
          className="p-button-success"
          onClick={() => navigate(ENC_NEW_PATH)}
        />
      </div>

      <DataTable
        value={continents}
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
        loading={isLoading && continents.length === 0}
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

        {showCol("name") && (
          <Column
            field="name"
            header={t("common.item_name", { item: t("admin.nav.continent") })}
            body={(record: ContinentRecord) => record.name}
            sortable={SORTABLE_FIELDS.has("name")}
            style={{ minWidth: "200px" }}
          />
        )}

        {showCol("is_active") && (
          <Column
            header={t("common.status")}
            body={statusBodyTemplate}
            style={{ width: "150px", textAlign: "center" }}
          />
        )}

        <Column
          header={t("common.actions")}
          body={actionBodyTemplate}
          style={{ width: "150px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
