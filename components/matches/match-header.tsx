import Link from "next/link";
import type { ReactNode } from "react";
import { TeamBadge } from "@/components/public/team-badge";

type Side = { name: string; logo?: string | null; flag?: string | null; extra?: ReactNode };

const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", hour: "2-digit", minute: "2-digit" });

function Team({ side, align }: { side: Side; align: "end" | "start" }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1.5 text-center sm:gap-2 ${align === "end" ? "sm:items-end sm:text-right" : "sm:items-start sm:text-left"}`}>
      <div className={`flex min-w-0 flex-col items-center gap-2 sm:gap-3 ${align === "end" ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
        <TeamBadge name={side.name} logo={side.logo} flag={side.flag} size="md" className="sm:size-16" />
        <span className="font-display text-base leading-tight font-semibold sm:text-3xl">{side.name}</span>
      </div>
      {side.extra}
    </div>
  );
}

/**
 * En-tête d'un match, compact : compétition en petit, les deux équipes de part et d'autre du score (ou de
 * l'heure), date et statut. Même présentation pour les matchs de club et des sélections.
 */
export function MatchHeader({
  title,
  stage,
  stageHref,
  stageLogo,
  home,
  away,
  main,
  live = false,
  date,
  status,
  details,
  below,
  actions,
}: {
  /** Titre de la page (« Congo – Cameroun »), lu par les lecteurs d'écran et les moteurs de recherche. */
  title: string;
  stage: string;
  stageHref?: string;
  stageLogo?: string | null;
  home: Side;
  away: Side;
  /** Score (« 1 - 1 ») ou heure du coup d'envoi. */
  main: string;
  live?: boolean;
  date: Date | null;
  status?: ReactNode;
  /** Précisions sous le statut (tirs au but, validation…). */
  details?: ReactNode;
  below?: ReactNode;
  /** Suivre, partager, ajouter à l'agenda : en haut à droite (sous le match sur téléphone). */
  actions?: ReactNode;
}) {
  const time = date ? timeFmt.format(date) : null;
  return (
    <section aria-label="Score" className="relative bg-muted/60 px-3 py-4 sm:px-8 sm:py-6">
      <h1 className="sr-only">{title}</h1>
      <p className="flex flex-wrap items-center justify-center gap-2 text-center text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase sm:px-36">
        {stageLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- logo servi par la route des médias
          <img src={stageLogo} alt="" className="size-5 rounded bg-white object-contain" />
        )}
        {stageHref ? (
          <Link href={stageHref} className="hover:text-foreground hover:underline">
            {stage}
          </Link>
        ) : (
          stage
        )}
      </p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:mt-4 sm:items-center sm:gap-8">
        <Team side={home} align="end" />
        <div className="flex flex-col items-center gap-1.5 pt-2 text-center sm:pt-0">
          <span className={`font-display text-4xl leading-none font-bold tabular-nums sm:text-5xl ${live ? "text-[var(--flag-red)]" : ""}`}>{main}</span>
          {date && (
            <span className="text-[0.7rem] font-medium whitespace-nowrap text-muted-foreground uppercase">
              {dayFmt.format(date).replace(".", "")}
              {time && time !== "00:00" && main !== time.replace(":", "h") ? ` · ${time}` : ""}
            </span>
          )}
          {status}
          {details}
        </div>
        <Team side={away} align="start" />
      </div>
      {below}
      {actions && <div className="mt-4 flex justify-center sm:absolute sm:top-3 sm:right-3 sm:mt-0">{actions}</div>}
    </section>
  );
}
