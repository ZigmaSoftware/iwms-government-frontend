import type { TableFilters } from "./types";
import type { ApartmentRow, BlockRow, CustomerCreationRecord, FlatRow, UserRow, ViewLevel } from "./types";
import { useEffect, useMemo, useState } from "react";
import Swal from "@/lib/notify";

import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { FilterMatchMode } from "primereact/api";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { useTranslation } from "react-i18next";
import { customerCreationApi } from "@/helpers/admin";


/* ---------------- HELPERS ---------------- */

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

const readCustomerText = (
  row: CustomerCreationRecord,
  key: keyof CustomerCreationRecord
): string => normalizeId(row[key]);

/* ---------------- COMPONENT ---------------- */

export default function ApartmentListPage() {
  const { t } = useTranslation();

  const [allCustomers, setAllCustomers] = useState<CustomerCreationRecord[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  useEffect(() => {
    let mounted = true
    setCustomersLoading(true)
    customerCreationApi.readAll()
      .then((data: unknown) => { if (mounted) setAllCustomers(Array.isArray(data) ? data as CustomerCreationRecord[] : []) })
      .catch((error: unknown) => { if (mounted) Swal.fire({ icon: 'error', title: 'Error', text: String(error) }) })
      .finally(() => { if (mounted) setCustomersLoading(false) })
    return () => { mounted = false }
  }, [t])

  const [viewLevel, setViewLevel] = useState<ViewLevel>("apartment");

  const [selectedApartment, setSelectedApartment] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("");
  const [selectedFlat, setSelectedFlat] = useState("");

  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<TableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const filteredCustomers = useMemo<CustomerCreationRecord[]>(() => {
    return allCustomers.filter((row) => {
      const apartmentName = readCustomerText(row, "apartment_name");
      return Boolean(apartmentName);
    });
  }, [allCustomers]);

  const apartments = useMemo<ApartmentRow[]>(() => {
    const byApartment = new Map<
      string,
      { blocks: Set<string>; flats: Set<string>; users: number; qr_code?: string }
    >();

    filteredCustomers.forEach((row) => {
      const apartmentName = readCustomerText(row, "apartment_name");
      if (!apartmentName) return;

      const blockNo = readCustomerText(row, "block_no");
      const flatNo = readCustomerText(row, "flat_no");
      const current =
        byApartment.get(apartmentName) ??
        { blocks: new Set<string>(), flats: new Set<string>(), users: 0 };

      if (blockNo) current.blocks.add(blockNo);
      if (flatNo) current.flats.add(`${blockNo}::${flatNo}`);
      current.users += 1;
      current.qr_code = current.qr_code || readCustomerText(row, "qr_code");
      byApartment.set(apartmentName, current);
    });

    return Array.from(byApartment.entries())
      .map(([apartment_name, meta]) => ({
        apartment_name,
        total_users: meta.users,
        total_blocks: meta.blocks.size,
        total_flats: meta.flats.size,
        qr_code: meta.qr_code,
      }))
      .sort((a, b) => a.apartment_name.localeCompare(b.apartment_name));
  }, [filteredCustomers]);

  const blocks = useMemo<BlockRow[]>(() => {
    const byBlock = new Map<string, Set<string>>();

    filteredCustomers
      .filter((row) => readCustomerText(row, "apartment_name") === selectedApartment)
      .forEach((row) => {
        const blockNo = readCustomerText(row, "block_no");
        if (!blockNo) return;

        const flatNo = readCustomerText(row, "flat_no");
        const flats = byBlock.get(blockNo) ?? new Set<string>();
        if (flatNo) flats.add(flatNo);
        byBlock.set(blockNo, flats);
      });

    return Array.from(byBlock.entries())
      .map(([block, flatSet]) => ({ block, flat_count: flatSet.size }))
      .sort((a, b) => a.block.localeCompare(b.block));
  }, [filteredCustomers, selectedApartment]);

  const flats = useMemo<FlatRow[]>(() => {
    const byFlat = new Map<string, number>();

    filteredCustomers
      .filter(
        (row) =>
          readCustomerText(row, "apartment_name") === selectedApartment &&
          readCustomerText(row, "block_no") === selectedBlock
      )
      .forEach((row) => {
        const flatNo = readCustomerText(row, "flat_no");
        if (!flatNo) return;
        byFlat.set(flatNo, (byFlat.get(flatNo) ?? 0) + 1);
      });

    return Array.from(byFlat.entries())
      .map(([flat_no, user_count]) => ({ flat_no, user_count }))
      .sort((a, b) => a.flat_no.localeCompare(b.flat_no));
  }, [filteredCustomers, selectedApartment, selectedBlock]);

  const users = useMemo<UserRow[]>(() => {
    return filteredCustomers
      .filter(
        (row) =>
          readCustomerText(row, "apartment_name") === selectedApartment &&
          readCustomerText(row, "block_no") === selectedBlock &&
          readCustomerText(row, "flat_no") === selectedFlat
      )
      .map((row) => ({
        customer_name: readCustomerText(row, "customer_name"),
        contact_no: readCustomerText(row, "contact_no"),
        flat_no: readCustomerText(row, "flat_no"),
      }))
      .filter((row) => row.customer_name || row.contact_no || row.flat_no)
      .sort((a, b) => a.flat_no.localeCompare(b.flat_no));
  }, [filteredCustomers, selectedApartment, selectedBlock, selectedFlat]);

  useEffect(() => {
    setSelectedApartment("");
    setSelectedBlock("");
    setSelectedFlat("");
    setViewLevel("apartment");
  }, [allCustomers]);

  /* ---- filter ---- */

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters((prev) => ({
      ...prev,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    }));
    setGlobalFilterValue(value);
  };

  const resetFilter = () => {
    setGlobalFilterValue("");
    setFilters({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } });
  };

  /* ---- drill-down navigation ---- */

  const drillToBlock = (apt: ApartmentRow) => {
    setSelectedApartment(apt.apartment_name);
    setViewLevel("block");
    resetFilter();
  };

  const drillToFlat = (blk: BlockRow) => {
    setSelectedBlock(blk.block);
    setSelectedFlat("");
    setViewLevel("flat");
    resetFilter();
  };

  const drillToUser = (flat: FlatRow) => {
    setSelectedFlat(flat.flat_no);
    setViewLevel("user");
    resetFilter();
  };

  const goBack = () => {
    resetFilter();
    if (viewLevel === "user") setViewLevel("flat");
    else if (viewLevel === "flat") setViewLevel("block");
    else if (viewLevel === "block") setViewLevel("apartment");
  };

  /* ---- breadcrumb ---- */

  const breadcrumbItems = () => {
    const crumbs: { label: string; level: ViewLevel }[] = [
      { label: "Apartments", level: "apartment" },
    ];
    if (viewLevel === "block" || viewLevel === "flat" || viewLevel === "user")
      crumbs.push({ label: selectedApartment, level: "block" });
    if (viewLevel === "flat" || viewLevel === "user")
      crumbs.push({ label: `Block ${selectedBlock}`, level: "flat" });
    if (viewLevel === "user")
      crumbs.push({ label: `Flat ${selectedFlat}`, level: "user" });
    return crumbs;
  };

  /* ---- table search header ---- */

  const tableHeader = (
    <div className="flex justify-end items-center">
      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder="Search…"
          className="p-inputtext-sm !border-0 !shadow-none"
        />
      </div>
    </div>
  );

  /* ---- shared column templates ---- */

  const indexTemplate = (_: unknown, options: { rowIndex: number }) =>
    options.rowIndex + 1;

  // ✅ QR POPUP
  const openQrPopup = (qrUrl: string) => {
    Swal.fire({
      title: "Apartment QR Code",
      html: `<div class="flex justify-center">
               <img src="${qrUrl}" style="width:200px;height:200px;" />
             </div>`,
      width: 350,
    });
  };

  // ✅ QR TEMPLATE — shows thumbnail; click to open popup
  const qrTemplate = (row: ApartmentRow) => {
    if (!row.qr_code) {
      return <span className="text-gray-400 text-xs">No QR</span>;
    }
    return (
      <button
        className="p-1 border rounded bg-white shadow-sm hover:bg-gray-50"
        onClick={() => openQrPopup(row.qr_code!)}
      >
        <img
          src={row.qr_code}
          alt="QR"
          className="w-12 h-12 object-contain"
        />
      </button>
    );
  };

  const viewActionTemplate = (onClick: () => void) => (
    <div className="flex gap-3 justify-center">
      <Button
        icon="pi pi-eye"
        className="p-button-sm p-button-text p-button-info"
        tooltip="View"
        tooltipOptions={{ position: "top" }}
        onClick={onClick}
      />
    </div>
  );

  const backButton = (
    <div className="flex justify-end mt-3">
      <Button
        label="Back"
        className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2.5 rounded-md font-medium transition duration-200"
        onClick={goBack}
      />
    </div>
  );

  /* ---- title / subtitle / empty message per level ---- */

  const levelMeta: Record<ViewLevel, { title: string; subtitle: string; emptyMessage: string }> = {
    apartment: {
      title: "Apartment List",
      subtitle: "Browse all apartments and drill down into blocks, flats and residents.",
      emptyMessage: "No apartments found.",
    },
    block: {
      title: `Blocks — ${selectedApartment}`,
      subtitle: "Select a block to view its flats.",
      emptyMessage: "No blocks found for this apartment.",
    },
    flat: {
      title: `Flats — Block ${selectedBlock}`,
      subtitle: `Apartment: ${selectedApartment}`,
      emptyMessage: "No flats found for this block.",
    },
    user: {
      title: "Residents",
      subtitle: `Flat ${selectedFlat} · Block ${selectedBlock} · ${selectedApartment}`,
      emptyMessage: "No residents found for this flat.",
    },
  };

  const { title, subtitle, emptyMessage } = levelMeta[viewLevel];

  /* ---- global filter fields per level ---- */

  const globalFilterFields: Record<ViewLevel, string[]> = {
    apartment: ["apartment_name"],
    block: ["block"],
    flat: ["flat_no"],
    user: ["customer_name", "contact_no", "flat_no"],
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="p-3">

      {/* PAGE HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">{title}</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>

        <div />
      </div>

      {/* BREADCRUMB */}
      {viewLevel !== "apartment" && (
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
          {breadcrumbItems().map((crumb, idx, arr) => (
            <span key={crumb.level} className="flex items-center gap-1">
              <span
                className={
                  idx === arr.length - 1
                    ? "font-semibold text-gray-800"
                    : "hover:underline cursor-pointer"
                }
                onClick={() => {
                  if (idx < arr.length - 1) {
                    setViewLevel(crumb.level);
                    resetFilter();
                  }
                }}
              >
                {crumb.label}
              </span>
              {idx < arr.length - 1 && (
                <i className="pi pi-chevron-right text-xs" />
              )}
            </span>
          ))}
        </div>
      )}

      {/* ---- APARTMENT TABLE ---- */}
      {viewLevel === "apartment" && (
        <DataTable
          value={apartments}
          dataKey="apartment_name"
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          loading={customersLoading && apartments.length === 0}
          filters={filters}
          globalFilterFields={globalFilterFields.apartment}
          header={tableHeader}
          emptyMessage={emptyMessage}
          stripedRows
          showGridlines
          className="p-datatable-sm"
        >
          <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
          <Column field="apartment_name" header="Apartment" sortable />

          {/* ✅ QR CODE COLUMN */}
          <Column
            header="QR Code"
            body={qrTemplate}
            style={{ width: "100px", textAlign: "center" }}
          />

          <Column field="total_blocks" header="Blocks" sortable style={{ width: "100px" }} />
          <Column field="total_flats" header="Flats" sortable style={{ width: "100px" }} />
          <Column field="total_users" header="Residents" sortable style={{ width: "120px" }} />
          <Column
            header={t("common.actions")}
            style={{ textAlign: "center", width: "100px" }}
            body={(row: ApartmentRow) => viewActionTemplate(() => drillToBlock(row))}
          />
        </DataTable>
      )}

      {/* ---- BLOCK TABLE ---- */}
      {viewLevel === "block" && (
        <div>
          <DataTable
            value={blocks}
            dataKey="block"
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            loading={customersLoading && blocks.length === 0}
            filters={filters}
            globalFilterFields={globalFilterFields.block}
            header={tableHeader}
            emptyMessage={emptyMessage}
            stripedRows
            showGridlines
            className="p-datatable-sm"
          >
            <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
            <Column field="block" header="Block No." sortable />
            <Column field="flat_count" header="Flats" sortable style={{ width: "100px" }} />
            <Column
              header={t("common.actions")}
              style={{ textAlign: "center", width: "100px" }}
              body={(row: BlockRow) => viewActionTemplate(() => drillToFlat(row))}
            />
          </DataTable>
          {backButton}
        </div>
      )}

      {/* ---- FLAT TABLE ---- */}
      {viewLevel === "flat" && (
        <div>
          <DataTable
            value={flats}
            dataKey="flat_no"
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            loading={customersLoading && flats.length === 0}
            filters={filters}
            globalFilterFields={globalFilterFields.flat}
            header={tableHeader}
            emptyMessage={emptyMessage}
            stripedRows
            showGridlines
            className="p-datatable-sm"
          >
            <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
            <Column field="flat_no" header="Flat No." sortable />
            <Column field="user_count" header="Residents" sortable style={{ width: "120px" }} />
            <Column
              header={t("common.actions")}
              style={{ textAlign: "center", width: "100px" }}
              body={(row: FlatRow) => viewActionTemplate(() => drillToUser(row))}
            />
          </DataTable>
          {backButton}
        </div>
      )}

      {/* ---- USER TABLE ---- */}
      {viewLevel === "user" && (
        <div>
          <DataTable
            value={users}
            dataKey="customer_name"
            paginator
            rows={10}
            rowsPerPageOptions={[5, 10, 25, 50]}
            loading={customersLoading && users.length === 0}
            filters={filters}
            globalFilterFields={globalFilterFields.user}
            header={tableHeader}
            emptyMessage={emptyMessage}
            stripedRows
            showGridlines
            className="p-datatable-sm"
          >
            <Column header={t("common.s_no")} body={indexTemplate} style={{ width: "80px" }} />
            <Column field="customer_name" header="Resident Name" sortable />
            <Column field="contact_no" header={t("common.mobile")} sortable />
            <Column field="flat_no" header="Flat No." sortable style={{ width: "120px" }} />
          </DataTable>
          {backButton}
        </div>
      )}

    </div>
  );
}
