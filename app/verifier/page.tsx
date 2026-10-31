import type { Metadata } from "next";
import { CheckCircleIcon, IdCardIcon, QrIcon, SearchIcon } from "@/components/public/icons";
import { LicenseResult } from "@/components/public/license-result";
import { PublicShell } from "@/components/public/public-shell";
import { publicLicense } from "@/lib/queries/verify";
import { hitRateLimit, LIMITS, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const metadata: Metadata = {
  title: "Vérifier une licence — FECOFOOT",
  description: "Vérifiez la validité d'une licence de joueur de la Fédération Congolaise de Football.",
};

/** Qui vérifie une licence, et pourquoi. */
const USES = [
  "Arbitres et commissaires, avant le coup d'envoi",
  "Clubs, pour un joueur qu'ils accueillent",
  "Organisateurs de tournois et partenaires",
];

/** Vérification publique d'une licence par son numéro (EF-PUB-06). */
export default async function VerifyPage({ searchParams }: PageProps<"/verifier">) {
  const raw = (await searchParams).numero;
  const numero = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const rl = numero ? await hitRateLimit(`verify:${await clientIp()}`, LIMITS.licenseVerifyPerIp.limit, LIMITS.licenseVerifyPerIp.windowMs) : null;
  const license = numero && rl?.allowed ? await publicLicense({ number: numero }) : undefined;

  return (
    <PublicShell eyebrow="Licences" title="Vérifier une licence" subtitle="Contrôlez en quelques secondes qu'un joueur est bien licencié et autorisé à jouer." wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <form data-reveal="up" className="flex flex-col gap-4 bg-muted/60 p-5 sm:p-6">
            <label htmlFor="numero" className="flex items-center gap-2.5 font-heading text-lg font-bold">
              <span aria-hidden className="grid size-9 place-items-center rounded-full bg-[var(--flag-green)] text-white">
                <IdCardIcon className="size-4" />
              </span>
              Numéro de la licence
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <span className="relative flex flex-1 items-center">
                <SearchIcon className="pointer-events-none absolute left-3.5 size-5 text-muted-foreground" />
                <input
                  id="numero"
                  name="numero"
                  defaultValue={numero}
                  placeholder="N° de licence, ex. LIC-2026-000001"
                  required
                  autoComplete="off"
                  className="h-12 w-full rounded-md border bg-background pr-3 pl-11 font-mono text-base uppercase transition-[border-color,box-shadow] focus:border-[var(--flag-green)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--flag-green)_20%,transparent)] focus:outline-none"
                />
              </span>
              <button type="submit" className="h-12 rounded-md bg-[var(--flag-green)] px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-ink">
                Vérifier
              </button>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <QrIcon className="size-4 text-[var(--flag-green)]" />
              Vous pouvez aussi scanner le QR code imprimé sur la carte de licence.
            </p>
          </form>
          {rl && !rl.allowed && (
            <p role="alert" className="border-l-4 border-[var(--flag-red)] bg-[color-mix(in_srgb,var(--flag-red)_8%,transparent)] p-4 text-sm font-semibold">
              {retryMessage(rl.retryAfterSec)}
            </p>
          )}
          {license !== undefined && <LicenseResult license={license} />}
        </div>

        <aside data-reveal="right" style={{ ["--rd" as string]: "120ms" }} className="flex flex-col gap-3 bg-muted/60 p-5">
          <h2 className="font-heading text-base font-bold">À quoi ça sert ?</h2>
          <p className="text-sm text-muted-foreground">Le résultat vient directement du registre des licences de la fédération : statut, club, saison et date de validité.</p>
          <ul className="flex flex-col gap-2.5 text-sm">
            {USES.map((u) => (
              <li key={u} className="flex items-start gap-2">
                <CheckCircleIcon className="mt-0.5 size-4 text-[var(--flag-green)]" />
                {u}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PublicShell>
  );
}
