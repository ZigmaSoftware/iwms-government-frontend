import { jsPDF } from "jspdf";

import type { Customer } from "./types";

export const PAGE_WIDTH = 1240;
export const PAGE_HEIGHT = 1754;

export const text = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export const localBody = (customer: Customer): string =>
  customer.corporation_name ||
  customer.municipality_name ||
  customer.town_panchayat_name ||
  customer.panchayat_union_name ||
  customer.panchayat_name ||
  customer.location_name ||
  "-";

export const loadQrImage = async (source: string): Promise<HTMLImageElement> => {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to load the customer QR code.");

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
  value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "customer";

export type PropertyKind = "individual" | "apartment" | "villa" | "industry" | "other";

export const propertyKind = (customer: Customer): PropertyKind => {
  const name = `${customer.property_name ?? ""} ${customer.sub_property_name ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (name.includes("apartment")) return "apartment";
  if (name.includes("villa")) return "villa";
  if (name.includes("industry") || name.includes("industrial")) return "industry";
  if (name.includes("individual") || name.includes("house")) return "individual";
  return "other";
};

export const propertySpecificDetails = (customer: Customer): Array<[string, unknown]> => {
  switch (propertyKind(customer)) {
    case "apartment":
      return [
        ["Apartment Name", customer.apartment_name],
        ["Block No", customer.block_no],
        ["Flat No", customer.flat_no],
        ["Apartment Sq. Ft.", customer.sqft],
      ];
    case "villa":
      return [
        ["Villa No", customer.villa_no],
        ["Street", customer.street],
        ["Area", customer.area],
        ["Villa Sq. Ft.", customer.sqft],
      ];
    case "industry":
      return [
        ["Industry Name", customer.industry_name],
        ["Industry Type", customer.industry_type],
        ["Industrial Area", customer.area],
        ["Property Sq. Ft.", customer.sqft],
      ];
    case "individual":
      return [
        ["Building No", customer.building_no],
        ["Street", customer.street],
        ["Area", customer.area],
        ["House Sq. Ft.", customer.sqft],
      ];
    default: {
      const availableAddressFields: Array<[string, unknown]> = [
        ["Building No", customer.building_no],
        ["Street", customer.street],
        ["Area", customer.area],
        ["Property Sq. Ft.", customer.sqft],
      ];
      return availableAddressFields.filter(
        ([, value]) => value !== null && value !== undefined && String(value).trim(),
      );
    }
  }
};

export const propertyAddress = (customer: Customer): string => {
  const partsByKind: Record<PropertyKind, unknown[]> = {
    apartment: [customer.apartment_name, customer.block_no, customer.flat_no, customer.pincode],
    villa: [customer.villa_no, customer.street, customer.area, customer.pincode],
    industry: [customer.industry_name, customer.industry_type, customer.area, customer.pincode],
    individual: [customer.building_no, customer.street, customer.area, customer.pincode],
    other: [customer.building_no, customer.street, customer.area, customer.pincode],
  };

  return partsByKind[propertyKind(customer)]
    .filter((part) => part !== null && part !== undefined && String(part).trim())
    .join(", ");
};

const createCustomerQrPdf = async (customer: Customer): Promise<jsPDF> => {
  if (!customer.qr_code) throw new Error("QR code is not available for this customer.");

  const qrImage = await loadQrImage(customer.qr_code);
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
  context.fillText("Customer QR Details", PAGE_WIDTH / 2, 82);
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
  for (const line of wrapText(context, text(customer.customer_name), 620).slice(0, 2)) {
    context.fillText(line, summaryX, summaryY);
    summaryY += 44;
  }
  const summary = [
    ["Customer ID", customer.unique_id],
    ["Contact", customer.contact_no],
    ["Status", customer.is_active ? "Active" : "Inactive"],
    ["Bulk Waste Generator", customer.is_bulkwaste_generator ? "Yes" : "No"],
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
    ["Username", customer.username],
    ["Email", customer.email],
    ["Identification Proof", customer.id_proof_type],
    ["Identification Proof No.", customer.id_no],
    ["Bulk Waste Generator", customer.is_bulkwaste_generator ? "Yes" : "No"],
    ["Property", customer.property_name],
    ["Sub-property", customer.sub_property_name],
    ...propertySpecificDetails(customer),
    ["State", customer.state_name],
    ["District", customer.district_name],
    ["Area Type", customer.area_type_name],
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
  const wasteTypes = customer.waste_types?.map((item) => item.waste_type_name).filter(Boolean).join(", ");
  const fullWidthDetails: Array<[string, unknown]> = [
    ["Property Address", propertyAddress(customer)],
    ["Local Body", `${localBody(customer)}${customer.location_level ? ` (${customer.location_level})` : ""}`],
    ["Waste Types", wasteTypes],
    ["Coordinates", customer.latitude || customer.longitude ? `${text(customer.latitude)}, ${text(customer.longitude)}` : "-"],
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

export const createCustomerQrPdfBlob = async (customer: Customer): Promise<Blob> => {
  const documentPdf = await createCustomerQrPdf(customer);
  return documentPdf.output("blob");
};

export const downloadCustomerQrPdf = async (customer: Customer): Promise<void> => {
  const documentPdf = await createCustomerQrPdf(customer);
  documentPdf.save(`${safeFilename(customer.customer_name)}_${safeFilename(customer.unique_id)}_QR.pdf`);
};
