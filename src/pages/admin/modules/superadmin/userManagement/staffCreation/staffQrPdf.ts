import { jsPDF } from "jspdf";

import type { Staff, StaffAddress } from "./types";

export const PAGE_WIDTH = 1240;
export const PAGE_HEIGHT = 1754;

export const text = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export const loadQrImage = async (source: string): Promise<HTMLImageElement> => {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to load the staff QR code.");

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
  value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "staff";

export const addressTextOf = (
  staff: Staff,
  prefix: "present" | "permanent",
): string => {
  const rawAddress: unknown = staff[`${prefix}_address`];
  let address: StaffAddress = {};

  if (rawAddress && typeof rawAddress === "object") {
    address = rawAddress as StaffAddress;
  } else if (typeof rawAddress === "string" && rawAddress.trim()) {
    try {
      const parsed = JSON.parse(rawAddress);
      if (parsed && typeof parsed === "object") address = parsed as StaffAddress;
    } catch {
      return rawAddress.trim();
    }
  }

  return [
    address.building_no ?? staff[`${prefix}_building_no`],
    address.street ?? staff[`${prefix}_street`],
    address.area ?? staff[`${prefix}_area`],
    address.city ?? staff[`${prefix}_city`],
    address.district ?? staff[`${prefix}_district`],
    address.state ?? staff[`${prefix}_state`],
    address.country ?? staff[`${prefix}_country`],
    address.pincode ?? staff[`${prefix}_pincode`],
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
};

export const localBodyNameOf = (staff: Staff): unknown =>
  staff.local_body_name ??
  staff.corporation_name ??
  staff.municipality_name ??
  staff.town_panchayat_name ??
  staff.panchayat_union_name ??
  staff.panchayat_name;

const createStaffQrPdf = async (staff: Staff): Promise<jsPDF> => {
  if (!staff.qr_code) throw new Error("QR code is not available for this staff member.");

  const qrImage = await loadQrImage(staff.qr_code);
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
  context.fillText("Staff QR Details", PAGE_WIDTH / 2, 82);
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
  for (const line of wrapText(context, text(staff.employee_name), 620).slice(0, 2)) {
    context.fillText(line, summaryX, summaryY);
    summaryY += 44;
  }
  const summary: Array<[string, unknown]> = [
    ["Zigma ID", staff.unique_id ?? staff.staff_unique_id],
    ["Employee ID", staff.emp_id],
    ["Status", staff.active_status ? "Active" : "Inactive"],
    ["Contact", staff.contact_mobile],
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
    ["Staff Type", staff.staff_type_name ?? staff.user_type_name],
    ["Government Staff Type", staff.government_staff_type_name ?? staff.governmentusertype_name],
    ["Government Level", staff.governmentusertype_level],
    ["Staff Configuration", staff.staff_config_name],
    ["Date of Joining", staff.doj],
    ["Email", staff.contact_email ?? staff.office_email],
    ["Username", staff.username],
    ["Login Enabled", staff.login_enabled ? "Yes" : "No"],
    ["Staff Head", staff.staff_head],
    ["Gender", staff.gender],
    ["Date of Birth", staff.dob],
    ["Age", staff.age],
    ["Blood Group", staff.blood_group],
    ["Marital Status", staff.marital_status],
    ["Physically Challenged", staff.physically_challenged],
    ["State", staff.state_name],
    ["District", staff.district_name],
    ["Area Type", staff.area_type_name],
    ["Local Body", localBodyNameOf(staff)],
    ["Present Address", addressTextOf(staff, "present")],
    ["Permanent Address", addressTextOf(staff, "permanent")],
    ["Driving Licence", staff.driving_licence_no],
    ["Licence Expiry", staff.driving_licence_expiry_date],
    ["Driving Experience", staff.driving_experience_years],
    ["Created At", staff.created_at],
    ["Updated At", staff.updated_at],
  ];

  const left = 82;
  const columnWidth = 550;
  const rowHeight = 64;
  let y = 625;
  details.forEach(([label, value], index) => {
    const column = index % 2;
    const x = left + column * columnWidth;
    if (index > 0 && column === 0) y += rowHeight;
    context.fillStyle = "#64748b";
    context.font = "700 16px Arial, sans-serif";
    context.fillText(label.toUpperCase(), x, y);
    context.fillStyle = "#0f172a";
    context.font = "19px Arial, sans-serif";
    const valueLines = wrapText(context, text(value), columnWidth - 45).slice(0, 2);
    valueLines.forEach((line, lineIndex) => context.fillText(line, x, y + 25 + lineIndex * 21));
  });
  y += rowHeight;

  context.textAlign = "center";
  context.fillStyle = "#94a3b8";
  context.font = "18px Arial, sans-serif";
  context.fillText(`Generated on ${new Date().toLocaleString("en-IN")}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 52);

  const documentPdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  documentPdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  return documentPdf;
};

export const createStaffQrPdfBlob = async (staff: Staff): Promise<Blob> => {
  const documentPdf = await createStaffQrPdf(staff);
  return documentPdf.output("blob");
};

export const downloadStaffQrPdf = async (staff: Staff): Promise<void> => {
  const documentPdf = await createStaffQrPdf(staff);
  const idLabel = String(staff.unique_id ?? staff.staff_unique_id ?? "");
  documentPdf.save(`${safeFilename(staff.employee_name)}_${safeFilename(idLabel)}_QR.pdf`);
};
