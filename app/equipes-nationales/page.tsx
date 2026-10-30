import type { Metadata } from "next";
import { connection } from "next/server";
import { FeaturedTeamCard, TeamCard } from "@/components/public/national-team-cards";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { nationalTeams } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Nos sélections nationales — FECOFOOT",
  description: "Les sélections nationales du Congo : équipe A, A' (locaux), sélections de jeunes et football féminin. Staff, convocations, calendrier, résultats et photos.",
};

/** Groupes de la page, dans l'ordre d'affichage (sélections réellement gérées par la fédération). */
const GROUPS: { title: string; description: string; slugs: string[] }[] = [
  { title: "Sélections de jeunes", description: "De l'équipe espoirs aux U-15 : la relève du football congolais.", slugs: ["u23", "u20", "u17", "u15"] },
  { title: "Sélection A' (locaux)", description: "Les joueurs évoluant dans le championnat national.", slugs: ["a-locaux"] },
  { title: "Football féminin", description: "L'équipe nationale féminine.", slugs: ["dames"] },
];

export default async function PublicNationalTeamsPage() {
  // Liste vivante : calculée à chaque visite, jamais figée à la construction.
  await connection();
  const rows = await db.select().from(nationalTeams);
  const bySlug = new Map(rows.map((t) => [t.slug, t]));
  const first = rows.find((t) => t.code === "A");
  return (
    <PublicShell
      eyebrow="Équipes nationales"
      title="Nos sélections nationales"
      subtitle="Les Diables Rouges représentent le Congo sur la scène africaine et mondiale : équipe A, joueurs locaux, sélections de jeunes et football féminin."
      wide
    >
      <div className="flex flex-col gap-12">
        {first && (
          <section aria-labelledby="groupe-a" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="groupe-a" className="text-2xl font-bold uppercase">
                Équipe première
              </h2>
              <p className="text-sm text-muted-foreground">Les Diables Rouges A, sélection nationale du Congo.</p>
            </div>
            <FeaturedTeamCard team={first} />
          </section>
        )}
        {(() => {
          const section = (g: (typeof GROUPS)[number], wide: boolean) => {
            const teams = g.slugs.map((s) => bySlug.get(s)).filter((t): t is NonNullable<typeof t> => Boolean(t));
            if (teams.length === 0) return null;
            return (
              <section key={g.title} aria-labelledby={`groupe-${g.slugs[0]}`} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id={`groupe-${g.slugs[0]}`} className="text-2xl font-bold uppercase">
                    {g.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{g.description}</p>
                </div>
                <ul className={`grid gap-3 sm:gap-4 ${wide ? "grid-cols-2" : ""}`}>
                  {teams.map((t) => (
                    <li key={t.slug}>
                      <TeamCard team={t} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          };
          const [youth, ...singles] = GROUPS;
          return (
            <>
              {section(youth, true)}
              {/* Sélections d'une seule équipe, côte à côte. */}
              <div className="grid gap-12 md:grid-cols-2">{singles.map((g) => section(g, false))}</div>
            </>
          );
        })()}
      </div>
    </PublicShell>
  );
}
