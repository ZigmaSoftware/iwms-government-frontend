import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

/** Shown instead of a dashboard the signed-in user may not open. */
export function NoAccess({ kind }: { kind: "admin" | "superadmin" }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <Lock size={36} className="text-gray-400" aria-hidden="true" />
      <h1 className="m-0 text-xl font-semibold text-gray-800 dark:text-gray-100">
        {kind === "admin"
          ? t("admin.dashboards.no_access.admin_title", "Welcome")
          : t("admin.dashboards.no_access.superadmin_title", "Super admins only")}
      </h1>
      <p className="m-0 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {kind === "admin"
          ? t(
              "admin.dashboards.no_access.admin_message",
              "You have not been given the Dashboard. Open your screens from the menu, or ask your administrator to grant Dashboard in Staff Access Configuration.",
            )
          : t(
              "admin.dashboards.no_access.superadmin_message",
              "The Superadmin Dashboard shows every district and local body on the platform, so only super admins can open it.",
            )}
      </p>
    </div>
  );
}
