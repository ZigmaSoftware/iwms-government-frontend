import type { StaffUserTypeRow } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
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
import { contractorUserTypeApi, governmentUserTypeApi, staffUserTypeApi } from "@/helpers/admin";

import type { StaffUserType } from "@/pages/admin/modules/superadmin/screenManagement/shared/adminTypes";


const toRecordList = (value: unknown): StaffUserType[] => {
  if (Array.isArray(value)) return value as StaffUserType[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as StaffUserType[];
    if (Array.isArray(record.data)) return record.data as StaffUserType[];
  }
  return [];
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: unknown } }).response?.data;

  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(", ");
  if (data && typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      )
      .join("\n");
  }

  return fallback;
};


export default function StaffUserTypeList() {
  const { t } = useTranslation();
  const [staffUserTypes, setStaffUserTypes] = useState<StaffUserType[]>([]);
  const [contractorUserTypes, setContractorUserTypes] = useState<StaffUserType[]>([]);
  const [governmentUserTypes, setGovernmentUserTypes] = useState<StaffUserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);
  const [isUpdatingContractor, setIsUpdatingContractor] = useState(false);
  const [isUpdatingGovernment, setIsUpdatingGovernment] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");

  const [filters, setFilters] = useState<any>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    usertype_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    category: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();
  const { encAdmins, encStaffUserType } = getEncryptedRoute();

  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encAdmins,
    encStaffUserType,
  );

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const [staffRes, contractorRes, governmentRes] = await Promise.all([
        staffUserTypeApi.readAll(),
        contractorUserTypeApi.readAll(),
        governmentUserTypeApi.readAll(),
      ]);
      setStaffUserTypes(toRecordList(staffRes));
      setContractorUserTypes(toRecordList(contractorRes));
      setGovernmentUserTypes(toRecordList(governmentRes));
    } catch {
      Swal.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const records = useMemo(() => {
    const normalize = (list: StaffUserType[], category: "Staff" | "Contractor" | "Government") =>
      (list ?? []).map((item) => ({
        ...item,
        usertype_id: item.usertype_id ?? item.usertype?.unique_id ?? null,
        usertype_name: item.usertype_name ?? item.usertype?.name ?? t("common.unknown"),
        category,
      }));

    return [
      ...normalize(staffUserTypes, "Staff"),
      ...normalize(contractorUserTypes, "Contractor"),
      ...normalize(governmentUserTypes, "Government"),
    ];
  }, [staffUserTypes, contractorUserTypes, governmentUserTypes, t]);

  /* -----------------------------------------------------------
     STATUS SWITCH
  ----------------------------------------------------------- */
  const updateStatus = async (row: any, checked: boolean) => {
    const id = String(row.unique_id);
    setPendingStatusId(id);

    try {
      if (row.category === "Contractor") {
        setIsUpdatingContractor(true);
        await contractorUserTypeApi.update(row.unique_id, { is_active: checked });
      } else if (row.category === "Government") {
        setIsUpdatingGovernment(true);
        await governmentUserTypeApi.update(row.unique_id, { is_active: checked });
      } else {
        setIsUpdatingStaff(true);
        await staffUserTypeApi.update(row.unique_id, { is_active: checked });
      }
      await loadRecords();
    } catch (error: any) {
      console.error("Update Status Error:", error?.response?.data || error);
      Swal.fire(
        t("common.error"),
        extractErrorMessage(error, t("common.update_status_failed")),
        "error"
      );
    } finally {
      setIsUpdatingContractor(false);
      setIsUpdatingStaff(false);
      setIsUpdatingGovernment(false);
      setPendingStatusId(null);
    }
  };

  const statusTemplate = (row: any) => {
    const id = String(row.unique_id);
    const updatingFlag =
      row.category === "Contractor" ? isUpdatingContractor
      : row.category === "Government" ? isUpdatingGovernment
      : isUpdatingStaff;
    const isPending = updatingFlag && pendingStatusId === id;
    return (
      <Switch
        checked={row.is_active}
        disabled={isPending}
        onCheckedChange={(checked) => void updateStatus(row, checked)}
      />
    );
  };

  /* -----------------------------------------------------------
     ACTION BUTTONS
  ----------------------------------------------------------- */
  const actionTemplate = (row: StaffUserTypeRow) => (
    <div className="flex gap-2 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
{/* 
      <button
        title="Delete"
        className="text-red-600 hover:text-red-800"
        onClick={() => handleDelete(row.unique_id)}
      >
        <TrashBinIcon className="size-5" />
      </button> */}
    </div>
  );

  /* -----------------------------------------------------------
     INDEX COLUMN
  ----------------------------------------------------------- */
  const indexTemplate = (_: StaffUserType, { rowIndex }: any) =>
    rowIndex + 1;

  /* -----------------------------------------------------------
     GLOBAL FILTER
  ----------------------------------------------------------- */
  const onGlobalFilterChange = (e: any) => {
    const value = e.target.value;
    const updated = { ...filters };
    updated["global"].value = value;

    setFilters(updated);
    setGlobalFilterValue(value);
  };

  const header = renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder_placeholder"),
    });

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */
  return (
    <div className="p-3">
  

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {t("admin.nav.staff_user_type")}
            </h1>
            <p className="text-gray-500 text-sm">
              {t("common.manage_item_records", {
                item: t("admin.nav.staff_user_type"),
              })}
            </p>
          </div>

          <Button
            label={t("common.add_item", {
              item: t("admin.nav.staff_user_type"),
            })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>

        <DataTable
          value={records}
          paginator
          rows={10}
          loading={isLoading && records.length === 0}
          filters={filters}
          rowsPerPageOptions={[5, 10, 25, 50]}
          globalFilterFields={["name", "usertype_name", "category"]}
          header={header}
          stripedRows
          showGridlines
          emptyMessage={t("common.no_items_found", {
            item: t("admin.nav.staff_user_type"),
          })}
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: 80 }} />
          <Column
            field="usertype_name"
            header={t("admin.nav.user_type")}
            sortable
            style={{ minWidth: 150 }}
          />
          {/* <Column
            field="category"
            header="Type"
            body={categoryTemplate}
            sortable
            style={{ minWidth: 120 }}
          /> */}
          <Column
            field="level_display"
            header="Level"
            body={(row: any) => row.level_display ?? row.level ?? "—"}
            sortable
            style={{ minWidth: 150 }}
          />
          <Column
            field="name"
            header={t("admin.nav.staff_user_type")}
            body={(row: any) => row.name_display ?? row.name ?? "—"}
            sortable
            style={{ minWidth: 180 }}
          />

          

          <Column
            header={t("common.status")}
            body={statusTemplate}
            style={{ width: 120 }}
          />

          <Column
            header={t("common.actions")}
            body={actionTemplate}
            style={{ width: 150 }}
          />

        </DataTable>
    </div>
  );
}
