import { jsPDF } from "jspdf";

import type { Bin } from "./types";
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  loadQrImage,
  localBodyName,
  localBodyType,
  safeFilename,
  text,
  wrapText,
} from "./binQrPdf";

const wasteTypeLabel = (bin: Bin): string =>
  bin.waste_type_name ?? bin.wastetype_name ?? bin.waste_type ?? "-";

const drawBinDetailsPage = async (context: CanvasRenderingContext2D, bin: Bin) => {
  context.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#123a63";
  context.fillRect(0, 0, PAGE_WIDTH, 22);

  context.textAlign = "center";
  context.fillStyle = "#123a63";
  context.font = "700 38px Arial, sans-serif";
  context.fillText("Bin Details", PAGE_WIDTH / 2, 78);
  context.fillStyle = "#64748b";
  context.font = "20px Arial, sans-serif";
  context.fillText("Integrated Waste Management System", PAGE_WIDTH / 2, 112);

  const qrSize = 190;
  const qrX = 82;
  const qrY = 150;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  context.strokeRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);

  if (bin.bin_qr) {
    try {
      const qrImage = await loadQrImage(bin.bin_qr);
      context.imageSmoothingEnabled = false;
      context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      context.imageSmoothingEnabled = true;
    } catch {
      context.textAlign = "center";
      context.fillStyle = "#94a3b8";
      context.font = "16px Arial, sans-serif";
      context.fillText("QR unavailable", qrX + qrSize / 2, qrY + qrSize / 2);
      context.textAlign = "left";
    }
  } else {
    context.textAlign = "center";
    context.fillStyle = "#94a3b8";
    context.font = "16px Arial, sans-serif";
    context.fillText("No QR", qrX + qrSize / 2, qrY + qrSize / 2);
    context.textAlign = "left";
  }

  const nameX = qrX + qrSize + 55;
  let nameY = qrY + 40;
  context.textAlign = "left";
  context.fillStyle = "#0f172a";
  context.font = "700 32px Arial, sans-serif";
  const nameWidth = PAGE_WIDTH - nameX - 82;
  for (const line of wrapText(context, text(bin.bin_name), nameWidth).slice(0, 2)) {
    context.fillText(line, nameX, nameY);
    nameY += 40;
  }
  context.fillStyle = "#64748b";
  context.font = "22px Arial, sans-serif";
  context.fillText(text(bin.unique_id), nameX, nameY + 12);

  let y = qrY + qrSize + 60;
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(82, y);
  context.lineTo(PAGE_WIDTH - 82, y);
  context.stroke();
  y += 45;

  const details: Array<[string, unknown]> = [
    ["Capacity", bin.bin_capacity],
    ["Status", bin.is_active ? "Active" : "Inactive"],
    ["State", bin.state_name],
    ["District", bin.district_name],
    ["Area Type", bin.area_type_name],
    ["Local Body Type", localBodyType(bin)],
    ["Local Body", localBodyName(bin)],
    ["Ward", bin.ward_name],
    ["Collection Point", bin.collection_point_name],
    ["Waste Type", wasteTypeLabel(bin)],
    ["Bin Type", bin.bin_type],
  ];

  const left = 82;
  const columnWidth = 550;
  const rowHeight = 82;
  details.forEach(([label, value], index) => {
    const column = index % 2;
    const x = left + column * columnWidth;
    if (index > 0 && column === 0) y += rowHeight;
    context.fillStyle = "#64748b";
    context.font = "700 17px Arial, sans-serif";
    context.fillText(label.toUpperCase(), x, y);
    context.fillStyle = "#0f172a";
    context.font = "21px Arial, sans-serif";
    const valueLines = wrapText(context, text(value), columnWidth - 45).slice(0, 2);
    valueLines.forEach((line, lineIndex) => context.fillText(line, x, y + 29 + lineIndex * 25));
  });
  y += rowHeight + 20;

  const fullWidthDetails: Array<[string, unknown]> = [
    ["Coordinates", bin.latitude || bin.longitude ? `${text(bin.latitude)}, ${text(bin.longitude)}` : "-"],
  ];

  for (const [label, value] of fullWidthDetails) {
    context.fillStyle = "#64748b";
    context.font = "700 17px Arial, sans-serif";
    context.fillText(label.toUpperCase(), left, y);
    context.fillStyle = "#0f172a";
    context.font = "21px Arial, sans-serif";
    const lines = wrapText(context, text(value), PAGE_WIDTH - left * 2).slice(0, 3);
    lines.forEach((line, lineIndex) => context.fillText(line, left, y + 29 + lineIndex * 26));
    y += 80 + Math.max(0, lines.length - 1) * 22;
  }

  context.textAlign = "center";
  context.fillStyle = "#94a3b8";
  context.font = "16px Arial, sans-serif";
  context.fillText(`Generated on ${new Date().toLocaleString("en-IN")}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 40);
};

const createAllBinsPdf = async (bins: Bin[]): Promise<jsPDF> => {
  if (bins.length === 0) throw new Error("No bins to export.");

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF generation is not supported in this browser.");

  const documentPdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let index = 0; index < bins.length; index += 1) {
    await drawBinDetailsPage(context, bins[index]);
    if (index > 0) documentPdf.addPage();
    documentPdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  }

  return documentPdf;
};

export const downloadAllBinsPdf = async (bins: Bin[]): Promise<void> => {
  const documentPdf = await createAllBinsPdf(bins);
  const suffix = bins.length === 1 ? safeFilename(bins[0].bin_name) : `${bins.length}_bins`;
  documentPdf.save(`bins_${suffix}.pdf`);
};
