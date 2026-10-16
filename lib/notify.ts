import "server-only";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

/**
 * Envoi des SMS et e-mails (EF-NOT-01, EF-NOT-02).
 *
 * NOTIFY_MODE=log (défaut) : rien n'est envoyé, le message est enregistré et consultable
 * par le super administrateur (Administration › Notifications) — développement et recette.
 * NOTIFY_MODE=live : brancher ici l'opérateur SMS (expéditeur « FECOFOOT ») et le service
 * d'e-mail (domaine fecofoot.cg, SPF/DKIM) une fois choisis (§9).
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
    // TODO (mise en production) : appel à l'API de l'opérateur SMS / du service d'e-mail.
    throw new Error(`Fournisseur ${channel} non configuré (NOTIFY_MODE=live).`);
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
