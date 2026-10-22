import "server-only";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

/**
 * Envoi des SMS et e-mails (EF-NOT-01, EF-NOT-02).
 *
 * NOTIFY_MODE=log (défaut) : rien n'est envoyé, le message est enregistré et consultable
 * par le super administrateur (Administration › Notifications) — développement et recette.
 * NOTIFY_MODE=live : envoi par passerelle HTTP, une par canal, configurée par variables d'environnement :
 *   SMS_GATEWAY_URL, SMS_GATEWAY_TOKEN, SMS_SENDER (défaut « FECOFOOT ») ;
 *   EMAIL_GATEWAY_URL, EMAIL_GATEWAY_TOKEN, EMAIL_FROM (adresse du domaine fecofoot.cg, SPF/DKIM).
 * Requête : POST JSON { from, to, subject?, text } avec « Authorization: Bearer <token> » ; toute réponse
 * 2xx vaut envoi. L'opérateur SMS et le service d'e-mail retenus (§9) exposent ce format directement ou via
 * un petit relais. Passerelle non configurée ou en erreur : message « en échec », jamais présenté comme envoyé.
 */

export const notifyMode = () => (process.env.NOTIFY_MODE === "live" ? "live" : "log");

type Message = { to: string; body: string; topic: string };

async function record(channel: "SMS" | "EMAIL", m: Message & { subject?: string }, status: "LOGGED" | "SENT" | "FAILED", error?: string) {
  // En production, on ne conserve pas le contenu : il contient des liens personnels.
  const body = notifyMode() === "log" ? m.body : `[${m.topic}] ${m.body.length} caractères`;
  await db.insert(notifications).values({ channel, recipient: m.to, subject: m.subject ?? null, body, topic: m.topic, status, error: error ?? null });
}

async function deliver(channel: "SMS" | "EMAIL", m: Message & { subject?: string }): Promise<boolean> {
  if (notifyMode() === "log") {
    await record(channel, m, "LOGGED");
    return true;
  }
  try {
    const env = channel === "SMS" ? { url: process.env.SMS_GATEWAY_URL, token: process.env.SMS_GATEWAY_TOKEN, from: process.env.SMS_SENDER ?? "FECOFOOT" } : { url: process.env.EMAIL_GATEWAY_URL, token: process.env.EMAIL_GATEWAY_TOKEN, from: process.env.EMAIL_FROM };
    if (!env.url || !env.token || !env.from) throw new Error(`Passerelle ${channel} non configurée (NOTIFY_MODE=live).`);
    const res = await fetch(env.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.token}` },
      body: JSON.stringify({ from: env.from, to: m.to, subject: m.subject, text: m.body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Passerelle ${channel} : réponse ${res.status}.`);
    await record(channel, m, "SENT");
    return true;
  } catch (e) {
    await record(channel, m, "FAILED", (e as Error).message);
    return false;
  }
}

export const sendSms = (m: Message) => deliver("SMS", m);
export const sendEmail = (m: Message & { subject: string }) => deliver("EMAIL", m);

/** Envoie sur tous les canaux disponibles ; vrai si au moins un a abouti. */
export async function notify(
  contact: { phone?: string | null; email?: string | null },
  m: { topic: string; subject: string; sms: string; email: string },
): Promise<boolean> {
  const results = await Promise.all([
    contact.phone ? sendSms({ to: contact.phone, body: m.sms, topic: m.topic }) : Promise.resolve(false),
    contact.email ? sendEmail({ to: contact.email, subject: m.subject, body: m.email, topic: m.topic }) : Promise.resolve(false),
  ]);
  return results.some(Boolean);
}
