import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { PillLink } from "@/components/public/ui";

export const metadata: Metadata = { title: "Page introuvable — FECOFOOT", robots: { index: false } };

/** Page introuvable du portail (lien périmé, match ou article supprimé, adresse mal saisie). */
export default function NotFound() {
  return (
    <PublicShell eyebrow="Erreur 404" title="Page introuvable" subtitle="Cette page n'existe pas ou n'est plus disponible.">
      <div className="flex flex-col gap-6">
        <p className="text-muted-foreground">
          Le lien que vous avez suivi est peut-être ancien : le match, l&apos;article ou la compétition a pu être déplacé ou retiré. Vous pouvez repartir de l&apos;une de ces pages.
        </p>
        <div className="flex flex-wrap gap-3">
          <PillLink href="/">Accueil</PillLink>
          <PillLink href="/championnats/ligue-1" variant="green">
            Ligue 1
          </PillLink>
          <PillLink href="/competitions" variant="green">
            Compétitions
          </PillLink>
        </div>
        <p className="text-sm">
          Vous cherchez une licence ?{" "}
          <Link href="/verifier" className="font-semibold underline">
            Vérifier une licence
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
