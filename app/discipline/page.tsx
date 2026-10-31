import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CalendarIcon, CheckCircleIcon, SearchIcon, ShieldIcon, TrophyIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { SectionTitle } from "@/components/public/section-title";
import { AUTO_REASON_LABELS, DEFAULT_YELLOW_THRESHOLD, SANCTION_LABELS, SANCTION_TYPES, type SanctionType } from "@/lib/discipline";
import { formatDate, formatFcfa } from "@/lib/format";
import { currentSuspensions, publishedDecisions } from "@/lib/queries/discipline";

export const metadata: Metadata = { title: "Décisions disciplinaires — FECOFOOT", description: "Décisions de la commission de discipline de la FECOFOOT, suspensions en cours et règles applicables." };

/** Couleur de chaque type de sanction (liseré, pastille) ; le libellé est toujours écrit à côté. */
const SANCTION_TONES: Record<SanctionType, { bar: string; pill: string }> = {
  WARNING: { bar: "bg-[var(--flag-yellow)]", pill: "bg-[color-mix(in_srgb,var(--flag-yellow)_35%,transparent)] text-brand-ink" },
  MATCH_SUSPENSION: { bar: "bg-[var(--flag-red)]", pill: "bg-[color-mix(in_srgb,var(--flag-red)_14%,transparent)] text-[var(--flag-red)]" },
  TIME_SUSPENSION: { bar: "bg-[var(--flag-red)]", pill: "bg-[color-mix(in_srgb,var(--flag-red)_14%,transparent)] text-[var(--flag-red)]" },
  FINE: { bar: "bg-brand-ink", pill: "bg-brand-ink text-white" },
  POINTS_DEDUCTION: { bar: "bg-[var(--flag-green)]", pill: "bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]" },
};

/** Carton de football dessiné (jaune ou rouge). */
const Card = ({ color, className = "" }: { color: "yellow" | "red"; className?: string }) => (
  <span aria-hidden className={`inline-block h-5 w-3.5 shrink-0 rounded-[2px] shadow-sm ${color === "yellow" ? "bg-[var(--flag-yellow)]" : "bg-[var(--flag-red)]"} ${className}`} />
);

/** Sanction en clair : « Suspension · 3 matchs », « Amende · 50 000 FCFA »… */
function sanctionText(c: { sanctionType: SanctionType | null; suspensionMatches: number | null; suspensionUntil: Date | null; fineAmount: number | null; pointsDeducted: number | null }) {
  switch (c.sanctionType) {
    case "MATCH_SUSPENSION":
      return `Suspension · ${c.suspensionMatches ?? 0} match${(c.suspensionMatches ?? 0) > 1 ? "s" : ""}`;
    case "TIME_SUSPENSION":
      return `Suspension jusqu'au ${formatDate(c.suspensionUntil)}`;
    case "FINE":
      return `Amende · ${formatFcfa(c.fineAmount ?? 0)}`;
    case "POINTS_DEDUCTION":
      return `Retrait de ${c.pointsDeducted ?? 0} point${(c.pointsDeducted ?? 0) > 1 ? "s" : ""}`;
    case "WARNING":
      return "Avertissement";
    default:
      return "Décision";
  }
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Discipline : décisions publiées de la commission, suspensions en cours, règles applicables (EF-DIS-01). */
export default async function PublicDisciplinePage({ searchParams }: PageProps<"/discipline">) {
  await connection();
  const sp = await searchParams;
  const sanction = SANCTION_TYPES.find((t) => t === one(sp.sanction));
  const search = one(sp.q)?.slice(0, 60);
  const [{ list, total, counts }, suspensions] = await Promise.all([publishedDecisions({ sanction, search }), currentSuspensions()]);
  const href = (s?: SanctionType) => {
    const q = new URLSearchParams();
    if (s) q.set("sanction", s);
    if (search) q.set("q", search);
    const str = q.toString();
    return `/discipline${str ? `?${str}` : ""}#decisions`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${active ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:border-[var(--flag-green)] hover:text-[var(--flag-green)]"}`;

  return (
    <PublicShell eyebrow="Commission de discipline" title="Décisions" subtitle="Décisions de la commission de discipline, suspensions en cours et règles applicables aux compétitions de la FECOFOOT." wide>
      <div className="flex flex-col gap-14">
        {/* En bref */}
        <section aria-label="En bref" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              [String(total), total > 1 ? "décisions publiées" : "décision publiée", <ShieldIcon key="d" className="size-5" />],
              [String(suspensions.length), suspensions.length > 1 ? "suspensions en cours" : "suspension en cours", <Card key="s" color="red" />],
            ] as [string, string, ReactNode][]
          ).map(([n, label, icon], i) => (
            <div key={label} data-reveal="left" style={{ ["--rd" as string]: `${i * 120}ms` }} className="flex items-center gap-4 bg-muted/60 p-5">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-card text-[var(--flag-green)]">
                {icon}
              </span>
              <span className="flex items-baseline gap-2">
                <strong className="font-display text-4xl leading-none font-bold tabular-nums">{n}</strong>
                <span className="text-sm text-muted-foreground">{label}</span>
              </span>
            </div>
          ))}
        </section>

        {/* Suspensions en cours : ce que les clubs doivent savoir avant chaque match. */}
        <section aria-labelledby="suspensions" className="flex flex-col gap-6">
          <SectionTitle id="suspensions" icon={<Card color="red" />} title="Suspensions en cours" text="Joueurs qui ne peuvent pas jouer tant que leur suspension n'est pas purgée." />
          {suspensions.length === 0 ? (
            <p data-reveal="up" className="flex items-center gap-3 bg-muted/60 px-5 py-4 text-sm text-muted-foreground">
              <CheckCircleIcon className="size-5 text-[var(--flag-green)]" />
              Aucune suspension en cours.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suspensions.map((s, i) => (
                <li key={s.key} data-reveal="up" style={{ ["--rd" as string]: `${Math.min(i, 8) * 70}ms` }} className="flex items-start gap-3 bg-muted/60 p-4">
                  <span className="flex gap-0.5 pt-0.5">
                    {s.reason === "YELLOW_ACCUMULATION" || s.reason === "TWO_YELLOWS" ? (
                      <>
                        <Card color="yellow" />
                        <Card color={s.reason === "TWO_YELLOWS" ? "red" : "yellow"} className="-ml-1.5 rotate-12" />
                      </>
                    ) : (
                      <Card color="red" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-semibold">{s.name}</span>
                    {s.club && <span className="truncate text-xs text-muted-foreground">{s.club}</span>}
                    <span className="text-xs text-muted-foreground">{s.reason ? `${AUTO_REASON_LABELS[s.reason]}${s.competition ? ` · ${s.competition}` : ""}` : `Décision ${s.caseNumber}`}</span>
                  </span>
                  <span className="shrink-0 bg-[color-mix(in_srgb,var(--flag-red)_14%,transparent)] px-2 py-1 text-center text-xs font-bold text-[var(--flag-red)]">
                    {s.remaining !== null ? `${s.remaining} match${s.remaining > 1 ? "s" : ""}` : s.until ? `Jusqu'au ${formatDate(s.until)}` : "En cours"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Décisions publiées */}
        <section id="decisions" aria-labelledby="decisions-titre" className="flex scroll-mt-28 flex-col gap-6">
          <SectionTitle
            id="decisions-titre"
            icon={<ShieldIcon className="size-5" />}
            title="Décisions publiées"
            text="Sanctions prononcées par la commission de discipline, de la plus récente à la plus ancienne."
            aside={
              total > 0 && (
                <form role="search" action="/discipline#decisions" data-reveal="right" className="flex w-full gap-2 sm:w-auto">
                  {sanction && <input type="hidden" name="sanction" value={sanction} />}
                  <label className="relative flex min-w-0 flex-1 items-center sm:w-72 sm:flex-none">
                    <span className="sr-only">Rechercher une décision</span>
                    <SearchIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                    <input name="q" defaultValue={search} placeholder="Joueur, club, n° de décision…" className="h-10 w-full rounded-md border bg-background pr-3 pl-9 text-sm transition-[border-color,box-shadow] focus:border-[var(--flag-green)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--flag-green)_20%,transparent)] focus:outline-none" />
                  </label>
                  <button type="submit" className="h-10 rounded-md bg-brand-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--flag-green)]">
                    Rechercher
                  </button>
                </form>
              )
            }
          />

          {total > 0 && (
            <nav aria-label="Type de sanction" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <ul className="flex gap-2 sm:flex-wrap">
                <li>
                  <Link href={href()} aria-current={!sanction ? "page" : undefined} className={chip(!sanction)}>
                    Toutes
                    <span className={`rounded-full px-1.5 text-xs tabular-nums ${!sanction ? "bg-white/20" : "bg-muted"}`}>{total}</span>
                  </Link>
                </li>
                {SANCTION_TYPES.filter((t) => counts.get(t)).map((t) => (
                  <li key={t}>
                    <Link href={href(t)} aria-current={sanction === t ? "page" : undefined} className={chip(sanction === t)}>
                      <span aria-hidden className={`size-2.5 rounded-full ${SANCTION_TONES[t].bar}`} />
                      {SANCTION_LABELS[t]}
                      <span className={`rounded-full px-1.5 text-xs tabular-nums ${sanction === t ? "bg-white/20" : "bg-muted"}`}>{counts.get(t)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {list.length === 0 ? (
            <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
              <ShieldIcon className="size-9 text-[var(--flag-green)]" />
              <p className="font-semibold">{total === 0 ? "Aucune décision publiée pour le moment." : "Aucune décision ne correspond à votre recherche."}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {total === 0 ? "Les décisions de la commission de discipline sont publiées ici dès qu'elles sont rendues." : "Essayez un autre nom, un autre club ou un autre type de sanction."}
              </p>
              {total > 0 && (
                <Link href="/discipline#decisions" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
                  Voir toutes les décisions
                </Link>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map(({ c, lastName, firstName, club, competition }, i) => {
                const tone = c.sanctionType ? SANCTION_TONES[c.sanctionType] : SANCTION_TONES.WARNING;
                const who = [lastName && `${firstName} ${lastName}`, club].filter(Boolean).join(" · ") || "Décision générale";
                const long = (c.decision?.length ?? 0) > 280;
                return (
                  <li key={c.id} data-reveal="up" style={{ ["--rd" as string]: `${Math.min(i, 8) * 70}ms` }}>
                    <article aria-labelledby={`decision-${c.id}`} className="relative flex flex-col gap-3 overflow-hidden bg-muted/60 py-5 pr-5 pl-7 sm:pr-6">
                      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-mono font-semibold text-foreground">{c.number}</span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarIcon className="size-3.5" />
                              Décision du {formatDate(c.decidedAt)}
                            </span>
                            {competition && (
                              <span className="inline-flex items-center gap-1">
                                <TrophyIcon className="size-3.5" />
                                {competition}
                              </span>
                            )}
                          </p>
                          <h3 id={`decision-${c.id}`} className="font-heading text-lg leading-snug font-bold">
                            {who}
                          </h3>
                        </div>
                        <span className={`shrink-0 px-3 py-1 text-sm font-bold ${tone.pill}`}>{sanctionText(c)}</span>
                      </div>
                      {c.decision &&
                        (long ? (
                          <details className="group text-sm leading-relaxed text-muted-foreground">
                            <summary className="cursor-pointer list-none">
                              <span className="line-clamp-3 whitespace-pre-line group-open:line-clamp-none">{c.decision}</span>
                              <span className="mt-1 inline-block font-semibold text-[var(--flag-green)] group-open:hidden">Lire la décision complète</span>
                            </summary>
                          </details>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{c.decision}</p>
                        ))}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Règles applicables (celles que la plateforme applique aux feuilles de match). */}
        <section aria-labelledby="regles" className="flex flex-col gap-6">
          <SectionTitle id="regles" icon={<CheckCircleIcon className="size-5" />} title="Les règles" text="Suspensions automatiques calculées à partir des feuilles de match officielles, et sanctions de la commission." />
          <div className="grid gap-3 lg:grid-cols-2">
            <div data-reveal="left" className="flex flex-col gap-4 bg-muted/60 p-5 sm:p-6">
              <h3 className="font-heading text-lg font-bold">Suspensions automatiques</h3>
              <ul className="flex flex-col gap-3 text-sm">
                <li className="flex items-start gap-3">
                  <Card color="red" className="mt-0.5" />
                  <span>
                    <strong>Carton rouge</strong> : 1 match de suspension.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex">
                    <Card color="yellow" />
                    <Card color="yellow" className="-ml-1.5 rotate-12" />
                  </span>
                  <span>
                    <strong>Deux cartons jaunes dans le même match</strong> : 1 match de suspension.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex">
                    <Card color="yellow" />
                    <Card color="yellow" className="-ml-1.5 rotate-6" />
                    <Card color="yellow" className="-ml-1.5 rotate-12" />
                  </span>
                  <span>
                    <strong>Cumul de cartons jaunes</strong> reçus sur des matchs différents : 1 match par série ({DEFAULT_YELLOW_THRESHOLD} par défaut, selon le règlement de chaque compétition).
                  </span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">La suspension se purge sur les matchs suivants du club du joueur, dans la même compétition.</p>
            </div>
            <div data-reveal="right" style={{ ["--rd" as string]: "120ms" }} className="flex flex-col gap-4 bg-muted/60 p-5 sm:p-6">
              <h3 className="font-heading text-lg font-bold">Sanctions de la commission</h3>
              <ul className="flex flex-col gap-2.5 text-sm">
                {SANCTION_TYPES.map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${SANCTION_TONES[t].bar}`} />
                    {SANCTION_LABELS[t]}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Chaque décision porte un numéro ; elle est publiée ici une fois rendue par la commission de discipline.</p>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
