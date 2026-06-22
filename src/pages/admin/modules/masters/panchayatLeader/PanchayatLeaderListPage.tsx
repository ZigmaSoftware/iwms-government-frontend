import type { PanchayatLeader } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";

import { PencilIcon } from "@/icons";
import { panchayatLeaderApi } from "@/helpers/admin";
import { getEncryptedRoute } from "@/utils/routeCache";
import { Switch } from "@/components/ui/switch";


const cap = (str?: string | null) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

export default function PanchayatLeaderListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { encMasters, encPanchayatLeaders } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH } = createCrudRoutePaths(encMasters, encPanchayatLeaders);
  const { editPath: ENC_EDIT_PATH } = createCrudRoutePaths(encMasters, encPanchayatLeaders);

  const [allRecords, setAllRecords] = useState<PanchayatLeader[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState({
    global:        { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    username:      { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    leader_name:   { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    panchayat_name:{ value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  /* ── fetch all records ── */
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (mounted) setIsLoading(true);
      try {
        const data: any = await panchayatLeaderApi.readAll();
        if (!mounted) return;
        const rows: PanchayatLeader[] = Array.isArray(data) ? data : (data?.results ?? []);
        if (mounted) setAllRecords(rows);
      } catch {
        if (mounted) Swal.fire({ icon: "error", title: t("common.error"), text: t("common.load_failed") });
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();
    return () => { mounted = false; };
  }, [t]);

  const data = allRecords;

  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as typeof filters);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  /* ── search header ── */
  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("common.search_placeholder", {
        item: t("admin.nav.panchayat_leader"),
      }),
    });

  const statusTemplate = (row: PanchayatLeader) => {
    const toggle = async (checked: boolean) => {
      setPendingStatusId(row.unique_id);
      setIsUpdating(true);
      try {
        await panchayatLeaderApi.update(row.unique_id, { is_active: checked });
        setAllRecords((prev) =>
          prev.map((r) => r.unique_id === row.unique_id ? { ...r, is_active: checked } : r)
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      } finally {
        setPendingStatusId(null);
        setIsUpdating(false);
      }
    };
    return (
      <Switch
        checked={row.is_active}
        disabled={isUpdating && pendingStatusId === row.unique_id}
        onCheckedChange={(v) => void toggle(v)}
      />
    );
  };

  const actionTemplate = (row: PanchayatLeader) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("common.edit")}
        className="text-blue-600 hover:text-blue-800"
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: PanchayatLeader, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  return (
    <div className="p-3">

      {/* ── Title + Add button ── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.nav.panchayat_leader")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("common.manage_item_records", { item: t("admin.nav.panchayat_leader") })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            label={t("common.add_item", { item: t("admin.nav.panchayat_leader") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      {/* ── DataTable ── */}
      <DataTable
        value={data}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={isLoading && data.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("common.no_items_found", { item: t("admin.nav.panchayat_leader") })}
        globalFilterFields={["username", "leader_name", "email", "panchayat_name"]}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />

        <Column
          field="username"
          header="Username"
          sortable
          filter
          showFilterMatchModes={false}
          body={(r: PanchayatLeader) => cap(r.username)}
        />

        <Column
          field="leader_name"
          header="Leader Name"
          sortable
          filter
          showFilterMatchModes={false}
          body={(r: PanchayatLeader) => cap(r.leader_name) || "-"}
        />

        <Column
          field="panchayat_name"
          header={t("admin.nav.panchayat")}
          sortable
          filter
          showFilterMatchModes={false}
          body={(r: PanchayatLeader) => cap(r.panchayat_name) || "-"}
        />

        <Column
          field="email"
          header="Email"
          body={(r: PanchayatLeader) => r.email || "-"}
        />

        <Column
          header={t("common.status")}
          body={statusTemplate}
          style={{ width: "140px" }}
        />

        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "150px", textAlign: "center" }}
        />
      </DataTable>
    </div>
  );
}
