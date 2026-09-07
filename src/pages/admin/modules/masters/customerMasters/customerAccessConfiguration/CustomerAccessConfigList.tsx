import { useEffect, useMemo, useState } from "react";
import Swal from "@/lib/notify";
import { useTranslation } from "react-i18next";

import ComponentCard from "@/components/common/ComponentCard";
import { DataTable } from "@/components/common/SafeDataTable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";

import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { customerAccessConfigurationApi } from "@/helpers/admin";

type CustomerOption = {
  unique_id: string;
  customer_name: string;
  contact_no: string | null;
  username: string | null;
  app_module: string | null;
  has_access_configuration: boolean;
};

type AvailableScreens = {
  app_modules: { uniqueId: string; surfaceKey: string; label: string }[];
  screens: { userScreenId: string; userScreenName: string; label: string }[];
};

type ConfigRecord = {
  unique_id: string;
  customer_id: string;
  app_module_ids?: string[];
  app_screen_ids?: string[];
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

/**
 * Customer Access Configuration.
 *
 * Customers are not staff, so they have no Staff Access Configuration to hang
 * grants off — and no web screens to inherit, because every citizen API route
 * is self-scoped to the signed-in customer. So this is the one place where app
 * screens are ticked directly: the module tick decides whether they can sign
 * in, the screen ticks decide what they see.
 */
export default function CustomerAccessConfigList() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [available, setAvailable] = useState<AvailableScreens | null>(null);
  const [configs, setConfigs] = useState<Record<string, ConfigRecord>>({});
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftModules, setDraftModules] = useState<string[]>([]);
  const [draftScreens, setDraftScreens] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customerAccessConfigurationApi
      .action("available-screens")
      .then((res: unknown) => setAvailable(res as AvailableScreens))
      .catch(() => setAvailable(null));
  }, []);

  const load = useMemo(
    () => () => {
      setLoading(true);
      Promise.all([
        // No company filter: this codebase scopes customers through the
        // government hierarchy, not a company/project pair.
        customerAccessConfigurationApi.action("customer-options"),
        customerAccessConfigurationApi.readAll(),
      ])
        .then(([options, existing]) => {
          setCustomers(toList<CustomerOption>(options));
          setConfigs(
            Object.fromEntries(
              toList<ConfigRecord>(existing).map((row) => [
                row.customer_id,
                row,
              ]),
            ),
          );
        })
        .catch(() => setCustomers([]))
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(load, [load]);

  const startEdit = (row: CustomerOption) => {
    const existing = configs[row.unique_id];
    setEditing(row.unique_id);
    setDraftModules(
      existing?.app_module_ids ??
        available?.app_modules.map((m) => m.uniqueId) ??
        [],
    );
    setDraftScreens(
      existing?.app_screen_ids ??
        available?.screens.map((s) => s.userScreenId) ??
        [],
    );
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const existing = configs[editing];
      const payload = {
        customer_unique_id: editing,
        app_module_ids: draftModules,
        app_screen_ids: draftScreens,
      };
      if (existing) {
        await customerAccessConfigurationApi.update(editing, payload);
      } else {
        await customerAccessConfigurationApi.create(payload);
      }
      Swal.fire(t("common.success"), "App access saved.", "success");
      setEditing(null);
      load();
    } catch {
      Swal.fire(t("common.error"), "Could not save app access.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (
    list: string[],
    setter: (next: string[]) => void,
    id: string,
  ) =>
    setter(
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );

  return (
    <ComponentCard title="Customer Access Configuration">
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Which app a customer may sign into, and which screens they see once
        inside. Customers have no web screens — every citizen request is scoped
        to the signed-in customer already — so these ticks are the whole of
        their app access.
      </p>

      {(
        <DataTable
          value={customers}
          loading={loading}
          dataKey="unique_id"
          stripedRows
          paginator
          rows={10}
        >
          <Column field="customer_name" header="Customer" />
          <Column
            field="contact_no"
            header="Contact"
            style={{ width: "11rem" }}
          />
          <Column
            field="username"
            header="Username"
            style={{ width: "11rem" }}
          />
          <Column
            header="App access"
            style={{ width: "12rem" }}
            body={(row: CustomerOption) =>
              row.has_access_configuration ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Configured
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  No app access
                </span>
              )
            }
          />
          <Column
            header=""
            style={{ width: "8rem" }}
            body={(row: CustomerOption) => (
              <Button
                label="Configure"
                size="small"
                outlined
                onClick={() => startEdit(row)}
              />
            )}
          />
        </DataTable>
      )}

      {editing && available && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              App access
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {customers.find((c) => c.unique_id === editing)?.customer_name}
            </p>

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                Apps they may sign into
              </p>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Without one, their mobile sign-in is refused.
              </p>
              <div className="flex flex-wrap gap-2">
                {available.app_modules.map((module) => (
                  <label
                    key={module.uniqueId}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draftModules.includes(module.uniqueId)}
                      onChange={() =>
                        toggle(draftModules, setDraftModules, module.uniqueId)
                      }
                    />
                    {module.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                Screens they can see
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {available.screens.map((screen) => (
                  <label
                    key={screen.userScreenId}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draftScreens.includes(screen.userScreenId)}
                      onChange={() =>
                        toggle(
                          draftScreens,
                          setDraftScreens,
                          screen.userScreenId,
                        )
                      }
                    />
                    {screen.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                label="Cancel"
                outlined
                onClick={() => setEditing(null)}
              />
              <Button label="Save" loading={saving} onClick={save} />
            </div>
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
