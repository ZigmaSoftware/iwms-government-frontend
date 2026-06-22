import type { Complaint } from "./types";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PencilIcon } from "@/icons";
import { FilterMatchMode } from "primereact/api";
import { Column } from "primereact/column";
import { DataTable } from "@/components/common/SafeDataTable";
import { InputText } from "primereact/inputtext";

const pdfImg = "/images/pdfimage/download.png";
import { getEncryptedRoute } from "@/utils/routeCache";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import { complaintApi } from "@/helpers/admin";
import { useTranslation } from "react-i18next";


export default function ComplaintsList() {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Complaint[] | Record<string, boolean> | undefined>(undefined);
  const [globalFilterValue, setGlobalFilterValue] = useState("");
  const [filters, setFilters] = useState<{
    global: { value: string | null; matchMode: FilterMatchMode };
  }>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
  });

  const navigate = useNavigate();

    const { encCitizenGrivence, encComplaint } = getEncryptedRoute();
  
  
    const { newPath: ENC_NEW_PATH, editPath: ENC_EDIT_PATH } = createCrudRoutePaths(
      encCitizenGrivence,
      encComplaint,
    );
  
  

  useEffect(() => {
    let mounted = true;

    const loadComplaints = async () => {
      setLoading(true);
      try {
        const data = await complaintApi.readAll();
        if (mounted) setComplaints(data as Complaint[]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadComplaints();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // DATE FORMATTER → DD-MM-YYYY HH:MM AM/PM
  // ==========================================================
 const formatDT = (d: string | null | undefined) => {
  if (!d) return "-";

  const dt = new Date(d);

  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();

  let hours = dt.getHours();
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours ? hours : 12;

  return (
    <>
      {`${day}-${month}-${year}`}
      <br />
      {`${hours}.${minutes} ${ampm}`}
    </>
  );
};


  const isImage = (url: string) => {
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp")
    );
  };

  const openFile = (fileUrl: string) => {
    if (!fileUrl) return;

    if (isImage(fileUrl)) {
      setModalImage(fileUrl);
    } else {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const onGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      global: { value, matchMode: FilterMatchMode.CONTAINS },
    });
    setGlobalFilterValue(value);
  };

  const tableHeader = (
    <div className="flex justify-end w-full">
      <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-gray-300 shadow-sm">
        <i className="pi pi-search text-gray-500" />
        <InputText
          value={globalFilterValue}
          onChange={onGlobalFilterChange}
          placeholder={t("admin.citizen_grievance.complaints.search_placeholder")}
          className="p-inputtext-sm !border-0 !shadow-none"
        />
      </div>
    </div>
  );

  const rowExpansionTemplate = (data: Complaint) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="w-full md:w-1/4 font-semibold">
          {t("admin.citizen_grievance.complaints.close_image")}
        </div>
        <div className="space-y-2">
          {data.close_image_url ? (
            <button onClick={() => openFile(data.close_image_url!)}>
              <img
                src={
                  isImage(data.close_image_url!)
                    ? data.close_image_url!
                    : pdfImg
                }
                className="w-40 h-20 rounded border object-cover"
              />
            </button>
          ) : (
            "-"
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <div className="w-full md:w-1/4 font-semibold">
          {t("admin.citizen_grievance.complaints.action_remarks")}
        </div>
        <div>{data.action_remarks || "-"}</div>
      </div>

      {data.status !== "CLOSED" && (
        <div className="flex justify-start">
          <div className="w-full md:w-1/4 font-semibold">
            {t("admin.citizen_grievance.complaints.action")}
          </div>
          <button
            className="text-blue-600 flex items-center gap-2 border px-4 py-1 rounded"
            onClick={() => navigate(ENC_EDIT_PATH(data.unique_id))}
          >
            <PencilIcon className="size-5" />
          </button>
        </div>
      )}
    </div>
  );

  const indexTemplate = (_: Complaint, options: { rowIndex?: number }) =>
    (options.rowIndex ?? 0) + 1;

  const imageTemplate = (row: Complaint) => (
    <div className="text-center">
      {row.image_url ? (
        <button onClick={() => openFile(row.image_url!)}>
          <img
            src={isImage(row.image_url!) ? row.image_url! : pdfImg}
            className="w-28 h-16 object-cover rounded border"
          />
        </button>
      ) : (
        "-"
      )}
    </div>
  );

  const closureTemplate = (row: Complaint) => (
    <div className="flex flex-col text-sm">
      <span>{formatDT(row.complaint_closed_at)}</span>
      <span className="font-semibold text-gray-700">{row.status}</span>
    </div>
  );

  if (loading) return <div className="p-6">{t("common.loading")}</div>;

  return (
    <div className="px-2 py-3">
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">
          {t("admin.citizen_grievance.complaints.title")}
        </h1>

        <button
          className="bg-green-custom text-white px-3 py-2 rounded"
          onClick={() => navigate(ENC_NEW_PATH)}
        >
          {t("admin.citizen_grievance.complaints.add")}
        </button>
      </div>

     
        <DataTable
          value={complaints}
          dataKey="id"
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          filters={filters}
          globalFilterFields={[
            "unique_id",
            "customer_name",
            "contact_no",
            "main_category",
            "sub_category",
            "priority",
            "zone_name",
            "ward_name",
            "address",
            "status",
          ]}
          header={tableHeader}
          emptyMessage={t("admin.citizen_grievance.complaints.empty_message")}
          responsiveLayout="scroll"
          className="p-datatable-sm"
          expandedRows={expandedRows}
          onRowToggle={(e) => setExpandedRows(e.data)}
          rowExpansionTemplate={rowExpansionTemplate}
          showGridlines
          stripedRows
        >
          <Column expander style={{ width: "3rem" }} />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.s_no")}
            body={indexTemplate}
            style={{ width: "90px" }}
          />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.created")}
            body={(row: Complaint) => formatDT(row.created)}
            style={{ minWidth: "160px" }}
          />
          <Column
            field="unique_id"
            header={t("admin.citizen_grievance.complaints.columns.cg_no")}
            sortable
            style={{ minWidth: "140px" }}
          />
          <Column
            field="contact_no"
            header={t("admin.citizen_grievance.complaints.columns.phone")}
            sortable
            style={{ minWidth: "140px" }}
          />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.main_category")}
            body={(row: Complaint) => row.main_category || "-"}
            style={{ minWidth: "160px" }}
          />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.sub_category")}
            body={(row: Complaint) => row.sub_category || "-"}
            style={{ minWidth: "160px" }}
          />
          <Column
            field="address"
            header={t("admin.citizen_grievance.complaints.columns.location")}
          />
          <Column
            field="details"
            header={t("admin.citizen_grievance.complaints.columns.description")}
          />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.priority")}
            body={(row: Complaint) => row.priority || "-"}
            style={{ minWidth: "120px" }}
          />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.image")}
            body={imageTemplate}
          />
          <Column
            header={t("admin.citizen_grievance.complaints.columns.closure_status")}
            body={closureTemplate}
          />
        </DataTable>
     

      {modalImage && (
        <div className="fixed inset-0 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded shadow relative">
            <button
              className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded"
              onClick={() => setModalImage(null)}
            >
              X
            </button>

            <img src={modalImage} className="w-[400px] h-[400px] rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
