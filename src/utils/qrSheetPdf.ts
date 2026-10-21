/* ─────────────────────────────────────────────────────────────────────
   Bulk QR sheet: every row's QR image as a printable A4 label grid
   (3 × 4 per page, name + sub-line under each code). Used by the
   "Download QR" item of list pages whose rows carry a QR image
   (customers, bins, staff …).
   ──────────────────────────────────────────────────────────────────── */

export type QrSheetItem = {
  /** QR image URL (or data URL) */
  qr: string | null | undefined;
  title: string;
  subtitle?: string;
};

const toDataUrl = async (source: string): Promise<string> => {
  if (source.startsWith("data:")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`QR image ${response.status}`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

/** Returns how many labels were placed and how many were skipped (no QR / failed to load). */
export const downloadQrSheetPdf = async (
  items: QrSheetItem[],
  filename: string,
  heading?: string,
): Promise<{ placed: number; skipped: number }> => {
  const withQr = items.filter((i) => i.qr);
  // load a few at a time so a big list doesn't flood the server
  const loaded: Array<{ item: QrSheetItem; data: string }> = [];
  for (let i = 0; i < withQr.length; i += 8) {
    const batch = await Promise.all(
      withQr.slice(i, i + 8).map(async (item) => {
        try {
          return { item, data: await toDataUrl(String(item.qr)) };
        } catch {
          return null;
        }
      }),
    );
    batch.forEach((b) => b && loaded.push(b));
  }
  if (!loaded.length) return { placed: 0, skipped: items.length };

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const cols = 3;
  const rows = 4;
  const marginX = 12;
  const top = heading ? 20 : 12;
  const cellW = (210 - marginX * 2) / cols;
  const cellH = (297 - top - 10) / rows;
  const qrSize = Math.min(cellW, cellH) - 22;

  loaded.forEach(({ item, data }, index) => {
    const slot = index % (cols * rows);
    if (index > 0 && slot === 0) pdf.addPage();
    if (slot === 0 && heading) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(heading, 105, 12, { align: "center" });
    }
    const x = marginX + (slot % cols) * cellW;
    const y = top + Math.floor(slot / cols) * cellH;
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x + 2, y + 2, cellW - 4, cellH - 4, 2, 2);
    pdf.addImage(data, x + (cellW - qrSize) / 2, y + 5, qrSize, qrSize, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(item.title || "-", cellW - 8).slice(0, 2), x + cellW / 2, y + qrSize + 10, { align: "center" });
    if (item.subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(pdf.splitTextToSize(item.subtitle, cellW - 8).slice(0, 1), x + cellW / 2, y + qrSize + 18, { align: "center" });
      pdf.setTextColor(0, 0, 0);
    }
  });

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  return { placed: loaded.length, skipped: items.length - loaded.length };
};
