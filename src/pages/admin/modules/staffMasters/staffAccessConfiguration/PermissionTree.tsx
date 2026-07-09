import { ChevronDown, LayoutGrid } from "lucide-react";

import type { FieldPermissionState, ModulePermission, UserActionOption } from "./types";

type PermissionTreeProps = {
  modules: ModulePermission[];
  actions: UserActionOption[];
  onChange: (modules: ModulePermission[]) => void;
  readOnly?: boolean;
};

const FIELD_STATES: FieldPermissionState[] = ["VISIBLE", "HIDDEN"];

const cloneModules = (modules: ModulePermission[]) =>
  modules.map((module) => ({
    ...module,
    screens: module.screens.map((screen) => ({
      ...screen,
      actions: { ...screen.actions },
      fields: screen.fields.map((field) => ({ ...field })),
    })),
  }));

const Toggle = ({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) onChange(!checked);
    }}
    className={`relative h-5 w-10 shrink-0 rounded-full transition ${
      checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
    } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
  >
    <span
      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
        checked ? "left-5" : "left-0.5"
      }`}
    />
  </button>
);

export default function PermissionTree({
  modules,
  actions,
  onChange,
  readOnly = false,
}: PermissionTreeProps) {
  const updateModule = (moduleIndex: number, enabled: boolean) => {
    const next = cloneModules(modules);
    next[moduleIndex].enabled = enabled;
    next[moduleIndex].screens = next[moduleIndex].screens.map((screen) => ({
      ...screen,
      enabled,
    }));
    onChange(next);
  };

  const updateScreen = (
    moduleIndex: number,
    screenIndex: number,
    updater: (screen: ModulePermission["screens"][number]) => void,
  ) => {
    const next = cloneModules(modules);
    updater(next[moduleIndex].screens[screenIndex]);
    onChange(next);
  };

  const updateField = (
    moduleIndex: number,
    screenIndex: number,
    fieldIndex: number,
    state: FieldPermissionState,
  ) => {
    const next = cloneModules(modules);
    next[moduleIndex].screens[screenIndex].fields[fieldIndex].fieldPermissionState = state;
    onChange(next);
  };

  if (!modules.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Select a role and load permissions to configure screen access.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-blue-500 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
        Permissions below are set at the role level. Changes apply to all staff with the same role.
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Module & screen permissions
        </p>
        {modules.map((module, moduleIndex) => (
          <details
            key={module.mainScreenId || module.mainScreenName}
            className="group overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
            open={moduleIndex === 0}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 bg-stone-50 px-3 py-2.5 dark:bg-gray-900">
            <LayoutGrid className="h-3.5 w-3.5 text-gray-500" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
              {module.mainScreenName}
            </span>
            <Toggle
              checked={module.enabled}
              disabled={readOnly}
              onChange={(checked) => updateModule(moduleIndex, checked)}
            />
            <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
            </summary>

            <div className={module.enabled ? "divide-y divide-gray-100 dark:divide-gray-800" : "divide-y divide-gray-100 opacity-60 dark:divide-gray-800"}>
              {module.screens.map((screen, screenIndex) => {
                const disabled = readOnly || !module.enabled;
                const hasFields = screen.fields.length > 0;
                const allChecked =
                  actions.length > 0 && actions.every((action) => Boolean(screen.actions[action.value]));
                return (
                  <div key={screen.userScreenId}>
                    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(190px,1fr)_minmax(360px,2fr)]">
                    <label
                      className="flex min-w-0 items-center gap-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                        {screen.userScreenName ?? screen.userScreenId}
                      </span>
                      {hasFields && (
                        <span className="text-xs text-gray-400">{screen.fields.length} fields</span>
                      )}
                    </label>

                    <div
                      className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900 disabled:opacity-50 dark:accent-gray-100"
                          checked={allChecked}
                          disabled={disabled}
                          onChange={(event) =>
                            updateScreen(moduleIndex, screenIndex, (nextScreen) => {
                              actions.forEach((action) => {
                                nextScreen.actions[action.value] = event.target.checked;
                              });
                            })
                          }
                        />
                        All
                      </label>
                      {actions.map((action) => (
                        <label
                          key={action.value}
                          className="flex items-center gap-1.5 text-xs capitalize text-gray-600 dark:text-gray-300"
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-900 disabled:opacity-50 dark:accent-gray-100"
                            checked={Boolean(screen.actions[action.value])}
                            disabled={disabled}
                            onChange={(event) =>
                              updateScreen(moduleIndex, screenIndex, (nextScreen) => {
                                nextScreen.actions[action.value] = event.target.checked;
                              })
                            }
                          />
                          {action.label}
                        </label>
                      ))}
                    </div>
                    </div>

                  {hasFields && (
                    <div className="space-y-2 bg-slate-50/70 px-6 pb-4 pt-1 dark:bg-gray-900/40">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <span>Column level data</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-gray-500 dark:bg-gray-950">
                          {screen.fields.length} fields
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {screen.fields.map((field, fieldIndex) => (
                          <div
                            key={field.columnId}
                            className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-950"
                          >
                            <span className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-200">
                              {field.displayName || field.fieldName}
                            </span>
                            <select
                              className="h-8 shrink-0 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:disabled:bg-gray-900"
                              value={field.fieldPermissionState}
                              disabled={disabled}
                              onChange={(event) =>
                                updateField(
                                  moduleIndex,
                                  screenIndex,
                                  fieldIndex,
                                  event.target.value as FieldPermissionState,
                                )
                              }
                            >
                              {FIELD_STATES.map((state) => (
                                <option key={state} value={state}>
                                  {state.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
