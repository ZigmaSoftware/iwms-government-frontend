import { useEffect, useMemo, useState } from "react";
import notify from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";

import { customerNotificationApi } from "@/helpers/admin";
import { confirmDeleteWithReason, withDeleteReason } from "@/utils/deleteReason";

type CustomerOption = {
  unique_id: string;
  customer_name: string;
  contact_no: string | null;
  username: string | null;
  has_fcm_token?: boolean;
};

type NotificationRow = {
  unique_id: string;
  customer_id: string;
  customer_name: string;
  contact_no: string | null;
  username: string | null;
  has_fcm_token?: boolean;
  last_tested_at?: string | null;
  last_test_sent?: boolean;
  last_test_message?: string | null;
};

type TestResponse = {
  sent: boolean;
  message: string;
};

const toList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: T[] }).results;
  }
  return [];
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function CustomerNotificationList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const [list, available] = await Promise.all([
          customerNotificationApi.readAll(),
          customerNotificationApi.action("customer-options"),
        ]);
        setRows(toList<NotificationRow>(list));
        setOptions(toList<CustomerOption>(available));
      } catch {
        setRows([]);
        setOptions([]);
        notify.fire(t("common.error"), "Could not load notifications.", "error");
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load();
  }, [load]);

  const addCustomer = async () => {
    if (!selectedCustomerId) {
      notify.fire(t("common.warning") || "Warning", "Choose a customer.", "warning");
      return;
    }
    setSaving(true);
    try {
      await customerNotificationApi.create({
        customer_unique_id: selectedCustomerId,
      });
      notify.fire(t("common.success"), "Customer added.", "success");
      setDialogOpen(false);
      setSelectedCustomerId("");
      load();
    } catch {
      notify.fire(t("common.error"), "Could not add customer.", "error");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (row: NotificationRow) => {
    setTestingId(row.unique_id);
    try {
      const result = await customerNotificationApi.action<TestResponse>(
        `${row.unique_id}/test`,
        {},
      );
      notify.fire(
        result.sent ? t("common.success") : t("common.warning") || "Warning",
        result.message,
        result.sent ? "success" : "warning",
      );
      load();
    } catch {
      notify.fire(t("common.error"), "Could not send test notification.", "error");
    } finally {
      setTestingId(null);
    }
  };

  const removeCustomer = async (row: NotificationRow) => {
    const reason = await confirmDeleteWithReason({
      title: "Remove customer?",
      text: row.customer_name,
      confirmButtonText: "Remove",
    });
    if (reason === null) return;

    try {
      await customerNotificationApi.delete(row.unique_id, withDeleteReason(reason));
      notify.fire(t("common.success"), "Customer removed.", "success");
      load();
    } catch {
      notify.fire(t("common.error"), "Could not remove customer.", "error");
    }
  };

  return (
    <ComponentCard title="Notification">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Send a test collection notification to selected customer app logins.
        </p>
        <Button
          label="Add"
          icon="pi pi-plus"
          size="small"
          onClick={() => setDialogOpen(true)}
        />
      </div>

      <DataTable
        value={rows}
        loading={loading}
        dataKey="unique_id"
        stripedRows
        paginator
        rows={10}
      >
        <Column field="customer_name" header="Customer" />
        <Column field="contact_no" header="Contact" style={{ width: "11rem" }} />
        <Column field="username" header="Username" style={{ width: "12rem" }} />
        <Column
          header="Device"
          style={{ width: "9rem" }}
          body={(row: NotificationRow) =>
            row.has_fcm_token ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                Ready
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                No token
              </span>
            )
          }
        />
        <Column
          header="Last test"
          style={{ width: "13rem" }}
          body={(row: NotificationRow) => formatDateTime(row.last_tested_at)}
        />
        <Column
          header=""
          style={{ width: "11rem" }}
          body={(row: NotificationRow) => (
            <div className="flex justify-end gap-2">
              <Button
                label="Test"
                size="small"
                outlined
                loading={testingId === row.unique_id}
                onClick={() => sendTest(row)}
              />
              <Button
                icon="pi pi-trash"
                size="small"
                severity="danger"
                text
                onClick={() => removeCustomer(row)}
                tooltip="Remove"
              />
            </div>
          )}
        />
      </DataTable>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add Customer
            </h3>
            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-gray-800 dark:text-gray-100">
                Customer
              </label>
              <select
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="">Select customer</option>
                {options.map((customer) => (
                  <option key={customer.unique_id} value={customer.unique_id}>
                    {customer.customer_name}
                    {customer.contact_no ? ` - ${customer.contact_no}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                label="Cancel"
                outlined
                onClick={() => {
                  setDialogOpen(false);
                  setSelectedCustomerId("");
                }}
              />
              <Button label="Add" loading={saving} onClick={addCustomer} />
            </div>
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
