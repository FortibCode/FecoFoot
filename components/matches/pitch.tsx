import { TeamBadge } from "@/components/public/team-badge";
import { pitchLines } from "@/lib/competitions";

export type LineupPlayer = { id: number; number: number | null; firstName: string; lastName: string; position: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD" | null; starter: boolean; captain?: boolean; photo?: string | null };
type Side = { id: number; name: string; logo?: string | null; flag?: string | null; formation?: string | null; players: LineupPlayer[] };

/** Hauteur (en % du terrain) de chaque ligne : extérieur en haut, domicile en bas. */
const AWAY_Y = [8, 19, 31, 43];
const HOME_Y = [90, 79, 67, 55];
/** Une seule équipe connue (sélection) : ses lignes occupent tout le terrain, gardien en bas. */
const SINGLE_Y = [89, 68, 45, 20];

function Dot({ p, home }: { p: LineupPlayer; home: boolean }) {
  return (
    <li className="flex w-16 flex-col items-center gap-1 text-center sm:w-20">
      {p.photo ? (
        <span className="relative">
          {/* Photo publiée avec l'accord du joueur ; le numéro en pastille. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par la route des licences */}
          <img src={p.photo} alt="" className={`size-10 rounded-full bg-white object-cover shadow-md ring-2 sm:size-12 ${home ? "ring-white/80" : "ring-[var(--flag-yellow)]"}`} />
          <span className="absolute -bottom-1 left-1/2 grid h-4 min-w-4 -translate-x-1/2 place-items-center rounded-full bg-brand-ink px-1 text-[0.6rem] font-bold text-white tabular-nums">{p.number ?? ""}</span>
        </span>
      ) : (
        <span
          className={`grid size-8 place-items-center rounded-full text-xs font-bold tabular-nums shadow-md ring-2 sm:size-9 sm:text-sm ${home ? "bg-brand-ink text-white ring-white/80" : "bg-white text-brand-ink ring-[var(--flag-yellow)]"}`}
        >
          {p.number ?? ""}
        </span>
      )}
      {p.captain && (
        <span aria-hidden className="-mt-3 ml-7 grid size-4 place-items-center rounded-full bg-[var(--flag-yellow)] text-[0.6rem] font-bold text-brand-ink ring-1 ring-black/20 sm:ml-8">
          C
        </span>
      )}
      <span className="w-full truncate text-[0.65rem] leading-tight font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.7)] sm:text-xs">{p.lastName}</span>
    </li>
  );
}

function Bench({ side, home }: { side: Side; home: boolean }) {
  const bench = side.players.filter((p) => !p.starter);
  // Système annoncé par le staff, sinon déduit des postes des titulaires.
  const formation = side.formation ?? pitchLines(side.players.filter((p) => p.starter)).formation;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card text-sm">
      <p className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5 font-semibold">
        <span aria-hidden className={`size-2.5 rounded-full ${home ? "bg-brand-ink" : "bg-white ring-2 ring-[var(--flag-yellow)]"}`} />
        <TeamBadge name={side.name} logo={side.logo} flag={side.flag} size="xs" />
        <span className="min-w-0 truncate">{side.name}</span>
        {formation && <span className="ml-auto shrink-0 rounded bg-muted px-2 py-0.5 text-xs tabular-nums">{formation}</span>}
      </p>
      <div className="px-4 py-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titulaires</p>
        <ul>
          {side.players
            .filter((p) => p.starter)
            .map((p) => (
              <li key={p.id} className="flex gap-3 py-0.5">
                <span className="w-6 shrink-0 text-right font-bold tabular-nums">{p.number ?? ""}</span>
                {p.firstName} {p.lastName}
                {p.captain && <span className="rounded bg-[var(--flag-yellow)] px-1 text-[0.65rem] font-bold text-brand-ink" title="Capitaine">C</span>}
              </li>
            ))}
        </ul>
        {bench.length > 0 && (
          <>
            <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remplaçants</p>
            <ul>
              {bench.map((p) => (
                <li key={p.id} className="flex gap-3 py-0.5 text-muted-foreground">
                  <span className="w-6 shrink-0 text-right font-bold tabular-nums">{p.number ?? ""}</span>
                  {p.firstName} {p.lastName}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Compositions sur un terrain : titulaires placés par ligne d'après leur poste (système déduit),
 * domicile en bas, extérieur en haut ; listes des titulaires et remplaçants à côté.
 * Le terrain est décoratif : les listes portent l'information pour les lecteurs d'écran.
 */
export function Pitch({ home, away }: { home: Side | null; away: Side | null }) {
  const sides = [away, home];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div
        aria-hidden
        className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-2xl bg-[repeating-linear-gradient(180deg,#2f8a46_0_8.33%,#2a7f40_8.33%_16.66%)] shadow-md"
      >
        <svg viewBox="0 0 200 300" className="absolute inset-0 size-full" fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="1.2">
          <rect x="6" y="6" width="188" height="288" rx="2" />
          <line x1="6" y1="150" x2="194" y2="150" />
          <circle cx="100" cy="150" r="24" />
          <circle cx="100" cy="150" r="1.6" fill="rgb(255 255 255 / 0.55)" />
          <rect x="52" y="6" width="96" height="40" />
          <rect x="78" y="6" width="44" height="14" />
          <rect x="52" y="254" width="96" height="40" />
          <rect x="78" y="280" width="44" height="14" />
        </svg>
        {sides.map((side, k) => {
          if (!side) return null;
          const isHome = k === 1;
          const single = !(home && away);
          const { lines } = pitchLines(side.players.filter((p) => p.starter));
          return lines.map((line, i) =>
            line.length === 0 ? null : (
              <ul key={`${side.id}-${i}`} className="absolute inset-x-0 flex -translate-y-1/2 justify-around px-1" style={{ top: `${(single ? SINGLE_Y : isHome ? HOME_Y : AWAY_Y)[i]}%` }}>
                {line.map((p) => (
                  <Dot key={p.id} p={p} home={isHome} />
                ))}
              </ul>
            ),
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {home && <Bench side={home} home />}
        {away && <Bench side={away} home={false} />}
      </div>
    </div>
  );
}
