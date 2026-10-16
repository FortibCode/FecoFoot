import type { Metadata } from "next";
import { LicenseResult } from "@/components/public/license-result";
import { PublicShell } from "@/components/public/public-shell";
import { publicLicense } from "@/lib/queries/verify";
import { hitRateLimit, LIMITS, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const metadata: Metadata = {
  title: "Vérifier une licence — FECOFOOT",
  description: "Vérifiez la validité d'une licence de joueur de la Fédération Congolaise de Football.",
};

/** Vérification publique d'une licence par son numéro (EF-PUB-06). */
export default async function VerifyPage({ searchParams }: PageProps<"/verifier">) {
  const raw = (await searchParams).numero;
  const numero = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const rl = numero ? await hitRateLimit(`verify:${await clientIp()}`, LIMITS.licenseVerifyPerIp.limit, LIMITS.licenseVerifyPerIp.windowMs) : null;
  const license = numero && rl?.allowed ? await publicLicense({ number: numero }) : undefined;

  return (
    <PublicShell eyebrow="Licences" title="Vérifier une licence">
      <form className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          name="numero"
          defaultValue={numero}
          placeholder="N° de licence, ex. LIC-2026-000001"
          required
          className="h-11 flex-1 rounded-md border px-3 font-mono uppercase"
        />
        <button type="submit" className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Vérifier
        </button>
      </form>
      <p className="mb-6 text-sm text-muted-foreground">Vous pouvez aussi scanner le QR code imprimé sur la carte de licence.</p>
      {rl && !rl.allowed && <p role="alert">{retryMessage(rl.retryAfterSec)}</p>}
      {license !== undefined && <LicenseResult license={license} />}
    </PublicShell>
  );
}
