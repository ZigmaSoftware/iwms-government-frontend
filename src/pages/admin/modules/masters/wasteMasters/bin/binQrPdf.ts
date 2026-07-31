import { jsPDF } from "jspdf";

import type { Bin } from "./types";

export const PAGE_WIDTH = 1240;
export const PAGE_HEIGHT = 1754;

export const text = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export const loadQrImage = async (source: string): Promise<HTMLImageElement> => {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to load the bin QR code.");

  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const wrapText = (
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string[] => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["-"];

  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
};

export const safeFilename = (value: string): string =>
  value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "bin";

const wasteTypeLabel = (bin: Bin): string =>
  bin.waste_type_name ?? bin.wastetype_name ?? bin.waste_type ?? "-";

export const localBodyType = (bin: Bin): string => {
  if (bin.corporation_name) return "Corporation";
  if (bin.municipality_name) return "Municipality";
  if (bin.town_panchayat_name) return "Town Panchayat";
  if (bin.panchayat_union_name) return "Panchayat Union";
  if (bin.panchayat_name || bin.panchayat) return "Panchayat";
  return "-";
};

export const localBodyName = (bin: Bin): string =>
  bin.corporation_name ||
  bin.municipality_name ||
  bin.town_panchayat_name ||
  bin.panchayat_union_name ||
  bin.panchayat_name ||
  bin.panchayat ||
  "-";

const createBinQrPdf = async (bin: Bin): Promise<jsPDF> => {
  if (!bin.bin_qr) throw new Error("QR code is not available for this bin.");

  const qrImage = await loadQrImage(bin.bin_qr);
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF generation is not supported in this browser.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#123a63";
  context.fillRect(0, 0, PAGE_WIDTH, 22);

  context.textAlign = "center";
  context.fillStyle = "#123a63";
  context.font = "700 42px Arial, sans-serif";
  context.fillText("Bin QR Details", PAGE_WIDTH / 2, 82);
  context.fillStyle = "#64748b";
  context.font = "22px Arial, sans-serif";
  context.fillText("Integrated Waste Management System", PAGE_WIDTH / 2, 118);

  const qrSize = 350;
  const qrX = 92;
  const qrY = 165;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 3;
  context.fillRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
  context.strokeRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
  context.imageSmoothingEnabled = false;
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  context.imageSmoothingEnabled = true;

  const summaryX = 520;
  let summaryY = 230;
  context.textAlign = "left";
  context.fillStyle = "#0f172a";
  context.font = "700 36px Arial, sans-serif";
  for (const line of wrapText(context, text(bin.bin_name), 620).slice(0, 2)) {
    context.fillText(line, summaryX, summaryY);
    summaryY += 44;
  }
  const summary: Array<[string, unknown]> = [
    ["Bin ID", bin.unique_id],
    ["Capacity", bin.bin_capacity],
    ["Status", bin.is_active ? "Active" : "Inactive"],
    ["Waste Type", wasteTypeLabel(bin)],
  ];
  summaryY += 18;
  for (const [label, value] of summary) {
    context.fillStyle = "#64748b";
    context.font = "700 20px Arial, sans-serif";
    context.fillText(`${label}:`, summaryX, summaryY);
    context.fillStyle = "#1e293b";
    context.font = "22px Arial, sans-serif";
    context.fillText(text(value), summaryX + 270, summaryY);
    summaryY += 43;
  }

  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(74, 570);
  context.lineTo(PAGE_WIDTH - 74, 570);
  context.stroke();

  const details: Array<[string, unknown]> = [
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
  let y = 625;
  details.forEach(([label, value], index) => {
    const column = index % 2;
    const x = left + column * columnWidth;
    if (index > 0 && column === 0) y += rowHeight;
    context.fillStyle = "#64748b";
    context.font = "700 18px Arial, sans-serif";
    context.fillText(label.toUpperCase(), x, y);
    context.fillStyle = "#0f172a";
    context.font = "23px Arial, sans-serif";
    const valueLines = wrapText(context, text(value), columnWidth - 45).slice(0, 2);
    valueLines.forEach((line, lineIndex) => context.fillText(line, x, y + 31 + lineIndex * 27));
  });

  y += 105;
  const fullWidthDetails: Array<[string, unknown]> = [
    ["Coordinates", bin.latitude || bin.longitude ? `${text(bin.latitude)}, ${text(bin.longitude)}` : "-"],
  ];

  for (const [label, value] of fullWidthDetails) {
    context.fillStyle = "#64748b";
    context.font = "700 18px Arial, sans-serif";
    context.fillText(label.toUpperCase(), left, y);
    context.fillStyle = "#0f172a";
    context.font = "23px Arial, sans-serif";
    const lines = wrapText(context, text(value), PAGE_WIDTH - left * 2).slice(0, 2);
    lines.forEach((line, lineIndex) => context.fillText(line, left, y + 31 + lineIndex * 28));
    y += 88 + Math.max(0, lines.length - 1) * 22;
  }

  context.textAlign = "center";
  context.fillStyle = "#94a3b8";
  context.font = "18px Arial, sans-serif";
  context.fillText(`Generated on ${new Date().toLocaleString("en-IN")}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 52);

  const documentPdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  documentPdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  return documentPdf;
};

export const createBinQrPdfBlob = async (bin: Bin): Promise<Blob> => {
  const documentPdf = await createBinQrPdf(bin);
  return documentPdf.output("blob");
};

export const downloadBinQrPdf = async (bin: Bin): Promise<void> => {
  const documentPdf = await createBinQrPdf(bin);
  documentPdf.save(`${safeFilename(bin.bin_name)}_${safeFilename(bin.unique_id)}_QR.pdf`);
};
