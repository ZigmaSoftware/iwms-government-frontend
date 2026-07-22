import { jsPDF } from "jspdf";

import type { Customer } from "./types";
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  loadQrImage,
  localBody,
  propertyAddress,
  propertySpecificDetails,
  safeFilename,
  text,
  wrapText,
} from "./customerQrPdf";

const drawCustomerDetailsPage = async (
  context: CanvasRenderingContext2D,
  customer: Customer,
) => {
  context.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#123a63";
  context.fillRect(0, 0, PAGE_WIDTH, 22);

  context.textAlign = "center";
  context.fillStyle = "#123a63";
  context.font = "700 38px Arial, sans-serif";
  context.fillText("Customer Details", PAGE_WIDTH / 2, 78);
  context.fillStyle = "#64748b";
  context.font = "20px Arial, sans-serif";
  context.fillText("Integrated Waste Management System", PAGE_WIDTH / 2, 112);

  // ── QR code box (top-left) ──
  const qrSize = 190;
  const qrX = 82;
  const qrY = 150;
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  context.strokeRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);

  if (customer.qr_code) {
    try {
      const qrImage = await loadQrImage(customer.qr_code);
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

  // ── Customer name + ID next to the QR ──
  const nameX = qrX + qrSize + 55;
  let nameY = qrY + 40;
  context.textAlign = "left";
  context.fillStyle = "#0f172a";
  context.font = "700 32px Arial, sans-serif";
  const nameWidth = PAGE_WIDTH - nameX - 82;
  for (const line of wrapText(context, text(customer.customer_name), nameWidth).slice(0, 2)) {
    context.fillText(line, nameX, nameY);
    nameY += 40;
  }
  context.fillStyle = "#64748b";
  context.font = "22px Arial, sans-serif";
  context.fillText(text(customer.unique_id), nameX, nameY + 12);

  let y = qrY + qrSize + 60;
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(82, y);
  context.lineTo(PAGE_WIDTH - 82, y);
  context.stroke();
  y += 45;

  const familyMembersSummary = Array.isArray(customer.family_members) && customer.family_members.length
    ? customer.family_members
        .map((member, index) => {
          const parts = [member.member_name, member.id_proof_type, member.id_no].filter(Boolean);
          return parts.length ? `${index + 1}. ${parts.join(" / ")}` : "";
        })
        .filter(Boolean)
        .join("; ")
    : "-";

  const wasteTypes = customer.waste_types?.map((item) => item.waste_type_name).filter(Boolean).join(", ");

  const details: Array<[string, unknown]> = [
    ["Contact", customer.contact_no],
    ["Username", customer.username],
    ["Email", customer.email],
    ["Status", customer.is_active ? "Active" : "Inactive"],
    ["Identification Proof", customer.id_proof_type],
    ["Identification Proof No.", customer.id_no],
    ["Property", customer.property_name],
    ["Sub-property", customer.sub_property_name],
    ...propertySpecificDetails(customer),
    ["State", customer.state_name],
    ["District", customer.district_name],
    ["Area Type", customer.area_type_name],
    ["Bulk Waste Generator", customer.is_bulkwaste_generator ? "Yes" : "No"],
    ["Water Consumption (L/day)", customer.water_consumption_lpd],
    ["Waste Collection (kg/day)", customer.waste_collection_kg_per_day],
    ["Member Count", customer.member_count],
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
    ["Property Address", propertyAddress(customer)],
    ["Local Body", `${localBody(customer)}${customer.location_level ? ` (${customer.location_level})` : ""}`],
    ["Waste Types", wasteTypes],
    ["Coordinates", customer.latitude || customer.longitude ? `${text(customer.latitude)}, ${text(customer.longitude)}` : "-"],
    ["Family Members ID Proof", familyMembersSummary],
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

const createAllCustomersPdf = async (customers: Customer[]): Promise<jsPDF> => {
  if (customers.length === 0) throw new Error("No customers to export.");

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF generation is not supported in this browser.");

  const documentPdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let index = 0; index < customers.length; index += 1) {
    await drawCustomerDetailsPage(context, customers[index]);
    if (index > 0) documentPdf.addPage();
    documentPdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  }

  return documentPdf;
};

export const downloadAllCustomersPdf = async (customers: Customer[]): Promise<void> => {
  const documentPdf = await createAllCustomersPdf(customers);
  const suffix = customers.length === 1 ? safeFilename(customers[0].customer_name) : `${customers.length}_customers`;
  documentPdf.save(`customers_${suffix}.pdf`);
};
