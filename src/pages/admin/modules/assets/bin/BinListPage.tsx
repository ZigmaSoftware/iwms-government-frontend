import type { Bin, BinApiRow, TableFilters } from "./types";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/common/SafeDataTable";
import type { DataTableFilterEvent } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { FilterMatchMode } from "primereact/api";
import { useNavigate } from "react-router-dom";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { renderListSearchHeader } from "@/utils/listSearchHeader";
import { PencilIcon } from "@/icons";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { binApi } from "@/helpers/admin";
import { formatCoordinates } from "../../masters/shared/formatCoordinates";


const { encMasters, encBins } = getEncryptedRoute();
const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
  encMasters,
  encBins,
);

const BIN_COLUMN_FIELDS: Record<string, string[]> = {
  bin_name: ["bin_name", "name"],
  bin_capacity: ["bin_capacity", "capacity_liters"],
  panchayat_name: ["panchayat_id", "panchayat", "panchayat_name"],
  waste_type_name: ["wastetype_id", "waste_type_id", "waste_type", "waste_type_name"],
  qr_code: ["bin_qr", "qr_code"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

export default function BinList() {
  const { t } = useTranslation();
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    bin_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    bin_capacity: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    panchayat_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
    waste_type_name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  const navigate = useNavigate();
  const [binRows, setBinRows] = useState<BinApiRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "assets",
    "bins",
    BIN_COLUMN_FIELDS,
  );

  useEffect(() => {
    let mounted = true;

    const loadBins = async () => {
      setIsLoading(true);
      try {
        const data = await binApi.readAll();
        if (mounted) setBinRows(data as BinApiRow[]);
      } catch (error) {
        if (mounted) {
          const data = (error as { response?: { data?: unknown } })?.response?.data;
          Swal.fire(t("common.error"), String(data ?? error), "error");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadBins();

    return () => {
      mounted = false;
    };
  }, [t]);

  const bins = (() => {
    const rows = Array.isArray(binRows) ? binRows : [];
    const mapped: Bin[] = rows.map((row) => ({
      unique_id: String(row.unique_id ?? ""),
      bin_name: String(row.bin_name ?? ""),
      bin_capacity: Number(row.bin_capacity ?? 0),
      bin_qr: row.bin_qr ? String(row.bin_qr) : null,
      company_id: row.company_id ? String(row.company_id) : null,
      company_unique_id: row.company_unique_id ? String(row.company_unique_id) : null,
      company_name: row.company_name ? String(row.company_name) : null,
      project_id: row.project_id ? String(row.project_id) : null,
      project_unique_id: row.project_unique_id ? String(row.project_unique_id) : null,
      project_name: row.project_name ? String(row.project_name) : null,
      panchayat_name: row.panchayat_name ? String(row.panchayat_name) : undefined,
      panchayat: row.panchayat ? String(row.panchayat) : undefined,
      bin_type: row.bin_type ? String(row.bin_type) : undefined,
      waste_type_name: row.waste_type_name ? String(row.waste_type_name) : undefined,
      wastetype_name: row.wastetype_name ? String(row.wastetype_name) : undefined,
      waste_type: row.waste_type ? String(row.waste_type) : undefined,
      bin_status: row.bin_status ? String(row.bin_status) : undefined,
      latitude: row.latitude as number | string | undefined,
      longitude: row.longitude as number | string | undefined,
      coordinates: row.coordinates,
      is_active: Boolean(row.is_active),
    }));

    return mapped;
  })();

  const onFilter = (e: DataTableFilterEvent) => {
    setFilters(e.filters as TableFilters);
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
    setGlobalFilterValue(value);
  };

  const statusBodyTemplate = (row: Bin) => {
    const updateStatus = async (checked: boolean) => {
      try {
        setPendingStatusId(row.unique_id);
        setIsUpdating(true);
        await binApi.update(
          row.unique_id,
          filterPayload({
            bin_name: row.bin_name,
            bin_capacity: row.bin_capacity,
            is_active: checked,
          }) as { bin_name: string; bin_capacity: number; is_active: boolean }
        );
        setBinRows((current) =>
          current.map((item) =>
            String(item.unique_id ?? "") === row.unique_id
              ? { ...item, is_active: checked }
              : item
          )
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
        onCheckedChange={updateStatus}
      />
    );
  };

  const actionBodyTemplate = (row: Bin) => (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
        title={t("common.edit")}
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: Bin, options: { rowIndex: number }) => options.rowIndex + 1;

  const header = renderListSearchHeader({
    value: globalFilterValue,
    onChange: onGlobalFilterChange,
    placeholder: t("common.search_placeholder", { item: t("admin.nav.bin_master") }),
  });

  const qrTemplate = (bin: Bin) => {
    if (!bin.bin_qr) {
      return <span className="text-gray-400 text-xs">No QR</span>;
    }
    return (
      <button
        className="p-1 border rounded bg-white shadow-sm hover:bg-gray-50"
        onClick={() => setSelectedQr(bin.bin_qr!)}
        title={t("admin.bin.qr_show")}
      >
        <img src={bin.bin_qr} alt="QR" className="w-12 h-12 object-contain" />
      </button>
    );
  };

  const wasteTypeTemplate = (row: Bin) =>
    row.waste_type_name ?? row.wastetype_name ?? row.waste_type ?? "-";

  const cap = (str?: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  return (
    <div className="p-3">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{t("admin.nav.bin_master")}</h1>
          <p className="text-gray-500 text-sm">
            {t("common.manage_item_records", { item: t("admin.nav.bin_master") })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            label={t("common.add_item", { item: t("admin.nav.bin_creation") })}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        value={bins}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        filters={filters}
        onFilter={onFilter}
        globalFilterFields={[
          "bin_name",
          "panchayat_name",
          "panchayat",
          "waste_type_name",
          "wastetype_name",
          "waste_type",
          "coordinates",
        ]}
        header={header}
        stripedRows
        showGridlines
        loading={isLoading}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
        {showCol("bin_name") && (
          <Column
            field="bin_name"
            header={t("common.item_name", { item: t("admin.nav.bin_master") })}
            sortable
            filter
            showFilterMatchModes={false}
            body={(row: Bin) => cap(row.bin_name)}
            style={{ minWidth: "200px" }}
          />
        )}
        {showCol("bin_capacity") && (
          <Column
            field="bin_capacity"
            header={t("common.bin_capacity")}
            sortable
            filter
            showFilterMatchModes={false}
            style={{ minWidth: "150px" }}
          />
        )}
        {showCol("panchayat_name") && (
          <Column
            field="panchayat_name"
            header={t("admin.nav.panchayat")}
            body={(row: Bin) => cap(row.panchayat_name || row.panchayat || "-")}
            sortable
            filter
            showFilterMatchModes={false}
            style={{ minWidth: "140px" }}
          />
        )}
        {showCol("waste_type_name") && (
          <Column
            field="waste_type_name"
            header={t("common.waste_type")}
            body={(row: Bin) => cap(wasteTypeTemplate(row))}
            sortable
            filter
            showFilterMatchModes={false}
            style={{ minWidth: "160px" }}
          />
        )}
        {showCol("qr_code") && (
          <Column
            field="qr_code"
            header={t("admin.bin.qr_label")}
            body={(row: Bin) => qrTemplate(row)}
            style={{ width: "100px", textAlign: "center" }}
          />
        )}
        {showCol("coordinates") && (
          <Column
            field="coordinates"
            header="Coordinates"
            body={(row: Bin) => formatCoordinates(row.coordinates)}
            style={{ minWidth: "240px" }}
          />
        )}
        {showCol("is_active") && (
          <Column
            field="is_active"
            header={t("common.status")}
            body={(row: Bin) => statusBodyTemplate(row)}
            style={{ width: "150px", textAlign: "center" }}
          />
        )}
        <Column
          field="actions"
          header={t("common.actions")}
          body={(row: Bin) => actionBodyTemplate(row)}
          style={{ width: "150px", textAlign: "center" }}
        />
      </DataTable>

      <Dialog open={Boolean(selectedQr)} onOpenChange={(open) => !open && setSelectedQr(null)}>
        <DialogContent className="w-auto max-w-[90vw] p-4">
          <DialogTitle className="sr-only">{t("admin.bin.qr_title")}</DialogTitle>
          {selectedQr && (
            <img
              src={selectedQr}
              alt={t("admin.bin.qr_title")}
              className="h-auto w-[min(75vw,320px)] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
