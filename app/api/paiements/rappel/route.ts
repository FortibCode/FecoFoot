import * as z from "zod";
import { logAudit } from "@/lib/audit";
import { confirmPayment, failPayment, paymentMode } from "@/lib/payments";
import { verifySignature } from "@/lib/webhook-signature";

const Callback = z.object({
  reference: z.string().min(4).max(40),
  status: z.enum(["SUCCEEDED", "FAILED"]),
  reason: z.string().max(300).optional(),
});

/**
 * Rappel serveur de l'opérateur Mobile Money (ou de l'agrégateur) : seule voie de confirmation d'un paiement
 * réel. Corps JSON { reference, status, reason? } signé (en-tête X-Signature, voir lib/webhook-signature.ts)
 * avec PAYMENT_WEBHOOK_SECRET. Refusé en mode simulation : la page de simulation confirme elle-même.
 */
export async function POST(request: Request) {
  if (paymentMode() !== "live") return Response.json({ error: "Rappels désactivés en mode simulation." }, { status: 409 });
  const body = await request.text();
  if (!verifySignature(body, request.headers.get("x-signature"), process.env.PAYMENT_WEBHOOK_SECRET)) {
    return Response.json({ error: "Signature invalide." }, { status: 401 });
  }
  let parsed: z.infer<typeof Callback>;
  try {
    parsed = Callback.parse(JSON.parse(body));
  } catch {
    return Response.json({ error: "Corps invalide." }, { status: 400 });
  }
  if (parsed.status === "SUCCEEDED") {
    const result = await confirmPayment(parsed.reference);
    await logAudit({ userId: null, action: "PAYMENT_CALLBACK", entity: "payment", entityId: parsed.reference, details: { status: parsed.status, result } });
    // Idempotent : un rappel répété sur un paiement déjà traité ne refait rien.
    return Response.json({ result }, { status: result === "ok" || result === "not_pending" ? 200 : 410 });
  }
  await failPayment(parsed.reference, parsed.reason ?? "Refusé par l'opérateur");
  await logAudit({ userId: null, action: "PAYMENT_CALLBACK", entity: "payment", entityId: parsed.reference, details: { status: parsed.status } });
  return Response.json({ result: "failed" });
}
