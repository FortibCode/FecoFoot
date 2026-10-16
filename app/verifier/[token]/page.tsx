import type { Metadata } from "next";
import Link from "next/link";
import { LicenseResult } from "@/components/public/license-result";
import { PublicShell } from "@/components/public/public-shell";
import { publicLicense } from "@/lib/queries/verify";
import { hitRateLimit, LIMITS, retryMessage } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const metadata: Metadata = { title: "Vérification de licence — FECOFOOT", robots: { index: false } };

/** Cible du QR code de la carte de licence (EF-LIC-07, EF-PUB-06). */
export default async function VerifyTokenPage({ params }: PageProps<"/verifier/[token]">) {
  const { token } = await params;
  const rl = await hitRateLimit(`verify:${await clientIp()}`, LIMITS.licenseVerifyPerIp.limit, LIMITS.licenseVerifyPerIp.windowMs);
  const license = rl.allowed && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? await publicLicense({ token }) : null;

  return (
    <PublicShell eyebrow="Licences" title="Vérification de licence">
      {rl.allowed ? <LicenseResult license={license} /> : <p role="alert">{retryMessage(rl.retryAfterSec)}</p>}
      <Link href="/verifier" className="mt-6 inline-block text-sm underline">
        Vérifier une autre licence
      </Link>
    </PublicShell>
  );
}
