import type { HierarchyRecord } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
import { Switch } from "@/components/ui/switch";
import { PencilIcon } from "@/icons";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { adminApi } from "@/helpers/admin/registry";
import Swal from "@/lib/notify";
import { capitalize } from "@/utils/capitalize";


const HIERARCHY_COLUMN_FIELDS: Record<string, string[]> = {
  level_name: ["level_name", "name"],
  is_active: ["is_active"],
};

const SORTABLE_FIELDS = new Set(["level_name", "is_active"]);

const toRecordList = (value: unknown): HierarchyRecord[] => {
  if (Array.isArray(value)) return value as HierarchyRecord[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: HierarchyRecord[] }).results;
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

export default function HierarchyListPage() {
  const { t } = useTranslation();
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [rows, setRows] = useState<HierarchyRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "masters",
    "hierarchies",
    HIERARCHY_COLUMN_FIELDS,
  );
  const navigate = useNavigate();
  const { encMasters, encHierarchies } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encMasters,
    encHierarchies,
  );

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await adminApi.hierarchies.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
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

  const onExportRequest = async () => toRecordList(await adminApi.hierarchies.readAllForExport());

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.hierarchy"),
      }),
    });

  const statusTemplate = (row: HierarchyRecord) => {
    const updateStatus = async (value: boolean) => {
      const hierarchyId = String(row.unique_id);
      setPendingStatusId(hierarchyId);

      try {
        await adminApi.hierarchies.update(
          row.unique_id as string | number,
          filterPayload({ is_active: value })
        );
        setRows((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id
              ? { ...item, is_active: value }
              : item
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

    return (
      <Switch
        checked={Boolean(row.is_active)}
        disabled={
          pendingStatusId === String(row.unique_id)
        }
        onCheckedChange={updateStatus}
      />
    );
  };

  const actionTemplate = (row: HierarchyRecord) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(String(row.unique_id)))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (
    _: HierarchyRecord,
    { rowIndex }: { rowIndex: number }
  ) => rowIndex + 1;


  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.hierarchy")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", {
              item: t("admin.nav.hierarchy"),
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            label={t("common.add_item", { item: t("admin.nav.hierarchy") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
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
        loading={isLoading}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", {
          item: t("admin.nav.hierarchy"),
        })}
        onExportRequest={onExportRequest}
        className="p-datatable-sm"
      >
        <Column
          header={t("common.s_no")}
          body={indexTemplate}
          style={{ width: "80px" }}
        />
        {showCol("level_name") && (
          <Column
            field="level_name"
            header={t("common.item_name", { item: t("admin.nav.hierarchy") })}
            sortable={SORTABLE_FIELDS.has("level_name")}
            body={(row: HierarchyRecord) => capitalize(row.level_name)}
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
