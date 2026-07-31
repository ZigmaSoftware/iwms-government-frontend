import type { Bin, BinApiRow } from "./types";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { DataTablePageEvent, DataTableSortEvent, SortOrder } from "primereact/datatable";
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
import { capitalize } from "@/utils/capitalize";
import {
  exportRecordsToExcel,
  getAdminScreenExcelFilename,
} from "@/utils/exportExcel";
import { createBinQrPdfBlob, downloadBinQrPdf } from "./binQrPdf";
import { downloadAllBinsPdf } from "./binAllDetailsPdf";


const { encWasteMasters, encBins } = getEncryptedRoute();
const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
  encWasteMasters,
  encBins,
);

const BIN_COLUMN_FIELDS: Record<string, string[]> = {
  bin_name: ["bin_name", "name"],
  bin_capacity: ["bin_capacity", "capacity_liters"],
  panchayat_name: ["panchayat_id", "panchayat", "panchayat_name"],
  ward_name: ["ward_id", "ward_name"],
  waste_type_name: ["wastetype_id", "waste_type_id", "waste_type", "waste_type_name"],
  qr_code: ["bin_qr", "qr_code"],
  latitude: ["latitude", "coordinates"],
  longitude: ["longitude", "coordinates"],
  is_active: ["is_active"],
};

const toRecordList = (value: unknown): BinApiRow[] => {
  if (Array.isArray(value)) return value as BinApiRow[];
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return (value as { results: BinApiRow[] }).results;
  }
  return [];
};

const SORTABLE_FIELDS = new Set(["bin_name", "bin_capacity"]);

export default function BinList() {
  const { t } = useTranslation();
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [selectedQrBin, setSelectedQrBin] = useState<Bin | null>(null);
  const [isPrintingQr, setIsPrintingQr] = useState(false);
  const [isPreviewingQr, setIsPreviewingQr] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const navigate = useNavigate();
  const [rows, setRows] = useState<BinApiRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { showColumn: showCol, filterPayload } = useFieldVisibility(
    "assets",
    "bins",
    BIN_COLUMN_FIELDS,
  );

  const ordering = sortField && SORTABLE_FIELDS.has(sortField)
    ? `${sortOrder === -1 ? "-" : ""}${sortField}`
    : undefined;

  useEffect(() => {
    let mounted = true;

    const loadRows = async (page: number, limit: number, search: string, orderingParam?: string) => {
      setIsLoading(true);
      try {
        const response = await binApi.readAllwithPaginated(page, limit, {
          params: {
            ...(search ? { search } : {}),
            ...(orderingParam ? { ordering: orderingParam } : {}),
          },
        });
        if (mounted) {
          setRows(toRecordList(response));
          setTotalRecords(
            typeof response?.count === "number" ? response.count : toRecordList(response).length,
          );
        }
      } catch (error) {
        if (mounted) {
          const data = (error as { response?: { data?: unknown } })?.response?.data;
          Swal.fire(t("common.error"), String(data ?? error), "error");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadRows(first / rowsPerPage + 1, rowsPerPage, searchTerm, ordering);

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, rowsPerPage, searchTerm, ordering, t]);

  const onPage = (event: DataTablePageEvent) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const onSort = (event: DataTableSortEvent) => {
    setFirst(0);
    setSortField(event.sortField);
    setSortOrder(event.sortOrder);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFirst(0);
      setSearchTerm(globalFilterValue);
    }, 400);
    return () => clearTimeout(timeout);
  }, [globalFilterValue]);

  const onExportRequest = async () => toRecordList(await binApi.readAllForExport());

  const fetchExportBins = async (): Promise<Bin[]> => {
    const rowsForExport = toRecordList(await binApi.readAllForExport());
    return rowsForExport.map((row) => ({
      unique_id: String(row.unique_id ?? ""),
      bin_name: String(row.bin_name ?? ""),
      bin_capacity: Number(row.bin_capacity ?? 0),
      bin_qr: row.bin_qr ? String(row.bin_qr) : null,
      state_name: row.state_name ? String(row.state_name) : undefined,
      district_name: row.district_name ? String(row.district_name) : undefined,
      area_type_name: row.area_type_name ? String(row.area_type_name) : undefined,
      corporation_name: row.corporation_name ? String(row.corporation_name) : undefined,
      municipality_name: row.municipality_name ? String(row.municipality_name) : undefined,
      town_panchayat_name: row.town_panchayat_name ? String(row.town_panchayat_name) : undefined,
      panchayat_union_name: row.panchayat_union_name ? String(row.panchayat_union_name) : undefined,
      panchayat_name: row.panchayat_name ? String(row.panchayat_name) : undefined,
      ward_id: row.ward_id ? String(row.ward_id) : undefined,
      ward_name: row.ward_name ? String(row.ward_name) : undefined,
      collection_point_name: row.collection_point_name ? String(row.collection_point_name) : undefined,
      bin_type: row.bin_type ? String(row.bin_type) : undefined,
      wastetype_name: row.wastetype_name ? String(row.wastetype_name) : undefined,
      latitude: row.latitude as number | string | undefined,
      longitude: row.longitude as number | string | undefined,
      is_active: Boolean(row.is_active),
    }));
  };

  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      const exportRows = await fetchExportBins();
      if (exportRows.length === 0) {
        Swal.fire(t("common.warning") || "Warning", "No bins to export", "warning");
        return;
      }
      exportRecordsToExcel(exportRows, getAdminScreenExcelFilename("all"), "Bins");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to export bins.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const exportRows = await fetchExportBins();
      if (exportRows.length === 0) {
        Swal.fire(t("common.warning") || "Warning", "No bins to export", "warning");
        return;
      }
      await downloadAllBinsPdf(exportRows);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to generate the bins PDF.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintQr = async () => {
    if (!selectedQrBin) return;
    setIsPrintingQr(true);
    try {
      await downloadBinQrPdf(selectedQrBin);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to generate the bin QR PDF.",
      });
    } finally {
      setIsPrintingQr(false);
    }
  };

  const handlePreviewQr = async () => {
    if (!selectedQrBin) return;

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      Swal.fire({
        icon: "warning",
        title: "Preview blocked",
        text: "Please allow pop-ups for this site to preview the PDF.",
      });
      return;
    }

    previewWindow.document.title = "Preparing bin QR PDF";
    previewWindow.document.body.innerHTML =
      '<p style="font-family:Arial,sans-serif;padding:24px;color:#475569">Preparing PDF preview…</p>';
    setIsPreviewingQr(true);
    try {
      const pdfBlob = await createBinQrPdfBlob(selectedQrBin);
      const previewUrl = URL.createObjectURL(pdfBlob);
      previewWindow.location.replace(previewUrl);
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 300_000);
    } catch (error) {
      previewWindow.close();
      Swal.fire({
        icon: "error",
        title: t("common.error"),
        text: error instanceof Error ? error.message : "Failed to preview the bin QR PDF.",
      });
    } finally {
      setIsPreviewingQr(false);
    }
  };

  const bins = (() => {
    const list = Array.isArray(rows) ? rows : [];
    const mapped: Bin[] = list.map((row) => ({
      unique_id: String(row.unique_id ?? ""),
      bin_name: String(row.bin_name ?? ""),
      bin_capacity: Number(row.bin_capacity ?? 0),
      bin_qr: row.bin_qr ? String(row.bin_qr) : null,
      state_name: row.state_name ? String(row.state_name) : undefined,
      district_name: row.district_name ? String(row.district_name) : undefined,
      area_type_name: row.area_type_name ? String(row.area_type_name) : undefined,
      corporation_name: row.corporation_name ? String(row.corporation_name) : undefined,
      municipality_name: row.municipality_name ? String(row.municipality_name) : undefined,
      town_panchayat_name: row.town_panchayat_name ? String(row.town_panchayat_name) : undefined,
      panchayat_union_name: row.panchayat_union_name ? String(row.panchayat_union_name) : undefined,
      panchayat_name: row.panchayat_name ? String(row.panchayat_name) : undefined,
      panchayat: row.panchayat ? String(row.panchayat) : undefined,
      ward_id: row.ward_id ? String(row.ward_id) : undefined,
      ward_name: row.ward_name ? String(row.ward_name) : undefined,
      collection_point_name: row.collection_point_name ? String(row.collection_point_name) : undefined,
      bin_type: row.bin_type ? String(row.bin_type) : undefined,
      waste_type_name: row.waste_type_name ? String(row.waste_type_name) : undefined,
      wastetype_name: row.wastetype_name ? String(row.wastetype_name) : undefined,
      waste_type: row.waste_type ? String(row.waste_type) : undefined,
      latitude: row.latitude as number | string | undefined,
      longitude: row.longitude as number | string | undefined,
      is_active: Boolean(row.is_active),
    }));

    return mapped;
  })();

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalFilterValue(e.target.value);
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
        setRows((current) =>
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
        onClick={() => setSelectedQrBin(bin)}
        title={t("admin.bin.qr_show")}
      >
        <img src={bin.bin_qr} alt="QR" className="w-12 h-12 object-contain" />
      </button>
    );
  };

  const wasteTypeTemplate = (row: Bin) =>
    row.waste_type_name ?? row.wastetype_name ?? row.waste_type ?? "-";


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
            label={isExportingExcel ? "Downloading…" : "Download Excel"}
            icon="pi pi-file-excel"
            className="p-button-outlined"
            disabled={isExportingExcel}
            onClick={handleDownloadExcel}
          />
          <Button
            label={isExportingPdf ? "Generating PDF…" : "Download PDF"}
            icon="pi pi-file-pdf"
            className="p-button-outlined"
            disabled={isExportingPdf}
            onClick={handleDownloadPdf}
          />
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
        header={header}
        stripedRows
        showGridlines
        loading={isLoading}
        onExportRequest={onExportRequest}
        className="p-datatable-sm"
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
        {showCol("bin_name") && (
          <Column
            field="bin_name"
            header={t("common.item_name", { item: t("admin.nav.bin_master") })}
            sortable
            body={(row: Bin) => capitalize(row.bin_name)}
            style={{ minWidth: "200px" }}
          />
        )}
        {showCol("bin_capacity") && (
          <Column
            field="bin_capacity"
            header={t("common.bin_capacity")}
            sortable
            style={{ minWidth: "150px" }}
          />
        )}
        {showCol("panchayat_name") && (
          <Column
            field="panchayat_name"
            header={t("admin.nav.panchayat")}
            body={(row: Bin) => capitalize(row.panchayat_name || row.panchayat || "-")}
            style={{ minWidth: "140px" }}
          />
        )}
        {showCol("ward_name") && (
          <Column
            field="ward_name"
            header="Ward"
            body={(row: Bin) => capitalize(row.ward_name || "-")}
            style={{ minWidth: "140px" }}
          />
        )}
        {showCol("waste_type_name") && (
          <Column
            field="waste_type_name"
            header={t("common.waste_type")}
            body={(row: Bin) => capitalize(wasteTypeTemplate(row))}
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
        {showCol("latitude") && (
          <Column
            field="latitude"
            header="Latitude"
            body={(row: Bin) => row.latitude ?? "-"}
            style={{ minWidth: "140px" }}
          />
        )}
        {showCol("longitude") && (
          <Column
            field="longitude"
            header="Longitude"
            body={(row: Bin) => row.longitude ?? "-"}
            style={{ minWidth: "140px" }}
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

      <Dialog
        open={Boolean(selectedQrBin)}
        onOpenChange={(open) => !open && setSelectedQrBin(null)}
      >
        <DialogContent className="w-auto max-w-[90vw] p-4">
          <DialogTitle className="sr-only">{t("admin.bin.qr_title")}</DialogTitle>
          {selectedQrBin?.bin_qr && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={selectedQrBin.bin_qr}
                alt={t("admin.bin.qr_title")}
                className="h-auto w-[min(75vw,320px)] object-contain"
              />
              <div className="text-center">
                <p className="font-semibold text-gray-800">{selectedQrBin.bin_name}</p>
                <p className="text-sm text-gray-500">{selectedQrBin.unique_id}</p>
              </div>
              <div className="flex w-full gap-2">
                <Button
                  label={isPreviewingQr ? "Preparing…" : "Preview"}
                  icon="pi pi-eye"
                  loading={isPreviewingQr}
                  disabled={isPreviewingQr || isPrintingQr}
                  onClick={handlePreviewQr}
                  className="flex-1 p-button-outlined"
                />
                <Button
                  label={isPrintingQr ? "Preparing PDF…" : "Print"}
                  icon="pi pi-print"
                  loading={isPrintingQr}
                  disabled={isPrintingQr || isPreviewingQr}
                  onClick={handlePrintQr}
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
