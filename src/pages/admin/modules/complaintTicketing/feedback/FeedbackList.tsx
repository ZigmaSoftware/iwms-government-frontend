import { useEffect, useState } from "react";
import Swal from "@/lib/notify";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { complaintFeedbackApi } from "@/features/complaintTicketing/api";
import type { ComplaintFeedback } from "@/features/complaintTicketing/types";
import { asArray, errorText, formatDateTime, yesNo } from "../utils";

export default function FeedbackList() {
  const [records, setRecords] = useState<ComplaintFeedback[]>([]);

  useEffect(() => {
    complaintFeedbackApi.readAll({ params: { all: 1 } })
      .then((response) => setRecords(asArray<ComplaintFeedback>(response)))
      .catch((err) => Swal.fire("Error", errorText(err, "Unable to load feedback"), "error"));
  }, []);

  return (
    <div className="p-3">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Complaint Feedback</h1>
        <p className="text-sm text-gray-500">Citizen feedback captured after resolution</p>
      </div>
      <DataTable value={records} dataKey="unique_id" paginator rows={10} stripedRows showGridlines emptyMessage="No feedback found" className="p-datatable-sm">
        <Column header="S.No" body={(_, options) => options.rowIndex + 1} style={{ width: "80px" }} />
        <Column field="ticket_no" header="Ticket" sortable body={(row) => row.ticket_no || row.ticket || "-"} />
        <Column field="customer_name" header="Customer" body={(row) => row.customer_name || row.customer || "-"} />
        <Column field="rating" header="Rating" sortable />
        <Column header="Issue Solved" body={(row) => yesNo(row.is_issue_solved)} />
        <Column field="feedback_text" header="Feedback" />
        <Column header="Submitted" body={(row) => formatDateTime(row.submitted_at)} />
      </DataTable>
    </div>
  );
}
