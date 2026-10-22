import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inArray } from "drizzle-orm";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { CARD_STATUS_LABELS, cardStatus, CATEGORY_LABELS, IDENTITY_METHOD_LABELS, LICENSE_TYPE_LABELS, POSITION_LABELS, seasonLabel } from "@/lib/licenses";
import type { LicenseCardData } from "@/lib/queries/license-card";
import { getFileOrNull } from "@/lib/storage";

const MM = 72 / 25.4;
const W = 85.6 * MM;
const H = 54 * MM;
const GREEN = "#009543";
const YELLOW = "#FBDE4A";
const RED = "#DC241F";
const INK = "#0A1F15";
const STATUS_COLOR = { ACTIVE: GREEN, PENDING: YELLOW, EXPIRED: RED, SUSPENDED: RED, REVOKED: INK, CLOSED: "#6B7280" } as const;

function readPublic(file: string): Buffer | null {
  try {
    return readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "public", file));
  } catch {
    return null;
  }
}

/** Images JPEG ou PNG uniquement (formats lus par le générateur PDF) ; WebP ignoré. */
async function imageOf(docId: number | null) {
  if (!docId) return null;
  const [doc] = await db.select().from(documents).where(inArray(documents.id, [docId])).limit(1);
  if (!doc || !/^image\/(jpeg|png)$/.test(doc.contentType)) return null;
  return getFileOrNull(doc.storageKey);
}

function face(doc: PDFKit.PDFDocument, demo: boolean) {
  doc.rect(0, 0, W, H).fill("#FFFFFF");
  // Trame guillochée (élément graphique anti-copie).
  doc.save().lineWidth(0.25).strokeColor(GREEN).opacity(0.12);
  for (let y = 4; y < H; y += 7) {
    doc.moveTo(0, y).bezierCurveTo(W * 0.15, y - 5, W * 0.3, y + 6, W * 0.45, y).bezierCurveTo(W * 0.6, y - 5, W * 0.8, y + 6, W, y).stroke();
  }
  doc.restore();
  const band = 2.4 * MM;
  doc.rect(0, 0, band, H / 3).fill(GREEN);
  doc.rect(0, H / 3, band, H / 3).fill(YELLOW);
  doc.rect(0, (2 * H) / 3, band, H / 3).fill(RED);
  if (demo) {
    doc.save().rotate(-18, { origin: [W / 2, H / 2] }).opacity(0.45).fillColor(RED).font("Helvetica-Bold").fontSize(15);
    doc.text("EXEMPLE", 0, H / 2 - 8, { width: W, align: "center", characterSpacing: 1.5 });
    doc.restore();
  }
}

function microText(doc: PDFKit.PDFDocument, y: number) {
  doc.save().opacity(0.7).fillColor(GREEN).font("Helvetica").fontSize(2.8);
  doc.text("FECOFOOT · RÉPUBLIQUE DU CONGO · LICENCE OFFICIELLE · ".repeat(5), 3.4 * MM, y, { width: W - 6 * MM, lineBreak: false, height: 4 });
  doc.restore();
}

function field(doc: PDFKit.PDFDocument, x: number, y: number, w: number, label: string, value: string) {
  doc.fillColor("#6B7280").font("Helvetica").fontSize(4.2).text(label.toUpperCase(), x, y, { width: w, lineBreak: false });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(5.4).text(value, x, y + 4.8, { width: w, lineBreak: false, ellipsis: true });
}

/** Carte de licence en PDF : deux pages au format de la carte (recto, verso), mêmes informations que l'aperçu. */
export async function licenseCardPdf(data: LicenseCardData): Promise<Buffer> {
  const { license, player, club } = data;
  const [photo, clubLogo, qr] = await Promise.all([
    imageOf(data.photoDocId),
    imageOf(data.clubLogoDocId),
    QRCode.toBuffer(data.verifyUrl, { type: "png", margin: 0, errorCorrectionLevel: "M", width: 300 }),
  ]);
  const logo = readPublic("logo-fecofoot.png");
  const status = cardStatus(license.status, license.expiresAt);
  const doc = new PDFDocument({ size: [W, H], margin: 0, info: { Title: `Licence ${license.number}`, Author: "FECOFOOT" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const left = 5 * MM;

  // ── Recto
  face(doc, data.demo);
  if (logo) doc.image(logo, left, 2.2 * MM, { width: 8.5 * MM, height: 8.5 * MM });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(4.4).text("FÉDÉRATION CONGOLAISE DE FOOTBALL", left + 10 * MM, 3.2 * MM, { characterSpacing: 0.4 });
  doc.fontSize(8.4).text("LICENCE DE JOUEUR", left + 10 * MM, 5.4 * MM);
  doc.font("Helvetica").fontSize(4.2).text("SAISON", W - 22 * MM, 3 * MM, { width: 19 * MM, align: "right" });
  doc.font("Helvetica-Bold").fontSize(7.6).text(seasonLabel(license.season), W - 22 * MM, 5 * MM, { width: 19 * MM, align: "right" });

  const top = 13 * MM;
  if (photo) {
    doc.image(photo, left, top, { cover: [18 * MM, 23 * MM], align: "center", valign: "center" });
  } else {
    doc.rect(left, top, 18 * MM, 23 * MM).dash(1.5, { space: 1.5 }).strokeColor("#9CA3AF").stroke().undash();
    doc.fillColor("#9CA3AF").font("Helvetica").fontSize(4.6).text("PHOTO", left, top + 11 * MM, { width: 18 * MM, align: "center" });
  }
  if (data.identity) {
    const label = data.identity === "BIOMETRIC" ? "BIOMÉTRIE VÉRIFIÉE" : "IDENTITÉ VÉRIFIÉE";
    doc.roundedRect(left, top + 24 * MM, 18 * MM, 3.2 * MM, 1.6 * MM).fill(GREEN);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(3.6).text(label, left, top + 24.9 * MM, { width: 18 * MM, align: "center" });
  }
  const x = left + 21 * MM;
  const colW = (W - x - 3 * MM) / 2;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(player.lastName.toUpperCase(), x, top - 0.5 * MM, { width: W - x - 3 * MM, lineBreak: false, ellipsis: true });
  doc.font("Helvetica").fontSize(7.2).text(player.firstName, x, top + 3.6 * MM, { width: W - x - 3 * MM, lineBreak: false, ellipsis: true });
  field(doc, x, top + 8 * MM, colW, "Né(e) le", player.showBirthDate ? formatDate(player.birthDate) : "Non publiée");
  field(doc, x + colW, top + 8 * MM, colW, "Nationalité", player.nationality);
  field(doc, x, top + 12.6 * MM, colW, "Catégorie", CATEGORY_LABELS[license.category]);
  field(doc, x + colW, top + 12.6 * MM, colW, "Poste", player.position ? POSITION_LABELS[player.position] : "—");
  if (clubLogo) doc.image(clubLogo, x, top + 18 * MM, { fit: [5 * MM, 5 * MM] });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(5.6).text(club.name, x + (clubLogo ? 6 * MM : 0), top + 19.6 * MM, { width: W - x - 9 * MM, lineBreak: false, ellipsis: true });

  doc.font("Courier-Bold").fontSize(6).fillColor(INK).text(license.number, left, H - 7.6 * MM);
  const pill = CARD_STATUS_LABELS[status].toUpperCase();
  doc.roundedRect(W - 19 * MM, H - 8.2 * MM, 16 * MM, 3.4 * MM, 1.7 * MM).fill(STATUS_COLOR[status]);
  doc.fillColor(status === "PENDING" ? INK : "#FFFFFF").font("Helvetica-Bold").fontSize(4.4).text(pill, W - 19 * MM, H - 7.3 * MM, { width: 16 * MM, align: "center" });
  microText(doc, H - 3 * MM);

  // ── Verso
  doc.addPage({ size: [W, H], margin: 0 });
  face(doc, data.demo);
  doc.image(qr, left, 4 * MM, { width: 24 * MM, height: 24 * MM });
  doc.fillColor("#4B5563").font("Helvetica").fontSize(4).text("Scannez pour vérifier l'authenticité", left - 1 * MM, 29 * MM, { width: 26 * MM, align: "center" });
  const vx = left + 28 * MM;
  const vw = (W - vx - 3 * MM) / 2;
  field(doc, vx, 4.5 * MM, vw, "Délivrée le", formatDate(license.validatedAt));
  field(doc, vx + vw, 4.5 * MM, vw, "Expire le", formatDate(license.expiresAt));
  field(doc, vx, 10 * MM, vw, "Type", LICENSE_TYPE_LABELS[license.type]);
  field(doc, vx + vw, 10 * MM, vw, "ID fédéral", player.federalId);
  field(
    doc,
    vx,
    15.5 * MM,
    vw * 2,
    "Contrôle d'identité",
    player.identityVerifiedAt && player.identityMethod ? `Effectué ${IDENTITY_METHOD_LABELS[player.identityMethod]} le ${formatDate(player.identityVerifiedAt)}` : "Non enregistré",
  );
  doc.fillColor("#4B5563").font("Helvetica").fontSize(4.2).text(
    "Carte personnelle et incessible, à présenter avec une pièce d'identité. Seul le statut affiché en ligne après lecture du QR code fait foi. Document émis par la plateforme FECOFOOT.",
    left,
    35 * MM,
    { width: W - left - 3 * MM },
  );
  microText(doc, H - 3 * MM);

  doc.end();
  return done;
}
