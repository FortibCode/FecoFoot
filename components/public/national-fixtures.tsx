import Link from "next/link";
import { flagUrl } from "@/lib/flags";
import { formatDayMonth, formatMatchDate, kickoffTime } from "@/lib/format";
import type { nationalFixturesOverview } from "@/lib/queries/national";

type Row = Awaited<ReturnType<typeof nationalFixturesOverview>>["played"][number];

/** Drapeau (décoratif : le nom du pays est écrit à côté). */
function Flag({ country }: { country: string }) {
  const src = flagUrl(country);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- petit SVG statique
  return <img src={src} alt="" width={36} height={24} className="h-6 w-9 shrink-0 rounded-[3px] object-cover shadow-sm ring-1 ring-black/10" />;
}

/** Nom du pays avec son drapeau ; `flagAfter` place le drapeau après le nom (côté gauche du score). */
function Team({ name, flagAfter = false }: { name: string; flagAfter?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {!flagAfter && <Flag country={name} />}
      <span className="truncate">{name}</span>
      {flagAfter && <Flag country={name} />}
    </span>
  );
}

/** Ville du lieu : dernière partie de « Stade …, Ville ». */
const splitVenue = (venue: string | null) => {
  if (!venue) return null;
  const i = venue.lastIndexOf(",");
  return i < 0 ? { stadium: venue, city: null } : { stadium: venue.slice(0, i).trim(), city: venue.slice(i + 1).trim() };
};

/** Prochain match, façon affiche : date en bandeau rouge, journée, affiche, stade et heure. */
function UpcomingCard({ row, index }: { row: Row; index: number }) {
  const { f } = row;
  const venue = splitVenue(f.venue);
  const time = kickoffTime(f.kickoffAt);
  const [home, away] = f.isHome ? ["Congo", f.opponent] : [f.opponent, "Congo"];
  return (
    <li data-reveal="left" style={{ ["--rd" as string]: `${index * 120}ms` }}>
      <Link href={`/equipes-nationales/${row.teamSlug}`} className="group block overflow-hidden rounded-2xl bg-brand-ink transition-transform duration-300 motion-safe:hover:-translate-y-1 text-white shadow-md transition-shadow hover:shadow-xl">
        <div className="flex items-center gap-3">
          <span className="shrink-0 whitespace-nowrap bg-[var(--flag-red)] px-4 py-2 font-display text-lg font-bold uppercase [clip-path:polygon(0_0,100%_0,calc(100%-0.75rem)_100%,0_100%)] pr-6">
            {formatDayMonth(f.kickoffAt)}
          </span>
          {f.competition && <span className="font-heading text-sm font-semibold whitespace-nowrap uppercase tracking-wide text-[var(--flag-yellow)]">{f.competition}</span>}
          <span className="ml-auto hidden pr-4 text-[0.65rem] whitespace-nowrap sm:inline font-semibold uppercase tracking-[0.14em] text-white/50">{row.team}</span>
        </div>
        <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-[1.35rem] font-bold uppercase sm:gap-x-3 sm:text-3xl">
            <Team name={home} />
            <span className="rounded bg-[var(--flag-yellow)] px-1.5 py-0.5 text-sm text-brand-ink italic">VS</span>
            <Team name={away} />
          </p>
          {venue && (
            <p className="text-xs uppercase tracking-wide text-white/70">
              {venue.stadium}
              {venue.city && (
                <>
                  , <strong className="text-white">{venue.city}</strong>
                </>
              )}
            </p>
          )}
          {time && <p className="font-heading text-sm font-semibold text-[var(--flag-yellow)]">{time}</p>}
        </div>
      </Link>
    </li>
  );
}

/** Résultat : équipes de part et d'autre du score, date et lieu en dessous. */
function ResultRow({ row, index }: { row: Row; index: number }) {
  const { f } = row;
  const [homeGoals, awayGoals] = f.isHome ? [f.goalsFor, f.goalsAgainst] : [f.goalsAgainst, f.goalsFor];
  const outcome = f.goalsFor! > f.goalsAgainst! ? "V" : f.goalsFor === f.goalsAgainst ? "N" : "D";
  const tone = { V: "text-[var(--flag-green)]", N: "text-foreground", D: "text-[var(--flag-red)]" }[outcome];
  const venue = splitVenue(f.venue);
  return (
    <li data-reveal="right" style={{ ["--rd" as string]: `${index * 120}ms` }} className="border-b py-4 last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 font-display text-lg font-bold uppercase sm:text-xl">
        <span className="min-w-0 justify-self-end">
          <Team name={f.isHome ? "Congo" : f.opponent} flagAfter />
        </span>
        <span className={`rounded-md bg-muted px-3 py-1 tabular-nums ${tone}`}>
          {homeGoals} - {awayGoals}
        </span>
        <span className="min-w-0">
          <Team name={f.isHome ? f.opponent : "Congo"} />
        </span>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {formatMatchDate(f.kickoffAt)}
        {venue && ` / ${venue.stadium}`}
        {f.competition && ` · ${f.competition}`}
      </p>
    </li>
  );
}

/** Derniers résultats et prochains matchs des sélections nationales (page d'accueil). */
export function NationalFixtures({ played, upcoming }: Awaited<ReturnType<typeof nationalFixturesOverview>>) {
  if (played.length === 0 && upcoming.length === 0) return null;
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col">
        <h3 className="border-b-2 border-foreground pb-2 font-heading text-xl font-bold uppercase">Prochains matchs</h3>
        {upcoming.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Aucun match programmé.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {upcoming.map((r, i) => (
              <UpcomingCard key={r.f.id} row={r} index={i} />
            ))}
          </ul>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <h3 className="border-b-2 border-foreground pb-2 font-heading text-xl font-bold uppercase">Derniers résultats</h3>
        {played.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Aucun résultat.</p>
        ) : (
          <ul className="rounded-b-xl bg-card/70 px-2">
            {played.map((r, i) => (
              <ResultRow key={r.f.id} row={r} index={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
