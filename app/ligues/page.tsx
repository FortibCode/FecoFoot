import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PublicShell } from "@/components/public/public-shell";
import { publicStatusLabel } from "@/lib/competitions";
import { leagueLogoUrl } from "@/lib/league-logo";
import { seasonLabel } from "@/lib/licenses";
import { leaguesOverview, nationalDivisions } from "@/lib/queries/public-leagues";
import { textMatch } from "@/lib/text-search";

export const metadata: Metadata = {
  title: "Ligues départementales — FECOFOOT",
  description: "Les ligues départementales de la Fédération Congolaise de Football et les divisions nationales : clubs, compétitions, calendriers et classements.",
};

/** Ligues départementales et divisions nationales (portail). */
export default async function PublicLeaguesPage({ searchParams }: PageProps<"/ligues">) {
  await connection();
  const q = String((await searchParams).q ?? "").trim();
  const [all, divisions] = await Promise.all([leaguesOverview(), nationalDivisions()]);
  const rows = all.filter((l) => textMatch(q, l.name, l.department, l.code));

  return (
    <PublicShell eyebrow="Ligues" title="Ligues et divisions" subtitle="Divisions nationales et ligues départementales de la FECOFOOT" wide>
      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-4" aria-labelledby="divisions">
          <h2 id="divisions" className="border-b-2 border-foreground pb-2 text-2xl font-bold uppercase">
            Divisions nationales
          </h2>
          {divisions.length === 0 ? (
            <p className="text-muted-foreground">Aucune division nationale publiée pour le moment.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {divisions.map(({ c, teams, played }) => (
                <li key={c.id}>
                  <Link href={`/competitions/${c.slug}`} className="group flex h-full items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all motion-safe:hover:-translate-y-0.5 hover:shadow-md">
                    <span className="flex flex-col gap-1">
                      <span className="font-display text-xl font-bold uppercase">{c.name}</span>
                      <span className="text-sm text-muted-foreground">
                        Saison {seasonLabel(c.season)} · {teams} club(s) · {publicStatusLabel(c.status, played)}
                      </span>
                    </span>
                    <span aria-hidden className="text-2xl transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="departementales">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-2">
            <h2 id="departementales" className="text-2xl font-bold uppercase">
              Ligues départementales
            </h2>
            <form role="search" className="flex w-full gap-2 sm:w-auto">
              <input
                name="q"
                defaultValue={q}
                placeholder="Ligue ou département"
                aria-label="Rechercher une ligue"
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm sm:w-64"
              />
              <button type="submit" className="h-10 rounded-md bg-brand-ink px-4 text-sm font-semibold text-white">
                Rechercher
              </button>
            </form>
          </div>
          {rows.length === 0 ? (
            <p className="text-muted-foreground">{q ? `Aucune ligue ne correspond à « ${q} ».` : "Aucune ligue publiée."}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((l, i) => {
                const logo = leagueLogoUrl(l);
                return (
                  <li key={l.id} data-reveal="zoom" style={{ ["--rd" as string]: `${Math.min(i, 8) * 50}ms` }}>
                    <Link
                      href={`/ligues/${l.code.toLowerCase()}`}
                      className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all motion-safe:hover:-translate-y-0.5 hover:shadow-md"
                      data-testid="public-league"
                    >
                      <span className="flex items-center gap-3">
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="size-14 rounded-lg border bg-white object-contain p-1" />
                        ) : (
                          <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-brand-ink font-heading text-lg font-bold text-[#fbde4a]">{l.code}</span>
                        )}
                        <span className="flex min-w-0 flex-col">
                          <span className="font-display text-lg leading-tight font-bold uppercase">{l.name}</span>
                          {l.department && <span className="text-xs text-muted-foreground">Département : {l.department}</span>}
                        </span>
                      </span>
                      <span className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs text-muted-foreground">
                        <span>
                          <strong className="block font-heading text-xl text-foreground">{l.clubs}</strong>
                          club(s) affilié(s)
                        </span>
                        <span>
                          <strong className="block font-heading text-xl text-foreground">{l.ongoing}</strong>
                          compétition(s) en cours
                        </span>
                        <span>
                          <strong className="block font-heading text-xl text-foreground">{l.season ? seasonLabel(l.season) : "—"}</strong>
                          saison
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
