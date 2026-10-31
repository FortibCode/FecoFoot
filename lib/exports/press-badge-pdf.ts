import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { PRESS_ROLE_LABELS, PRESS_ZONE_LABELS, PRESS_ZONES, type PressRole, type PressZone, pressCredential } from "@/lib/accreditations";
import { parseEventTitle } from "@/lib/ticketing";

const MM = 72 / 25.4;
// Format A6 : la taille standard des porte-badges à cordon.
const W = 105 * MM;
const H = 148 * MM;
const GREEN = "#009543";
const YELLOW = "#FBDE4A";
const RED = "#DC241F";
const INK = "#0B1F17";
const GREY = "#6B7280";
const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function logo(): Buffer | null {
  try {
    return readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "public", "logo-fecofoot.png"));
  } catch {
    return null;
  }
}

export type PressBadgePdfData = {
  number: string;
  lastName: string;
  firstName: string;
  outlet: string;
  role: PressRole;
  pressCardNumber: string | null;
  grantedZones: PressZone[];
  event: string;
  kickoffAt: Date;
  venue: string;
  qrUrl: string;
  /** Photo JPEG ou PNG (format lu par le générateur PDF) ; initiales sinon. */
  photo: Buffer | null;
};

/** Badge presse imprimable (EF-MED-04) au format A6, à glisser dans un porte-badge : même contenu que le badge à l'écran. */
export async function pressBadgePdf(a: PressBadgePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: `Badge presse ${a.number}`, Author: "FECOFOOT" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // En-tête : fente du cordon, logo, mention PRESSE, bande tricolore.
  doc.rect(0, 0, W, 24 * MM).fill(INK);
  doc.roundedRect(W / 2 - 9 * MM, 3 * MM, 18 * MM, 2.6 * MM, 1.3 * MM).fill("#FFFFFF");
  const crest = logo();
  if (crest) doc.image(crest, 6 * MM, 8.5 * MM, { height: 12 * MM });
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text("FECOFOOT", 20 * MM, 11 * MM, { lineBreak: false });
  doc.font("Helvetica").fontSize(5.5).fillColor("#CBD5D0").text("FÉDÉRATION CONGOLAISE DE FOOTBALL", 20 * MM, 16 * MM, { lineBreak: false, characterSpacing: 0.6 });
  doc.rect(0, 24 * MM, W, 11 * MM).fill(YELLOW);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(24).text("PRESSE", 0, 26.2 * MM, { width: W, align: "center", characterSpacing: 6 });
  doc.rect(0, 35 * MM, W / 3, 1.6 * MM).fill(GREEN);
  doc.rect(W / 3, 35 * MM, W / 3, 1.6 * MM).fill(YELLOW);
  doc.rect((2 * W) / 3, 35 * MM, W / 3, 1.6 * MM).fill(RED);

  // Photo et identité
  const pw = 27 * MM;
  const ph = 36 * MM;
  const px = 7 * MM;
  const py = 41 * MM;
  doc.roundedRect(px - 1 * MM, py - 1 * MM, pw + 2 * MM, ph + 2 * MM, 2 * MM).fill(INK);
  if (a.photo) {
    doc.save().roundedRect(px, py, pw, ph, 1.5 * MM).clip();
    doc.image(a.photo, px, py, { cover: [pw, ph], align: "center", valign: "center" });
    doc.restore();
  } else {
    doc.roundedRect(px, py, pw, ph, 1.5 * MM).fill("#E5E7EB");
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(`${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase(), px, py + ph / 2 - 4 * MM, { width: pw, align: "center" });
  }
  const ix = px + pw + 5 * MM;
  const iw = W - ix - 6 * MM;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text(a.lastName.toUpperCase(), ix, py + 1 * MM, { width: iw });
  doc.font("Helvetica").fontSize(11).text(a.firstName, ix, doc.y + 0.5 * MM, { width: iw });
  const roleY = doc.y + 3 * MM;
  doc.roundedRect(ix, roleY, iw, 6 * MM, 3 * MM).fill(INK);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7.5).text(PRESS_ROLE_LABELS[a.role].toUpperCase(), ix, roleY + 1.8 * MM, { width: iw, align: "center", characterSpacing: 0.8 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(a.outlet, ix, roleY + 9 * MM, { width: iw });
  doc.font("Helvetica").fontSize(7).fillColor(GREY).text(pressCredential(a), ix, doc.y + 1 * MM, { width: iw });

  // Zones numérotées : accordées en vert, refusées en gris barré.
  const zy = 82 * MM;
  const zw = (W - 14 * MM - 3 * 2 * MM) / 4;
  PRESS_ZONES.forEach((z, i) => {
    const ok = a.grantedZones.includes(z);
    const zx = 7 * MM + i * (zw + 2 * MM);
    doc.roundedRect(zx, zy, zw, 13 * MM, 1.5 * MM).fill(ok ? GREEN : "#F3F4F6");
    doc.fillColor(ok ? "#FFFFFF" : "#9CA3AF").font("Helvetica-Bold").fontSize(15).text(String(i + 1), zx, zy + 1.5 * MM, { width: zw, align: "center" });
    doc.font("Helvetica").fontSize(5).text(PRESS_ZONE_LABELS[z].replace(" (photo)", ""), zx + 1 * MM, zy + 8 * MM, { width: zw - 2 * MM, align: "center" });
    if (!ok) doc.moveTo(zx + 2 * MM, zy + 6.5 * MM).lineTo(zx + zw - 2 * MM, zy + 6.5 * MM).lineWidth(0.6).strokeColor("#9CA3AF").stroke();
  });

  // Rencontre et QR code
  const my = 100 * MM;
  doc.moveTo(7 * MM, my - 2 * MM).lineTo(W - 7 * MM, my - 2 * MM).dash(2, { space: 2 }).lineWidth(0.6).strokeColor("#D1D5DB").stroke().undash();
  const { competition, detail, match, teams } = parseEventTitle(a.event);
  const tw = W - 14 * MM - 32 * MM;
  doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(6).text([competition ?? "Rencontre", detail].filter(Boolean).join(" · ").toUpperCase(), 7 * MM, my + 1 * MM, { width: tw, characterSpacing: 0.5 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text((teams ? `${teams[0]} – ${teams[1]}` : match).toUpperCase(), 7 * MM, doc.y + 1 * MM, { width: tw });
  const day = dayFmt.format(a.kickoffAt);
  doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(`${day.charAt(0).toUpperCase() + day.slice(1)} · ${timeFmt.format(a.kickoffAt)}`, 7 * MM, doc.y + 1 * MM, { width: tw });
  doc.text(a.venue, 7 * MM, doc.y + 0.5 * MM, { width: tw });
  doc.font("Courier-Bold").fontSize(9).fillColor(INK).text(a.number, 7 * MM, doc.y + 2 * MM, { width: tw });
  const qr = await QRCode.toBuffer(a.qrUrl, { type: "png", margin: 1, width: 500, errorCorrectionLevel: "M" });
  doc.image(qr, W - 7 * MM - 30 * MM, my, { width: 30 * MM });

  doc.rect(0, H - 9 * MM, W, 9 * MM).fill(INK);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(6).text("PERSONNEL ET INCESSIBLE · VALABLE UNIQUEMENT POUR CE MATCH", 0, H - 5.8 * MM, { width: W, align: "center", characterSpacing: 0.6 });
  doc.end();
  return done;
}
