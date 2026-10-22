import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatFcfa } from "@/lib/format";

const MM = 72 / 25.4;
const GREEN = "#009543";
const YELLOW = "#FBDE4A";
const RED = "#DC241F";
const INK = "#0B1F17";
const GREY = "#6B7280";
const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export type TicketPdfData = {
  number: string;
  holderName: string;
  category: string;
  gate: string;
  price: number;
  status: string;
  event: string;
  kickoffAt: Date;
  venue: string;
  orderRef: string;
  qrUrl: string;
};

function logo(): Buffer | null {
  try {
    return readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "public", "logo-fecofoot.png"));
  } catch {
    return null;
  }
}

/** « Compétition : Équipe A – Équipe B (précision) » → morceaux affichés. */
function parseTitle(title: string) {
  const i = title.indexOf(" : ");
  const competition = i >= 0 ? title.slice(0, i) : null;
  const rest = i >= 0 ? title.slice(i + 3) : title;
  const detail = rest.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
  const match = rest.replace(/\s*\([^)]+\)\s*$/, "");
  return { competition, detail, match: match.replace(/\s+[–-]\s+/, "  vs  ") };
}

/**
 * Billet à imprimer chez soi (format A4, comme les billets électroniques des grandes rencontres) :
 * en haut le billet avec son talon et le QR code d'entrée, en dessous les consignes ; un billet par page.
 * Le même QR code que sur le téléphone : il n'est valable que pour une seule entrée.
 */
export async function ticketsPdf(list: TicketPdfData[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: list.length === 1 ? `Billet ${list[0].number}` : "Billets FECOFOOT", Author: "FECOFOOT" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const crest = logo();

  for (const [n, t] of list.entries()) {
    if (n > 0) doc.addPage();
    const { competition, detail, match } = parseTitle(t.event);
    const x = 12 * MM;
    const y = 14 * MM;
    const w = 186 * MM;
    const h = 80 * MM;
    const stubW = 52 * MM;
    const mainW = w - stubW;

    // Cadre du billet
    doc.roundedRect(x, y, w, h, 4 * MM).lineWidth(0.8).strokeColor("#D1D5DB").stroke();
    // En-tête
    doc.save().roundedRect(x, y, mainW, 15 * MM, 4 * MM).clip();
    doc.rect(x, y, mainW, 15 * MM).fill(INK);
    doc.restore();
    if (crest) doc.image(crest, x + 4 * MM, y + 2.5 * MM, { height: 10 * MM });
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text("FECOFOOT", x + 16 * MM, y + 4 * MM, { lineBreak: false });
    doc.font("Helvetica").fontSize(6).fillColor("#CBD5D0").text("FÉDÉRATION CONGOLAISE DE FOOTBALL", x + 16 * MM, y + 9 * MM, { lineBreak: false, characterSpacing: 0.8 });
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF").text("BILLET D'ENTRÉE", x + mainW - 40 * MM, y + 6 * MM, { width: 36 * MM, align: "right", characterSpacing: 1.2 });
    const band = (mainW / 3);
    doc.rect(x, y + 15 * MM, band, 1.6 * MM).fill(GREEN);
    doc.rect(x + band, y + 15 * MM, band, 1.6 * MM).fill(YELLOW);
    doc.rect(x + 2 * band, y + 15 * MM, band, 1.6 * MM).fill(RED);

    // Rencontre
    let cy = y + 21 * MM;
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(7).text([competition ?? "Rencontre", detail].filter(Boolean).join(" · ").toUpperCase(), x + 6 * MM, cy, { width: mainW - 12 * MM, characterSpacing: 0.8 });
    cy += 4.5 * MM;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(match.toUpperCase(), x + 6 * MM, cy, { width: mainW - 12 * MM, lineBreak: false, ellipsis: true });
    cy += 10 * MM;
    doc.moveTo(x + 6 * MM, cy).lineTo(x + mainW - 6 * MM, cy).dash(2, { space: 2 }).strokeColor("#D1D5DB").stroke().undash();
    cy += 3 * MM;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(timeFmt.format(t.kickoffAt), x + 6 * MM, cy, { lineBreak: false });
    const day = dayFmt.format(t.kickoffAt);
    doc.font("Helvetica-Bold").fontSize(9).text(day.charAt(0).toUpperCase() + day.slice(1), x + 32 * MM, cy + 0.5 * MM, { width: mainW - 38 * MM });
    doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(t.venue, x + 32 * MM, cy + 5 * MM, { width: mainW - 38 * MM, lineBreak: false, ellipsis: true });
    cy += 11 * MM;
    doc.moveTo(x + 6 * MM, cy).lineTo(x + mainW - 6 * MM, cy).dash(2, { space: 2 }).strokeColor("#D1D5DB").stroke().undash();
    cy += 3 * MM;

    // Cases : porte, tribune, prix, numéro, titulaire, commande
    const cells: [string, string, number][] = [
      ["PORTE", t.gate, 1],
      ["TRIBUNE", t.category, 1],
      ["PRIX", t.price === 0 ? "Invitation" : formatFcfa(t.price).replace(/ | /g, " "), 1],
      ["N° DE BILLET", t.number, 1],
      ["TITULAIRE", t.holderName, 2],
      ["COMMANDE", t.orderRef, 2],
    ];
    const cw = (mainW - 12 * MM - 3 * 2 * MM) / 4;
    let col = 0;
    let row = 0;
    for (const [label, value, span] of cells) {
      if (col + span > 4) {
        col = 0;
        row++;
      }
      const bx = x + 6 * MM + col * (cw + 2 * MM);
      const by = cy + row * 11 * MM;
      const bw = cw * span + (span - 1) * 2 * MM;
      doc.roundedRect(bx, by, bw, 9.5 * MM, 1.5 * MM).fillAndStroke("#F9FAFB", "#E5E7EB");
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(5.5).text(label, bx + 2 * MM, by + 1.6 * MM, { characterSpacing: 0.8, lineBreak: false });
      // Une seule ligne : la taille s'adapte à la longueur (« Tribune d'honneur »…).
      doc.font("Helvetica-Bold").fontSize(9);
      const size = Math.max(6.5, Math.min(9, (9 * (bw - 4 * MM)) / Math.max(1, doc.widthOfString(value))));
      doc.fillColor(INK).fontSize(size).text(value, bx + 2 * MM, by + 4.6 * MM, { width: bw - 4 * MM, height: 4.5 * MM, lineBreak: false, ellipsis: true });
      col += span;
    }

    // Perforation et talon
    const px = x + mainW;
    doc.moveTo(px, y + 3 * MM).lineTo(px, y + h - 3 * MM).dash(3, { space: 3 }).lineWidth(1).strokeColor("#9CA3AF").stroke().undash();
    doc.circle(px, y, 3 * MM).fill("#FFFFFF");
    doc.circle(px, y + h, 3 * MM).fill("#FFFFFF");
    doc.font("Helvetica-Bold").fontSize(6).fillColor(GREY).text("CONTRÔLE D'ACCÈS", px, y + 8 * MM, { width: stubW, align: "center", characterSpacing: 1 });
    const qrSize = 36 * MM;
    if (t.status === "VALID") {
      const png = await QRCode.toBuffer(t.qrUrl, { type: "png", margin: 1, width: 600, errorCorrectionLevel: "M" });
      doc.image(png, px + (stubW - qrSize) / 2, y + 13 * MM, { width: qrSize });
    } else {
      doc.rect(px + (stubW - qrSize) / 2, y + 13 * MM, qrSize, qrSize).dash(2, { space: 2 }).strokeColor("#9CA3AF").stroke().undash();
      doc.font("Helvetica").fontSize(7).fillColor(GREY).text("QR code non valable", px, y + 13 * MM + qrSize / 2 - 2 * MM, { width: stubW, align: "center" });
    }
    doc.font("Courier-Bold").fontSize(10).fillColor(INK).text(t.number, px, y + 52 * MM, { width: stubW, align: "center" });
    doc.font("Helvetica").fontSize(7).fillColor(GREY).text(`Porte ${t.gate.replace(/^porte\s+/i, "")} · ${t.category}`, px + 3 * MM, y + 58 * MM, { width: stubW - 6 * MM, align: "center" });
    const label = t.status === "VALID" ? "VALIDE" : t.status === "USED" ? "UTILISÉ" : "NON VALABLE";
    doc.font("Helvetica-Bold").fontSize(8).fillColor(t.status === "VALID" ? GREEN : RED).text(label, px, y + 66 * MM, { width: stubW, align: "center", characterSpacing: 1 });

    // Consignes (sous le billet)
    let iy = y + h + 12 * MM;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text("Avant le match", x, iy);
    iy += 7 * MM;
    const rules = [
      "Présentez ce billet imprimé ou sur votre téléphone : le QR code est scanné à l'entrée.",
      `Entrée par la ${t.gate.replace(/^Porte/, "porte")} (${t.category}). Arrivez en avance : les contrôles prennent du temps.`,
      "Billet nominatif et personnel : une pièce d'identité au nom du titulaire peut être demandée.",
      "Le QR code n'est valable que pour une seule entrée. Une copie ou une capture partagée ne vous fera pas entrer si le billet a déjà été scanné.",
      "Billet ni repris ni échangé, sauf annulation de la rencontre. Toute revente est interdite.",
    ];
    doc.font("Helvetica").fontSize(9).fillColor("#374151");
    for (const r of rules) {
      doc.circle(x + 1.2 * MM, iy + 1.6 * MM, 0.8 * MM).fill(GREEN);
      doc.fillColor("#374151").text(r, x + 4 * MM, iy, { width: w - 4 * MM });
      iy = doc.y + 2.2 * MM;
    }
    doc.font("Helvetica").fontSize(7).fillColor(GREY).text(`Billet ${t.number} · commande ${t.orderRef} · FECOFOOT — Fédération Congolaise de Football`, x, 285 * MM, { width: w, align: "center" });
  }
  doc.end();
  return done;
}
