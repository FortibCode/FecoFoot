import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { findConsentByToken } from "@/lib/queries/consents";
import { answerConsent } from "./actions";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = {
  title: "Accord pour la licence — FECOFOOT",
  robots: { index: false, follow: false },
};

const MESSAGES = {
  expired: "Ce lien a expiré (validité 14 jours). Demandez au club de vous envoyer une nouvelle demande.",
  blocked: "Ce lien est bloqué après plusieurs vérifications erronées. Demandez au club une nouvelle demande.",
  answered: "Vous avez déjà répondu à cette demande. Merci.",
  cancelled: "Cette demande a été remplacée par une plus récente. Utilisez le dernier lien reçu.",
} as const;

/** Accord en ligne du joueur ou de son représentant légal (M05). */
export default async function ConsentPage({ params }: PageProps<"/accord/[token]">) {
  const { token } = await params;
  const found = await findConsentByToken(token);

  return (
    <PublicShell eyebrow="Licence — accord en ligne" title="Accord pour la licence">
      {!found ? (
        <p>Ce lien n’est pas valide. Vérifiez l’adresse reçue ou contactez le club.</p>
      ) : found.state !== "open" ? (
        <p>{MESSAGES[found.state]}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground">
            Bonjour {found.consent.recipientName}. Le club <strong className="text-foreground">{found.club.name}</strong> demande{" "}
            {found.consent.recipient === "GUARDIAN" ? "votre accord, en tant que représentant légal, pour licencier " : "votre accord pour vous licencier : "}
            <strong className="text-foreground">
              {found.player.firstName} {found.player.lastName}
            </strong>
            .
          </p>
          <ConsentForm
            action={answerConsent.bind(null, token)}
            guardian={found.consent.recipient === "GUARDIAN"}
            playerName={`${found.player.firstName} ${found.player.lastName}`}
            clubName={found.club.name}
          />
        </div>
      )}
    </PublicShell>
  );
}
