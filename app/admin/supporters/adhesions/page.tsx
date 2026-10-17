import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { membershipPlans } from "@/lib/db/schema";
import { seasonLabel, seasonOf } from "@/lib/licenses";
import { MEMBERSHIP_TIERS, YOUTH_MAX_AGE } from "@/lib/supporters";
import { saveMembershipPlan } from "../actions";
import { PlanForm } from "./PlanForm";

export const metadata: Metadata = { title: "Tarifs d'adhésion — FECOFOOT" };

export default async function MembershipPlansPage() {
  await requirePermission("ticketing.manage");
  const season = seasonOf();
  const plans = await db.select().from(membershipPlans).where(eq(membershipPlans.season, season));
  return (
    <>
      <PageHeader
        eyebrow="Stade & supporters"
        title={`Adhésions ${seasonLabel(season)}`}
        description={`Club des supporters : tarifs annuels. Formule jeune : moins de ${YOUTH_MAX_AGE + 1} ans au 1er juillet.`}
      />
      <div className="flex max-w-2xl flex-col gap-3">
        {MEMBERSHIP_TIERS.map((tier) => {
          const plan = plans.find((p) => p.tier === tier);
          return <PlanForm key={tier} action={saveMembershipPlan.bind(null, season)} tier={tier} price={plan?.price ?? null} open={plan?.open ?? true} />;
        })}
      </div>
    </>
  );
}
