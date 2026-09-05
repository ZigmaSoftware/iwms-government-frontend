import { useEffect, useState } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { appModuleApi } from "@/helpers/admin";

/** One row of the mobile app module master. */
type AppModuleRow = {
  unique_id: string;
  module_key: string;
  surface_key: string;
  label: string;
  route: string;
  order_no: number;
  description: string | null;
  is_active: boolean;
  screen_count: number;
};

const toRows = (value: unknown): AppModuleRow[] => {
  if (Array.isArray(value)) return value as AppModuleRow[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { results?: unknown }).results)
  ) {
    return (value as { results: AppModuleRow[] }).results;
  }
  return [];
};

/**
 * App Modules — one row per app in the mobile build.
 *
 * Rows cannot be added or deleted here: a module only means anything if the
 * app has screens and a route for it, so the set changes with an app release.
 * The label, ordering and active flag are maintained inline.
 */
export default function AppModuleList() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AppModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { label: string; order_no: number }>
  >({});

  const load = () => {
    setLoading(true);
    appModuleApi
      .readAll()
      .then((res: unknown) => {
        const list = toRows(res);
        setRows(list);
        setDrafts(
          Object.fromEntries(
            list.map((row) => [
              row.unique_id,
              { label: row.label, order_no: row.order_no },
            ]),
          ),
        );
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async (row: AppModuleRow) => {
    const draft = drafts[row.unique_id];
    if (!draft) return;
    setSavingId(row.unique_id);
    try {
      await appModuleApi.update(row.unique_id, {
        label: draft.label.trim() || row.label,
        order_no: Number(draft.order_no) || 0,
      });
      Swal.fire(t("common.success"), `${draft.label} saved.`, "success");
      load();
    } catch {
      Swal.fire(t("common.error"), "Could not save the module.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (row: AppModuleRow) => {
    setSavingId(row.unique_id);
    try {
      await appModuleApi.update(row.unique_id, { is_active: !row.is_active });
      load();
    } catch {
      Swal.fire(t("common.error"), "Could not change the module.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ComponentCard title="App Modules">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        One row per app in the mobile build. Grant a module to someone by
        ticking it under <strong>Mobile App Access</strong> in Staff Access
        Configuration (or Customer Access Configuration) — that is what lets
        them sign into that app. What they can do inside comes from the ordinary
        screen permissions, the same ticks that govern the web screens.
      </p>
      <p className="mb-4 rounded-md border-l-2 border-blue-500 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
        Modules cannot be added or deleted here. Each one is backed by screens
        and a route that ship inside the app, so a module invented here would
        appear in every dropdown and lead nowhere. Deactivate one instead to
        stop new people being granted it.
      </p>

      <DataTable value={rows} loading={loading} dataKey="unique_id" stripedRows>
        <Column field="module_key" header="Key" style={{ width: "14rem" }} />
        <Column
          header="Label"
          body={(row: AppModuleRow) => (
            <input
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              value={drafts[row.unique_id]?.label ?? row.label}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [row.unique_id]: {
                    ...(current[row.unique_id] ?? { order_no: row.order_no }),
                    label: event.target.value,
                  },
                }))
              }
            />
          )}
        />
        <Column
          header="Order"
          style={{ width: "7rem" }}
          body={(row: AppModuleRow) => (
            <input
              type="number"
              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
              value={drafts[row.unique_id]?.order_no ?? row.order_no}
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [row.unique_id]: {
                    ...(current[row.unique_id] ?? { label: row.label }),
                    order_no: Number(event.target.value),
                  },
                }))
              }
            />
          )}
        />
        <Column field="route" header="Opens" style={{ width: "12rem" }} />
        <Column
          header="Screens"
          style={{ width: "7rem" }}
          body={(row: AppModuleRow) => `${row.screen_count}`}
        />
        <Column
          header="Active"
          style={{ width: "8rem" }}
          body={(row: AppModuleRow) => (
            <button
              type="button"
              onClick={() => toggleActive(row)}
              disabled={savingId === row.unique_id}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                row.is_active
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              {row.is_active ? "Active" : "Inactive"}
            </button>
          )}
        />
        <Column
          header=""
          style={{ width: "7rem" }}
          body={(row: AppModuleRow) => (
            <Button
              label="Save"
              size="small"
              loading={savingId === row.unique_id}
              onClick={() => save(row)}
            />
          )}
        />
      </DataTable>
    </ComponentCard>
  );
}
