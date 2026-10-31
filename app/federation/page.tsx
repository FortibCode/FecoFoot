import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { CalendarIcon, CheckCircleIcon, GroupIcon, PinIcon, ShieldIcon, TrophyIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { GOVERNANCE_BODY_KIND_LABELS, positionRank, type GovernanceBodyKind } from "@/lib/governance";
import { publishedBodies } from "@/lib/queries/governance";
import { siteSettingsRow } from "@/lib/queries/reference";
import { memberPhotoUrl } from "@/lib/member-photo";

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

type Member = { id: number; fullName: string; position: string; photoKey: string | null; photoCredit: string | null };

/**
 * Carte portrait d'un membre : sa photo officielle seule (ou, à défaut, un portrait aux couleurs de la fédération
 * avec ses initiales) ; le président : filet jaune. Au toucher, au survol ou au clavier : un voile couvre la photo
 * et le nom et la fonction apparaissent en son centre.
 */
function MemberCard({ m, index }: { m: Member; index: number }) {
  const photo = memberPhotoUrl(m);
  const president = positionRank(m.position) === 0;
  return (
    // Distribution : depuis la gauche, le bas, puis la droite, à tour de rôle, une carte après l'autre.
    <li
      data-reveal="deal"
      style={{
        ["--rd" as string]: `${200 + Math.min(index, 10) * 220}ms`,
        ["--deal-x" as string]: ["-120px", "0px", "120px"][index % 3],
        ["--deal-r" as string]: ["-8deg", "3deg", "8deg"][index % 3],
      }}
    >
      <figure
        tabIndex={0}
        className="group flex h-full cursor-pointer flex-col overflow-hidden bg-brand-ink transition-[transform,box-shadow] duration-300 ease-out outline-none hover:shadow-[0_22px_44px_-22px_rgb(0_0_0/0.6)] focus-visible:ring-2 focus-visible:ring-[var(--flag-green)] focus-visible:ring-offset-2 motion-safe:hover:-translate-y-1.5 motion-safe:focus:-translate-y-1.5"
      >
        <div className={`relative aspect-[3/4] overflow-hidden bg-brand-ink ${president ? "border-b-4 border-[var(--flag-yellow)]" : ""}`}>
          <div className="deal-photo absolute inset-0 bg-[linear-gradient(160deg,#6b7470_0%,#3f4744_100%)]">
            {photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- portrait servi par la route des médias */}
                <img src={photo} alt={`${m.fullName}, ${m.position}`} loading="lazy" className="size-full object-cover object-top transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.06] motion-safe:group-focus:scale-[1.06]" />
                {m.photoCredit && <span className="absolute right-2 bottom-2 bg-black/45 px-1.5 py-0.5 text-[0.6rem] text-white/85">© {m.photoCredit}</span>}
              </>
            ) : (
              // Sans photo officielle : écusson en filigrane et initiales.
              <div aria-hidden className="relative grid size-full place-items-center overflow-hidden bg-[linear-gradient(160deg,var(--flag-green)_0%,var(--brand-ink)_85%)]">
                <span className="absolute -right-10 -bottom-8 aspect-[1741/1975] h-[85%] bg-white opacity-[0.08] [mask:url(/fecofoot-mark.svg)_center/contain_no-repeat]" />
                <span className="font-display text-6xl font-bold tracking-wide text-white/90 transition-opacity duration-300 group-hover:opacity-0 group-focus:opacity-0 sm:text-7xl">{initials(m.fullName)}</span>
              </div>
            )}
          </div>
          {/* Au toucher : voile aux couleurs de la fédération, nom et fonction au centre de la photo. */}
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--brand-ink)_55%,transparent)_0%,color-mix(in_srgb,var(--flag-green)_62%,var(--brand-ink))_100%)] px-4 text-center text-white opacity-0 transition-opacity duration-400 ease-out group-hover:opacity-100 group-focus:opacity-100"
          >
            <span className="translate-y-4 font-display text-xl leading-tight font-bold uppercase transition-transform duration-500 ease-out group-hover:translate-y-0 group-focus:translate-y-0 sm:text-2xl">{m.fullName}</span>
            <span aria-hidden className="h-1 w-12 translate-y-4 bg-[linear-gradient(90deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)] transition-transform delay-75 duration-500 ease-out group-hover:translate-y-0 group-focus:translate-y-0" />
            <span className={`translate-y-4 text-sm font-semibold transition-transform delay-100 duration-500 ease-out group-hover:translate-y-0 group-focus:translate-y-0 ${president ? "text-[var(--flag-yellow)]" : "text-white/85"}`}>{m.position}</span>
          </div>
        </div>
        {/* Nom et fonction : affichés au centre de la photo au toucher ; toujours lus par les lecteurs d'écran. */}
        <figcaption className="sr-only">
          {m.fullName}, {m.position}
        </figcaption>
      </figure>
    </li>
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
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                      {b.members.map((m, i) => (
                        <MemberCard key={m.id} m={m} index={i} />
                      ))}
                    </ul>
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
