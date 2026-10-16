import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResets } from "@/lib/db/schema";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/qr";
import { hashToken, randomToken } from "@/lib/tokens";
import { RESET_LINK_TTL_MS } from "./password";

/**
 * Émet un lien personnel « choisir un mot de passe » (1 h, usage unique) et l'envoie par e-mail / SMS.
 * Sert au mot de passe oublié (EF-AUT-04) et à l'ouverture d'un accès (ex. espace arbitre).
 */
export async function sendPasswordLink(
  user: { id: number; email: string; phone: string | null; fullName: string },
  purpose: "reset" | "welcome",
  ttlMs: number = RESET_LINK_TTL_MS,
): Promise<void> {
  const token = randomToken();
  const now = new Date();
  await db.transaction(async (tx) => {
    // Un seul lien valable à la fois.
    await tx.update(passwordResets).set({ usedAt: now }).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
    await tx.insert(passwordResets).values({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + ttlMs) });
  });
  const link = await appUrl(`/reinitialiser/${token}`);
  const validity = ttlMs >= 86_400_000 ? `${Math.round(ttlMs / 86_400_000)} jours` : "1 heure";

  await notify(
    { email: user.email, phone: user.phone },
    purpose === "reset"
      ? {
          topic: "password_reset",
          subject: "FECOFOOT — réinitialisation de votre mot de passe",
          sms: `FECOFOOT : pour choisir un nouveau mot de passe, ouvrez ${link} (valable ${validity}). Ignorez ce message si vous n'êtes pas à l'origine de la demande.`,
          email: `Bonjour ${user.fullName},\n\nUne réinitialisation du mot de passe de votre compte FECOFOOT a été demandée.\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable ${validity}, utilisable une seule fois) :\n\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n\nFédération Congolaise de Football`,
        }
      : {
          topic: "account_welcome",
          subject: "FECOFOOT — ouverture de votre accès",
          sms: `FECOFOOT : votre accès à l'espace fédéral est ouvert. Choisissez votre mot de passe : ${link} (valable ${validity}).`,
          email: `Bonjour ${user.fullName},\n\nUn accès à l'espace fédéral de la FECOFOOT vient de vous être ouvert (identifiant : ${user.email}).\nChoisissez votre mot de passe avec ce lien (valable ${validity}, utilisable une seule fois) :\n\n${link}\n\nFédération Congolaise de Football`,
        },
  );
}
