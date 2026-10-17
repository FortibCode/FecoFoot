import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

/**
 * Documents PDF officiels (EF-EXP-01, EF-SEL-05) : en-tête FECOFOOT aux couleurs du drapeau,
 * tableaux paginés. Polices standard PDF (Helvetica), accents français pris en charge.
 */

export type Column = { header: string; width: number; align?: "left" | "center" | "right" };

const GREEN = "#009543";
const YELLOW = "#FBDE4A";
const RED = "#DC241F";
const MARGIN = 40;
const LOGO_SIZE = 44;

// Écusson lu à l'exécution dans public/ (copié à côté du serveur en production) ; absent : en-tête sans logo.
let logo: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logo === undefined) {
    try {
      logo = readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "public", "logo-fecofoot.png"));
    } catch {
      logo = null;
    }
  }
  return logo;
}

export function newDocument(opts: { landscape?: boolean } = {}) {
  return new PDFDocument({ size: "A4", layout: opts.landscape ? "landscape" : "portrait", margin: MARGIN, bufferPages: true });
}

export function header(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  const width = doc.page.width - 2 * MARGIN;
  const third = width / 3;
  doc.rect(MARGIN, MARGIN, third, 4).fill(GREEN);
  doc.rect(MARGIN + third, MARGIN, third, 4).fill(YELLOW);
  doc.rect(MARGIN + 2 * third, MARGIN, third, 4).fill(RED);
  const img = logoBytes();
  const x = img ? MARGIN + LOGO_SIZE + 10 : MARGIN;
  const top = MARGIN + 12;
  if (img) doc.image(img, MARGIN, top, { width: LOGO_SIZE, height: LOGO_SIZE });
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(9).text("FÉDÉRATION CONGOLAISE DE FOOTBALL", x, top, { characterSpacing: 1 });
  doc.font("Helvetica-Bold").fontSize(16).text(title, x, doc.y + 4);
  if (subtitle) doc.font("Helvetica").fontSize(10).fillColor("#444").text(subtitle, x);
  // Le contenu reprend à la marge, sous le logo s'il est plus haut que le texte.
  doc.fillColor("#000").text("", MARGIN, Math.max(doc.y, img ? top + LOGO_SIZE : 0));
  doc.moveDown(1);
}

export function table(doc: PDFKit.PDFDocument, columns: Column[], rows: (string | number | null)[][]) {
  const rowHeight = 18;
  const bottom = () => doc.page.height - MARGIN - 30;
  const drawHeader = () => {
    let x = MARGIN;
    const y = doc.y;
    doc.rect(MARGIN, y, columns.reduce((a, c) => a + c.width, 0), rowHeight).fill("#0b1a14");
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8);
    for (const c of columns) {
      doc.text(c.header.toUpperCase(), x + 4, y + 5, { width: c.width - 8, align: c.align ?? "left", lineBreak: false });
      x += c.width;
    }
    doc.fillColor("#000").font("Helvetica").fontSize(9);
    doc.y = y + rowHeight;
  };
  drawHeader();
  rows.forEach((row, i) => {
    if (doc.y + rowHeight > bottom()) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.rect(MARGIN, y, columns.reduce((a, c) => a + c.width, 0), rowHeight).fill("#f3f3f1").fillColor("#000");
    let x = MARGIN;
    columns.forEach((c, j) => {
      doc.text(String(row[j] ?? ""), x + 4, y + 5, { width: c.width - 8, align: c.align ?? "left", lineBreak: false, ellipsis: true });
      x += c.width;
    });
    doc.y = y + rowHeight;
  });
  doc.x = MARGIN;
}

/** Pied de page (date d'édition, pagination) puis contenu binaire. */
export function finish(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const issued = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", dateStyle: "long", timeStyle: "short" }).format(new Date());
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#666")
      .text(`FECOFOOT — document édité le ${issued} — page ${i + 1}/${range.count}`, MARGIN, doc.page.height - MARGIN - 10, {
        width: doc.page.width - 2 * MARGIN,
        align: "center",
        lineBreak: false,
      });
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
