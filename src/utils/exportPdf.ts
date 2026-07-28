import { jsPDF } from "jspdf";
import QRCode from "qr.js/lib/QRCode";
import ErrorCorrectLevel from "qr.js/lib/ErrorCorrectLevel";

export type PdfColumn = {
  key: string;
  label: string;
};

const display = (value: unknown) =>
  value === null || value === undefined || String(value).trim() === ""
    ? "-"
    : String(value);

export const downloadRecordsPdf = ({
  title,
  filename,
  rows,
  columns,
}: {
  title: string;
  filename: string;
  rows: Record<string, unknown>[];
  columns: PdfColumn[];
}) => {
  if (rows.length === 0) throw new Error("No records to export.");

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const columnWidth = usableWidth / columns.length;
  const rowHeight = 8;
  let y = 18;

  pdf.setLineWidth(0.1);

  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(title, margin, 10);
    pdf.setFontSize(7);
    pdf.setFillColor(30, 64, 175);
    pdf.setTextColor(255, 255, 255);
    columns.forEach((column, index) => {
      const x = margin + index * columnWidth;
      pdf.setFillColor(30, 64, 175);
      pdf.rect(x, y, columnWidth, rowHeight, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.text(column.label, x + 1.5, y + 5, { maxWidth: columnWidth - 3 });
    });
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "normal");
    y += rowHeight;
  };

  drawHeader();
  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > pdf.internal.pageSize.getHeight() - 10) {
      pdf.addPage();
      y = 18;
      drawHeader();
    }
    columns.forEach((column, index) => {
      const x = margin + index * columnWidth;
      const fill = rowIndex % 2 === 0 ? 248 : 255;
      pdf.setFillColor(fill, fill, fill);
      pdf.rect(x, y, columnWidth, rowHeight, "F");
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(x, y, columnWidth, rowHeight, "S");
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.text(display(row[column.key]), x + 1.5, y + 5, {
        maxWidth: columnWidth - 3,
      });
    });
    y += rowHeight;
  });

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
};

export const drawQrCode = (pdf: jsPDF, value: string, x: number, y: number, size: number) => {
  const qr = new QRCode(-1, ErrorCorrectLevel.M);
  qr.addData(value);
  qr.make();
  const cellSize = size / qr.modules.length;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, size, size, "F");
  pdf.setFillColor(0, 0, 0);
  qr.modules.forEach((row, rowIndex) => row.forEach((filled, columnIndex) => {
    if (filled) {
      pdf.rect(
        x + columnIndex * cellSize,
        y + rowIndex * cellSize,
        cellSize + 0.02,
        cellSize + 0.02,
        "F",
      );
    }
  }));
};
