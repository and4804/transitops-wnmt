import PDFDocument from "pdfkit";
import type { Response } from "express";

export interface PdfColumn {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

const MARGIN = 40;
const PAGE_WIDTH = 612; // US Letter, points

export function newReportDoc(res: Response, title: string, subtitle: string, filename: string) {
  const doc = new PDFDocument({ margin: MARGIN, size: "LETTER" });
  res.status(200);
  res.header("Content-Type", "application/pdf");
  res.header("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(18).fillColor("#161d2e").text("TransitOps", MARGIN, MARGIN);
  doc.fontSize(11).fillColor("#5b8cff").text(title, MARGIN, MARGIN + 24);
  doc.fontSize(9).fillColor("#666").text(subtitle, MARGIN, MARGIN + 42);
  doc
    .fontSize(8)
    .fillColor("#999")
    .text(`Generated ${new Date().toLocaleString()}`, MARGIN, MARGIN + 56);
  doc
    .moveTo(MARGIN, MARGIN + 74)
    .lineTo(PAGE_WIDTH - MARGIN, MARGIN + 74)
    .strokeColor("#e2e6f0")
    .stroke();
  doc.y = MARGIN + 86;

  return doc;
}

export function drawTable(doc: PDFKit.PDFDocument, columns: PdfColumn[], rows: Record<string, string | number>[]) {
  const rowHeight = 20;
  const tableLeft = MARGIN;
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  function drawHeader() {
    let x = tableLeft;
    doc.fontSize(8).fillColor("#fff");
    doc.rect(tableLeft, doc.y, tableWidth, rowHeight).fill("#5b8cff");
    const y = doc.y + 6;
    for (const col of columns) {
      doc.fillColor("#fff").text(col.header, x + 4, y, { width: col.width - 8, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y += rowHeight;
  }

  function ensureSpace() {
    if (doc.y + rowHeight > doc.page.height - MARGIN) {
      doc.addPage();
      doc.y = MARGIN;
      drawHeader();
    }
  }

  drawHeader();

  rows.forEach((row, i) => {
    ensureSpace();
    const y = doc.y;
    if (i % 2 === 1) {
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#f5f7fb");
    }
    let x = tableLeft;
    for (const col of columns) {
      doc
        .fontSize(8)
        .fillColor("#1a2033")
        .text(String(row[col.key] ?? ""), x + 4, y + 6, { width: col.width - 8, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y = y + rowHeight;
  });

  doc
    .moveTo(tableLeft, doc.y)
    .lineTo(tableLeft + tableWidth, doc.y)
    .strokeColor("#e2e6f0")
    .stroke();
  doc.y += 4;
}

export function drawTotalsRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#161d2e").text(`${label}: ${value}`, MARGIN);
}
