import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { getCurrentSupporter } from "@/lib/auth/fan-session";

export const metadata: Metadata = {
  title: "Supporters : Fan ID et club des supporters — FECOFOOT",
  description: "Créez votre Fan ID pour acheter vos billets et rejoignez le club des supporters de la FECOFOOT.",
};

export default async function SupportersPage() {
  const me = await getCurrentSupporter();
  return (
    <PublicShell eyebrow="Supporters" title="Fan ID et club des supporters">
      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <p>
          Le <strong>Fan ID</strong> est votre identifiant de supporter : il est obligatoire pour acheter des billets. Les billets sont numériques,
          à votre nom, et présentés à l&apos;entrée du stade avec un QR code.
        </p>
        <p>
          Le <strong>club des supporters</strong> donne accès à la prévente des grands matchs, à des tarifs réduits et à des points de fidélité.
        </p>
        {me ? (
          <Link href="/supporters/espace" className="w-fit rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
            Mon espace supporter
          </Link>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link href="/supporters/inscription" className="rounded-md bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
              Créer mon Fan ID
            </Link>
            <Link href="/supporters/connexion" className="rounded-md border px-5 py-2.5 font-semibold hover:bg-muted">
              J&apos;ai déjà un Fan ID
            </Link>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
