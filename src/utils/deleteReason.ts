import type { AxiosRequestConfig } from "axios";

import i18n from "@/i18n";
import Notify from "@/lib/notify";

/** Matches the backend's delete_reason column length. */
export const DELETE_REASON_MAX_LENGTH = 500;

type ConfirmDeleteOptions = {
  title?: string;
  text?: string;
  confirmButtonText?: string;
};

/**
 * Asks the user to confirm a delete and enter the reason the backend
 * requires (stored on the record and in the audit log). Resolves to the
 * trimmed reason, or null when the user cancels.
 */
export async function confirmDeleteWithReason(
  options: ConfirmDeleteOptions = {},
): Promise<string | null> {
  const result = await Notify.fire({
    title: options.title ?? i18n.t("common.confirm_title"),
    text: options.text ?? i18n.t("common.confirm_delete_text"),
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText,
    cancelButtonText: i18n.t("common.cancel"),
    input: "textarea",
    inputLabel: i18n.t("common.delete_reason_label"),
    inputPlaceholder: i18n.t("common.delete_reason_placeholder"),
    inputMaxLength: DELETE_REASON_MAX_LENGTH,
    inputValidator: (value: string) =>
      value.trim() ? null : i18n.t("common.delete_reason_required"),
  });

  return result.isConfirmed ? (result.value ?? "").trim() : null;
}

/** Axios config that sends the delete reason in the DELETE request body. */
export const withDeleteReason = (
  reason: string,
  config: AxiosRequestConfig = {},
): AxiosRequestConfig => ({
  ...config,
  data: { ...(config.data ?? {}), delete_reason: reason },
});
