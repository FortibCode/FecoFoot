import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CalendarIcon, CheckCircleIcon, GroupIcon, PinIcon, ShieldIcon, TrophyIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { GOVERNANCE_BODY_KIND_LABELS, positionRank, type GovernanceBodyKind } from "@/lib/governance";
import { publishedBodies } from "@/lib/queries/governance";
import { siteSettingsRow } from "@/lib/queries/reference";

export const metadata: Metadata = {
  title: "La Fédération — FECOFOOT",
  description: "Comité exécutif, commissions et instances de la Fédération Congolaise de Football : composition et fonctions.",
};

/** Pictogramme de chaque type d'instance. */
const KIND_ICONS: Record<GovernanceBodyKind, (className: string) => ReactNode> = {
  EXECUTIVE: (c) => <TrophyIcon className={c} />,
  GENERAL_ASSEMBLY: (c) => <GroupIcon className={c} />,
  JUDICIAL: (c) => <ShieldIcon className={c} />,
  PERMANENT: (c) => <GroupIcon className={c} />,
  INDEPENDENT: (c) => <CheckCircleIcon className={c} />,
  OTHER: (c) => <GroupIcon className={c} />,
};

/** Initiales d'un membre : premier et dernier mot du nom (« Éric Alain MANTOT » → « ÉM »). */
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

/** Médaillon d'initiales dans un anneau aux couleurs du drapeau. */
function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-[conic-gradient(var(--flag-green)_0_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%_100%)] p-[3px] ${size === "lg" ? "size-16" : "size-12"}`}
    >
      <span className={`grid size-full place-items-center rounded-full bg-brand-ink font-display font-bold text-white ${size === "lg" ? "text-xl" : "text-base"}`}>{initials(name)}</span>
    </span>
  );
}

/** Présentation de la fédération et composition de ses instances (gouvernance). */
export default async function FederationPage() {
  await connection();
  const [bodies, settings] = await Promise.all([publishedBodies(), siteSettingsRow()]);
  // Informations institutionnelles : paramètres du portail (administration), seulement celles renseignées.
  const facts = (
    [
      ["Fondée en", settings?.foundedYear ? String(settings.foundedYear) : null, <CalendarIcon key="c" className="size-5" />],
      ["Siège", settings?.headquarters ?? null, <PinIcon key="p" className="size-5" />],
      ["Affiliations", settings?.affiliations ?? null, <CheckCircleIcon key="a" className="size-5" />],
    ] as [string, string | null, ReactNode][]
  ).filter((f): f is [string, string, ReactNode] => f[1] !== null);

  return (
    <PublicShell eyebrow="La Fédération" title="La Fédération" subtitle="Fédération Congolaise de Football · membre de la FIFA, de la CAF et de l'UNIFFAC" wide>
      <div className="flex flex-col gap-14">
        {/* Carte d'identité de la fédération : écusson, nom, informations clés. */}
        <section aria-label="La fédération en bref" data-reveal="up" className="relative isolate overflow-hidden bg-[var(--flag-green)] p-6 text-white sm:p-10">
          <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[7%] sm:w-[30%]">
            <polygon points="70,0 200,0 200,300 70,300 150,150" fill="var(--flag-yellow)" />
            <polygon points="-30,0 22,0 102,150 22,300 -30,300 50,150" fill="var(--flag-yellow)" opacity="0.35" />
          </svg>
          <div className="flex flex-col gap-8 pr-4 sm:max-w-[72%] sm:pr-0">
            <div className="flex items-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- écusson officiel, fichier statique */}
              <img src="/logo-fecofoot.png" alt="" data-reveal="zoom" style={{ ["--rd" as string]: "150ms" }} className="h-20 w-auto shrink-0 drop-shadow-[0_6px_14px_rgb(0_0_0/0.3)] sm:h-28" />
              <div data-reveal="left" style={{ ["--rd" as string]: "250ms" }} className="flex flex-col gap-1">
                <span className="font-display text-xs font-bold tracking-[0.2em] text-white/75 uppercase">FECOFOOT</span>
                <span className="font-display text-2xl leading-tight font-bold uppercase sm:text-4xl">Fédération Congolaise de Football</span>
              </div>
            </div>
            {facts.length > 0 && (
              <dl className="grid gap-3 sm:grid-cols-3">
                {facts.map(([k, v, icon], i) => (
                  <div key={k} data-reveal="up" style={{ ["--rd" as string]: `${350 + i * 110}ms` }} className="flex items-start gap-3 border border-white/40 p-4">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
                      {icon}
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[0.7rem] font-semibold tracking-[0.14em] text-white/75 uppercase">{k}</dt>
                      <dd className="mt-0.5 font-semibold leading-snug">{v}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        {bodies.length === 0 ? (
          <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
            <GroupIcon className="size-9 text-[var(--flag-green)]" />
            <p className="font-semibold">La composition des instances sera publiée prochainement.</p>
          </div>
        ) : (
          <>
            {/* Sommaire : accès direct à chaque instance. */}
            <nav aria-label="Instances de la fédération" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <ul className="flex gap-2 sm:flex-wrap">
                {bodies.map((b, i) => (
                  <li key={b.id} data-reveal="left" style={{ ["--rd" as string]: `${i * 70}ms` }}>
                    <a
                      href={`#instance-${b.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold whitespace-nowrap transition-colors hover:border-[var(--flag-green)] hover:text-[var(--flag-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flag-green"
                    >
                      {KIND_ICONS[b.kind]("size-4")}
                      {b.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {bodies.map((b) => {
              const leaders = b.members.filter((m) => positionRank(m.position) <= 1);
              const others = b.members.filter((m) => positionRank(m.position) > 1);
              const kind = GOVERNANCE_BODY_KIND_LABELS[b.kind];
              return (
                <section key={b.id} aria-labelledby={`instance-${b.id}`} className="flex scroll-mt-28 flex-col gap-6">
                  <div className="flex items-start gap-4">
                    <span data-reveal="zoom" aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--flag-green)_14%,transparent)] text-[var(--flag-green)]">
                      {KIND_ICONS[b.kind]("size-5")}
                    </span>
                    <div data-reveal="left" style={{ ["--rd" as string]: "100ms" }} className="flex max-w-3xl flex-col gap-1.5">
                      {kind !== b.name && <p className="text-xs font-semibold tracking-[0.16em] text-[var(--flag-green)] uppercase">{kind}</p>}
                      <h2 id={`instance-${b.id}`} className="text-2xl leading-tight font-bold uppercase sm:text-3xl">
                        {b.name}
                      </h2>
                      {b.description && <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{b.description}</p>}
                    </div>
                  </div>

                  {b.members.length === 0 ? (
                    <p data-reveal="up" className="flex items-center gap-3 bg-muted/60 px-5 py-4 text-sm text-muted-foreground">
                      <GroupIcon className="size-5 text-[var(--flag-green)]" />
                      Composition à publier.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {leaders.length > 0 && (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {leaders.map((m, i) => {
                            // Le président : carte foncée mise en valeur ; les vice-présidents : cartes claires.
                            const president = positionRank(m.position) === 0;
                            return (
                              <li key={m.id} data-reveal="left" style={{ ["--rd" as string]: `${150 + i * 120}ms` }}>
                                <div
                                  className={`group relative isolate flex h-full items-center gap-4 overflow-hidden p-5 transition-[transform,box-shadow] duration-300 ease-out hover:shadow-[0_18px_36px_-20px_rgb(0_0_0/0.45)] motion-safe:hover:-translate-y-1 ${president ? "bg-brand-ink text-white" : "bg-muted/60"}`}
                                >
                                  {president && (
                                    <svg aria-hidden viewBox="0 0 200 300" preserveAspectRatio="xMaxYMid slice" className="absolute inset-y-0 right-0 -z-10 h-full w-[22%] transition-transform duration-500 ease-out motion-safe:group-hover:translate-x-1.5">
                                      <polygon points="70,0 200,0 200,300 70,300 150,150" fill="var(--flag-yellow)" />
                                    </svg>
                                  )}
                                  <Avatar name={m.fullName} size="lg" />
                                  <span className="min-w-0 pr-8">
                                    <span className={`block text-xs font-semibold tracking-[0.14em] uppercase ${president ? "text-[var(--flag-yellow)]" : "text-[var(--flag-green)]"}`}>{m.position}</span>
                                    <span className="block font-display text-xl leading-tight font-bold">{m.fullName}</span>
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {others.length > 0 && (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {others.map((m, i) => (
                            <li key={m.id} data-reveal="up" style={{ ["--rd" as string]: `${200 + Math.min(i, 8) * 70}ms` }}>
                              <div className="flex h-full items-center gap-3 bg-muted/60 p-4 transition-[background-color,transform] duration-300 ease-out hover:bg-muted motion-safe:hover:-translate-y-0.5">
                                <Avatar name={m.fullName} />
                                <span className="min-w-0">
                                  <span className="block text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{m.position}</span>
                                  <span className="block font-semibold">{m.fullName}</span>
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </PublicShell>
  );
}
