import { BrandLogo } from "@/components/brand-logo";
import { formatFcfa } from "@/lib/format";
import { EVENT_KIND_LABELS, type EventKind } from "@/lib/ticketing";

const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** « Éliminatoires CAN 2027 : Congo – Comores (…) » → compétition, équipes, précision. */
function parseTitle(title: string) {
  const [competition, rest] = title.includes(" : ") ? [title.slice(0, title.indexOf(" : ")), title.slice(title.indexOf(" : ") + 3)] : [null, title];
  const detail = rest.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
  const match = rest.replace(/\s*\([^)]+\)\s*$/, "");
  const teams = match.split(/\s+[–-]\s+/);
  return { competition, detail, teams: teams.length === 2 ? (teams as [string, string]) : null, match };
}

const STAMP: Record<string, string> = { USED: "Utilisé", CANCELLED: "Annulé", REFUNDED: "Remboursé", RESERVED: "Paiement en attente" };

/**
 * E-billet nominatif (EF-SUP-02, EF-BIL-04), au format d'un billet de stade : partie principale
 * (rencontre, date, lieu, porte, tribune, prix, titulaire) et talon détachable portant le QR code
 * d'entrée. Pleine largeur : talon à droite ; écran étroit : talon sous le billet.
 */
export function ETicket({
  qr,
  t,
}: {
  qr: string;
  t: {
    number: string;
    holderName: string;
    category: string;
    gate: string;
    price: number;
    status: string;
    event: string;
    kind?: EventKind;
    kickoffAt: Date;
    venue: string;
    orderRef?: string;
  };
}) {
  const { competition, detail, teams, match } = parseTitle(t.event);
  const valid = t.status === "VALID";
  const stamp = STAMP[t.status];
  const [stadium, ...city] = t.venue.split(",");
  const field = (label: string, value: string, wide = false) => (
    <div className={`min-w-0 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</dt>
      <dd className="font-heading text-base leading-tight font-bold break-words text-gray-900">{value}</dd>
    </div>
  );

  return (
    <article aria-label={`Billet ${t.number} — ${t.event}`} className="@container print-only w-full max-w-3xl text-black">
      <div className="relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10 @xl:flex-row">
        {/* Partie principale */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 bg-[#0b1f17] px-4 py-3 text-white">
            <BrandLogo size={34} decorative />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-heading text-sm font-bold tracking-wider">FECOFOOT</p>
              <p className="truncate text-[0.6rem] uppercase tracking-[0.18em] text-white/70">Fédération Congolaise de Football</p>
            </div>
            <p className="rounded border border-white/30 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em]">Billet d&apos;entrée</p>
          </header>
          <div aria-hidden className="flex h-1.5">
            <span className="flex-1 bg-[#009543]" />
            <span className="flex-1 bg-[#fbde4a]" />
            <span className="flex-1 bg-[#dc241f]" />
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 @xl:p-5">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#009543]">
                {competition ?? (t.kind ? EVENT_KIND_LABELS[t.kind] : "Rencontre")}
                {detail && ` · ${detail}`}
              </p>
              {teams ? (
                <p className="mt-1 flex flex-wrap items-baseline gap-x-3 font-heading text-3xl leading-none font-bold uppercase @xl:text-4xl">
                  <span>{teams[0]}</span>
                  <span className="text-base font-semibold text-gray-400">vs</span>
                  <span>{teams[1]}</span>
                </p>
              ) : (
                <p className="mt-1 font-heading text-2xl leading-tight font-bold uppercase">{match}</p>
              )}
            </div>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-y border-dashed border-gray-300 py-3">
              <p className="row-span-2 self-center font-heading text-4xl leading-none font-bold tabular-nums">{timeFmt.format(t.kickoffAt)}</p>
              <p className="text-sm font-semibold first-letter:uppercase">{dayFmt.format(t.kickoffAt)}</p>
              <p className="text-sm text-gray-600">
                {stadium}
                {city.length > 0 && <span className="text-gray-500"> · {city.join(",").trim()}</span>}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-2 @md:grid-cols-4">
              {field("Porte", t.gate)}
              {field("Tribune", t.category)}
              {field("Prix", t.price === 0 ? "Invitation" : formatFcfa(t.price))}
              {field("N° de billet", t.number)}
              {field("Titulaire", t.holderName, true)}
              {t.orderRef && field("Commande", t.orderRef, true)}
            </dl>

            <p className="text-[0.62rem] leading-snug text-gray-500">
              Billet nominatif et personnel : une pièce d&apos;identité au nom du titulaire peut être demandée à l&apos;entrée. Le QR code n&apos;est valable que
              pour une seule entrée ; toute copie est inutile. Le billet n&apos;est ni repris ni échangé, sauf annulation de la rencontre.
            </p>
          </div>
        </div>

        {/* Perforation : pointillés et encoches, verticale (talon à droite) ou horizontale (talon dessous). */}
        <div aria-hidden className="relative border-t-2 border-dashed border-gray-300 @xl:border-t-0 @xl:border-l-2">
          <span className="absolute -top-3 -left-3 size-6 rounded-full bg-background" />
          <span className="absolute -top-3 -right-3 size-6 rounded-full bg-background @xl:top-auto @xl:right-auto @xl:-bottom-3 @xl:-left-3" />
        </div>

        {/* Talon : contrôle d'accès */}
        <aside className="flex flex-col items-center justify-center gap-2 bg-gray-50 p-4 text-center @xl:w-52">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gray-500">Contrôle d&apos;accès</p>
          {valid ? (
            <div className="size-36 rounded-lg bg-white p-2 ring-1 ring-gray-200 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="grid size-36 place-items-center rounded-lg border-2 border-dashed border-gray-300 p-3 text-xs text-gray-500">
              {t.status === "RESERVED" ? "QR code disponible après paiement" : "QR code désactivé"}
            </div>
          )}
          <p className="font-mono text-sm font-bold tracking-wider">{t.number}</p>
          <p className="text-[0.65rem] text-gray-500">
            Porte <strong className="text-gray-800">{t.gate}</strong> · {t.category}
          </p>
          <p className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${valid ? "bg-[#009543]/10 text-[#00753a]" : "bg-red-50 text-red-700"}`}>
            {valid ? "Valide" : (stamp ?? t.status)}
          </p>
        </aside>

        {stamp && (
          <p aria-hidden className="pointer-events-none absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-4 border-red-600/70 px-4 py-1 font-heading text-3xl font-bold uppercase tracking-widest text-red-600/70">
            {stamp}
          </p>
        )}
      </div>
    </article>
  );
}
