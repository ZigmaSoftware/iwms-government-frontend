import { jsPDF } from "jspdf";

import type { Staff } from "./types";
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  addressTextOf,
  loadQrImage,
  localBodyNameOf,
  safeFilename,
  text,
  wrapText,
} from "./staffQrPdf";

const drawStaffDetailsPage = async (context: CanvasRenderingContext2D, staff: Staff) => {
  context.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.fillStyle = "#123a63";
  context.fillRect(0, 0, PAGE_WIDTH, 22);

  context.textAlign = "center";
  context.fillStyle = "#123a63";
  context.font = "700 38px Arial, sans-serif";
  context.fillText("Staff Details", PAGE_WIDTH / 2, 78);
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

  if (staff.qr_code) {
    try {
      const qrImage = await loadQrImage(staff.qr_code);
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
  for (const line of wrapText(context, text(staff.employee_name), nameWidth).slice(0, 2)) {
    context.fillText(line, nameX, nameY);
    nameY += 40;
  }
  context.fillStyle = "#64748b";
  context.font = "22px Arial, sans-serif";
  context.fillText(text(staff.unique_id ?? staff.staff_unique_id), nameX, nameY + 12);

  let y = qrY + qrSize + 60;
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(82, y);
  context.lineTo(PAGE_WIDTH - 82, y);
  context.stroke();
  y += 45;

  const details: Array<[string, unknown]> = [
    ["Employee ID", staff.emp_id],
    ["Status", staff.active_status ? "Active" : "Inactive"],
    ["Staff Type", staff.staff_type_name ?? staff.user_type_name],
    ["Government Staff Type", staff.government_staff_type_name ?? staff.governmentusertype_name],
    ["Government Level", staff.governmentusertype_level],
    ["Staff Configuration", staff.staff_config_name],
    ["Date of Joining", staff.doj],
    ["Contact", staff.contact_mobile],
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
  const rowHeight = 70;
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
  y += rowHeight + 20;

  context.textAlign = "center";
  context.fillStyle = "#94a3b8";
  context.font = "16px Arial, sans-serif";
  context.fillText(`Generated on ${new Date().toLocaleString("en-IN")}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 40);
};

const createAllStaffPdf = async (staffList: Staff[]): Promise<jsPDF> => {
  if (staffList.length === 0) throw new Error("No staff to export.");

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF generation is not supported in this browser.");

  const documentPdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let index = 0; index < staffList.length; index += 1) {
    await drawStaffDetailsPage(context, staffList[index]);
    if (index > 0) documentPdf.addPage();
    documentPdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  }

  return documentPdf;
};

export const downloadAllStaffPdf = async (staffList: Staff[]): Promise<void> => {
  const documentPdf = await createAllStaffPdf(staffList);
  const suffix = staffList.length === 1 ? safeFilename(staffList[0].employee_name) : `${staffList.length}_staff`;
  documentPdf.save(`staff_${suffix}.pdf`);
};
