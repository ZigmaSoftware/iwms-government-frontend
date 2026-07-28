import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { type ChangeEvent, useEffect, useState } from "react";
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

import { mainScreenTypeApi } from "@/helpers/admin";

import type { MainScreenType } from "@/pages/admin/modules/superadmin/screenManagement/shared/adminTypes";

const toRecordList = (value: unknown): MainScreenType[] => {
  if (Array.isArray(value)) return value as MainScreenType[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: MainScreenType[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["type_name"]);

export default function MainScreenTypeList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<MainScreenType[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);

  const navigate = useNavigate();
  const { encSuperAdmin, encMainScreenType } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encSuperAdmin,
    encMainScreenType,
  );

  const loadRows = async (page: number, limit: number, search: string, ordering?: string) => {
    setIsLoading(true);
    try {
      const response = await mainScreenTypeApi.readAllwithPaginated(page, limit, {
        params: {
          ...(search ? { search } : {}),
          ...(ordering ? { ordering } : {}),
        },
      });
      setRows(toRecordList(response));
      setTotalRecords(
        typeof response?.count === "number" ? response.count : toRecordList(response).length,
      );
    } catch {
      Swal.fire(t("common.error"), t("common.load_failed"), "error");
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

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onExportRequest = async () => toRecordList(await mainScreenTypeApi.readAllForExport());

  const indexTemplate = (_: MainScreenType, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  const actionTemplate = (row: MainScreenType) => (
    <div className="flex gap-2 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>

      {/* <button
        title="Delete"
        className="text-red-600 hover:text-red-800"
        onClick={() => handleDelete(row.unique_id)}
      >
        <TrashBinIcon className="size-5" />
      </button> */}
    </div>
  );

  const statusTemplate = (row: MainScreenType) => {
    const updateStatus = async (value: boolean) => {
      const id = String(row.unique_id);
      setPendingStatusId(id);

      try {
        await mainScreenTypeApi.update(row.unique_id, { is_active: value });
        setRows((current) =>
          current.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      } finally {
        setPendingStatusId(null);
      }
    };

    return (
      <Switch
        checked={row.is_active}
        disabled={pendingStatusId === String(row.unique_id)}
        onCheckedChange={updateStatus}
      />
    );
  };

  const header = renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.main_screen_type"),
      }),
    });

  return (
    <div className="px-3 py-3 w-full ">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.main_screen_type")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", {
                item: t("admin.nav.main_screen_type"),
              })}
            </p>
          </div>

          <Button
            label={t("common.add_item", {
              item: t("admin.nav.main_screen_type"),
            })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>

        <DataTable
          value={rows}
          lazy
          paginator
          first={first}
          rows={rowsPerPage}
          totalRecords={totalRecords}
          onPage={onPage}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={onSort}
          loading={isLoading}
          rowsPerPageOptions={[5, 10, 25, 50]}
          header={header}
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.main_screen_type"),
          })}
          stripedRows
          showGridlines
          onExportRequest={onExportRequest}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
          <Column
            field="type_name"
            header={t("admin.nav.main_screen_type")}
            sortable
            style={{ minWidth: "200px" }}
          />
          <Column header={t("common.status")} body={statusTemplate} style={{ width: "150px" }} />
          <Column header={t("common.actions")} body={actionTemplate} style={{ width: "150px" }} />
        </DataTable>

    </div>
  );
}
