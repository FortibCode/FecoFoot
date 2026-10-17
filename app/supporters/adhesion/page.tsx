import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { requireSupporter } from "@/lib/auth/fan-session";
import { db } from "@/lib/db";
import { membershipPlans } from "@/lib/db/schema";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { methodForOperator } from "@/lib/payments-rules";
import { operatorOf, tierError } from "@/lib/supporters";
import { MembershipForm } from "../SupporterForms";

export const metadata: Metadata = { title: "Adhésion au club des supporters — FECOFOOT", robots: { index: false } };

/** Adhésion annuelle (adulte / jeune) payée par Mobile Money (EF-SUP-03). */
export default async function MembershipPage() {
  const s = await requireSupporter();
  if (s.banned) redirect("/supporters/espace");
  const season = seasonOf();
  const plans = await db
    .select()
    .from(membershipPlans)
    .where(and(eq(membershipPlans.season, season), eq(membershipPlans.open, true)))
    .orderBy(asc(membershipPlans.tier));

  return (
    <PublicShell eyebrow="Club des supporters" title={`Adhésion ${seasonLabel(season)}`}>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Les adhésions pour cette saison ne sont pas encore ouvertes.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Avantages : prévente réservée aux membres, tarif membre sur les billets, points de fidélité. Le paiement se valide sur votre téléphone.
          </p>
          <MembershipForm
            plans={plans.map((p) => ({ tier: p.tier, price: p.price, allowed: tierError(p.tier, s.birthDate, season) === null }))}
            defaultMethod={methodForOperator(operatorOf(s.phone))}
          />
        </div>
      )}
    </PublicShell>
  );
}
