import { ChevronDown, LayoutGrid } from "lucide-react";

import type { ModulePermission, UserActionOption } from "./types";
import type { AllowedActionsMap } from "@/helpers/admin/staffAccessConfigApi";

type PermissionTreeProps = {
  modules: ModulePermission[];
  actions: UserActionOption[];
  onChange: (modules: ModulePermission[]) => void;
  /**
   * userScreenId -> action -> true, the set of screens/actions Super Admin
   * enabled for the selected Local Body. When provided, a staff admin can
   * only narrow this set — actions not present here are not rendered.
   */
  allowedActions?: AllowedActionsMap;
  readOnly?: boolean;
};

const cloneModules = (modules: ModulePermission[]) =>
  modules.map((module) => ({
    ...module,
    screens: module.screens.map((screen) => ({
      ...screen,
      actions: { ...screen.actions },
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
  allowedActions,
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

  if (!modules.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Select a Local Body to load the screens enabled for it.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-blue-500 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
        Only screens and actions enabled by Super Admin for this Local Body are shown. You cannot grant access beyond what Super Admin has allowed.
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
                const allowedForScreen = allowedActions?.[screen.userScreenId];
                const visibleActions = allowedForScreen
                  ? actions.filter((action) => Boolean(allowedForScreen[action.value]))
                  : actions;
                const allChecked =
                  visibleActions.length > 0 &&
                  visibleActions.every((action) => Boolean(screen.actions[action.value]));
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
                              visibleActions.forEach((action) => {
                                nextScreen.actions[action.value] = event.target.checked;
                              });
                            })
                          }
                        />
                        All
                      </label>
                      {visibleActions.map((action) => (
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
