import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { type ChangeEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
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

import type { UserType } from "../types/admin.types"; 

import { userTypeApi } from "@/helpers/admin";

export default function UserTypePage() {
  const { t } = useTranslation();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();
  const { encAdmins, encUserType } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encAdmins,
    encUserType,
  );

  useEffect(() => {
    let mounted = true;

    const loadUserTypes = async () => {
      setIsLoading(true);
      try {
        const data = await userTypeApi.readAll();
        if (mounted) setUserTypes(data as UserType[]);
      } catch {
        if (mounted) {
          Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadUserTypes();

    return () => {
      mounted = false;
    };
  }, [t]);

  const onGlobalFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const _filters = { ...filters };
    _filters["global"].value = value;
    setFilters(_filters);
    setGlobalFilterValue(value);
  };

  const indexTemplate = (_: UserType, { rowIndex }: { rowIndex: number }) =>
    rowIndex + 1;

  const actionTemplate = (row: UserType) => (
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

  const updateStatus = async (row: UserType, checked: boolean) => {
    const id = String(row.unique_id);
    setPendingStatusId(id);
    setIsUpdating(true);

    try {
      await userTypeApi.update(row.unique_id, { is_active: checked });
      setUserTypes((current) =>
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

  const statusTemplate = (row: UserType) => {
    const id = String(row.unique_id);
    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === id}
        onCheckedChange={(checked) => void updateStatus(row, checked)}
      />
    );
  };

  const header = renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.user_type"),
      }),
    });

  return (
    <div className="px-3 py-3 w-full ">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              {t("admin.nav.user_type")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", {
                item: t("admin.nav.user_type"),
              })}
            </p>
          </div>

          <Button
            label={t("common.add_item", { item: t("admin.nav.user_type") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>

        <DataTable
          value={userTypes}
          paginator
          rows={10}
          loading={isLoading && userTypes.length === 0}
          filters={filters}
          rowsPerPageOptions={[5, 10, 25, 50]}
          globalFilterFields={["name"]}
          header={header}
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.user_type"),
          })}
          stripedRows
          showGridlines
          className="p-datatable-sm"
        >
          <Column
            header={t("common.s_no")}
            body={indexTemplate}
            style={{ width: "80px" }}
          />
          <Column
            field="name"
            header={t("admin.nav.user_type")}
            sortable
            style={{ minWidth: "200px" }}
          />
          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: "150px" }}
          />
          <Column
            header={t("common.actions")}
            body={actionTemplate}
            style={{ width: "150px" }}
          />
        </DataTable>
    
    </div>
  );
}
