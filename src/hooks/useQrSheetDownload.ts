import { useState } from "react";
import notify from "@/lib/notify";
import type { DocAction } from "@/components/common/ListToolbar";
import { downloadQrSheetPdf, type QrSheetItem } from "@/utils/qrSheetPdf";

/**
 * The Documents menu's "Download QR" action: fetches the list's rows
 * (honouring its current filters) and saves every row's QR code as one
 * printable label sheet.
 *
 *   documentActions={{ downloadQr: useQrSheetDownload(fetchRows, (b) => ({ qr: b.bin_qr, title: b.bin_name }), "bin_qr_codes", "Bin QR codes") }}
 */
export function useQrSheetDownload<T>(
  fetchRows: () => Promise<T[]>,
  toItem: (row: T) => QrSheetItem,
  filename: string,
  heading?: string,
): DocAction {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    onClick: () => {
      void (async () => {
        setBusy(true);
        try {
          const { placed, skipped } = await downloadQrSheetPdf((await fetchRows()).map(toItem), filename, heading);
          if (!placed) notify.fire("No QR codes", "None of these records has a QR code.", "info");
          else if (skipped) notify.fire("QR sheet downloaded", `${placed} QR codes · ${skipped} without a QR code skipped.`, "success");
        } catch {
          notify.fire("Error", "Failed to generate the QR sheet.", "error");
        } finally {
          setBusy(false);
        }
      })();
    },
  };
}
