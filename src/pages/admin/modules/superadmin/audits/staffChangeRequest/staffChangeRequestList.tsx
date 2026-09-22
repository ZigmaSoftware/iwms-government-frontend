import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import notify from "@/lib/notify";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import type { DataTablePageEvent } from "primereact/datatable";
import { ListPageHeader } from "@/components/common/ListPageHeader";

import { staffChangeRequestApi } from "@/helpers/admin";
import {
  CHANGEABLE_FIELDS,
  type StaffChangeRequestRecord,
  type StaffChangeRequestValue,
} from "./types";

const toRecordList = (value: unknown): StaffChangeRequestRecord[] => {
  if (Array.isArray(value)) return value as StaffChangeRequestRecord[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: StaffChangeRequestRecord[] }).results;
  }
  return [];
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const formatValue = (value?: StaffChangeRequestValue) => {
  if (value === undefined || value === null) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

type TFunc = ReturnType<typeof useTranslation>["t"];

const fieldLabel = (t: TFunc, fieldName: string): string => {
  const match = CHANGEABLE_FIELDS.find((f) => f.value === fieldName);
  return match ? t(match.labelKey, { defaultValue: fieldName }) : fieldName;
};

const statusBadge = (status: StaffChangeRequestRecord["status"]) => {
  const color =
    status === "APPROVED"
      ? "text-green-600"
      : status === "REJECTED"
        ? "text-red-600"
        : "text-amber-600";
  return <span className={`font-medium ${color}`}>{status}</span>;
};

export default function StaffChangeRequestList() {
  const { t } = useTranslation();

  const [myRequests, setMyRequests] = useState<StaffChangeRequestRecord[]>([]);
  const [pendingApproval, setPendingApproval] = useState<StaffChangeRequestRecord[]>([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);

  const [myRequestsTotal, setMyRequestsTotal] = useState(0);
  const [myRequestsFirst, setMyRequestsFirst] = useState(0);
  const [myRequestsRows, setMyRequestsRows] = useState(10);

  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingFirst, setPendingFirst] = useState(0);
  const [pendingRows, setPendingRows] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [fieldName, setFieldName] = useState<string>("");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [decisionTarget, setDecisionTarget] = useState<{
    record: StaffChangeRequestRecord;
    action: "approve" | "reject";
  } | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [deciding, setDeciding] = useState(false);

  const loadMyRequests = useCallback(
    async (page: number, limit: number) => {
      setLoadingMyRequests(true);
      try {
        const response = await staffChangeRequestApi.readAllwithPaginated(page, limit, {
          params: {},
        });
        setMyRequests(toRecordList(response));
        setMyRequestsTotal(
          typeof response?.count === "number" ? response.count : toRecordList(response).length,
        );
      } catch {
        notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        setLoadingMyRequests(false);
      }
    },
    [t],
  );

  const loadPendingApproval = useCallback(
    async (page: number, limit: number) => {
      setLoadingPending(true);
      try {
        const response = await staffChangeRequestApi.readAllwithPaginated(page, limit, {
          params: { scope: "pending_approval" },
        });
        setPendingApproval(toRecordList(response));
        setPendingTotal(
          typeof response?.count === "number" ? response.count : toRecordList(response).length,
        );
      } catch {
        notify.fire(t("common.error"), t("common.fetch_failed"), "error");
      } finally {
        setLoadingPending(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadMyRequests(myRequestsFirst / myRequestsRows + 1, myRequestsRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMyRequests, myRequestsFirst, myRequestsRows]);

  useEffect(() => {
    void loadPendingApproval(pendingFirst / pendingRows + 1, pendingRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPendingApproval, pendingFirst, pendingRows]);

  const onMyRequestsPage = (event: DataTablePageEvent) => {
    setMyRequestsFirst(event.first);
    setMyRequestsRows(event.rows);
  };

  const onPendingPage = (event: DataTablePageEvent) => {
    setPendingFirst(event.first);
    setPendingRows(event.rows);
  };

  const resetForm = () => {
    setFieldName("");
    setNewValue("");
    setReason("");
  };

  const handleSubmit = async () => {
    if (!fieldName || !newValue.trim()) return;
    setSubmitting(true);
    try {
      await staffChangeRequestApi.create({
        field_name: fieldName,
        new_value: newValue.trim(),
        reason: reason.trim() || undefined,
      });
      notify.fire(
        t("common.success"),
        t("admin.staff_change_request.submitted_success"),
        "success",
      );
      setFormOpen(false);
      resetForm();
      setMyRequestsFirst(0);
      void loadMyRequests(1, myRequestsRows);
    } catch {
      notify.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openDecision = (record: StaffChangeRequestRecord, action: "approve" | "reject") => {
    setDecisionTarget({ record, action });
    setDecisionRemarks("");
  };

  const closeDecision = () => {
    setDecisionTarget(null);
    setDecisionRemarks("");
  };

  const submitDecision = async () => {
    if (!decisionTarget) return;
    setDeciding(true);
    try {
      await staffChangeRequestApi.action(
        `${decisionTarget.record.unique_id}/${decisionTarget.action}`,
        { decision_remarks: decisionRemarks.trim() || undefined },
      );
      notify.fire(
        t("common.success"),
        t(
          decisionTarget.action === "approve"
            ? "admin.staff_change_request.approved_success"
            : "admin.staff_change_request.rejected_success",
        ),
        "success",
      );
      closeDecision();
      setPendingFirst(0);
      void loadPendingApproval(1, pendingRows);
      void loadMyRequests(myRequestsFirst / myRequestsRows + 1, myRequestsRows);
    } catch {
      notify.fire(t("common.error"), t("common.fetch_failed"), "error");
    } finally {
      setDeciding(false);
    }
  };

  const decisionActionsTemplate = useCallback(
    (row: StaffChangeRequestRecord) => (
      <div className="flex justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-green-600 text-green-600 hover:bg-green-50"
          onClick={() => openDecision(row, "approve")}
        >
          {t("admin.staff_change_request.approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-600 text-red-600 hover:bg-red-50"
          onClick={() => openDecision(row, "reject")}
        >
          {t("admin.staff_change_request.reject")}
        </Button>
      </div>
    ),
    [t],
  );

  return (
    <div className="p-3">
      <div className="mb-6 flex items-start justify-between gap-4">
        <ListPageHeader
          title={t("admin.staff_change_request.list_title")}
          subtitle={t("admin.staff_change_request.list_subtitle")}
        />
        <Button onClick={() => setFormOpen(true)}>
          {t("admin.staff_change_request.new_request")}
        </Button>
      </div>

      <Tabs defaultValue="my-requests">
        <TabsList>
          <TabsTrigger value="my-requests">
            {t("admin.staff_change_request.tab_my_requests")}
          </TabsTrigger>
          <TabsTrigger value="pending-approval">
            {t("admin.staff_change_request.tab_pending_approval")}
            {pendingTotal > 0 ? ` (${pendingTotal})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-requests">
          <Card>
            <CardContent className="p-4">
              <DataTable
                value={myRequests}
                dataKey="unique_id"
                lazy
                paginator
                first={myRequestsFirst}
                rows={myRequestsRows}
                totalRecords={myRequestsTotal}
                onPage={onMyRequestsPage}
                loading={loadingMyRequests}
                stripedRows
                showGridlines
                className="p-datatable-sm"
                emptyMessage={t("admin.staff_change_request.empty_my_requests")}
              >
                <Column
                  header={t("common.s_no")}
                  body={(_, { rowIndex }) => myRequestsFirst + rowIndex + 1}
                  style={{ width: 70 }}
                />
                <Column
                  field="field_name"
                  header={t("admin.staff_change_request.field_name")}
                  body={(r: StaffChangeRequestRecord) => fieldLabel(t, r.field_name)}
                />
                <Column
                  header={t("admin.staff_change_request.current_value")}
                  body={(r: StaffChangeRequestRecord) => formatValue(r.old_value)}
                />
                <Column
                  header={t("admin.staff_change_request.requested_value")}
                  body={(r: StaffChangeRequestRecord) => formatValue(r.new_value)}
                />
                <Column
                  field="reason"
                  header={t("admin.staff_change_request.reason")}
                  body={(r: StaffChangeRequestRecord) => r.reason ?? "-"}
                />
                <Column
                  field="status"
                  header={t("admin.staff_change_request.status")}
                  body={(r: StaffChangeRequestRecord) => statusBadge(r.status)}
                />
                <Column
                  field="decided_by_name"
                  header={t("admin.staff_change_request.decided_by")}
                  body={(r: StaffChangeRequestRecord) => r.decided_by_name ?? "-"}
                />
                <Column
                  field="created_at"
                  header={t("admin.staff_change_request.requested_at")}
                  body={(r: StaffChangeRequestRecord) => formatDateTime(r.created_at)}
                />
              </DataTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-approval">
          <Card>
            <CardContent className="p-4">
              <DataTable
                value={pendingApproval}
                dataKey="unique_id"
                lazy
                paginator
                first={pendingFirst}
                rows={pendingRows}
                totalRecords={pendingTotal}
                onPage={onPendingPage}
                loading={loadingPending}
                stripedRows
                showGridlines
                className="p-datatable-sm"
                emptyMessage={t("admin.staff_change_request.empty_pending_approval")}
              >
                <Column
                  header={t("common.s_no")}
                  body={(_, { rowIndex }) => pendingFirst + rowIndex + 1}
                  style={{ width: 70 }}
                />
                <Column
                  field="requested_by_name"
                  header={t("admin.staff_change_request.requested_by")}
                  body={(r: StaffChangeRequestRecord) => r.requested_by_name ?? "-"}
                />
                <Column
                  field="field_name"
                  header={t("admin.staff_change_request.field_name")}
                  body={(r: StaffChangeRequestRecord) => fieldLabel(t, r.field_name)}
                />
                <Column
                  header={t("admin.staff_change_request.current_value")}
                  body={(r: StaffChangeRequestRecord) => formatValue(r.old_value)}
                />
                <Column
                  header={t("admin.staff_change_request.requested_value")}
                  body={(r: StaffChangeRequestRecord) => formatValue(r.new_value)}
                />
                <Column
                  field="reason"
                  header={t("admin.staff_change_request.reason")}
                  body={(r: StaffChangeRequestRecord) => r.reason ?? "-"}
                />
                <Column
                  field="created_at"
                  header={t("admin.staff_change_request.requested_at")}
                  body={(r: StaffChangeRequestRecord) => formatDateTime(r.created_at)}
                />
                <Column
                  header={t("common.actions")}
                  body={decisionActionsTemplate}
                  style={{ width: 200 }}
                />
              </DataTable>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Request form */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.staff_change_request.new_request")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("admin.staff_change_request.field_name")}</Label>
              <Select value={fieldName} onValueChange={setFieldName}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.staff_change_request.field_name")} />
                </SelectTrigger>
                <SelectContent>
                  {CHANGEABLE_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {t(field.labelKey, field.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("admin.staff_change_request.requested_value")}</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("admin.staff_change_request.reason")}</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("admin.staff_change_request.reason_placeholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !fieldName || !newValue.trim()}
            >
              {t("admin.staff_change_request.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject decision dialog */}
      <Dialog open={Boolean(decisionTarget)} onOpenChange={(open) => !open && closeDecision()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.action === "approve"
                ? t("admin.staff_change_request.approve")
                : t("admin.staff_change_request.reject")}
            </DialogTitle>
          </DialogHeader>

          {decisionTarget && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t("admin.staff_change_request.field_name")}:
                </span>{" "}
                {fieldLabel(t, decisionTarget.record.field_name)}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("admin.staff_change_request.current_value")}:
                </span>{" "}
                {formatValue(decisionTarget.record.old_value)}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("admin.staff_change_request.requested_value")}:
                </span>{" "}
                {formatValue(decisionTarget.record.new_value)}
              </div>

              <div className="space-y-1.5">
                <Label>{t("admin.staff_change_request.decision_remarks")}</Label>
                <Textarea
                  value={decisionRemarks}
                  onChange={(e) => setDecisionRemarks(e.target.value)}
                  placeholder={t("admin.staff_change_request.decision_remarks_placeholder")}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDecision}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submitDecision} disabled={deciding}>
              {decisionTarget?.action === "approve"
                ? t("admin.staff_change_request.approve")
                : t("admin.staff_change_request.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
