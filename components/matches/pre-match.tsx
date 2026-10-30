import { ClubLogo } from "@/components/public/club-logo";
import { CompareStats, FormRows, type FormItem } from "@/components/matches/form-rows";
import { GOAL_BUCKETS } from "@/lib/competitions";

type Team = { id: number; name: string; logo?: string | null } | null;
type TeamRecord = {
  recent: FormItem[];
  totals: { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; scoringRun: number };
  streaks: { wins: number; unbeaten: number };
} | null;
type Profile = { scored: number[]; conceded: number[]; scorers: { name: string; goals: number }[] } | null;
type Suspension = { id: number; name: string; reason: string };

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function TeamCard({ team, record, profile, suspended, upcoming }: { team: NonNullable<Team>; record: TeamRecord; profile: Profile; suspended: Suspension[]; upcoming: boolean }) {
  return (
    <section aria-label={`Avant-match : ${team.name}`} className="flex flex-col overflow-hidden rounded-2xl bg-muted/60 text-sm">
      <p className="flex items-center gap-2.5 border-b bg-muted/50 px-4 py-3 font-semibold">
        <ClubLogo src={team.logo} name={team.name} className="size-7 text-[0.55rem]" />
        <span className="min-w-0 truncate">{team.name}</span>
      </p>
      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Forme récente</h3>
          <FormRows items={record?.recent ?? []} />
          {record && record.recent.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  [record.streaks.wins, "victoire", "victoires", "d'affilée"],
                  [record.streaks.unbeaten, "match", "matchs", "sans défaite"],
                  [record.totals.scoringRun, "match", "matchs", "avec au moins un but"],
                ] as const
              ).map(([n, one, many, tail]) => (
                <li key={tail} className="rounded-full bg-muted px-2.5 py-1">
                  <strong className="tabular-nums">{n}</strong> {n > 1 ? many : one} {tail}
                </li>
              ))}
            </ul>
          )}
        </div>

        {upcoming && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Suspendus pour ce match</h3>
            {suspended.length === 0 ? (
              <p className="text-muted-foreground">Aucun joueur suspendu.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {suspended.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span aria-hidden className="inline-block h-4 w-3 rounded-[2px] bg-[var(--flag-red)]" />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">· {p.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Meilleurs buteurs dans la compétition</h3>
          {profile && profile.scorers.length > 0 ? (
            <ol className="flex flex-col gap-1">
              {profile.scorers.map((p, i) => (
                <li key={p.name} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="font-semibold tabular-nums">{plural(p.goals, "but", "buts")}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Aucun but enregistré dans la compétition.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Buts marqués et encaissés par tranche de 15 minutes, côte à côte pour les deux équipes. */
function GoalTimes({ teams, profiles }: { teams: [NonNullable<Team>, NonNullable<Team>]; profiles: [NonNullable<Profile>, NonNullable<Profile>] }) {
  const max = Math.max(1, ...profiles.flatMap((p) => [...p.scored, ...p.conceded]));
  const bar = (n: number, tone: string) => (
    <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
      <span className={`rounded-full ${tone}`} style={{ width: `${(n / max) * 100}%` }} />
    </span>
  );
  return (
    <section aria-labelledby="buts-minutes" className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
      <h3 id="buts-minutes" className="font-heading text-base font-bold uppercase">
        Buts par tranche de 15 minutes
      </h3>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-full bg-[var(--flag-green)]" /> Marqués
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-full bg-muted-foreground/60" /> Encaissés
        </span>
        <span>Résultats validés de la compétition</span>
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-16 py-1 text-left font-semibold">
              Minutes
            </th>
            {teams.map((t) => (
              <th key={t.id} scope="col" className="py-1 text-left font-semibold">
                <span className="line-clamp-1">{t.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GOAL_BUCKETS.map((label, i) => (
            <tr key={label} className="border-t">
              <th scope="row" className="py-2 text-left font-medium tabular-nums">
                {label}&apos;
              </th>
              {profiles.map((p, k) => (
                <td key={k} className="py-2 pr-3">
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="w-4 text-right font-semibold tabular-nums">{p.scored[i]}</span>
                      {bar(p.scored[i], "bg-[var(--flag-green)]")}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-4 text-right tabular-nums">{p.conceded[i]}</span>
                      {bar(p.conceded[i], "bg-muted-foreground/60")}
                    </span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type Stadium = { name: string; city: string; address: string | null; capacity: number | null; surface: string | null; openedYear: number | null; description: string | null };

/** Fiche du stade enregistré par la fédération. */
function StadiumCard({ stadium }: { stadium: Stadium }) {
  const facts = [
    ["Ville", stadium.city],
    ["Adresse", stadium.address],
    ["Capacité", stadium.capacity ? `${stadium.capacity.toLocaleString("fr-FR")} places` : null],
    ["Pelouse", stadium.surface],
    ["Inauguration", stadium.openedYear ? String(stadium.openedYear) : null],
  ].filter((f): f is [string, string] => Boolean(f[1]));
  return (
    <section aria-labelledby="le-stade" className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
      <h3 id="le-stade" className="flex items-center gap-2 font-heading text-base font-bold uppercase">
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 text-flag-green" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
        </svg>
        Le stade · {stadium.name}
      </h3>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {stadium.description && <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{stadium.description}</p>}
    </section>
  );
}

/**
 * Avant-match : forme et séries, suspendus (avant le coup d'envoi), buteurs, buts par tranche de minutes.
 * Uniquement des résultats validés et des décisions enregistrées ; aucune estimation.
 */
export function PreMatch({
  teams,
  records,
  profiles,
  suspensions,
  upcoming,
  stadium,
}: {
  stadium?: Stadium | null;
  teams: Team[];
  records: TeamRecord[];
  profiles: Profile[];
  suspensions: Suspension[][];
  upcoming: boolean;
}) {
  const [home, away] = teams;
  const [rh, ra] = records;
  return (
    <div className="flex flex-col gap-6">
      {home && away && rh && ra && rh.totals.played + ra.totals.played > 0 && (
        <section aria-labelledby="stats-generales" className="flex flex-col gap-4 rounded-2xl bg-muted/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <ClubLogo src={home.logo} name={home.name} className="size-8 text-[0.6rem]" />
            <div className="text-center">
              <h3 id="stats-generales" className="font-heading text-base font-bold uppercase">
                Statistiques générales
              </h3>
              <p className="text-xs text-muted-foreground">10 derniers matchs officiels, toutes compétitions</p>
            </div>
            <ClubLogo src={away.logo} name={away.name} className="size-8 text-[0.6rem]" />
          </div>
          <CompareStats
            rows={[
              { label: "Victoires", home: rh.totals.wins, away: ra.totals.wins },
              { label: "Nuls", home: rh.totals.draws, away: ra.totals.draws },
              { label: "Défaites", home: rh.totals.losses, away: ra.totals.losses },
              { label: "Buts marqués", home: rh.totals.goalsFor, away: ra.totals.goalsFor },
              { label: "Buts encaissés", home: rh.totals.goalsAgainst, away: ra.totals.goalsAgainst },
            ]}
          />
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {teams.map((t, i) => (t ? <TeamCard key={t.id} team={t} record={records[i]} profile={profiles[i]} suspended={suspensions[i] ?? []} upcoming={upcoming} /> : null))}
      </div>
      {home && away && profiles[0] && profiles[1] && <GoalTimes teams={[home, away]} profiles={[profiles[0], profiles[1]]} />}
      {stadium && <StadiumCard stadium={stadium} />}
    </div>
  );
}
