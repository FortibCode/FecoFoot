import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatFcfa } from "@/lib/format";
import { parseEventTitle } from "@/lib/ticketing";

const MM = 72 / 25.4;
// Format d'un billet de stade imprimé : 203 × 82 mm (8 × 3¼ pouces), talon de 50 mm.
const W = 203 * MM;
const H = 82 * MM;
const STUB = 50 * MM;
const BAND = 7 * MM;
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

/** Texte sur une ligne, réduit si besoin pour tenir dans la largeur (jamais en dessous de `min`). */
function fit(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, size: number, min: number) {
  doc.fontSize(size);
  const s = Math.max(min, Math.min(size, (size * width) / Math.max(1, doc.widthOfString(text))));
  doc.fontSize(s).text(text, x, y, { width, lineBreak: false, ellipsis: true });
}

/**
 * Billets en PDF au format d'un billet de match imprimé (203 × 82 mm, un billet par page) :
 * bande aux couleurs nationales, rencontre, date, stade, porte, tribune, prix, titulaire,
 * puis talon détachable avec le QR code d'entrée — le même que sur le téléphone, valable une seule fois.
 */
export async function ticketsPdf(list: TicketPdfData[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: list.length === 1 ? `Billet ${list[0].number}` : "Billets FECOFOOT", Author: "FECOFOOT" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const crest = logo();

  for (const [n, t] of list.entries()) {
    if (n > 0) doc.addPage({ size: [W, H], margin: 0 });
    const { competition, detail, match, teams } = parseEventTitle(t.event);
    const mx = BAND + 5 * MM;
    const mw = W - STUB - mx - 5 * MM;

    // Bande latérale aux couleurs nationales
    doc.rect(0, 0, BAND, H / 3).fill(GREEN);
    doc.rect(0, H / 3, BAND, H / 3).fill(YELLOW);
    doc.rect(0, (2 * H) / 3, BAND, H / 3).fill(RED);

    // En-tête
    if (crest) doc.image(crest, mx, 4 * MM, { height: 8 * MM });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text("FECOFOOT", mx + 10 * MM, 5.2 * MM, { lineBreak: false });
    doc.font("Helvetica").fontSize(5).fillColor(GREY).text("FÉDÉRATION CONGOLAISE DE FOOTBALL", mx + 10 * MM, 9.3 * MM, { lineBreak: false, characterSpacing: 0.5 });
    doc.roundedRect(mx + mw - 26 * MM, 5 * MM, 26 * MM, 5 * MM, 1 * MM).lineWidth(0.5).strokeColor("#D1D5DB").stroke();
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor(GREY).text("BILLET D'ENTRÉE", mx + mw - 26 * MM, 6.6 * MM, { width: 26 * MM, align: "center", characterSpacing: 0.8 });

    // Rencontre
    doc.fillColor(GREEN).font("Helvetica-Bold");
    fit(doc, [competition ?? "Rencontre", detail].filter(Boolean).join(" · ").toUpperCase(), mx, 16 * MM, mw, 6.5, 5);
    doc.fillColor(INK).font("Helvetica-Bold");
    fit(doc, (teams ? `${teams[0]}  vs  ${teams[1]}` : match).toUpperCase(), mx, 20.5 * MM, mw, 20, 12);
    const day = dayFmt.format(t.kickoffAt);
    doc.font("Helvetica-Bold").fillColor(INK);
    fit(doc, `${day.charAt(0).toUpperCase() + day.slice(1)} · ${timeFmt.format(t.kickoffAt)}`, mx, 31 * MM, mw, 9, 7);
    doc.font("Helvetica").fillColor(GREY);
    fit(doc, t.venue, mx, 36 * MM, mw, 8, 6);

    // Porte, tribune, prix, titulaire
    const y = 44 * MM;
    doc.moveTo(mx, y - 2 * MM).lineTo(mx + mw, y - 2 * MM).dash(2, { space: 2 }).lineWidth(0.5).strokeColor("#D1D5DB").stroke().undash();
    const cols: [string, string, number][] = [
      ["PORTE", t.gate, 1],
      ["TRIBUNE", t.category, 1.6],
      ["PRIX", t.price === 0 ? "Invitation" : formatFcfa(t.price).replace(/ | /g, " "), 1.1],
      ["TITULAIRE", t.holderName, 1.8],
    ];
    const unit = (mw - 3 * 3 * MM) / cols.reduce((a, c) => a + c[2], 0);
    let cx = mx;
    for (const [label, value, w] of cols) {
      const cw = unit * w;
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(5).text(label, cx, y, { width: cw, characterSpacing: 0.6, lineBreak: false });
      doc.fillColor(INK).font("Helvetica-Bold");
      fit(doc, value, cx, y + 3 * MM, cw, 10, 6.5);
      cx += cw + 3 * MM;
    }

    // Conditions et références
    doc.fillColor(GREY).font("Helvetica").fontSize(5.2);
    doc.text("Billet nominatif et personnel · pièce d'identité exigible à l'entrée · QR code valable pour une seule entrée · ni repris ni échangé, sauf annulation du match.", mx, H - 14 * MM, {
      width: mw,
    });
    doc.font("Courier").fontSize(6).fillColor(INK).text(`Billet ${t.number} · commande ${t.orderRef}`, mx, H - 7.5 * MM, { width: mw, lineBreak: false });

    // Perforation et talon
    const px = W - STUB;
    doc.rect(px, 0, STUB, H).fill("#F6F7F6");
    doc.moveTo(px, 3 * MM).lineTo(px, H - 3 * MM).dash(3, { space: 3 }).lineWidth(0.8).strokeColor("#9CA3AF").stroke().undash();
    doc.circle(px, 0, 2.5 * MM).fill("#FFFFFF");
    doc.circle(px, H, 2.5 * MM).fill("#FFFFFF");
    const qrSize = 34 * MM;
    const qx = px + (STUB - qrSize) / 2;
    if (t.status === "VALID") {
      const png = await QRCode.toBuffer(t.qrUrl, { type: "png", margin: 1, width: 600, errorCorrectionLevel: "M" });
      doc.image(png, qx, 6 * MM, { width: qrSize });
    } else {
      doc.rect(qx, 6 * MM, qrSize, qrSize).dash(2, { space: 2 }).lineWidth(0.6).strokeColor("#9CA3AF").stroke().undash();
      doc.font("Helvetica").fontSize(6.5).fillColor(GREY).text("QR code non valable", px, 6 * MM + qrSize / 2 - 2 * MM, { width: STUB, align: "center" });
    }
    doc.font("Courier-Bold").fontSize(9).fillColor(INK).text(t.number, px, 43 * MM, { width: STUB, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(6).fillColor(GREY).text(`${t.gate} · ${t.category}`, px + 3 * MM, 48.5 * MM, { width: STUB - 6 * MM, align: "center" });
    const label = t.status === "VALID" ? "VALIDE" : t.status === "USED" ? "UTILISÉ" : "NON VALABLE";
    doc.roundedRect(px + STUB / 2 - 11 * MM, H - 14 * MM, 22 * MM, 5.5 * MM, 2.75 * MM).fill(t.status === "VALID" ? "#E3F2EA" : "#FDECEC");
    doc.font("Helvetica-Bold").fontSize(7).fillColor(t.status === "VALID" ? GREEN : RED).text(label, px, H - 12.4 * MM, { width: STUB, align: "center", characterSpacing: 1 });
  }
  doc.end();
  return done;
}
