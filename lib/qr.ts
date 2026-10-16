import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** URL absolue de l'application : APP_URL en production, sinon l'hôte de la requête. */
export async function appUrl(path: string): Promise<string> {
  const base = process.env.APP_URL ?? (await (async () => {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  })());
  return new URL(path, base).toString();
}

/** QR code en SVG (net à l'impression, aucune image externe). */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
}
