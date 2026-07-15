import type { WasteCollection } from "./types";
import { ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { DataTableFilterMeta } from "primereact/datatable";

import { PencilIcon } from "@/icons";
import { Switch } from "@/components/ui/switch";
import { getEncryptedRoute } from "@/utils/routeCache";
import { adminApi } from "@/helpers/admin/registry";

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

const cap = (str?: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function WasteCollectedDataList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encScheduleMasters, encWasteCollectedData } = getEncryptedRoute();
  const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
    encScheduleMasters,
    encWasteCollectedData,
  );

  const [wasteCollections, setWasteCollections] = useState<WasteCollection[]>([]);
  const [imageRow, setImageRow] = useState<WasteCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null as string | null, matchMode: FilterMatchMode.CONTAINS },
    customer_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    contact_no: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    district_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    area_type_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    panchayat_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
    location_name: { value: null as string | null, matchMode: FilterMatchMode.STARTS_WITH },
  });

  /* ── load data ── */
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    adminApi.wasteCollections.readAll()
      .then((res: any) => {
        if (!mounted) return;
        const rows: WasteCollection[] = Array.isArray(res) ? res : res?.results ?? [];
        setWasteCollections(rows);
      })
      .catch((err) => { if (mounted) Swal.fire({ icon: "error", title: t("common.error"), text: String(err) }); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [t]);

  const onFilter = (e: DataTableFilterEvent) => setFilters(e.filters as DataTableFilterMeta);

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, global: { ...prev.global, value } }));
    setGlobalFilterValue(value);
  };

  /* ── status toggle ── */
  const statusTemplate = (row: WasteCollection) => {
    const updateStatus = async (value: boolean) => {
      try {
        await adminApi.wasteCollections.update(row.unique_id, { is_active: value });
        setWasteCollections((prev) =>
          prev.map((item) =>
            item.unique_id === row.unique_id ? { ...item, is_active: value } : item
          )
        );
      } catch {
        Swal.fire(t("common.error"), t("common.update_status_failed"), "error");
      }
    };
    return <Switch checked={!!row.is_active} onCheckedChange={updateStatus} />;
  };

  const actionTemplate = (row: WasteCollection) => (
    <div className="flex gap-3 justify-center">
      <button
        title={t("admin.waste_collected_data.view_image", "View captured image")}
        onClick={() => setImageRow(row)}
        className="text-emerald-600 hover:text-emerald-800"
      >
        <ImageIcon className="size-5" />
      </button>
      <button
        title={t("common.edit")}
        onClick={() => navigate(ENC_EDIT_PATH(row.unique_id))}
        className="text-blue-600 hover:text-blue-800"
      >
        <PencilIcon className="size-5" />
      </button>
    </div>
  );

  const indexTemplate = (_: WasteCollection, { rowIndex }: { rowIndex: number }) => rowIndex + 1;

  const renderHeader = () =>
    renderListSearchHeader({
      value: globalFilterValue,
      onChange: onGlobalFilterChange,
      placeholder: t("admin.household_collection_event.search_placeholder"),
    });

  return (
    <div className="p-3">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            {t("admin.household_collection_event.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("admin.household_collection_event.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            label={t("admin.household_collection_event.add_new")}
            icon="pi pi-plus"
            className="p-button-success"
            onClick={() => navigate(ENC_NEW_PATH)}
          />
        </div>
      </div>

      <DataTable
        value={wasteCollections}
        dataKey="unique_id"
        paginator
        rows={10}
        rowsPerPageOptions={[5, 10, 25, 50]}
        loading={loading && wasteCollections.length === 0}
        filters={filters}
        onFilter={onFilter}
        header={renderHeader()}
        stripedRows
        showGridlines
        emptyMessage={t("admin.household_collection_event.empty_message")}
        className="p-datatable-sm"
        globalFilterFields={["customer_name", "contact_no", "district_name", "area_type_name", "panchayat_name", "location_name"]}
      >
        <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "60px" }} />
        <Column
          field="customer_name"
          header={t("admin.household_collection_event.customer_name")}
          body={(row: WasteCollection) => cap(row.customer_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="contact_no"
          header={t("common.mobile")}
          body={(row: WasteCollection) => row.contact_no || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="dry_waste"
          header={t("admin.household_collection_event.dry_waste")}
          sortable
        />
        <Column
          field="wet_waste"
          header={t("admin.household_collection_event.wet_waste")}
          sortable
        />
        <Column
          field="mixed_waste"
          header={t("admin.household_collection_event.mixed_waste")}
          sortable
        />
        <Column
          field="total_quantity"
          header={t("admin.household_collection_event.quantity")}
          sortable
        />
        <Column
          field="district_name"
          header={t("common.district")}
          body={(row: WasteCollection) => cap(row.district_name) || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="area_type_name"
          header={t("common.area_type")}
          body={(row: WasteCollection) => row.area_type_name || "-"}
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="location_name"
          header={t("common.location")}
          body={(row: WasteCollection) =>
            row.location_name
              ? `${cap(row.location_name)}${row.location_level ? ` (${row.location_level})` : ""}`
              : "-"
          }
          sortable filter showFilterMatchModes={false}
        />
        <Column
          field="is_active"
          header={t("common.status")}
          body={statusTemplate}
          style={{ width: "120px" }}
        />
        <Column
          header={t("common.actions")}
          body={actionTemplate}
          style={{ width: "120px", textAlign: "center" }}
        />
      </DataTable>

      <Dialog
        open={!!imageRow}
        onOpenChange={(open) => {
          if (!open) setImageRow(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("admin.waste_collected_data.captured_images", "Captured images")}
              {imageRow?.customer_name ? ` — ${cap(imageRow.customer_name)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 p-1 max-h-[70vh] overflow-y-auto sm:grid-cols-3">
            {(imageRow?.capture_images ?? []).map((img, index) => (
              <a
                key={`${img.url}-${index}`}
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="block"
                title={t("common.view")}
              >
                <img
                  src={img.url}
                  alt={`${t("admin.waste_collected_data.captured_images", "Captured image")} ${index + 1}`}
                  className="h-40 w-full rounded-lg border object-cover"
                  loading="lazy"
                />
                {img.weight != null && img.weight !== "" && (
                  <div className="mt-1 text-center text-xs text-gray-500">
                    {img.weight} kg
                  </div>
                )}
              </a>
            ))}
            {!(imageRow?.capture_images?.length) && (
              <div className="col-span-full py-6 text-center text-sm text-gray-500">
                {t("admin.waste_collected_data.no_images", "No captured images found")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
